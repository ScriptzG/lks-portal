import { prisma } from "./prisma.js";
import { emailService } from "../services/email/MockEmailService.js";
import type { NotificationType } from "./types.js";

export async function notifyUser(params: {
  userId: string;
  type: NotificationType;
  message: string;
  link?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      message: params.message,
      link: params.link,
    },
  });
}

export async function notifyAllAdmins(params: { type: NotificationType; message: string; link?: string }) {
  const admins = await prisma.user.findMany({ where: { role: "admin" } });
  await Promise.all(admins.map((admin) => notifyUser({ userId: admin.id, ...params })));
}

export async function sendEmail(params: { to: string; subject: string; body: string }) {
  await emailService.send(params);
}
