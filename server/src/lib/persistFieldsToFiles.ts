import { prisma } from "./prisma.js";
import { storageService } from "../services/storage/LocalDiskStorage.js";
import { compileHtml } from "./compileSite.js";

function filesDir(websiteId: string) {
  return `websites/${websiteId}/files`;
}

/**
 * After a field's draft value is saved, re-renders every affected HTML file from ALL of that
 * file's current field values (draft-if-set, else published) and overwrites the stored
 * WebsiteFile on disk with the result — so clicking to edit doesn't just persist a value into a
 * side table, the actual page source under the Files tab reflects the change immediately, the
 * way a client expects a "click, type, save" editor to behave.
 *
 * Safe to call repeatedly on the same file: compileHtml only ever rewrites the content/attribute
 * of nodes matched by their existing `data-lks-editable` tag, which this never removes, so
 * re-running it with the same values is a no-op and re-running it with new values simply
 * re-applies them — it can never "double-apply" or drift the markup structure.
 */
export async function persistFieldsToFiles(websiteId: string, sourceFiles: Iterable<string>): Promise<void> {
  const uniqueFiles = [...new Set(sourceFiles)];

  for (const sourceFile of uniqueFiles) {
    const [fields, fileRecord] = await Promise.all([
      prisma.editableField.findMany({ where: { websiteId, sourceFile } }),
      prisma.websiteFile.findUnique({ where: { websiteId_filePath: { websiteId, filePath: sourceFile } } }),
    ]);
    if (fields.length === 0 || !fileRecord) continue;

    let raw: string;
    try {
      raw = (await storageService.read(`${filesDir(websiteId)}/${sourceFile}`)).toString("utf-8");
    } catch {
      continue; // file listed in the DB but missing on disk — nothing to recompile
    }

    const fieldValues = fields.map((f) => ({
      fieldKey: f.fieldKey,
      fieldType: f.fieldType,
      value: (f.draftValue ?? f.currentValue) ?? "",
    }));

    const compiled = compileHtml(raw, fieldValues);
    const buffer = Buffer.from(compiled, "utf-8");
    await storageService.save(`${filesDir(websiteId)}/${sourceFile}`, buffer);
    await prisma.websiteFile.update({ where: { id: fileRecord.id }, data: { sizeBytes: buffer.length } });
  }
}
