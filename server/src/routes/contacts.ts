import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const contactsRouter = Router();
contactsRouter.use(requireAuth, requireRole("admin"));

const contactSchema = z.object({
  companyId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

contactsRouter.get("/", async (req, res) => {
  const { companyId } = req.query as Record<string, string | undefined>;
  const contacts = await prisma.contact.findMany({
    where: companyId ? { companyId } : {},
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(contacts);
});

contactsRouter.post("/", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.isPrimary) {
    await prisma.contact.updateMany({
      where: { companyId: parsed.data.companyId },
      data: { isPrimary: false },
    });
  }
  const contact = await prisma.contact.create({ data: parsed.data });
  res.status(201).json(contact);
});

contactsRouter.patch("/:id", async (req, res) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.isPrimary) {
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (existing) {
      await prisma.contact.updateMany({
        where: { companyId: existing.companyId, id: { not: existing.id } },
        data: { isPrimary: false },
      });
    }
  }
  const contact = await prisma.contact.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(contact);
});

contactsRouter.delete("/:id", async (req, res) => {
  await prisma.contact.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
