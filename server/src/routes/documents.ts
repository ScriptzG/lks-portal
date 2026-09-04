import { Router, type Request } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { storageService } from "../services/storage/LocalDiskStorage.js";
import { notifyAllAdmins, notifyUser, sendEmail } from "../lib/notify.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function hasCompanyAccess(req: Request, companyId: string): boolean {
  if (req.user!.role === "admin") return true;
  return req.user!.companyId === companyId;
}

function docDir(companyId: string) {
  return `companies/${companyId}/documents`;
}

documentsRouter.get("/:companyId", async (req, res) => {
  if (!hasCompanyAccess(req, req.params.companyId)) return res.status(403).json({ error: "Forbidden" });

  const documents = await prisma.document.findMany({
    where: { companyId: req.params.companyId },
    include: { uploadedBy: { select: { id: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    documents.map((d) => ({
      ...d,
      url: `/storage/${docDir(req.params.companyId)}/${d.id}${path.extname(d.fileName)}`,
    })),
  );
});

documentsRouter.post("/:companyId", upload.single("file"), async (req, res) => {
  const companyId = req.params.companyId;
  if (!hasCompanyAccess(req, companyId)) return res.status(403).json({ error: "Forbidden" });
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { users: { where: { role: "client" } }, contacts: { where: { isPrimary: true }, take: 1 } },
  });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const id = randomUUID();
  const ext = path.extname(req.file.originalname);
  const storageUrl = await storageService.save(`${docDir(companyId)}/${id}${ext}`, req.file.buffer);

  const document = await prisma.document.create({
    data: {
      id,
      companyId,
      uploadedById: req.user!.id,
      uploaderRole: req.user!.role,
      fileName: req.file.originalname,
      storageUrl,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    },
    include: { uploadedBy: { select: { id: true, email: true, role: true } } },
  });

  if (req.user!.role === "admin") {
    for (const clientUser of company.users) {
      await notifyUser({
        userId: clientUser.id,
        type: "general",
        message: `LKS Systems shared a file: "${req.file.originalname}"`,
        link: "/portal/documents",
      });
    }
    const recipientEmail = company.contacts[0]?.email ?? company.users[0]?.email;
    if (recipientEmail) {
      await sendEmail({
        to: recipientEmail,
        subject: `New file shared: ${req.file.originalname}`,
        body: `LKS Systems shared a new file with you: ${req.file.originalname}. Log in to your portal to download it.`,
      });
    }
  } else {
    await notifyAllAdmins({
      type: "general",
      message: `${company.name} uploaded a file: "${req.file.originalname}"`,
      link: `/admin/companies/${companyId}?tab=documents`,
    });
  }

  res.status(201).json({ ...document, url: `/storage/${docDir(companyId)}/${id}${ext}` });
});

documentsRouter.delete("/:id", async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: "Document not found" });
  if (!hasCompanyAccess(req, document.companyId)) return res.status(403).json({ error: "Forbidden" });

  // Clients may only remove their own uploads; admins can remove anything in the thread.
  if (req.user!.role !== "admin" && document.uploadedById !== req.user!.id) {
    return res.status(403).json({ error: "You can only remove files you uploaded" });
  }

  const ext = path.extname(document.fileName);
  await storageService.delete(`${docDir(document.companyId)}/${document.id}${ext}`);
  await prisma.document.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
