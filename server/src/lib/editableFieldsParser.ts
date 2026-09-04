import * as cheerio from "cheerio";
import { extractBackgroundDecl } from "./backgroundStyle.js";

export type ParsedFieldType = "text" | "textarea" | "image" | "color" | "link" | "background";

export interface ParsedField {
  fieldKey: string;
  fieldType: ParsedFieldType;
  label: string;
  section: string;
  sourceFile: string;
  currentValue: string;
}

function prettifyKey(key: string): string {
  return key
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Scans one HTML file's markup for elements tagged `data-lks-editable="key"`
 * and derives a field definition for each, e.g.:
 *   <h1 data-lks-editable="hero-title">Welcome</h1>
 *   <img data-lks-editable="hero-image" src="banner.jpg" />
 */
export function parseEditableFields(html: string, sourceFile: string): ParsedField[] {
  const $ = cheerio.load(html);
  const fields: ParsedField[] = [];

  $("[data-lks-editable]").each((_, el) => {
    const node = $(el);
    const fieldKey = node.attr("data-lks-editable")?.trim();
    if (!fieldKey) return;

    const tagName = (el as { tagName?: string }).tagName?.toLowerCase();
    const explicitType = node.attr("data-lks-type") as ParsedFieldType | undefined;

    let fieldType: ParsedFieldType;
    let currentValue: string;

    if (explicitType) {
      fieldType = explicitType;
      if (fieldType === "background") {
        currentValue = extractBackgroundDecl(node.attr("style"))?.url ?? "";
      } else if (fieldType === "image" || fieldType === "link") {
        currentValue = node.attr("src") ?? node.attr("href") ?? node.text().trim();
      } else {
        // text/textarea use innerHTML (not .text()), same as the inferred branch below — real
        // markup often has inline tags inside an editable node (a multi-line headline built
        // with <br>, a bolded word), and .text() would silently collapse those.
        currentValue = (node.html() ?? "").trim();
      }
    } else if (tagName === "img") {
      fieldType = "image";
      currentValue = node.attr("src") ?? "";
    } else if (tagName === "a") {
      fieldType = "link";
      currentValue = node.attr("href") ?? node.text().trim();
    } else {
      // Use the node's inner HTML (trimmed), not plain text — real-world markup often has
      // inline tags inside an editable heading/paragraph (e.g. a multi-line headline built
      // with <br>), and text() would silently collapse those, mashing words together.
      const text = node.text().trim();
      const html = (node.html() ?? "").trim();
      fieldType = text.length > 80 ? "textarea" : "text";
      currentValue = html;
    }

    fields.push({
      fieldKey,
      fieldType,
      label: node.attr("data-lks-label")?.trim() || prettifyKey(fieldKey),
      section: node.attr("data-lks-section")?.trim() || "General",
      sourceFile,
      currentValue,
    });
  });

  return fields;
}
