import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { sendEmail } from "../lib/notify.js";
import { env } from "../lib/env.js";
import type { Role } from "../lib/types.js";

export const authRouter = Router();

const COOKIE_NAME = "lks_token";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.post("/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid credentials" });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  if (user.suspended) return res.status(403).json({ error: "Your account has been suspended. Contact LKS Systems." });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = signToken({ id: user.id, email: user.email, role: user.role as Role, companyId: user.companyId });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ id: user.id, email: user.email, role: user.role, companyId: user.companyId });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { company: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    company: user.company,
    tutorialSeenAt: user.tutorialSeenAt,
  });
});

// Marks the client onboarding tour as seen so it never shows again for this user — called once,
// when they dismiss it or finish it (see client/src/components/onboarding/ClientTour.tsx).
authRouter.post("/tutorial-seen", requireAuth, async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { tutorialSeenAt: new Date() } });
  res.json({ ok: true });
});

authRouter.post("/accept-invite", async (req, res) => {
  const schema = z.object({ token: z.string(), password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const invite = await prisma.invite.findUnique({ where: { token: parsed.data.token } });
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.acceptedAt) return res.status(400).json({ error: "Invite already used" });
  if (invite.expiresAt < new Date()) return res.status(400).json({ error: "Invite expired" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: invite.email.toLowerCase(),
      passwordHash,
      role: invite.role,
      companyId: invite.companyId,
    },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

  const token = signToken({ id: user.id, email: user.email, role: user.role as Role, companyId: user.companyId });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ id: user.id, email: user.email, role: user.role, companyId: user.companyId });
});

authRouter.get("/invite/:token", async (req, res) => {
  const invite = await prisma.invite.findUnique({
    where: { token: req.params.token },
    include: { company: true },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return res.status(404).json({ error: "Invite not found or expired" });
  }
  res.json({ email: invite.email, companyName: invite.company?.name ?? null });
});

authRouter.post("/request-password-reset", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Always respond ok, whether or not the user exists, to avoid leaking account existence.
  if (user) {
    const token = randomUUID();
    const resetInvite = await prisma.invite.create({
      data: {
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await sendEmail({
      to: user.email,
      subject: "Reset your LKS Systems Client Portal password",
      body: `Reset your password: ${env.clientOrigin}/reset-password/${resetInvite.token}`,
    });
  }
  res.json({ ok: true });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
});

authRouter.post("/reset-password", async (req, res) => {
  const schema = z.object({ token: z.string(), password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const invite = await prisma.invite.findUnique({ where: { token: parsed.data.token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return res.status(400).json({ error: "Reset link invalid or expired" });
  }
  const user = await prisma.user.findUnique({ where: { email: invite.email } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  res.json({ ok: true });
});
