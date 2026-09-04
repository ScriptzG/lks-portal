import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sendEmail, notifyUser } from "../lib/notify.js";
import { env } from "../lib/env.js";

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAuth, requireRole("admin"));

// Every response below must exclude passwordHash — never spread a raw Prisma User record
// straight into res.json().
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  companyId: true,
  suspended: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

adminUsersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: "client" },
    select: { ...SAFE_USER_SELECT, company: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

adminUsersRouter.get("/invites", async (_req, res) => {
  const invites = await prisma.invite.findMany({
    where: { acceptedAt: null },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(invites);
});

const inviteSchema = z.object({
  email: z.string().email(),
  companyId: z.string().uuid(),
});

adminUsersRouter.post("/invite", async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: "A user with that email already exists" });

  const company = await prisma.company.findUnique({ where: { id: parsed.data.companyId } });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const token = randomUUID();
  const invite = await prisma.invite.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      role: "client",
      companyId: company.id,
      token,
      invitedById: req.user!.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const inviteLink = `${env.clientOrigin}/accept-invite/${token}`;
  await sendEmail({
    to: invite.email,
    subject: `You've been invited to the LKS Systems Client Portal`,
    body: `${company.name} has set up your access to the LKS Systems Client Portal.\n\nAccept your invite and set a password: ${inviteLink}\n\nThis link expires in 7 days.`,
  });

  res.status(201).json(invite);
});

adminUsersRouter.post("/:id/suspend", async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { suspended: true },
    select: SAFE_USER_SELECT,
  });
  res.json(user);
});

adminUsersRouter.post("/:id/reinstate", async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { suspended: false },
    select: SAFE_USER_SELECT,
  });
  res.json(user);
});

adminUsersRouter.post("/:id/notify-test", async (req, res) => {
  await notifyUser({ userId: req.params.id, type: "general", message: "Test notification from LKS admin." });
  res.json({ ok: true });
});
