import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      website?: NonNullable<Awaited<ReturnType<typeof prisma.website.findUnique>>>;
    }
  }
}

/** Admins can access any website; clients only the website(s) belonging to their own company. */
export async function requireWebsiteAccess(req: Request, res: Response, next: NextFunction) {
  const website = await prisma.website.findUnique({ where: { id: req.params.id } });
  if (!website) return res.status(404).json({ error: "Website not found" });

  if (req.user!.role === "client" && website.companyId !== req.user!.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  req.website = website;
  next();
}
