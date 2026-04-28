// Default NDA template lifted from "NDA Test 2.0" — used as the seed when an
// admin enables the HTML NDA flow on an asset for the first time. Editable
// per asset via the admin UI; this constant is the fallback / starter.

export interface TemplateField {
  key: string;
  label: string;
  type?: "text" | "email" | "number";
  prefill?: string;
  required?: boolean;
  /** When true, hidden from the investor — admin pre-fills only. */
  adminOnly?: boolean;
}

export interface HtmlNdaTemplate {
  html: string;
  fields: TemplateField[];
}

export const DEFAULT_NDA_TEMPLATE: HtmlNdaTemplate = {
  fields: [
    { key: "BUILDING_NAME", label: "Building name", adminOnly: true },
    { key: "CITY", label: "City", adminOnly: true },
    { key: "VENDOR", label: "Vendor", adminOnly: true },
    { key: "ADDRESS", label: "Subject of sale address", adminOnly: true },
    { key: "NAME", label: "First name(s) in full", required: true },
    { key: "SURNAME", label: "Surname", required: true },
    { key: "ADDRESS_SIGNEE", label: "Your address", required: true },
    { key: "POSTCODE_CITY", label: "Postcode and town/city", required: true },
    { key: "COMPANY_NAME", label: "Company name", required: true },
    { key: "OFFICE", label: "Registered office in", required: true },
    { key: "KVK", label: "Trade register number (KVK)", required: true },
  ],
  html: `
<article class="nda">
  <h1 style="text-align:center;font-size:18px;margin:0 0 4px 0;">NON DISCLOSURE AGREEMENT</h1>
  <p style="text-align:center;font-style:italic;margin:0 0 24px 0;">(in respect of the sale of {{BUILDING_NAME}}, {{CITY}})</p>

  <p>The undersigned,</p>

  <table style="width:100%;border-collapse:collapse;margin:12px 0;">
    <tr><td style="padding:4px 8px;width:40%;">first name(s) in full</td><td style="padding:4px 8px;">: <span class="field">{{NAME}}</span></td></tr>
    <tr><td style="padding:4px 8px;">surname</td><td style="padding:4px 8px;">: <span class="field">{{SURNAME}}</span></td></tr>
    <tr><td style="padding:4px 8px;">address</td><td style="padding:4px 8px;">: <span class="field">{{ADDRESS_SIGNEE}}</span></td></tr>
    <tr><td style="padding:4px 8px;">postcode and town/city</td><td style="padding:4px 8px;">: <span class="field">{{POSTCODE_CITY}}</span></td></tr>
  </table>

  <p>acting in this matter as director having independent authority to represent:</p>

  <table style="width:100%;border-collapse:collapse;margin:12px 0;">
    <tr><td style="padding:4px 8px;width:40%;">company name</td><td style="padding:4px 8px;">: <span class="field">{{COMPANY_NAME}}</span></td></tr>
    <tr><td style="padding:4px 8px;">with registered office in</td><td style="padding:4px 8px;">: <span class="field">{{OFFICE}}</span></td></tr>
    <tr><td style="padding:4px 8px;">trade register number</td><td style="padding:4px 8px;">: <span class="field">{{KVK}}</span></td></tr>
  </table>

  <p>(the "<strong>Recipient</strong>")</p>
  <p>declares as follows:</p>

  <h2 style="font-size:14px;margin:16px 0 8px 0;">Recitals:</h2>
  <p>{{VENDOR}} (the "<strong>Vendor</strong>") is considering the "as is" sale of the property located at the {{ADDRESS}} ("<strong>Subject of Sale</strong>") and the Recipient is considering the purchase of the Subject of Sale.</p>
  <p>In connection with the foregoing, the Vendor wishes to provide certain Confidential Information (as defined below) with respect to the Subject of Sale to the Recipient on a confidential basis.</p>

  <h2 style="font-size:14px;margin:16px 0 8px 0;">1. Definitions</h2>
  <p>1.1. In this NDA, the following terms shall have the following meanings:</p>
  <p style="margin-left:24px;"><strong>a.</strong> "<strong>Confidential Information</strong>": all written, oral, electronic or other information of whatever nature which has been disclosed to or obtained by the Recipient and its Representatives at any time in connection with the possible sale of the Subject of Sale, as well as all knowledge, data and information related to the Subject of Sale derived therefrom;</p>
  <p style="margin-left:24px;"><strong>b.</strong> "<strong>Representative</strong>": (i) the members of the bodies and the employees of the Recipient (ii) any person or company (including the members of the bodies and the employees) with whom the Recipient is affiliated in a group and also every person or company (including the members of the bodies and the employees) of which the Recipient is a subsidiary or that is a subsidiary of such a person or company, and (iii) any third party (including but not limited to commercial advisor, accountants, legal counsels, consultants and auditors and including, to the extent applicable, the members of the bodies and the employees), all only to be involved or engaged by the Recipient in connection with the possible acquisition of the Subject of Sale. For the purposes of this paragraph b, a 'subsidiary' and a 'group' shall be considered to be a subsidiary or group as defined in Section 2:24a and Section 2:24b of the Dutch Civil Code.</p>
  <p style="margin-left:24px;"><strong>c.</strong> "<strong>NDA</strong>": this present non-disclosure NDA.</p>

  <p>1.2. Confidential Information shall also be deemed to include:</p>
  <p style="margin-left:24px;"><strong>a.</strong> the fact that the Confidential Information has been made available to the Recipient;</p>
  <p style="margin-left:24px;"><strong>b.</strong> if applicable, the fact that discussions and negotiations are being held between the Recipient and the Vendor regarding the contemplated acquisition of the Subject of Sale.</p>

  <p>1.3. Confidential Information shall not be deemed to include:</p>
  <p style="margin-left:24px;"><strong>a.</strong> information that was already in the public domain, in the possession of or generally known or known to the Recipient or a Representative prior to disclosure by the Vendor;</p>
  <p style="margin-left:24px;"><strong>b.</strong> information that has become available in the public domain or became generally known after having been disclosed by the Vendor to the Recipient, other than as a result of a breach of this Statement by the Recipient or its Representatives;</p>
  <p style="margin-left:24px;"><strong>c.</strong> information in respect of which the Vendor has given its prior written approval that it may be released;</p>
  <p style="margin-left:24px;"><strong>d.</strong> information developed by the Recipient independently from the Confidential Information disclosed hereunder, in so far as the information developed by the Recipient does not contain (parts of or references to) the disclosed Confidential Information.</p>

  <h2 style="font-size:14px;margin:16px 0 8px 0;">2. Rights of use, restrictions and publication</h2>
  <p>2.1. The Recipient will:</p>
  <p style="margin-left:24px;"><strong>a.</strong> treat the Confidential Information confidentially and keep it carefully;</p>
  <p style="margin-left:24px;"><strong>b.</strong> not supply or otherwise disclose the Confidential Information, in full or in part, to persons other than its Representative, and, to its Representatives, only after having the obligations arising from this NDA imposed on the relevant Representatives. The Recipient will ensure that such Representative will be bound by and will comply with this NDA;</p>
  <p style="margin-left:24px;"><strong>c.</strong> only use the Confidential Information itself and allow the Representative to use such Information to the extent necessary for the possible acquisition of the Subject of Sale;</p>
  <p style="margin-left:24px;"><strong>d.</strong> only reproduce the Confidential Information or have the Confidential Information reproduced if necessary for the possible acquisition of the Subject of Sale; and</p>
  <p style="margin-left:24px;"><strong>e.</strong> destroy or return the Confidential Information upon first request from the Vendor, unless it concerns:</p>
  <p style="margin-left:48px;">(i) Confidential Information which the Recipient and/or its Representative is required to retain based on either applicable laws or regulations or by order or a legally authorized body;</p>
  <p style="margin-left:48px;">(ii) Confidential Information that has been automatically stored in electronic form by computer back-ups or archiving systems and is not accessible to Recipient's or its Representatives' employees or officers; or</p>
  <p style="margin-left:48px;">(iii) Confidential Information which is processed in documents used for internal decision-making at the Recipient (such as board or investment committee minutes or business cases).</p>
  <p style="margin-left:24px;">all on the understanding that any retained Confidential Information (whether or not reflected in other documents) will kept confidential, such with due observance for clause e of this Statement.</p>

  <h2 style="font-size:14px;margin:16px 0 8px 0;">3. Request on legal grounds</h2>
  <p>3.1. In the event the Recipient or a Representative is requested to disclose any Confidential Information on legal grounds, the Recipient will inform the Vendor of this request timely before any Confidential Information is made available, such in order to enable the Vendor to take appropriate measures to prevent the disclosure of Confidential Information or to limit its damage.</p>

  <h2 style="font-size:14px;margin:16px 0 8px 0;">4. No offer by the Vendor or compensation from the Vendor</h2>
  <p>4.1. Providing Confidential Information does not in any way constitute any offer by the Vendor to the Recipient. The Recipient acknowledges that the Vendor is not obliged to make an offer or to enter or to continue any negotiations with the Recipient, that the Vendor is allowed to change or terminate the sales process at any time or to conduct negotiations regarding the sale and purchase of the Subject of Sale with any other interested party at any time. The Vendor will never be required to pay any compensation, however named, also not in the event the negotiations with the Recipient are terminated on whatever ground or the sales process is changed or terminated. The foregoing also applies if the Recipient made an offer pertaining to the Subject of Sale and parties have negotiated following such offer.</p>

  <h2 style="font-size:14px;margin:16px 0 8px 0;">5. Breach of this NDA</h2>
  <p>5.1. If the Recipient or a Representative does not comply with this NDA, the Vendor shall be entitled to terminate the negotiations with the Recipient regarding the sale of the Subject of Sale with immediate effect, without such termination affecting the right of the Vendor to seek equitable relief (including injunctive relief and specific performance).</p>

  <h2 style="font-size:14px;margin:16px 0 8px 0;">6. Miscellaneous</h2>
  <p>6.1. Dutch law shall apply to this NDA and the further sales process. Any dispute arising in connection with this NDA or the sales process will be settled exclusively by the competent court in Amsterdam, the Netherlands.</p>
  <p>6.2. This NDA terminates 1 year after the date of this NDA or at such an earlier date upon which the Vendor and the Recipient have signed a sale and purchase NDA regarding the sale and acquisition of the Subject of Sale. If the Recipient and the Vendor are still negotiating on the possible sale and acquisition of the Subject of Sale after 1 year after the date of this NDA, this NDA is being prolonged until the moment the negotiations are terminated or a sale and purchase NDA has been signed by the Parties. After the termination of this NDA, the obligations, which by their nature are meant to remain applicable, will remain in place after the termination of this NDA (such as clause 2).</p>

  <p style="margin-top:24px;">By signing this NDA, the Recipient declares to be bound by this NDA.</p>

  <p style="margin-top:24px;">Signed for approval and acknowledgement,</p>

  <div style="margin-top:24px;border-top:1px solid #000;padding-top:8px;display:inline-block;min-width:240px;">{{SIGNATURE_BLOCK}}</div>
  <p style="margin:4px 0 0 0;"><strong>Recipient</strong></p>
  <p style="margin:0;">By: <span class="field">{{NAME}} {{SURNAME}}</span></p>
  <p style="margin:0;">Date: <span class="field">{{DATE}}</span></p>
</article>
`.trim(),
};

// Accepts both {{TOKEN}} and {token}. Case-insensitive — keys are normalised
// to UPPERCASE so the same field works regardless of how the lawyer typed it
// in Word ({surname}, {SURNAME}, {{Surname}} all resolve to SURNAME).
const TOKEN_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}|\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/** Substitute every {{TOKEN}} or {TOKEN} in the template with the matching value. */
export function renderTemplate(html: string, values: Record<string, string>): string {
  return html.replace(TOKEN_REGEX, (full, double, single) => {
    const raw = (double ?? single) as string | undefined;
    if (!raw) return full;
    const key = raw.toUpperCase();
    const v = values[key];
    return v == null ? full : escapeHtml(v);
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Pull every {{TOKEN}} / {TOKEN} the template references — used to drive field coverage. */
export function extractTokens(html: string): string[] {
  const set = new Set<string>();
  let m;
  TOKEN_REGEX.lastIndex = 0;
  while ((m = TOKEN_REGEX.exec(html)) !== null) {
    const raw = m[1] ?? m[2];
    if (raw) set.add(raw.toUpperCase());
  }
  return Array.from(set).sort();
}

/** Tokens the system fills automatically — never shown to admin or investor as inputs. */
export const RESERVED_TOKENS = new Set(["SIGNATURE", "SIGNATURE_BLOCK", "DATE"]);

/**
 * After renderTemplate, swap any signature placeholder for the actual image.
 * Accepts {SIGNATURE}, {{SIGNATURE}}, {SIGNATURE_BLOCK}, {{SIGNATURE_BLOCK}}
 * (case-insensitive) so it works whatever the lawyer typed.
 */
export function injectSignature(html: string, signatureImgHtml: string): string {
  return html.replace(
    /\{\{(signature(?:_block)?)\}\}|\{(signature(?:_block)?)\}/gi,
    signatureImgHtml
  );
}
