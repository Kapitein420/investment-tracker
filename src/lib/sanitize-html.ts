import sanitizeHtml from "sanitize-html";

/**
 * Sanitise admin/EDITOR-authored NDA HTML (and the rendered signed copy)
 * before it is rendered to investors/admins via dangerouslySetInnerHTML.
 *
 * EDITOR-supplied template HTML is untrusted: an EDITOR is a lower-trust
 * role than ADMIN and can inject <script>/onerror payloads that would
 * otherwise execute in every investor's (and reviewing admin's) browser.
 * This keeps the tables/inline styles/images the templates rely on while
 * stripping scripts, event-handler attributes, and unsafe URIs. `data:`
 * URIs are allowed only on <img src>, so the embedded signature image
 * survives — a data: URI in that context can only ever be decoded as
 * image data by the browser, never executed.
 *
 * Uses sanitize-html (pure JS, no DOM) rather than isomorphic-dompurify.
 * isomorphic-dompurify pulls in jsdom -> html-encoding-sniffer ->
 * @exodus/bytes, and every published @exodus/bytes release ships
 * `"type": "module"` while html-encoding-sniffer still `require()`s it —
 * an unconditional CJS/ESM incompatibility (not a bundler quirk) that
 * crashed every NDA sign/render in production with ERR_REQUIRE_ESM.
 * `next dev` (and ts-node/tsx) didn't reproduce it because their looser
 * module interop papers over the mismatch that Vercel's actual Node
 * runtime rejects. See BUG-043.
 */
export function sanitizeNdaHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    // sanitize-html defines default attributes for <img> as a reference but
    // omits the tag itself from allowedTags — omitting this silently strips
    // every <img>, including the embedded signature.
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["class", "style"],
    },
    allowedSchemes: sanitizeHtml.defaults.allowedSchemes,
    allowedSchemesByTag: {
      img: ["data", "http", "https"],
    },
  });
}
