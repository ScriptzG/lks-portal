// Shared by autoAnnotateHtml (detection), editableFieldsParser (currentValue extraction), and
// compileSite (writing an edited value back) — one regex definition for the inline-style
// `<prop>: url(...)` pattern this app's uploaded sites use for swappable background photos, e.g.
// `style="--hero-photo:url('images/hero.jpg')"` or a plain `style="background-image:url(...)"`.
const DECL_RE = /(--[\w-]+|background-image)\s*:\s*url\(\s*(['"]?)([^'")]+)\2\s*\)/i;

export interface BackgroundDecl {
  prop: string;
  url: string;
}

/** Finds the first `<prop>: url(...)` declaration in a `style` attribute value, if any. */
export function extractBackgroundDecl(style: string | undefined | null): BackgroundDecl | null {
  if (!style) return null;
  const m = DECL_RE.exec(style);
  if (!m) return null;
  return { prop: m[1], url: m[3] };
}

/** Replaces the url(...) inside an existing `<prop>: url(...)` declaration with `newUrl`,
 * preserving every other declaration in the style attribute untouched. If `prop` isn't present
 * yet, appends it. */
export function setBackgroundUrl(style: string | undefined | null, prop: string, newUrl: string): string {
  const current = style ?? "";
  const propEscaped = prop.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp(`(${propEscaped}\\s*:\\s*url\\()[^)]*(\\))`, "i");
  if (re.test(current)) {
    return current.replace(re, `$1'${newUrl}'$2`);
  }
  const trimmed = current.trim().replace(/;+\s*$/, "");
  return trimmed ? `${trimmed}; ${prop}:url('${newUrl}')` : `${prop}:url('${newUrl}')`;
}
