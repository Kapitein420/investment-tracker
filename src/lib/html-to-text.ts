/**
 * Plain-text alternative for outbound email.
 *
 * Every message we send is HTML. An HTML-only message (no text/plain
 * part) is a well-known spam signal — SpamAssassin scores it as
 * MIME_HTML_ONLY, and several corporate gateways weight it the same way.
 * On a bulk investor send that is a few tenths of a point of spam score
 * we get back for free, so `sendEmail` always ships both parts.
 *
 * This is deliberately a small hand-rolled converter rather than a
 * dependency: our HTML is not arbitrary web content, it is the output of
 * `renderEmail` in src/lib/email-template.ts — a fixed set of block
 * elements, anchors and inline styles. A general-purpose library would
 * add install weight for markup we control.
 *
 * Links are rendered as `Label (https://...)` because the whole point of
 * the text part is that a recipient reading it can still reach the
 * portal.
 */

/**
 * Block-level tags whose close should become a line break. `<li>` is
 * deliberately absent: its *open* tag already emits the newline plus the
 * bullet, so closing it too would put a blank line between list items.
 */
const BLOCK_CLOSE =
  /<\/(?:p|div|h[1-6]|tr|table|section|header|footer|blockquote)\s*>/gi;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  euro: "€",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  copy: "©",
  eacute: "é",
};

function decodeEntities(input: string): string {
  return (
    input
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
        String.fromCodePoint(parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_m, dec: string) =>
        String.fromCodePoint(parseInt(dec, 10)),
      )
      // Named entities last-but-one, and &amp; genuinely last, so that a
      // literal "&amp;lt;" decodes to "&lt;" rather than all the way to "<".
      .replace(/&(quot|apos|nbsp|middot|euro|mdash|ndash|hellip|copy|eacute|lt|gt);/gi,
        (_m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? _m,
      )
      .replace(/&amp;/gi, "&")
  );
}

/**
 * Convert one of our email HTML bodies to a readable text/plain part.
 * Returns "" for empty input so callers can skip the header entirely.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";

  let out = html;

  // 1. Drop anything whose text content must never surface.
  out = out
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");

  // 2. Anchors -> "Label (href)". Skip the parenthetical when the label
  //    already is the URL (the sign-in hint line prints its own link),
  //    and for mailto:/# hrefs where it adds noise.
  out = out.replace(
    /<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a\s*>/gi,
    (_m, href: string, inner: string) => {
      const label = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim();
      const url = decodeEntities(href).trim();
      if (!/^https?:\/\//i.test(url)) return label;
      if (!label) return url;
      if (label.replace(/\/+$/, "") === url.replace(/\/+$/, "")) return url;
      return `${label} (${url})`;
    },
  );

  // 3. Structural whitespace.
  out = out
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/td\s*>\s*<td\b[^>]*>/gi, "  ")
    .replace(BLOCK_CLOSE, "\n");

  // 4. Everything else goes.
  out = out.replace(/<[^>]+>/g, "");

  // 5. Entities, then tidy up the spacing the markup left behind.
  out = decodeEntities(out);

  return out
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
