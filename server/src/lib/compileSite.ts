import * as cheerio from "cheerio";
import { setBackgroundUrl } from "./backgroundStyle.js";

export interface CompileFieldValue {
  fieldKey: string;
  fieldType: string;
  value: string;
}

/** Re-renders one HTML document, writing current field values back into their tagged nodes. */
export function compileHtml(html: string, fieldValues: CompileFieldValue[]): string {
  const $ = cheerio.load(html);

  for (const field of fieldValues) {
    const node = $(`[data-lks-editable="${field.fieldKey}"]`);
    if (node.length === 0) continue;

    if (field.fieldType === "image") {
      node.attr("src", field.value);
    } else if (field.fieldType === "background") {
      const prop = node.attr("data-lks-bg-prop") || "background-image";
      node.attr("style", setBackgroundUrl(node.attr("style"), prop, field.value));
    } else if (field.fieldType === "link" && node.is("a")) {
      node.attr("href", field.value);
    } else if (field.fieldType === "color") {
      const prop = node.attr("data-lks-color-prop") || "color";
      const existing = (node.attr("style") ?? "")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && !s.toLowerCase().startsWith(prop.toLowerCase()));
      existing.push(`${prop}: ${field.value}`);
      node.attr("style", existing.join("; "));
    } else {
      // text/textarea values may contain a small allow-listed set of inline HTML tags
      // (bold/italic/underline/link) applied via the visual editor's formatting toolbar —
      // sanitized server-side at save time (see server/src/lib/sanitizeRichText.ts) — so it's
      // safe to render as HTML here rather than escaping it as plain text.
      node.html(field.value);
    }
  }

  return $.html();
}

/** Applies compileHtml across every HTML file in a site's file set, scoped to each field's source file. */
export function compileSite(
  files: Record<string, string>,
  fieldValues: (CompileFieldValue & { sourceFile: string })[],
): Record<string, string> {
  const compiled: Record<string, string> = {};

  for (const [filePath, content] of Object.entries(files)) {
    if (!/\.html?$/i.test(filePath)) {
      compiled[filePath] = content;
      continue;
    }
    const fieldsForFile = fieldValues.filter((f) => f.sourceFile === filePath);
    compiled[filePath] = fieldsForFile.length ? compileHtml(content, fieldsForFile) : content;
  }

  return compiled;
}
