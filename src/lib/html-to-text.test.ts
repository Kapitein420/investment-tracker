import { describe, it, expect } from "vitest";
import { htmlToText } from "@/lib/html-to-text";

describe("htmlToText", () => {
  it("returns empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText(null)).toBe("");
    expect(htmlToText(undefined)).toBe("");
  });

  it("keeps the CTA label and its URL so the text part is actionable", () => {
    const html = `
      <div style="margin: 0 0 28px 0;">
        <a href="https://www.dils-investorportal.nl/set-password/abc"
           style="background:#101820;">Set a new password</a>
      </div>`;
    expect(htmlToText(html)).toBe(
      "Set a new password (https://www.dils-investorportal.nl/set-password/abc)",
    );
  });

  it("prints a bare URL once when the label already is the URL", () => {
    const html = `<a href="https://www.dils-investorportal.nl/login">https://www.dils-investorportal.nl/login</a>`;
    expect(htmlToText(html)).toBe("https://www.dils-investorportal.nl/login");
  });

  it("drops the href for mailto and anchor links, keeping the label", () => {
    expect(htmlToText(`<a href="mailto:a@b.com">Email us</a>`)).toBe("Email us");
    expect(htmlToText(`<a href="#skip">Skip</a>`)).toBe("Skip");
  });

  it("never leaks style or script contents", () => {
    const html = `<head><style>.a{color:red}</style></head><p>Hello</p><script>alert(1)</script>`;
    expect(htmlToText(html)).toBe("Hello");
  });

  it("breaks blocks onto their own lines and collapses blank runs", () => {
    const html = `<p>One</p>\n\n\n<div>Two</div><br/><p>Three</p>`;
    expect(htmlToText(html)).toBe("One\n\nTwo\n\nThree");
  });

  it("renders list items as dashes", () => {
    expect(htmlToText(`<ul><li>Alpha</li><li>Beta</li></ul>`)).toBe(
      "- Alpha\n- Beta",
    );
  });

  it("decodes the entities our templates actually emit", () => {
    expect(htmlToText(`<p>Rent &euro;1.200 &middot; A&amp;B &nbsp;&mdash; done</p>`)).toBe(
      "Rent €1.200 · A&B — done",
    );
  });

  it("decodes numeric and hex entities", () => {
    expect(htmlToText(`<p>&#39;quoted&#39; &#x2014; yes</p>`)).toBe(
      "'quoted' — yes",
    );
  });

  it("does not double-decode an escaped entity", () => {
    expect(htmlToText(`<p>&amp;lt;</p>`)).toBe("&lt;");
  });

  it("separates table cells rather than gluing them together", () => {
    expect(htmlToText(`<table><tr><td>Label</td><td>Value</td></tr></table>`)).toBe(
      "Label Value",
    );
  });
});
