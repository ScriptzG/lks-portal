import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireWebsiteAccess } from "../middleware/websiteAccess.js";
import { notifyAllAdmins, sendEmail } from "../lib/notify.js";
import { sanitizeRichText } from "../lib/sanitizeRichText.js";
import { persistFieldsToFiles } from "../lib/persistFieldsToFiles.js";

export const editableFieldsRouter = Router({ mergeParams: true });
editableFieldsRouter.use(requireAuth);

editableFieldsRouter.get("/", requireWebsiteAccess, async (req, res) => {
  const fields = await prisma.editableField.findMany({
    where: { websiteId: req.params.id },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
  });
  res.json(fields);
});

const saveDraftSchema = z.object({
  fields: z.array(z.object({ id: z.string().uuid(), draftValue: z.string() })),
});

editableFieldsRouter.post("/draft", requireWebsiteAccess, async (req, res) => {
  if (req.website!.editLocked && req.user!.role === "client") {
    return res.status(403).json({ error: "Editing is currently locked by LKS Systems." });
  }
  const parsed = saveDraftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Only text/textarea values may carry rich-text formatting tags from the visual editor's
  // toolbar — image/color/link values are plain strings (a file path, hex color, or URL) and
  // must pass through untouched, since running them through an HTML sanitizer would corrupt
  // characters like `&` in a query string.
  const fieldRecords = await prisma.editableField.findMany({
    where: { id: { in: parsed.data.fields.map((f) => f.id) }, websiteId: req.params.id },
    select: { id: true, fieldType: true, sourceFile: true },
  });
  const recordById = new Map(fieldRecords.map((f) => [f.id, f]));

  await Promise.all(
    parsed.data.fields.map((f) => {
      const fieldType = recordById.get(f.id)?.fieldType;
      const value =
        fieldType === "text" || fieldType === "textarea" ? sanitizeRichText(f.draftValue) : f.draftValue;
      return prisma.editableField.update({
        where: { id: f.id, websiteId: req.params.id },
        data: { draftValue: value },
      });
    }),
  );

  // Bake the saved value(s) straight into the page's own stored HTML too, not just this table —
  // see persistFieldsToFiles for why that's safe to do unconditionally on every save.
  const touchedFiles = fieldRecords.map((f) => f.sourceFile).filter((f): f is string => !!f);
  await persistFieldsToFiles(req.params.id, touchedFiles);

  res.json({ ok: true });
});

editableFieldsRouter.post("/request-publish", requireWebsiteAccess, async (req, res) => {
  if (req.website!.editLocked && req.user!.role === "client") {
    return res.status(403).json({ error: "Editing is currently locked by LKS Systems." });
  }

  await prisma.website.update({ where: { id: req.params.id }, data: { status: "pending_review" } });

  const website = await prisma.website.findUnique({ where: { id: req.params.id }, include: { company: true } });
  await notifyAllAdmins({
    type: "publish_requested",
    message: `${website?.company.name ?? "A client"} requested publish for "${website?.name}".`,
    link: `/admin/websites/${req.params.id}/deploy`,
  });
  await sendEmail({
    to: "admin@lks.systems",
    subject: `Publish requested: ${website?.name}`,
    body: `${website?.company.name} has requested their edits to "${website?.name}" be reviewed and published.`,
  });

  res.json({ ok: true });
});
