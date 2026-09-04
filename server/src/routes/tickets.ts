import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notifyUser, notifyAllAdmins, sendEmail } from "../lib/notify.js";

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

function hasCompanyAccess(req: Request, companyId: string): boolean {
  if (req.user!.role === "admin") return true;
  return req.user!.companyId === companyId;
}

const ticketInclude = {
  createdBy: { select: { id: true, email: true, role: true } },
  company: { select: { id: true, name: true } },
} as const;

// Admin-only global inbox across every company, newest activity first.
ticketsRouter.get("/", requireRole("admin"), async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const tickets = await prisma.ticket.findMany({
    where: status ? { status } : {},
    include: ticketInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json(tickets);
});

ticketsRouter.get("/company/:companyId", async (req, res) => {
  if (!hasCompanyAccess(req, req.params.companyId)) return res.status(403).json({ error: "Forbidden" });
  const tickets = await prisma.ticket.findMany({
    where: { companyId: req.params.companyId },
    include: ticketInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json(tickets);
});

ticketsRouter.get("/:id", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      ...ticketInclude,
      replies: { include: { sender: { select: { id: true, email: true, role: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (!hasCompanyAccess(req, ticket.companyId)) return res.status(403).json({ error: "Forbidden" });
  res.json(ticket);
});

const createSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
  priority: z.enum(["normal", "urgent"]).default("normal"),
});

ticketsRouter.post("/company/:companyId", async (req, res) => {
  const companyId = req.params.companyId;
  if (!hasCompanyAccess(req, companyId)) return res.status(403).json({ error: "Forbidden" });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const ticket = await prisma.ticket.create({
    data: { companyId, createdById: req.user!.id, ...parsed.data },
    include: ticketInclude,
  });

  await notifyAllAdmins({
    type: "ticket_created",
    message: `${company.name} opened a ticket: "${parsed.data.subject}"`,
    link: `/admin/companies/${companyId}?tab=tickets`,
  });
  await sendEmail({
    to: "admin@lks.systems",
    subject: `New ticket — ${parsed.data.subject}`,
    body: `${company.name} (${req.user!.email}):\n\n${parsed.data.message}`,
  });

  res.status(201).json(ticket);
});

const replySchema = z.object({ message: z.string().min(1).max(4000) });

ticketsRouter.post("/:id/replies", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { company: true } });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (!hasCompanyAccess(req, ticket.companyId)) return res.status(403).json({ error: "Forbidden" });

  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Reply can't be empty" });

  const isAdmin = req.user!.role === "admin";

  const reply = await prisma.ticketReply.create({
    data: { ticketId: ticket.id, senderId: req.user!.id, senderRole: req.user!.role, message: parsed.data.message },
    include: { sender: { select: { id: true, email: true, role: true } } },
  });

  // An admin reply marks the ticket answered; a client reply reopens an answered ticket (a
  // closed one stays closed until explicitly reopened) — same behavior as the ticket system
  // already live on the LKS Systems site, which this feature reimplements on this app's stack.
  const nextStatus = isAdmin ? "answered" : ticket.status === "answered" ? "open" : ticket.status;
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: nextStatus, updatedAt: new Date() } });

  if (isAdmin) {
    const clientUsers = await prisma.user.findMany({ where: { companyId: ticket.companyId, role: "client" } });
    for (const clientUser of clientUsers) {
      await notifyUser({
        userId: clientUser.id,
        type: "ticket_reply",
        message: `LKS Systems replied to your ticket "${ticket.subject}".`,
        link: `/portal/tickets`,
      });
    }
    const contact = await prisma.contact.findFirst({ where: { companyId: ticket.companyId, isPrimary: true } });
    const recipientEmail = contact?.email ?? clientUsers[0]?.email;
    if (recipientEmail) {
      await sendEmail({ to: recipientEmail, subject: `Re: ${ticket.subject}`, body: parsed.data.message });
    }
  } else {
    await notifyAllAdmins({
      type: "ticket_reply",
      message: `${ticket.company.name} replied to "${ticket.subject}".`,
      link: `/admin/companies/${ticket.companyId}?tab=tickets`,
    });
    await sendEmail({
      to: "admin@lks.systems",
      subject: `Re: ${ticket.subject}`,
      body: `${ticket.company.name} (${req.user!.email}):\n\n${parsed.data.message}`,
    });
  }

  res.status(201).json(reply);
});

const statusSchema = z.object({ status: z.enum(["open", "answered", "closed"]) });

ticketsRouter.patch("/:id/status", requireRole("admin"), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });

  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
    include: ticketInclude,
  });
  res.json(ticket);
});
