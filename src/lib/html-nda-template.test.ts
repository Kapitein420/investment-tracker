import { describe, it, expect } from "vitest";
import { DEFAULT_NDA_TEMPLATE } from "./html-nda-template";

const html = DEFAULT_NDA_TEMPLATE.html;

describe("DEFAULT_NDA_TEMPLATE legal text", () => {
  // Articles 3 and 5 once ran the warranty, the indemnity and the exclusion
  // right to "Eigenaar", which the declaration never defines. Every
  // obligation must name a party the document introduces.
  it("names only parties the declaration defines", () => {
    expect(html).not.toMatch(/Eigenaar/);
    expect(html).toMatch(/Gegadigde staat er jegens Verkoper voor in/);
    expect(html).toMatch(/Gegadigde vrijwaart Verkoper en voormelde partijen/);
    expect(html).toMatch(/Verkoper heeft het recht Gegadigde uit te sluiten/);
  });

  // Article 2f limits reproduction to a *use* defined elsewhere in the list.
  // It pointed at d. (safekeeping), which is not a use.
  it("points art. 2f at a clause that actually defines a use", () => {
    const f = html.match(/de Vertrouwelijke Informatie uitsluitend te vermenigvuldigen[^<]*/)?.[0];
    expect(f).toBeDefined();
    const referenced = f!.match(/onder ([a-g])\. bedoelde gebruik/)?.[1];
    expect(referenced).toBe("e");

    const clauseE = html.match(/<li><span class="letter">e\.<\/span><span class="text">([^<]*)/)?.[1];
    expect(clauseE).toMatch(/gebruiken/);
  });

  it("still defines its four terms and all seven articles", () => {
    for (const term of ["Betrokkene", "Dochtermaatschappij", "Groep", "Vertrouwelijke informatie"]) {
      expect(html).toContain(`${term}:`);
    }
    for (let n = 1; n <= 7; n++) {
      expect(html).toMatch(new RegExp(`<h2>${n}\\.`));
    }
  });
});
