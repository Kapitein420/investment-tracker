import DOMPurify from "isomorphic-dompurify";

// URI allow-list for sanitised NDA HTML. Mirrors DOMPurify's default safe
// protocols (http/https/mailto/tel/…) but additionally permits
// `data:image/*` so the embedded signature image survives sanitisation.
// It deliberately does NOT permit `data:text/html` or `javascript:`, so a
// URI can never be an XSS vector.
const ALLOWED_URI_REGEXP =
  /^(?:(?:https?|mailto|tel|callto|sms|cid|xmpp):|data:image\/(?:png|jpe?g|gif|webp);|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

/**
 * Sanitise admin/EDITOR-authored NDA HTML (and the rendered signed copy)
 * before it is rendered to investors/admins via dangerouslySetInnerHTML.
 *
 * EDITOR-supplied template HTML is untrusted: an EDITOR is a lower-trust
 * role than ADMIN and can inject <script>/onerror payloads that would
 * otherwise execute in every investor's (and reviewing admin's) browser.
 * DOMPurify keeps the tables/inline styles/images the templates rely on
 * while stripping scripts, event-handler attributes, and unsafe URIs.
 *
 * Runs server-side only (this module pulls in jsdom via isomorphic-dompurify
 * — never import it from a client component).
 */
export function sanitizeNdaHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP });
}
