import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireWebsiteAccess } from "../middleware/websiteAccess.js";
import { storageService } from "../services/storage/index.js";
import { deployService } from "../services/deploy/MockNetlifyService.js";
import { compileHtml } from "../lib/compileSite.js";
import { notifyUser, sendEmail } from "../lib/notify.js";
import type { DeploymentTrigger } from "../lib/types.js";

export const deploymentsRouter = Router();
deploymentsRouter.use(requireAuth);

async function buildCompiledFiles(websiteId: string): Promise<Record<string, string>> {
  const [files, fields] = await Promise.all([
    prisma.websiteFile.findMany({ where: { websiteId, filePath: { endsWith: ".html" } } }),
    prisma.editableField.findMany({ where: { websiteId } }),
  ]);

  const compiled: Record<string, string> = {};
  for (const file of files) {
    const raw = (await storageService.read(`websites/${websiteId}/files/${file.filePath}`)).toString("utf-8");
    const fieldsForFile = fields
      .filter((f) => f.sourceFile === file.filePath)
      .map((f) => ({ fieldKey: f.fieldKey, fieldType: f.fieldType, value: f.currentValue ?? "" }));
    compiled[file.filePath] = compileHtml(raw, fieldsForFile);
  }
  return compiled;
}

async function runDeploy(params: {
  websiteId: string;
  triggeredById: string;
  trigger: DeploymentTrigger;
  note?: string;
}) {
  const website = await prisma.website.findUniqueOrThrow({
    where: { id: params.websiteId },
    include: { company: { include: { contacts: { where: { isPrimary: true }, take: 1 } } } },
  });
  const fields = await prisma.editableField.findMany({ where: { websiteId: params.websiteId } });
  const recipientEmail = website.company.contacts[0]?.email ?? "client@example.com";

  const versionSnapshot = JSON.stringify({
    capturedAt: new Date().toISOString(),
    fields: fields.map((f) => ({ fieldKey: f.fieldKey, value: f.currentValue, fieldType: f.fieldType })),
  });

  const deployment = await prisma.deployment.create({
    data: {
      websiteId: params.websiteId,
      triggeredById: params.triggeredById,
      trigger: params.trigger,
      status: "building",
      versionSnapshot,
      note: params.note,
    },
  });

  const files = await buildCompiledFiles(params.websiteId);

  const { deployUrl } = await deployService.deploy({
    netlifySiteId: website.netlifySiteId,
    files,
    onSettled: async (result) => {
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: result.status, deployUrl: result.deployUrl, deployedAt: new Date() },
      });

      if (result.status === "live") {
        await prisma.website.update({
          where: { id: params.websiteId },
          data: { status: "live", lastDeployedAt: new Date(), domainUrl: website.domainUrl ?? result.deployUrl },
        });
        await notifyUser({
          userId: params.triggeredById,
          type: "deploy_succeeded",
          message: `"${website.name}" deployed successfully.`,
          link: `/admin/websites/${params.websiteId}/deploy`,
        });
        await sendEmail({
          to: recipientEmail,
          subject: `Your website "${website.name}" is live`,
          body: `Your latest changes to "${website.name}" have been deployed: ${result.deployUrl}`,
        });
      } else {
        await notifyUser({
          userId: params.triggeredById,
          type: "deploy_failed",
          message: `Deploy failed for "${website.name}".`,
          link: `/admin/websites/${params.websiteId}/deploy`,
        });
        await sendEmail({
          to: "admin@lks.systems",
          subject: `Deploy failed: ${website.name}`,
          body: `The deploy for "${website.name}" (deployment ${deployment.id}) failed. Please investigate.`,
        });
      }
    },
  });

  return { deployment, deployUrl };
}

deploymentsRouter.get("/website/:id", requireWebsiteAccess, async (req, res) => {
  const deployments = await prisma.deployment.findMany({
    where: { websiteId: req.params.id },
    include: { triggeredBy: { select: { id: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(deployments);
});

deploymentsRouter.post("/website/:id/deploy", requireWebsiteAccess, async (req, res) => {
  const website = req.website!;
  const isAdmin = req.user!.role === "admin";
  const canSelfPublish = website.allowSelfPublish && !website.editLocked;

  if (!isAdmin && !canSelfPublish) {
    return res.status(403).json({ error: "You do not have permission to publish this site directly." });
  }

  // Promote any pending draft edits to the current (live) values before compiling the deploy.
  await prisma.$transaction(async (tx) => {
    const drafted = await tx.editableField.findMany({
      where: { websiteId: website.id, draftValue: { not: null } },
    });
    for (const field of drafted) {
      await tx.editableField.update({
        where: { id: field.id },
        data: { currentValue: field.draftValue, draftValue: null },
      });
    }
  });

  const { deployment, deployUrl } = await runDeploy({
    websiteId: website.id,
    triggeredById: req.user!.id,
    trigger: isAdmin ? "admin_publish" : "client_publish",
  });

  res.status(201).json({ deployment, deployUrl });
});

deploymentsRouter.post("/:deploymentId/rollback", async (req, res) => {
  if (req.user!.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const target = await prisma.deployment.findUnique({ where: { id: req.params.deploymentId } });
  if (!target) return res.status(404).json({ error: "Deployment not found" });

  const snapshot = JSON.parse(target.versionSnapshot) as { fields: { fieldKey: string; value: string | null }[] };

  await Promise.all(
    snapshot.fields.map((f) =>
      prisma.editableField.updateMany({
        where: { websiteId: target.websiteId, fieldKey: f.fieldKey },
        data: { currentValue: f.value, draftValue: null },
      }),
    ),
  );

  const { deployment, deployUrl } = await runDeploy({
    websiteId: target.websiteId,
    triggeredById: req.user!.id,
    trigger: "rollback",
    note: `Rolled back to deployment ${target.id}`,
  });

  res.status(201).json({ deployment, deployUrl });
});
