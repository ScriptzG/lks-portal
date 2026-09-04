import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const extrasRouter = Router();
extrasRouter.use(requireAuth);

// Admin sees every extra (so it can toggle visibility); a client only ever sees the ones
// currently marked visible.
extrasRouter.get("/", async (req, res) => {
  const extras = await prisma.extra.findMany({
    where: req.user!.role === "admin" ? {} : { visibleToClients: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(extras);
});

const extraSchema = z.object({
  title: z.string().min(1).max(120),
  url: z.string().min(1).max(2000),
  description: z.string().max(500).optional(),
  icon: z.string().max(8).optional(),
  visibleToClients: z.boolean().optional(),
});

extrasRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = extraSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const count = await prisma.extra.count();
  const extra = await prisma.extra.create({ data: { ...parsed.data, sortOrder: count } });
  res.status(201).json(extra);
});

extrasRouter.patch("/:id", requireRole("admin"), async (req, res) => {
  const parsed = extraSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const extra = await prisma.extra.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(extra);
});

extrasRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  await prisma.extra.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
