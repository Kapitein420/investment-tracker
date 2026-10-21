import { describe, it, expect } from "vitest";
import {
  extractTokens,
  injectSignature,
  pickNdaTemplateForAsset,
  renderTemplate,
  RESERVED_TOKENS,
  splitFullName,
  DEFAULT_NDA_TEMPLATE,
} from "./html-nda-template";
import { ECLIPSE_NDA_TEMPLATE } from "./html-nda-template-eclipse";
import { sanitizeNdaHtml } from "./sanitize-html";

describe("ECLIPSE_NDA_TEMPLATE", () => {
  it("references every placeholder of the Word original", () => {
    expect(extractTokens(ECLIPSE_NDA_TEMPLATE.html)).toEqual([
      "ADDRESS",
      "COMPANY_ADDRESS",
      "COMPANY_NAME",
      "COMPANY_OFFICE",
      "DATE",
      "FIRST_NAMES",
      "KVK",
      "NAME",
      "POSTCODE_CITY",
      "SIGNATURE_BLOCK",
      "SURNAME",
    ]);
  });

  it("only asks the signer for fields that are not auto-filled", () => {
    const investorKeys = extractTokens(ECLIPSE_NDA_TEMPLATE.html).filter(
      (t) => !RESERVED_TOKENS.has(t) && t !== "NAME"
    );
    const configured = new Set(ECLIPSE_NDA_TEMPLATE.fields.map((f) => f.key));
    for (const key of investorKeys) expect(configured.has(key)).toBe(true);
  });

  it("survives sanitisation with its inline layout intact (no <style> dependency)", () => {
    const html = ECLIPSE_NDA_TEMPLATE.html;
    expect(html).not.toMatch(/<style/i);
    const sanitized = sanitizeNdaHtml(html);
    expect(sanitized).toContain("NON DISCLOSURE AGREEMENT");
    expect(sanitized).toContain("font-family:Arial");
    expect(sanitized).toContain("{{SIGNATURE_BLOCK}}");
    expect(sanitized.match(/<table/g)).toHaveLength(3);
  });

  it("renders values and the signature, escaping input", () => {
    const rendered = renderTemplate(sanitizeNdaHtml(ECLIPSE_NDA_TEMPLATE.html), {
      FIRST_NAMES: "Jan",
      SURNAME: "<b>de Vries</b>",
      NAME: "Jan de Vries",
      DATE: "21 October 2026",
    });
    expect(rendered).toContain("&lt;b&gt;de Vries&lt;/b&gt;");
    expect(rendered).toContain("21 October 2026");
    const signed = injectSignature(rendered, '<img src="data:image/png;base64,AAAA" alt="signature" />');
    expect(signed).toContain('<img src="data:image/png;base64,AAAA"');
    expect(signed).not.toContain("{{SIGNATURE_BLOCK}}");
  });

  it("has no leftover word-wrap hyphenation from the Word export", () => {
    const text = ECLIPSE_NDA_TEMPLATE.html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/[a-z]- [a-z]/);
  });
});

describe("pickNdaTemplateForAsset", () => {
  it("uses the Eclipse NDA for the Eclipse Building only", () => {
    expect(pickNdaTemplateForAsset("Eclipse Building")).toBe(ECLIPSE_NDA_TEMPLATE);
    expect(pickNdaTemplateForAsset("The Eclipse building, Rotterdam")).toBe(ECLIPSE_NDA_TEMPLATE);
    expect(pickNdaTemplateForAsset("Anderlechtlaan")).toBe(DEFAULT_NDA_TEMPLATE);
    expect(pickNdaTemplateForAsset(undefined)).toBe(DEFAULT_NDA_TEMPLATE);
  });
});

describe("splitFullName", () => {
  it.each([
    ["Jan Pieter de Vries", "Jan Pieter", "de Vries"],
    ["Anna van der Berg", "Anna", "van der Berg"],
    ["Pim van den Heuvel", "Pim", "van den Heuvel"],
    ["Anna in 't Veld", "Anna", "in 't Veld"],
    ["Anna in \u2019t Veld", "Anna", "in \u2019t Veld"],
    ["Maria De La Cruz", "Maria", "De La Cruz"],
    ["Jan Jansen", "Jan", "Jansen"],
    ["Jan Pieter Jansen", "Jan Pieter", "Jansen"],
    ["  Jan   de   Vries  ", "Jan", "de Vries"],
  ])("splits %j", (input, firstNames, surname) => {
    expect(splitFullName(input)).toEqual({ firstNames, surname });
  });

  it("always keeps one word as the first name", () => {
    expect(splitFullName("de Vries")).toEqual({ firstNames: "de", surname: "Vries" });
    expect(splitFullName("Jan de")).toEqual({ firstNames: "Jan", surname: "de" });
  });

  it("treats a single word as a first name and an empty input as empty", () => {
    expect(splitFullName("Madonna")).toEqual({ firstNames: "Madonna", surname: "" });
    expect(splitFullName("   ")).toEqual({ firstNames: "", surname: "" });
  });
});
