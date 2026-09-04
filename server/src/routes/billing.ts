import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { billingService } from "../services/billing/MockStripeService.js";
import { notifyUser, sendEmail } from "../lib/notify.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

function serializePlan(plan: { featuresJson: string; [key: string]: unknown }) {
  let features: string[] = [];
  try {
    features = JSON.parse(plan.featuresJson);
  } catch {
    features = [];
  }
  return { ...plan, featuresJson: features };
}

billingRouter.get("/plans", async (_req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  res.json(plans.map(serializePlan));
});

const planSchema = z.object({
  name: z.string().min(1),
  priceMonthly: z.number().nonnegative(),
  maxSites: z.number().int().positive(),
  canSelfPublish: z.boolean().optional(),
  featuresJson: z.array(z.string()).optional(),
});

billingRouter.post("/plans", requireRole("admin"), async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { featuresJson, ...rest } = parsed.data;
  const plan = await prisma.plan.create({ data: { ...rest, featuresJson: JSON.stringify(featuresJson ?? []) } });
  res.status(201).json(serializePlan(plan));
});

billingRouter.patch("/plans/:id", requireRole("admin"), async (req, res) => {
  const parsed = planSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { featuresJson, ...rest } = parsed.data;
  const plan = await prisma.plan.update({
    where: { id: req.params.id },
    data: { ...rest, ...(featuresJson ? { featuresJson: JSON.stringify(featuresJson) } : {}) },
  });
  res.json(serializePlan(plan));
});

billingRouter.get("/companies/:companyId", requireRole("admin"), async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { companyId: req.params.companyId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(subscriptions);
});

billingRouter.post("/companies/:companyId/subscribe", requireRole("admin"), async (req, res) => {
  const schema = z.object({ planId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const company = await prisma.company.findUnique({ where: { id: req.params.companyId } });
  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!company || !plan) return res.status(404).json({ error: "Company or plan not found" });

  let stripeCustomerId = company.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await billingService.createCustomer({ companyName: company.name, email: "billing@example.com" });
    stripeCustomerId = customer.customerId;
  }

  const sub = await billingService.createSubscription({
    customerId: stripeCustomerId,
    planPriceMonthly: Number(plan.priceMonthly),
  });

  const [subscription] = await prisma.$transaction([
    prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        stripeSubscriptionId: sub.subscriptionId,
        status: sub.status,
        nextBillingDate: sub.nextBillingDate,
      },
    }),
    prisma.company.update({
      where: { id: company.id },
      data: { planId: plan.id, stripeCustomerId, status: "active" },
    }),
  ]);

  res.status(201).json(subscription);
});

billingRouter.post("/companies/:companyId/mark-overdue", requireRole("admin"), async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.companyId },
    include: { users: true, websites: true, subscriptions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const latestSub = company.subscriptions[0];
  if (latestSub) {
    await prisma.subscription.update({ where: { id: latestSub.id }, data: { status: "past_due" } });
  }

  const autoSuspend = (await prisma.setting.findUnique({ where: { key: "autoSuspendOnOverdue" } }))?.value !== "false";
  if (autoSuspend) {
    await prisma.user.updateMany({ where: { companyId: company.id, role: "client" }, data: { suspended: true } });
    await prisma.website.updateMany({ where: { companyId: company.id }, data: { editLocked: true } });
  }

  for (const user of company.users) {
    await notifyUser({
      userId: user.id,
      type: "payment_overdue",
      message: `Payment overdue for ${company.name}. ${autoSuspend ? "Access has been suspended." : ""}`,
    });
    await sendEmail({
      to: user.email,
      subject: "Payment overdue - LKS Systems Client Portal",
      body: `Your subscription payment is overdue. ${
        autoSuspend ? "Your edit access has been suspended until payment is resolved." : "Please update your payment method to avoid service interruption."
      }`,
    });
  }

  res.json({ ok: true, autoSuspend });
});

billingRouter.post("/companies/:companyId/cancel", requireRole("admin"), async (req, res) => {
  const latestSub = await prisma.subscription.findFirst({
    where: { companyId: req.params.companyId },
    orderBy: { createdAt: "desc" },
  });
  if (latestSub) {
    if (latestSub.stripeSubscriptionId) await billingService.cancelSubscription(latestSub.stripeSubscriptionId);
    await prisma.subscription.update({ where: { id: latestSub.id }, data: { status: "cancelled" } });
  }
  await prisma.company.update({ where: { id: req.params.companyId }, data: { status: "inactive" } });
  res.json({ ok: true });
});
