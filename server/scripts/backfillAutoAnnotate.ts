// One-off backfill: applies autoAnnotateHtml to every HTML file on every already-uploaded
// website, so existing sites (created before click-to-edit-everything shipped) get the same
// auto-tagged fields a fresh upload would produce, without needing to be re-uploaded.
// Idempotent — safe to run again later (e.g. after a further autoAnnotateHtml tweak).
//
// Run from server/: npx tsx scripts/backfillAutoAnnotate.ts
import { prisma } from "../src/lib/prisma.js";
import { storageService } from "../src/services/storage/LocalDiskStorage.js";
import { autoAnnotateHtml } from "../src/lib/autoAnnotateHtml.js";
import { parseEditableFields } from "../src/lib/editableFieldsParser.js";

function filesDir(websiteId: string) {
  return `websites/${websiteId}/files`;
}

async function main() {
  const websites = await prisma.website.findMany({ include: { company: true } });

  for (const website of websites) {
    const htmlFiles = await prisma.websiteFile.findMany({
      where: { websiteId: website.id, filePath: { endsWith: ".html" } },
    });
    if (htmlFiles.length === 0) continue;

    let newFieldsForSite = 0;

    for (const file of htmlFiles) {
      const before = (await storageService.read(`${filesDir(website.id)}/${file.filePath}`)).toString("utf-8");
      const after = autoAnnotateHtml(before, file.filePath);

      if (after !== before) {
        const buffer = Buffer.from(after, "utf-8");
        await storageService.save(`${filesDir(website.id)}/${file.filePath}`, buffer);
        await prisma.websiteFile.update({ where: { id: file.id }, data: { sizeBytes: buffer.length } });
      }

      const existingCount = await prisma.editableField.count({ where: { websiteId: website.id } });
      const parsedFields = parseEditableFields(after, file.filePath);

      for (const [index, field] of parsedFields.entries()) {
        const existing = await prisma.editableField.findUnique({
          where: { websiteId_fieldKey: { websiteId: website.id, fieldKey: field.fieldKey } },
        });
        if (existing) continue; // never touch a field that already exists — this is additive only
        await prisma.editableField.create({
          data: {
            websiteId: website.id,
            fieldKey: field.fieldKey,
            fieldType: field.fieldType,
            label: field.label,
            section: field.section,
            sourceFile: field.sourceFile,
            currentValue: field.currentValue,
            sortOrder: existingCount + index,
          },
        });
        newFieldsForSite += 1;
      }
    }

    console.log(`${website.company.name} / ${website.name}: +${newFieldsForSite} new editable fields`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
