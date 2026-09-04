import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { storageService } from "../services/storage/LocalDiskStorage.js";

export const companiesRouter = Router();
companiesRouter.use(requireAuth, requireRole("admin"));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

companiesRouter.get("/", async (req, res) => {
  const { search, status, planId } = req.query as Record<string, string | undefined>;
  const companies = await prisma.company.findMany({
    where: {
      AND: [
        // Note: SQLite's `contains` is case-sensitive (no `mode: "insensitive"` support).
        // This becomes a case-insensitive search automatically once swapped to Postgres.
        search
          ? {
              OR: [{ name: { contains: search } }, { domain: { contains: search } }],
            }
          : {},
        status ? { status: status as never } : {},
        planId ? { planId } : {},
      ],
    },
    include: {
      plan: true,
      _count: { select: { contacts: true, websites: true } },
      // Latest subscription only, so the client can show real billing status (trialing/active/
      // past_due/cancelled) — distinct from the company's own CRM status (active/inactive/prospect).
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(companies);
});

companiesRouter.get("/stats", async (_req, res) => {
  const [total, active, subscriptions] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: "active" } }),
    prisma.subscription.findMany({ where: { status: "active" }, include: { plan: true } }),
  ]);
  const mrr = subscriptions.reduce((sum, s) => sum + Number(s.plan.priceMonthly), 0);
  res.json({ totalClients: total, activeClients: active, activeSubscriptions: subscriptions.length, mrr });
});

companiesRouter.get("/:id", async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.id },
    include: {
      plan: true,
      contacts: true,
      websites: true,
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!company) return res.status(404).json({ error: "Company not found" });
  res.json(company);
});

const companySchema = z.object({
  name: z.string().min(1),
  // Accepts either a relative /storage/... path (from the logo upload endpoint below) or a
  // full external URL — not restricted to url() since our own uploads are relative paths.
  logoUrl: z.string().optional().or(z.literal("")),
  industry: z.string().optional(),
  domain: z.string().optional(),
  status: z.enum(["active", "inactive", "prospect"]).optional(),
  planId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

companiesRouter.post("/", async (req, res) => {
  const parsed = companySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const company = await prisma.company.create({ data: parsed.data });
  res.status(201).json(company);
});

companiesRouter.patch("/:id", async (req, res) => {
  const parsed = companySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const company = await prisma.company.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(company);
});

companiesRouter.post("/:id/logo", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  if (!req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Only image uploads are allowed" });

  const ext = path.extname(req.file.originalname) || ".png";
  const relativePath = `companies/${req.params.id}/logo${ext}`;
  await storageService.save(relativePath, req.file.buffer);

  const logoUrl = `/storage/${relativePath}?t=${Date.now()}`;
  const company = await prisma.company.update({ where: { id: req.params.id }, data: { logoUrl } });
  res.status(201).json(company);
});

companiesRouter.delete("/:id", async (req, res) => {
  await prisma.company.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
