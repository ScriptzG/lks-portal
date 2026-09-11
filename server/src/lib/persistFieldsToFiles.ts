import { prisma } from "./prisma.js";
import { storageService } from "../services/storage/index.js";
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

  // Each file's read/compile/write is independent of every other's, so running them concurrently
  // rather than one-at-a-time matters once more than a couple of files are touched at once (a
  // saved version's restore, or a save whose fields happen to span many pages) — a Supabase
  // Storage round-trip per file adds up fast in a sequential loop.
  await Promise.all(uniqueFiles.map((sourceFile) => persistOneFile(websiteId, sourceFile)));
}

async function persistOneFile(websiteId: string, sourceFile: string): Promise<void> {
  const [fields, fileRecord] = await Promise.all([
    prisma.editableField.findMany({ where: { websiteId, sourceFile } }),
    prisma.websiteFile.findUnique({ where: { websiteId_filePath: { websiteId, filePath: sourceFile } } }),
  ]);
  if (fields.length === 0 || !fileRecord) return;

  let raw: string;
  try {
    raw = (await storageService.read(`${filesDir(websiteId)}/${sourceFile}`)).toString("utf-8");
  } catch {
    return; // file listed in the DB but missing on disk — nothing to recompile
  }

  const fieldValues = fields.map((f) => ({
    fieldKey: f.fieldKey,
    fieldType: f.fieldType,
    value: (f.draftValue ?? f.currentValue) ?? "",
  }));

  const compiled = compileHtml(raw, fieldValues);
  const buffer = Buffer.from(compiled, "utf-8");
  try {
    // The field's own draftValue (already saved above) is the authoritative source of truth —
    // this re-bake into the raw file is a convenience for the Files tab and live preview, not
    // something a client's save should ever fail over. A storage hiccup on one file used to
    // throw here and take down the entire request, discarding every other field's save with it.
    await storageService.save(`${filesDir(websiteId)}/${sourceFile}`, buffer);
    await prisma.websiteFile.update({ where: { id: fileRecord.id }, data: { sizeBytes: buffer.length } });
  } catch (err) {
    console.error(`persistFieldsToFiles: failed to write ${sourceFile} for website ${websiteId}`, err);
  }
}
