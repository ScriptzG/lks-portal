import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    where: { name: "Starter" },
    update: {},
    create: {
      name: "Starter",
      priceMonthly: 29,
      maxSites: 1,
      canSelfPublish: false,
      featuresJson: JSON.stringify(["1 site", "Basic content editing", "Publish requests reviewed by LKS"]),
    },
  });
  await prisma.plan.upsert({
    where: { name: "Pro" },
    update: {},
    create: {
      name: "Pro",
      priceMonthly: 79,
      maxSites: 3,
      canSelfPublish: true,
      featuresJson: JSON.stringify(["Up to 3 sites", "Publish directly to live", "Priority support"]),
    },
  });
  await prisma.plan.upsert({
    where: { name: "Enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      priceMonthly: 0,
      maxSites: 999,
      canSelfPublish: true,
      featuresJson: JSON.stringify(["Unlimited sites", "Custom pricing", "Dedicated priority support"]),
    },
  });

  const adminEmail = "admin@lks.systems";
  const adminPassword = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, role: "admin" },
  });

  console.log("Seed complete.");
  console.log(`Admin login -> email: ${adminEmail}  password: ${adminPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
