// Eclipse Building NDA — English "Non Disclosure Agreement" (Laagraven
// Investment B.V. as Vendor), reproduced from the Word original: A4 Arial
// 10pt, numbered clauses 1. / 1.1. / a. / (i), underlined fill-in lines for
// the Recipient's details and a signature line above "Recipient / By / Date".
//
// Every style is INLINE on purpose. sanitizeNdaHtml() (used when a template is
// saved and again when it is served/signed) strips <style> blocks, so a
// stylesheet-based layout like DEFAULT_NDA_TEMPLATE's would lose its
// formatting. Class names are only kept as hooks (`nda-doc`).
//
// The markup is composed from small helpers below so the offsets stay in one
// place. All measurements are the Word ones (twips / 20 = pt), measured from
// the 5pt paragraph indent the original uses for its body text.

import type { HtmlNdaTemplate } from "./html-nda-template";

const TEXT = "font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;";
const LINE = "0.75pt solid #000";
const AVOID_BREAK = "break-inside:avoid;page-break-inside:avoid;";

// Level offsets (pt) relative to the body indent: [number position, text position].
const L1: [number, number] = [0, 36.8]; // "1."   / "1.1."
const L2: [number, number] = [36.8, 59.5]; // "a."
const L3: [number, number] = [59.5, 82.2]; // "(i)"

const bold = (s: string) => `<strong style="font-weight:bold;color:#000;">${s}</strong>`;
const spacer = (pt = 11.5) => `<div style="height:${pt}pt;"></div>`;

/** Plain body paragraph (left aligned, no number). */
function para(html: string, extra = "") {
  return `<div style="margin:0;line-height:1.35;${AVOID_BREAK}${extra}">${html}</div>`;
}

/** Numbered clause heading: "1." + bold title. */
function heading(num: string, title: string) {
  return `<div style="display:flex;margin:11.5pt 0 4pt 0;font-weight:bold;${AVOID_BREAK}">
    <div style="flex:0 0 ${L1[1]}pt;box-sizing:border-box;">${num}</div>
    <div style="flex:1;min-width:0;">${title}</div>
  </div>`;
}

/** Hanging-indent list item: label at [0], justified text at [1]. */
function item(level: [number, number], label: string, html: string) {
  return `<div style="display:flex;margin:0 0 6pt 0;line-height:1.35;text-align:justify;${AVOID_BREAK}">
    <div style="flex:0 0 ${level[1]}pt;box-sizing:border-box;padding-left:${level[0]}pt;text-align:left;">${label}</div>
    <div style="flex:1;min-width:0;">${html}</div>
  </div>`;
}

/** One "label  :  ______" line of a fill-in table. */
function fieldRow(label: string, token: string, labelPct: number) {
  return `<tr style="border:0;">
      <td style="width:${labelPct}%;padding:4pt 0 0 0;border:0;vertical-align:bottom;">${label}</td>
      <td style="width:2%;padding:4pt 0 0 0;border:0;vertical-align:bottom;">:</td>
      <td style="padding:4pt 4pt 0 4pt;border:0;border-bottom:${LINE};vertical-align:bottom;height:12pt;">${token}</td>
    </tr>`;
}

/** Fill-in table. The ruled line ends 420pt (Word tab stop 8407) from the margin. */
function fieldTable(
  ariaLabel: string,
  rows: Array<[string, string]>,
  opts: { maxWidthPt: number; labelPct: number } = { maxWidthPt: 415, labelPct: 44 }
) {
  const body = rows.map(([label, token]) => fieldRow(label, token, opts.labelPct)).join("\n");
  return `<table aria-label="${ariaLabel}" style="border-collapse:collapse;table-layout:fixed;border:0;width:100%;max-width:${opts.maxWidthPt}pt;margin:0;">
    <tbody style="border:0;">
${body}
    </tbody>
  </table>`;
}

const HTML = `
<article class="nda-doc" style="${TEXT}line-height:1.15;padding-left:5pt;">
  <div style="text-align:center;font-weight:bold;margin:0;">NON DISCLOSURE AGREEMENT</div>
  <div style="text-align:center;font-style:italic;margin:4pt 0 0 0;">(in respect of the sale of Rivium Quadrant 75, Capelle aan den IJssel)</div>
  ${spacer()}
  ${para("The undersigned,")}
  ${spacer(4)}
  ${fieldTable("Personal details", [
    ["first name(s) in full", "{{FIRST_NAMES}}"],
    ["surname", "{{SURNAME}}"],
    ["address", "{{ADDRESS}}"],
    ["postcode and town/city", "{{POSTCODE_CITY}}"],
  ])}
  ${spacer(34)}
  ${para("acting in this matter as director having independent authority to represent:")}
  ${spacer(4)}
  ${fieldTable("Company details", [
    ["company name", "{{COMPANY_NAME}}"],
    ["with registered office in", "{{COMPANY_OFFICE}}"],
    ["principal place of business at", "{{COMPANY_ADDRESS}}"],
    ["trade register number", "{{KVK}}"],
  ])}
  ${spacer()}
  ${para(`(the &ldquo;${bold("Recipient")}&rdquo;)`)}
  ${spacer()}
  ${para("declares as follows:")}
  ${spacer()}
  ${para(bold("Recitals:"))}
  ${spacer()}
  ${para(
    `Laagraven Investment B.V. (the &quot;${bold("Vendor")}&quot;) is considering the &quot;as is&quot; sale of the property located at the Rivium Quadrant 75, 2909 LC Capelle aan den IJssel (&ldquo;${bold("Subject of Sale")}&quot;) and the Recipient is considering the purchase of the Subject of Sale.`,
    "text-align:justify;"
  )}
  ${spacer()}
  ${para(
    "In connection with the foregoing, the Vendor wishes to provide certain Confidential Information (as defined below) with respect to the Subject of Sale to the Recipient on a confidential basis.",
    "text-align:justify;"
  )}

  ${heading("1.", "Definitions")}
  ${item(L1, "1.1.", "In this NDA, the following terms shall have the following meanings:")}
  ${item(
    L2,
    "a.",
    `&quot;${bold("Confidential Information")}&quot;: all written, oral, electronic or other information of whatever nature which has been disclosed to or obtained by the Recipient and its Representatives at any time in connection with the possible sale of the Subject of Sale, as well as all knowledge, data and information related to the Subject of Sale derived therefrom;`
  )}
  ${item(
    L2,
    "b.",
    `&quot;${bold("Representative")}&quot;: (i) the members of the bodies and the employees of the Recipient (ii) any person or company (including the members of the bodies and the employees) with whom the Recipient is affiliated in a group and also every person or company (including the members of the bodies and the employees) of which the Recipient is a subsidiary or that is a subsidiary of such a person or company, and (iii) any third party (including but not limited to commercial advisor, accountants, legal counsels, consultants and auditors and including, to the extent applicable, the members of the bodies and the employees), all only to be involved or engaged by the Recipient in connection with the possible acquisition of the Subject of Sale. For the purposes of this paragraph b, a 'subsidiary' and a 'group' shall be considered to be a subsidiary or group as defined in Section 2:24a and Section 2:24b of the Dutch Civil Code.`
  )}
  ${item(L2, "c.", `&quot;${bold("NDA")}&quot;: this present non-disclosure NDA.`)}
  ${item(L1, "1.2.", "Confidential Information shall also be deemed to include:")}
  ${item(L2, "a.", "the fact that the Confidential Information has been made available to the Recipient;")}
  ${item(
    L2,
    "b.",
    "if applicable, the fact that discussions and negotiations are being held between the Recipient and the Vendor regarding the contemplated acquisition of the Subject of Sale."
  )}
  ${item(L1, "1.3.", "Confidential Information shall not be deemed to include:")}
  ${item(
    L2,
    "a.",
    "information that was already in the public domain, in the possession of or generally known or known to the Recipient or a Representative prior to disclosure by the Vendor;"
  )}
  ${item(
    L2,
    "b.",
    "information that has become available in the public domain or became generally known after having been disclosed by the Vendor to the Recipient, other than as a result of a breach of this Statement by the Recipient or its Representatives;"
  )}
  ${item(L2, "c.", "information in respect of which the Vendor has given its prior written approval that it may be released;")}
  ${item(
    L2,
    "d.",
    "information developed by the Recipient independently from the Confidential Information disclosed hereunder, in so far as the information developed by the Recipient does not contain (parts of or references to) the disclosed Confidential Information."
  )}

  ${heading("2.", "Rights of use, restrictions and publication")}
  ${item(L1, "2.1.", "The Recipient will:")}
  ${item(L2, "a.", "treat the Confidential Information confidentially and keep it carefully;")}
  ${item(
    L2,
    "b.",
    "not supply or otherwise disclose the Confidential Information, in full or in part, to persons other than its Representative, and, to its Representatives, only after having the obligations arising from this NDA imposed on the relevant Representatives. The Recipient will ensure that such Representative will be bound by and will comply with this NDA;"
  )}
  ${item(
    L2,
    "c.",
    "only use the Confidential Information itself and allow the Representative to use such Information to the extent necessary for the possible acquisition of the Subject of Sale;"
  )}
  ${item(
    L2,
    "d.",
    "only reproduce the Confidential Information or have the Confidential Information reproduced if necessary for the possible acquisition of the Subject of Sale; and"
  )}
  ${item(L2, "e.", "destroy or return the Confidential Information upon first request from the Vendor, unless it concerns:")}
  ${item(
    L3,
    "(i)",
    "Confidential Information which the Recipient and/or its Representative is required to retain based on either applicable laws or regulations or by order or a legally authorized body;"
  )}
  ${item(
    L3,
    "(ii)",
    "Confidential Information that has been automatically stored in electronic form by computer back-ups or archiving systems and is not accessible to Recipient&rsquo;s or its Representatives&rsquo; employees or officers; or"
  )}
  ${item(
    L3,
    "(iii)",
    "Confidential Information which is processed in documents used for internal decision-making at the Recipient (such as board or investment committee minutes or business cases)."
  )}
  ${para(
    "all on the understanding that any retained Confidential Information (whether or not reflected in other documents) will kept confidential, such with due observance for clause e of this Statement.",
    `margin:0 0 6pt ${L2[1]}pt;`
  )}

  ${heading("3.", "Request on legal grounds")}
  ${item(
    L1,
    "3.1.",
    "In the event the Recipient or a Representative is requested to disclose any Confidential Information on legal grounds, the Recipient will inform the Vendor of this request timely before any Confidential Information is made available, such in order to enable the Vendor to take appropriate measures to prevent the disclosure of Confidential Information or to limit its damage."
  )}

  ${heading("4.", "No offer by the Vendor or compensation from the Vendor")}
  ${item(
    L1,
    "4.1.",
    "Providing Confidential Information does not in any way constitute any offer by the Vendor to the Recipient. The Recipient acknowledges that the Vendor is not obliged to make an offer or to enter or to continue any negotiations with the Recipient, that the Vendor is allowed to change or terminate the sales process at any time or to conduct negotiations regarding the sale and purchase of the Subject of Sale with any other interested party at any time. The Vendor will never be required to pay any compensation, however named, also not in the event the negotiations with the Recipient are terminated on whatever ground or the sales process is changed or terminated. The foregoing also applies if the Recipient made an offer pertaining to the Subject of Sale and parties have negotiated following such offer."
  )}

  ${heading("5.", "Breach of this NDA")}
  ${item(
    L1,
    "5.1.",
    "If the Recipient or a Representative does not comply with this NDA, the Vendor shall be entitled to terminate the negotiations with the Recipient regarding the sale of the Subject of Sale with immediate effect, without such termination affecting the right of the Vendor to seek equitable relief (including injunctive relief and specific performance)."
  )}

  ${heading("6.", "Miscellaneous")}
  ${item(
    L1,
    "6.1.",
    "Dutch law shall apply to this NDA and the further sales process. Any dispute arising in connection with this NDA or the sales process will be settled exclusively by the competent court in Amsterdam, the Netherlands."
  )}
  ${item(
    L1,
    "6.2.",
    "This NDA terminates 1 year after the date of this NDA or at such an earlier date upon which the Vendor and the Recipient have signed a sale and purchase NDA regarding the sale and acquisition of the Subject of Sale. If the Recipient and the Vendor are still negotiating on the possible sale and acquisition of the Subject of Sale after 1 year after the date of this NDA, this NDA is being prolonged until the moment the negotiations are terminated or a sale and purchase NDA has been signed by the Parties. After the termination of this NDA, the obligations, which by their nature are meant to remain applicable, will remain in place after the termination of this NDA (such as clause 2)."
  )}

  ${spacer(6)}
  ${para("By signing this NDA, the Recipient declares to be bound by this NDA.")}
  ${spacer()}
  ${para("Signed for approval and acknowledgement,")}

  <div style="margin:40pt 0 0 0;${AVOID_BREAK}">
    <div style="width:177.7pt;max-width:100%;min-height:36pt;border-bottom:${LINE};display:flex;align-items:flex-end;">{{SIGNATURE_BLOCK}}</div>
    <div style="font-weight:bold;margin:2pt 0 0 0;">Recipient</div>
    ${fieldTable(
      "Signature details",
      [
        ["By", "{{NAME}}"],
        ["Date", "{{DATE}}"],
      ],
      { maxWidthPt: 217, labelPct: 33 }
    )}
  </div>
</article>
`;

export const ECLIPSE_NDA_TEMPLATE: HtmlNdaTemplate = {
  fields: [
    // ── Investor (each signer fills) ─────────────────────────────────────
    // NAME = the single "Full name" input on the signing page header; it also
    // fills the "By:" line. FIRST_NAMES / SURNAME are derived from it by the
    // signing flow (listed so the blank-NDA download shows English labels).
    { key: "NAME", label: "Full name", required: true },
    { key: "FIRST_NAMES", label: "First name(s) in full" },
    { key: "SURNAME", label: "Surname" },
    { key: "ADDRESS", label: "Address", required: true },
    { key: "POSTCODE_CITY", label: "Postcode and town/city", required: true },
    // Only for signers acting on behalf of a company.
    { key: "COMPANY_NAME", label: "Company name", required: false },
    { key: "COMPANY_OFFICE", label: "Registered office in", required: false },
    { key: "COMPANY_ADDRESS", label: "Principal place of business at", required: false },
    { key: "KVK", label: "Trade register number", required: false },
  ],
  html: HTML.trim(),
};
