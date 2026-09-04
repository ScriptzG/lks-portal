import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/admin", requireRole("admin"), async (_req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalClients, activeSites, deploymentsThisMonth, activeSubs, pendingApprovals, recentDeployments, recentNotifications] =
    await Promise.all([
      prisma.company.count(),
      prisma.website.count({ where: { status: "live" } }),
      prisma.deployment.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.subscription.findMany({ where: { status: "active" }, include: { plan: true } }),
      prisma.website.findMany({ where: { status: "pending_review" }, include: { company: true } }),
      prisma.deployment.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { website: { include: { company: true } }, triggeredBy: { select: { id: true, email: true } } },
      }),
      prisma.notification.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
    ]);

  const mrr = activeSubs.reduce((sum, s) => sum + Number(s.plan.priceMonthly), 0);

  res.json({
    totalClients,
    activeSites,
    deploymentsThisMonth,
    mrr,
    pendingApprovals,
    recentDeployments,
    recentNotifications,
  });
});

dashboardRouter.get("/client", requireRole("client"), async (req, res) => {
  const companyId = req.user!.companyId;
  if (!companyId) return res.status(400).json({ error: "No company linked to this account" });

  const [company, websites, notifications] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, include: { plan: true } }),
    prisma.website.findMany({
      where: { companyId },
      include: {
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { triggeredBy: { select: { id: true, email: true } } },
        },
      },
    }),
    prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  res.json({ company, websites, notifications });
});
