import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyUser, notifyAllAdmins, sendEmail } from "../lib/notify.js";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

function hasCompanyAccess(req: Request, companyId: string): boolean {
  if (req.user!.role === "admin") return true;
  return req.user!.companyId === companyId;
}

// One thread per company. Admins can open/view any company's thread; a client can only see
// their own company's thread.
messagesRouter.get("/:companyId", async (req, res) => {
  if (!(hasCompanyAccess(req, req.params.companyId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const messages = await prisma.message.findMany({
    where: { companyId: req.params.companyId },
    include: { sender: { select: { id: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});

const sendSchema = z.object({ body: z.string().min(1).max(4000) });

messagesRouter.post("/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!(hasCompanyAccess(req, companyId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Message can't be empty" });

  const isAdmin = req.user!.role === "admin";

  // Only a manager (admin) account may start a new conversation — a client can only reply
  // inside a thread the LKS Systems team has already opened with them.
  if (!isAdmin) {
    const priorAdminMessage = await prisma.message.findFirst({ where: { companyId, senderRole: "admin" } });
    if (!priorAdminMessage) {
      return res.status(403).json({ error: "A member of the LKS Systems team needs to start this conversation first." });
    }
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { users: { where: { role: "client" } }, contacts: { where: { isPrimary: true }, take: 1 } },
  });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const message = await prisma.message.create({
    data: { companyId, senderId: req.user!.id, senderRole: req.user!.role, body: parsed.data.body },
    include: { sender: { select: { id: true, email: true, role: true } } },
  });

  if (isAdmin) {
    for (const clientUser of company.users) {
      await notifyUser({
        userId: clientUser.id,
        type: "message_received",
        message: `LKS Systems sent you a message.`,
        link: "/portal/messages",
      });
    }
    const recipientEmail = company.contacts[0]?.email ?? company.users[0]?.email;
    if (recipientEmail) {
      await sendEmail({
        to: recipientEmail,
        subject: `New message from LKS Systems`,
        body: parsed.data.body,
      });
    }
  } else {
    await notifyAllAdmins({
      type: "message_received",
      message: `${company.name} replied: "${parsed.data.body.slice(0, 80)}"`,
      link: `/admin/companies/${companyId}?tab=messages`,
    });
    await sendEmail({
      to: "admin@lks.systems",
      subject: `New message from ${company.name}`,
      body: parsed.data.body,
    });
  }

  res.status(201).json(message);
});

messagesRouter.post("/:companyId/read", async (req, res) => {
  const companyId = req.params.companyId;
  if (!(hasCompanyAccess(req, companyId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Mark the OTHER party's messages as read — an admin reading marks client messages read,
  // a client reading marks admin messages read.
  const opposingRole = req.user!.role === "admin" ? "client" : "admin";
  await prisma.message.updateMany({
    where: { companyId, senderRole: opposingRole, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});
