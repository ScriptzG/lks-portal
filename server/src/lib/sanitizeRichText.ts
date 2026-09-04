import * as cheerio from "cheerio";

const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "a", "br"]);

/**
 * Strips a client-submitted "rich text" fragment (from the visual editor's contentEditable
 * formatting — bold/italic/underline/link) down to a small allow-listed subset of inline tags.
 * Disallowed tags are unwrapped (their text/children survive, the tag itself doesn't), and every
 * attribute except `href` on `<a>` is stripped. This is the ONE place untrusted client input
 * becomes a stored field value — sanitize here, once, rather than re-sanitizing at render time.
 */
export function sanitizeRichText(html: string): string {
  const $ = cheerio.load(`<div id="lks-sanitize-root">${html}</div>`);
  const root = $("#lks-sanitize-root").get(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function clean(el: any) {
    $(el)
      .contents()
      .each((_, node) => {
        // domhandler tags <script>/<style> elements with node.type === "script"/"style"
        // (not the generic "tag"), so both must be checked here or they pass through
        // completely unprocessed — a real XSS hole if missed.
        if (node.type === "comment") {
          $(node).remove();
          return;
        }
        if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return;

        const tagName = node.tagName?.toLowerCase();

        // <script>/<style> content is never meant to be visible page text — remove entirely
        // rather than unwrapping (unwrapping is safe from execution but would dump raw JS/CSS
        // source onto the page as text).
        if (tagName === "script" || tagName === "style") {
          $(node).remove();
          return;
        }

        if (!ALLOWED_TAGS.has(tagName)) {
          clean(node);
          $(node).replaceWith($(node).contents());
          return;
        }

        for (const attr of Object.keys(node.attribs ?? {})) {
          if (tagName === "a" && attr === "href") continue;
          $(node).removeAttr(attr);
        }

        if (tagName === "a") {
          const href = $(node).attr("href") ?? "";
          if (/^\s*(javascript|data|vbscript):/i.test(href)) {
            $(node).removeAttr("href");
          } else {
            $(node).attr("rel", "noopener noreferrer");
            $(node).attr("target", "_blank");
          }
        }

        clean(node);
      });
  }

  if (root) clean(root);
  return $("#lks-sanitize-root").html() ?? "";
}
