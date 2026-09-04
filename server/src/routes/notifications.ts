import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyAllAdmins, sendEmail } from "../lib/notify.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const notification = await prisma.notification.update({
    where: { id: req.params.id, userId: req.user!.id },
    data: { read: true },
  });
  res.json(notification);
});

notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
  res.json({ ok: true });
});

notificationsRouter.post("/support-request", async (req, res) => {
  const schema = z.object({ message: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { company: true } });
  await notifyAllAdmins({
    type: "support_request",
    message: `${user?.company?.name ?? user?.email} needs support: "${parsed.data.message}"`,
  });
  await sendEmail({
    to: "admin@lks.systems",
    subject: `Support request from ${user?.company?.name ?? user?.email}`,
    body: parsed.data.message,
  });
  res.json({ ok: true });
});
