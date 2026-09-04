import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { storageService } from "../services/storage/LocalDiskStorage.js";
import { env } from "../lib/env.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const settingsRouter = Router();

// Public — no auth. Deliberately registered before the requireAuth/requireRole gate below so
// both the (unauthenticated) login page and any logged-in client can render LKS Systems' own
// configured branding. Only exposes the two cosmetic fields — never API keys or anything else
// from the settings table.
settingsRouter.get("/branding", async (_req, res) => {
  const rows = await prisma.setting.findMany({ where: { key: { in: ["brandLogoUrl", "brandPrimaryColor"] } } });
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ brandLogoUrl: values.brandLogoUrl ?? null, brandPrimaryColor: values.brandPrimaryColor ?? null });
});

settingsRouter.use(requireAuth, requireRole("admin"));

const SETTING_KEYS = [
  "brandLogoUrl",
  "brandPrimaryColor",
  "netlifyApiToken",
  "stripeSecretKey",
  "smtpHost",
  "smtpUser",
  "smtpPassword",
  "autoSuspendOnOverdue",
  "defaultSelfPublish",
] as const;

settingsRouter.get("/", async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ mockServicesActive: env.mockServices, values });
});

const settingsSchema = z.record(z.string());

settingsRouter.put("/", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const entries = Object.entries(parsed.data).filter(([key]) => (SETTING_KEYS as readonly string[]).includes(key));
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
  res.json({ ok: true });
});

settingsRouter.post("/branding/logo", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  if (!req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Only image uploads are allowed" });

  const ext = path.extname(req.file.originalname) || ".png";
  const relativePath = `branding/logo${ext}`;
  await storageService.save(relativePath, req.file.buffer);

  const brandLogoUrl = `/storage/${relativePath}?t=${Date.now()}`;
  await prisma.setting.upsert({
    where: { key: "brandLogoUrl" },
    update: { value: brandLogoUrl },
    create: { key: "brandLogoUrl", value: brandLogoUrl },
  });
  res.status(201).json({ brandLogoUrl });
});

settingsRouter.get("/sent-emails", async (_req, res) => {
  const emails = await prisma.sentEmail.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  res.json(emails);
});
