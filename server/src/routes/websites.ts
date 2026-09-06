import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import mime from "mime-types";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import * as cheerio from "cheerio";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireWebsiteAccess } from "../middleware/websiteAccess.js";
import { storageService } from "../services/storage/index.js";
import { parseEditableFields } from "../lib/editableFieldsParser.js";
import { autoAnnotateHtml } from "../lib/autoAnnotateHtml.js";
import { compileHtml } from "../lib/compileSite.js";
import { buildEditorInjection } from "../lib/injectEditorScript.js";
import { env } from "../lib/env.js";

export const websitesRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function filesDir(websiteId: string) {
  return `websites/${websiteId}/files`;
}

// --- Public site view: no login required. A "live" website is, by definition, meant to be
// publicly viewable — this only ever compiles from each field's published `currentValue`, never
// `draftValue`, and never injects the click-to-edit script, so nothing unpublished or interactive
// is ever exposed here. Registered BEFORE the `requireAuth` gate below, which only applies to
// routes registered after it — every other route on this router still requires a login.
async function servePublicSite(req: import("express").Request, res: import("express").Response) {
  const websiteId = req.params.id;
  const page = (req.params as unknown as Record<string, string>)[0];
  const requestedFile = page ? `${page}.html` : undefined;

  const entryFileRecord = requestedFile
    ? await prisma.websiteFile.findUnique({ where: { websiteId_filePath: { websiteId, filePath: requestedFile } } })
    : await prisma.websiteFile.findFirst({
        where: { websiteId, filePath: { endsWith: "index.html" } },
        orderBy: { filePath: "asc" },
      });

  const entryFile = entryFileRecord?.filePath;
  if (!entryFile) return res.status(404).send("Page not found.");

  let rawHtml: string;
  try {
    rawHtml = (await storageService.read(`${filesDir(websiteId)}/${entryFile}`)).toString("utf-8");
  } catch {
    return res.status(404).send("Not found.");
  }

  const fields = await prisma.editableField.findMany({ where: { websiteId, sourceFile: entryFile } });
  const fieldValues = fields.map((f) => ({ fieldKey: f.fieldKey, fieldType: f.fieldType, value: f.currentValue ?? "" }));
  const compiled = compileHtml(rawHtml, fieldValues);

  // The site's own markup uses root-relative links (e.g. href="/about") meant for a clean-URL
  // static host of its own — rewritten here so they stay inside this public, per-website route
  // instead of hitting the bare API server root. "/login" is a special case: that's meant to
  // reach the real client portal, not another page of this site — and since this page is itself
  // shown inside an iframe on the portal's own homepage (client/src/routes/MarketingHome.tsx),
  // that link needs target="_top" or clicking it just navigates the iframe in place, nesting the
  // whole React app one level deep inside itself instead of actually taking the visitor to login.
  const $ = cheerio.load(compiled);
  const sitePrefix = `/api/websites/${websiteId}/site`;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || /^https?:\/\//i.test(href) || href.startsWith("//") || href.startsWith("#")) return;
    if (href === "/login") {
      $(el).attr("href", `${env.clientOrigin}/login`);
      $(el).attr("target", "_top");
      return;
    }
    if (href.startsWith("/")) {
      const cleanPath = href.slice(1);
      $(el).attr("href", cleanPath ? `${sitePrefix}/${cleanPath}` : sitePrefix);
    }
  });

  const basePath = path.posix.dirname(entryFile);
  const baseHref = `/storage/${filesDir(websiteId)}/${basePath === "." ? "" : basePath + "/"}`;
  const withBase = $.html().includes("<head>")
    ? $.html().replace("<head>", `<head><base href="${baseHref}">`)
    : `<base href="${baseHref}">${$.html()}`;

  res.set("Content-Type", "text/html");
  res.send(withBase);
}

websitesRouter.get("/:id/site", servePublicSite);
websitesRouter.get("/:id/site/*", servePublicSite);

websitesRouter.use(requireAuth);

websitesRouter.get("/", async (req, res) => {
  const { companyId } = req.query as Record<string, string | undefined>;
  const where =
    req.user!.role === "client"
      ? { companyId: req.user!.companyId ?? "__none__" }
      : companyId
      ? { companyId }
      : {};
  const websites = await prisma.website.findMany({
    where,
    include: { company: true, _count: { select: { deployments: true, editableFields: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(websites);
});

const websiteSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  domainUrl: z.string().optional(),
  netlifySiteId: z.string().optional(),
  allowSelfPublish: z.boolean().optional(),
  filesLocked: z.boolean().optional(),
});

websitesRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = websiteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const website = await prisma.website.create({ data: parsed.data });
  res.status(201).json(website);
});

websitesRouter.get("/:id", requireWebsiteAccess, async (req, res) => {
  const website = await prisma.website.findUnique({
    where: { id: req.params.id },
    include: {
      company: true,
      deployments: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { files: true, editableFields: true } },
    },
  });
  res.json(website);
});

websitesRouter.patch("/:id", requireRole("admin"), requireWebsiteAccess, async (req, res) => {
  const parsed = websiteSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const website = await prisma.website.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(website);
});

websitesRouter.post("/:id/lock", requireRole("admin"), requireWebsiteAccess, async (req, res) => {
  const website = await prisma.website.update({
    where: { id: req.params.id },
    data: { editLocked: req.body.locked !== false },
  });
  res.json(website);
});

websitesRouter.delete("/:id", requireRole("admin"), requireWebsiteAccess, async (req, res) => {
  await storageService.deleteDir(filesDir(req.params.id));
  await prisma.website.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// --- Upload a ZIP of the built site; extracts it, stores files, and parses editable fields ---
websitesRouter.post(
  "/:id/upload",
  requireRole("admin"),
  requireWebsiteAccess,
  upload.single("zip"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No zip file provided" });

    const websiteId = req.params.id;
    let zip: AdmZip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch {
      return res.status(400).json({ error: "Uploaded file is not a valid zip" });
    }

    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    if (entries.length === 0) return res.status(400).json({ error: "Zip file is empty" });

    const parsedFields: ReturnType<typeof parseEditableFields> = [];

    for (const entry of entries) {
      // ZIP entry names are always forward-slash-separated per spec, but some Windows zip
      // tools (e.g. PowerShell's Compress-Archive) write backslashes for nested folders anyway.
      // Normalize here so stored filePath values always match what the site's own HTML
      // references (e.g. src="images/photo.jpg") — a mismatch wouldn't break static file
      // serving (Windows resolves either separator on disk) but would break any exact-string
      // filePath lookup, like the preview route's file-ownership check or the media library.
      const relPath = entry.entryName.replace(/\\/g, "/").replace(/^\/+/, "");
      let contents = entry.getData();

      // Auto-tag every text element and <img> that isn't already `data-lks-editable` so clients
      // can click-to-edit the whole page, not just whatever an admin hand-annotated — see
      // autoAnnotateHtml.ts for the full rationale. Fully idempotent, so re-uploading a site an
      // admin has already hand-tagged never touches those existing fields.
      if (/\.html?$/i.test(relPath)) {
        contents = Buffer.from(autoAnnotateHtml(contents.toString("utf-8"), relPath), "utf-8");
      }

      const storageUrl = await storageService.save(`${filesDir(websiteId)}/${relPath}`, contents);

      await prisma.websiteFile.upsert({
        where: { websiteId_filePath: { websiteId, filePath: relPath } },
        update: { storageUrl, mimeType: mime.lookup(relPath) || null, sizeBytes: contents.length },
        create: {
          websiteId,
          filePath: relPath,
          storageUrl,
          mimeType: mime.lookup(relPath) || null,
          sizeBytes: contents.length,
        },
      });

      if (/\.html?$/i.test(relPath)) {
        parsedFields.push(...parseEditableFields(contents.toString("utf-8"), relPath));
      }
    }

    for (const [index, field] of parsedFields.entries()) {
      await prisma.editableField.upsert({
        where: { websiteId_fieldKey: { websiteId, fieldKey: field.fieldKey } },
        update: {
          fieldType: field.fieldType,
          label: field.label,
          section: field.section,
          sourceFile: field.sourceFile,
        },
        create: {
          websiteId,
          fieldKey: field.fieldKey,
          fieldType: field.fieldType,
          label: field.label,
          section: field.section,
          sourceFile: field.sourceFile,
          currentValue: field.currentValue,
          sortOrder: index,
        },
      });
    }

    const website = await prisma.website.update({
      where: { id: websiteId },
      data: { status: "draft" },
    });

    res.status(201).json({ website, filesUploaded: entries.length, fieldsFound: parsedFields.length });
  },
);

// Blocks raw HTML/CSS/JS access when a website's filesLocked flag is set — a safety guardrail
// against an accidental raw-markup edit, not a permission check (the visual click-to-edit editor
// is a completely separate code path and keeps working regardless of this flag).
function blockIfFilesLocked(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (req.website!.filesLocked) {
    return res.status(423).json({ error: "This site's code files are locked. Use the Preview tab's click-to-edit editor instead, or unlock them in Settings." });
  }
  next();
}

websitesRouter.get("/:id/files", requireWebsiteAccess, requireRole("admin"), blockIfFilesLocked, async (req, res) => {
  const files = await prisma.websiteFile.findMany({
    where: { websiteId: req.params.id },
    orderBy: { filePath: "asc" },
  });
  res.json(files);
});

websitesRouter.get("/:id/files/*", requireWebsiteAccess, requireRole("admin"), blockIfFilesLocked, async (req, res) => {
  const filePath = (req.params as unknown as Record<string, string>)[0];
  const file = await prisma.websiteFile.findUnique({
    where: { websiteId_filePath: { websiteId: req.params.id, filePath } },
  });
  if (!file) return res.status(404).json({ error: "File not found" });

  const isText = /\.(html?|css|js|json|txt|md|svg)$/i.test(filePath);
  const contents = await storageService.read(`${filesDir(req.params.id)}/${filePath}`);
  res.json({
    filePath,
    mimeType: file.mimeType,
    content: isText ? contents.toString("utf-8") : contents.toString("base64"),
    encoding: isText ? "utf-8" : "base64",
  });
});

websitesRouter.put("/:id/files/*", requireRole("admin"), requireWebsiteAccess, blockIfFilesLocked, async (req, res) => {
  const websiteId = req.params.id;
  const filePath = (req.params as unknown as Record<string, string>)[0];
  let { content } = req.body as { content?: string };
  if (typeof content !== "string") return res.status(400).json({ error: "Missing content" });

  // Same auto-tagging pass as zip upload, so new markup typed straight into the raw editor
  // becomes click-to-edit immediately too, without a manual data-lks-editable tag.
  if (/\.html?$/i.test(filePath)) {
    content = autoAnnotateHtml(content, filePath);
  }

  const buffer = Buffer.from(content, "utf-8");
  const storageUrl = await storageService.save(`${filesDir(websiteId)}/${filePath}`, buffer);

  const file = await prisma.websiteFile.upsert({
    where: { websiteId_filePath: { websiteId, filePath } },
    update: { storageUrl, sizeBytes: buffer.length },
    create: { websiteId, filePath, storageUrl, sizeBytes: buffer.length },
  });

  // Re-parse for data-lks-editable elements so a raw-code edit that adds/relabels a field is
  // picked up immediately, matching what already happens on zip upload — without this, editing
  // HTML directly in the Monaco editor would silently never surface new editable fields until
  // the next full zip re-upload.
  if (/\.html?$/i.test(filePath)) {
    const parsedFields = parseEditableFields(content, filePath);
    const existingCount = await prisma.editableField.count({ where: { websiteId } });
    for (const [index, field] of parsedFields.entries()) {
      await prisma.editableField.upsert({
        where: { websiteId_fieldKey: { websiteId, fieldKey: field.fieldKey } },
        update: { fieldType: field.fieldType, label: field.label, section: field.section, sourceFile: field.sourceFile },
        create: {
          websiteId,
          fieldKey: field.fieldKey,
          fieldType: field.fieldType,
          label: field.label,
          section: field.section,
          sourceFile: field.sourceFile,
          currentValue: field.currentValue,
          sortOrder: existingCount + index,
        },
      });
    }
  }

  res.json(file);
});

websitesRouter.delete("/:id/files/*", requireRole("admin"), requireWebsiteAccess, blockIfFilesLocked, async (req, res) => {
  const websiteId = req.params.id;
  const filePath = (req.params as unknown as Record<string, string>)[0];

  const file = await prisma.websiteFile.findUnique({ where: { websiteId_filePath: { websiteId, filePath } } });
  if (!file) return res.status(404).json({ error: "File not found" });

  // Any editable fields whose content lived in this file would otherwise dangle, pointing at a
  // sourceFile that no longer exists — remove them too rather than leaving orphaned rows the
  // client editor could still try to render.
  await prisma.editableField.deleteMany({ where: { websiteId, sourceFile: filePath } });
  await storageService.delete(`${filesDir(websiteId)}/${filePath}`);
  await prisma.websiteFile.delete({ where: { id: file.id } });

  res.status(204).end();
});

// --- Live preview: compiles the current draft/live field values back into an HTML file ---
websitesRouter.get("/:id/preview", requireWebsiteAccess, async (req, res) => {
  const websiteId = req.params.id;
  const mode = req.query.mode === "live" ? "live" : "draft";
  const interactive = req.query.edit === "1";
  const requestedFile = typeof req.query.file === "string" ? req.query.file : null;

  // Only ever read a file that is actually a registered WebsiteFile row for THIS website —
  // never trust the raw query string for a filesystem path (cross-tenant path traversal guard).
  const entryFileRecord = requestedFile
    ? await prisma.websiteFile.findUnique({ where: { websiteId_filePath: { websiteId, filePath: requestedFile } } })
    : await prisma.websiteFile.findFirst({
        where: { websiteId, filePath: { endsWith: "index.html" } },
        orderBy: { filePath: "asc" },
      });

  const entryFile = entryFileRecord?.filePath;
  if (!entryFile) return res.status(404).send("No index.html found for this website yet.");

  let rawHtml: string;
  try {
    rawHtml = (await storageService.read(`${filesDir(websiteId)}/${entryFile}`)).toString("utf-8");
  } catch {
    return res.status(404).send("File not found.");
  }

  const fields = await prisma.editableField.findMany({ where: { websiteId, sourceFile: entryFile } });
  const fieldValues = fields.map((f) => ({
    fieldKey: f.fieldKey,
    fieldType: f.fieldType,
    value: (mode === "draft" ? f.draftValue ?? f.currentValue : f.currentValue) ?? "",
  }));

  let compiled = compileHtml(rawHtml, fieldValues);
  const basePath = path.posix.dirname(entryFile);
  const baseHref = `/storage/${filesDir(websiteId)}/${basePath === "." ? "" : basePath + "/"}`;

  if (interactive) {
    const injection = buildEditorInjection(
      fields.map((f) => ({ fieldKey: f.fieldKey, fieldType: f.fieldType, label: f.label })),
      websiteId,
    );
    compiled = compiled.includes("</body>") ? compiled.replace("</body>", `${injection}</body>`) : `${compiled}${injection}`;
  }

  const withBase = compiled.includes("<head>")
    ? compiled.replace("<head>", `<head><base href="${baseHref}">`)
    : `<base href="${baseHref}">${compiled}`;

  res.set("Content-Type", "text/html");
  res.send(withBase);
});

// --- List the site's HTML pages (for the client editor's page switcher) ---
websitesRouter.get("/:id/pages", requireWebsiteAccess, async (req, res) => {
  const pages = await prisma.websiteFile.findMany({
    where: { websiteId: req.params.id, filePath: { endsWith: ".html" } },
    orderBy: { filePath: "asc" },
    select: { filePath: true },
  });
  res.json(
    pages.map((p) => ({
      filePath: p.filePath,
      label: path.posix
        .basename(p.filePath, ".html")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()) || "Home",
    })),
  );
});

// --- Media library: every image already on this site, for the visual editor's "choose
// existing" picker (so clients aren't forced to re-upload a fresh file every time) ---
websitesRouter.get("/:id/assets", requireWebsiteAccess, async (req, res) => {
  const files = await prisma.websiteFile.findMany({
    where: { websiteId: req.params.id, mimeType: { startsWith: "image/" } },
    orderBy: { createdAt: "desc" },
    select: { filePath: true, createdAt: true },
  });
  res.json(
    files.map((f) => ({
      path: f.filePath,
      url: `/storage/${filesDir(req.params.id)}/${f.filePath}`,
      createdAt: f.createdAt,
    })),
  );
});

// --- Upload an image asset (used by image-type editable fields) ---
websitesRouter.post("/:id/assets", requireWebsiteAccess, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  if (!req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Only image uploads are allowed" });

  const ext = path.extname(req.file.originalname) || "";
  const fileName = `uploads/${randomUUID()}${ext}`;
  await storageService.save(`${filesDir(req.params.id)}/${fileName}`, req.file.buffer);

  // Without this, the file exists on disk and is servable, but has no WebsiteFile row — so it
  // silently never appears in the admin's Files tab or the media library picker above.
  await prisma.websiteFile.create({
    data: {
      websiteId: req.params.id,
      filePath: fileName,
      storageUrl: `/storage/${filesDir(req.params.id)}/${fileName}`,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    },
  });

  res.status(201).json({ path: fileName });
});
