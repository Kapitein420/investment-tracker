import { describe, it, expect } from "vitest";
import { sanitizeNdaHtml } from "./sanitize-html";

// These guard the NDA HTML that gets rendered to investors/admins via
// dangerouslySetInnerHTML. EDITOR-authored templates are untrusted.
describe("sanitizeNdaHtml", () => {
  it("strips <script> tags", () => {
    const out = sanitizeNdaHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain("ok");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("strips event-handler attributes", () => {
    const out = sanitizeNdaHtml('<img src="x" onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain("onerror");
  });

  it("drops javascript: URIs", () => {
    const out = sanitizeNdaHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("preserves data:image signature URIs (needed for signed copies)", () => {
    const sig =
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==">';
    const out = sanitizeNdaHtml(sig);
    expect(out).toContain("data:image/png;base64,");
  });

  it("keeps benign formatting (tables/inline styles)", () => {
    const out = sanitizeNdaHtml(
      '<table><tr><td style="color:red">cell</td></tr></table>'
    );
    expect(out).toContain("<table");
    expect(out).toContain("cell");
  });

  it("returns empty string for nullish input", () => {
    expect(sanitizeNdaHtml(null)).toBe("");
    expect(sanitizeNdaHtml(undefined)).toBe("");
    expect(sanitizeNdaHtml("")).toBe("");
  });
});
