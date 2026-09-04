import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { extractBackgroundDecl } from "./backgroundStyle.js";

// Semantic, text-bearing tags we're willing to make click-to-edit on our own, without an admin
// having to hand-annotate the source. Deliberately excludes generic containers (div/span) and
// inline formatting tags (b/i/em/strong/u) — those are either too coarse (a div can wrap a whole
// page section) or are meant to stay nested inside a real field's rich-text value.
const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "li", "td", "th", "label",
  "figcaption", "blockquote", "button", "dt", "dd", "caption", "legend", "summary", "a",
]);

// Never descend into these — their contents aren't user-facing page copy (script/style/svg
// markup) or, for head, isn't rendered as visible content at all.
const SKIP_SUBTREE_TAGS = new Set(["script", "style", "template", "noscript", "svg", "head"]);

const LANDMARK_TAGS = new Set(["header", "nav", "footer", "main"]);

function slugForFile(sourceFile: string): string {
  const base = sourceFile.replace(/\.[a-z0-9]+$/i, "");
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "page";
}

function prettify(key: string): string {
  return key.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function snippetLabel(text: string, fallback: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > 42 ? `${clean.slice(0, 42).trimEnd()}…` : clean;
}

/**
 * Scans one HTML file and auto-injects `data-lks-editable` (+ type/label/section) onto every
 * text-bearing element, `<img>`, and inline CSS background-photo declaration that isn't already
 * tagged, so clients can click-to-edit ANY element on an uploaded site — not just the ones an
 * admin manually annotated. Runs on upload
 * (zip and single-file) and on every raw-code save, and is fully idempotent: elements that
 * already carry `data-lks-editable` (from a prior auto-tag pass, or hand-authored by an admin)
 * are left completely untouched and their subtree is never re-scanned, so re-running this never
 * changes an existing field's key or clobbers a manually-curated site like Kara's Kitchen.
 *
 * Walks bottom-up (children before parents) so that when an element's own subtree already
 * contains a tagged descendant (e.g. a `<li><a>Home</a></li>` where the `<a>` just got tagged),
 * the ancestor is skipped rather than also being tagged — nesting two `data-lks-editable`
 * elements would let compileSite's `node.html(value)` on the outer one silently wipe out the
 * inner field's markup the next time only the outer field is saved.
 */
export function autoAnnotateHtml(html: string, sourceFile: string): string {
  const $ = cheerio.load(html);
  const fileSlug = slugForFile(sourceFile);

  const existingKeys = new Set<string>();
  $("[data-lks-editable]").each((_, el) => {
    const key = $(el).attr("data-lks-editable");
    if (key) existingKeys.add(key);
  });

  // Resume numbering after whatever auto-tags already exist for this file, so re-running this
  // (e.g. re-uploading a site with one new paragraph inserted at the top) never reassigns a key
  // that's already in use by an existing, previously-saved field.
  const counters: Record<string, number> = {};
  const prefixRe = new RegExp(`^auto-${fileSlug}-([a-z0-9]+)-(\\d+)$`);
  for (const key of existingKeys) {
    const m = prefixRe.exec(key);
    if (!m) continue;
    const [, tag, n] = m;
    counters[tag] = Math.max(counters[tag] ?? 0, parseInt(n, 10));
  }

  function nextKey(tag: string): string {
    let n = (counters[tag] ?? 0) + 1;
    let key = `auto-${fileSlug}-${tag}-${n}`;
    while (existingKeys.has(key)) {
      n += 1;
      key = `auto-${fileSlug}-${tag}-${n}`;
    }
    counters[tag] = n;
    existingKeys.add(key);
    return key;
  }

  function sectionFor(el: Element): string {
    let node = $(el).parent();
    while (node.length) {
      const tag = (node.get(0) as Element | undefined)?.tagName?.toLowerCase();
      if (tag && LANDMARK_TAGS.has(tag)) return prettify(tag);
      const id = node.attr("id");
      if (id) return prettify(id);
      node = node.parent();
    }
    return "General";
  }

  // Returns true if `el` is now (or already was) tagged, or has a tagged descendant — the
  // signal an ancestor uses to know it must NOT also be tagged.
  function visit(node: AnyNode): boolean {
    if (node.type !== "tag") return false;
    const el = node as Element;
    const tagName = el.tagName?.toLowerCase();
    if (!tagName || SKIP_SUBTREE_TAGS.has(tagName)) return false;

    const $el = $(el);
    if ($el.attr("data-lks-editable")) return true;

    let hasTaggedDescendant = false;
    for (const child of el.children) {
      if (visit(child)) hasTaggedDescendant = true;
    }

    // A CSS background photo (this app's sites set it as an inline custom property, e.g.
    // style="--hero-photo:url('images/hero.jpg')") only ever touches the style attribute, never
    // the element's content — so unlike text/img, it's safe to tag even when a descendant (the
    // heading/paragraph sitting on top of the photo) was just independently tagged above.
    const bg = extractBackgroundDecl($el.attr("style"));
    if (bg) {
      const key = nextKey("bg");
      $el.attr("data-lks-editable", key);
      $el.attr("data-lks-type", "background");
      $el.attr("data-lks-bg-prop", bg.prop);
      $el.attr("data-lks-label", "Background image");
      $el.attr("data-lks-section", sectionFor(el));
      return true;
    }

    if (hasTaggedDescendant) return true;

    if (tagName === "img") {
      const src = $el.attr("src");
      if (!src) return false;
      const key = nextKey("img");
      const alt = $el.attr("alt")?.trim();
      $el.attr("data-lks-editable", key);
      $el.attr("data-lks-type", "image");
      $el.attr("data-lks-label", alt ? `${alt} image` : "Image");
      $el.attr("data-lks-section", sectionFor(el));
      return true;
    }

    if (TEXT_TAGS.has(tagName)) {
      const text = $el.text().trim();
      if (!text) return false;
      const key = nextKey(tagName);
      $el.attr("data-lks-editable", key);
      // Anchors default to fieldType "link" (value = href) when untyped — force "text" so
      // auto-tagged nav/CTA links become editable by their visible label, not their destination.
      $el.attr("data-lks-type", text.length > 80 ? "textarea" : "text");
      $el.attr("data-lks-label", snippetLabel(text, prettify(tagName)));
      $el.attr("data-lks-section", sectionFor(el));
      return true;
    }

    return false;
  }

  // NOTE: the callback body must not just be `=> visit(node)` — cheerio's `.each()` follows the
  // jQuery convention where a callback returning `false` stops the whole iteration early, and
  // `visit` legitimately returns `false` for the very first text/whitespace node, which would
  // silently abort before ever reaching the real elements.
  $("body")
    .contents()
    .each((_, node) => {
      visit(node);
    });

  return $.html();
}
