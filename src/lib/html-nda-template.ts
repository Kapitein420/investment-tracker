// Default NDA template — Orizon-style Dutch NDA (geheimhoudingsverklaring).
// Matches the preview.html design Noah delivered: A4 layout, Times New
// Roman, the three "Handelend als" lines kept as plain informational
// text, and the vendor identity block hard-coded (Orizon B.V. / Noventa).
// If a future asset needs a different vendor block, edit the template
// per-asset via the admin UI.

export interface TemplateField {
  key: string;
  label: string;
  type?: "text" | "email" | "number" | "tel" | "select" | "date";
  /** Options for `type: "select"`. Each entry is the literal value persisted. */
  options?: string[];
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
    // ── Asset-level (admin pre-fills once per asset) ─────────────────────
    { key: "SALE_DESCRIPTION", label: "Subject of sale (omschrijving propositie / portefeuille)", adminOnly: true, required: true },
    { key: "BROKER_NAME", label: "Broker name (makelaar verkoper)", adminOnly: true, prefill: "DILS", required: true },

    // ── Investor (each signer fills) ─────────────────────────────────────
    // NAME = the single "Full name" input on the signing page header.
    // FIRST_NAMES / SURNAME are derived from NAME by the signing flow.
    { key: "NAME", label: "Full name", required: true },
    { key: "DOB_PLACE", label: "Geboortedatum en plaats", prefill: "12-03-1985, Amsterdam", required: true },
    { key: "PHONE", label: "Telefoonnummer", type: "tel", required: true },
    { key: "COMPANY_NAME", label: "Naam rechtspersoon of vennootschap", required: false },
    { key: "COMPANY_OFFICE", label: "Statutair gevestigd te", required: false },
    { key: "KVK", label: "KvK-nummer", required: false },
    { key: "COMPANY_ADDRESS", label: "Adres", required: false },
    { key: "POSTCODE_CITY", label: "Postcode en plaats", required: false },
    { key: "SIGNING_PLACE", label: "Plaats van ondertekening", prefill: "Amsterdam", required: true },
  ],
  html: `
<style>
  .nda-doc { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.28; color: #000; }
  .nda-doc h1 { margin: 0 0 28px 0; font-size: 11pt; font-weight: bold; text-decoration: underline; }
  .nda-doc h2 { margin: 22px 0 8px 0; font-size: 11pt; font-weight: bold; text-transform: uppercase; }
  .nda-doc p { margin: 0 0 10px 0; }
  .nda-doc .nda-fields { border-collapse: collapse; margin: 0 0 12px 0; width: 100%; }
  .nda-doc .nda-fields td { padding: 0 0 4px 0; vertical-align: bottom; }
  .nda-doc .nda-fields td:first-child { width: 205px; }
  .nda-doc .field { display: inline-block; min-width: 220px; padding: 0 4px 1px 4px; border-bottom: 1px solid #000; }
  .nda-doc .field-inline { display: inline-block; min-width: 200px; padding: 0 4px; border-bottom: 1px solid #000; }
  .nda-doc .definitions { width: 100%; border-collapse: collapse; margin: 6px 0 22px 0; }
  .nda-doc .definitions td { vertical-align: top; padding: 0 0 12px 0; }
  .nda-doc .definitions td:first-child { width: 150px; padding-right: 18px; }
  .nda-doc .defs-list { margin: 0; padding: 0; list-style: none; }
  .nda-doc .defs-list li { margin: 0 0 8px 0; }
  .nda-doc .letter-list { margin: 0; padding: 0; list-style: none; }
  .nda-doc .letter-list li { margin: 0 0 8px 0; display: flex; gap: 8px; }
  .nda-doc .letter-list .letter { width: 18px; flex: 0 0 18px; }
  .nda-doc .letter-list .text { flex: 1; }
  .nda-doc .signature-block { margin-top: 28px; }
  .nda-doc .signature-row { margin: 0 0 20px 0; }
  .nda-doc .signature-label { display: inline-block; min-width: 90px; }
</style>
<article class="nda-doc">
  <h1>Geheimhoudingsverklaring</h1>

  <p>De ondergetekende(n):</p>

  <table class="nda-fields" aria-label="Persoonsgegevens">
    <tr><td>Volledige voornamen:</td><td><span class="field">{{FIRST_NAMES}}</span></td></tr>
    <tr><td>Achternaam:</td><td><span class="field">{{SURNAME}}</span></td></tr>
    <tr><td>Geboortedatum en plaats:</td><td><span class="field">{{DOB_PLACE}}</span></td></tr>
    <tr><td>Email:</td><td><span class="field">{{EMAIL}}</span></td></tr>
    <tr><td>Telefoonnummer:</td><td><span class="field">{{PHONE}}</span></td></tr>
  </table>

  <p>Handelend voor zich: of</p>
  <p>Handelend als rechtsgeldig(e) vertegenwoordiger(s) van: of</p>
  <p>Handelend als adviseur van (en haar gelieerde ondernemingen casu quo rechtsopvolgers):</p>

  <table class="nda-fields" aria-label="Rechtspersoon of vennootschap">
    <tr><td>Naam rechtspersoon of vennootschap:</td><td><span class="field">{{COMPANY_NAME}}</span></td></tr>
    <tr><td>Statutair gevestigd te:</td><td><span class="field">{{COMPANY_OFFICE}}</span></td></tr>
    <tr><td>KvK-nummer:</td><td><span class="field">{{KVK}}</span></td></tr>
    <tr><td>Adres:</td><td><span class="field">{{COMPANY_ADDRESS}}</span></td></tr>
    <tr><td>Postcode en plaats:</td><td><span class="field">{{POSTCODE_CITY}}</span></td></tr>
  </table>

  <p>De ondergetekende(n), (&ldquo;<strong>Gegadigde</strong>&rdquo;), verklaart (verklaren) hierbij jegens Orizon B.V., een besloten vennootschap met beperkte aansprakelijkheid, statutair gevestigd te 's-Gravenhage, kantoorhoudende te Prinses Beatrixlaan 582, 2595 BM 's-Gravenhage, ingeschreven in het Handelsregister van de Kamer van Koophandel onder nummer 98434322, handelend als beheerder en bewaarder van het fonds voor gemene rekening &ldquo;Noventa&rdquo;</p>

  <p>(&ldquo;<strong>Verkoper</strong>&rdquo;) dat Gegadigde zich tot het in deze geheimhoudingsverklaring bepaalde verplicht, op grond waarvan Verkoper bereid is aan Gegadigde Vertrouwelijke Informatie, zoals hierna gedefinieerd, mede te delen (of te laten mede delen) in het kader van de verkoop van <span class="field-inline">{{SALE_DESCRIPTION}}</span> (&ldquo;<strong>Verkoopproces</strong>&rdquo;).</p>

  <h2>1. DEFINITIES</h2>
  <p>In deze geheimhoudingsverklaring wordt verstaan onder:</p>

  <table class="definitions">
    <tr>
      <td>Betrokkene:</td>
      <td>
        <ul class="defs-list">
          <li>(i)&nbsp;&nbsp;elke vennootschap en/of rechtspersoon (daaronder begrepen de leden van de organen - en de medewerkers van elke vennootschap en/of rechtspersoon) waarmee Gegadigde in een Groep is verbonden of waarvan Gegadigde een Dochtermaatschappij is; en</li>
          <li>(ii)&nbsp;&nbsp;elke door Gegadigde in het kader van het Verkoopproces ingeschakelde adviseur (daaronder begrepen, voor zover van toepassing, de leden van de organen - en de medewerkers van de adviseur(s));</li>
          <li>(iii)&nbsp;&nbsp;elke medewerker van Gegadigde.</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td>Dochtermaatschappij:</td>
      <td>een dochtermaatschappij als bedoeld in artikel 2:24a Burgerlijk Wetboek.</td>
    </tr>
    <tr>
      <td>Groep:</td>
      <td>een groep als bedoeld in artikel 2:24b Burgerlijk Wetboek.</td>
    </tr>
    <tr>
      <td>Vertrouwelijke informatie:</td>
      <td>alle kennis, gegevens en informatie die in verband met deelname van Gegadigde aan het Verkoopproces te eniger tijd hetzij schriftelijk, hetzij anderszins, door of namens Verkoper aan Gegadigde bekend is gemaakt of door hem is verkregen, alsmede alle daarvan afgeleide kennis, gegevens en informatie, voor zover zulke kennis, gegevens en informatie ten tijde van zulke bekendmaken of verkrijgen niet:<br><br>
        (i)&nbsp;&nbsp;reeds rechtmatig in bezit van Gegadigde is; of<br>
        (ii)&nbsp;&nbsp;openbaar is.
      </td>
    </tr>
  </table>

  <h2>2. &nbsp;RESTRICTIES</h2>
  <p>Gegadigde verbindt zich:</p>
  <ol class="letter-list">
    <li><span class="letter">a.</span><span class="text">geen mededeling te doen aan een derde, niet zijnde een Betrokkene, omtrent (de uitnodiging tot) deelname aan het Verkoopproces, en/of het feit dat er besprekingen en onderhandelingen worden gevoerd tussen de Gegadigde en Verkoper, en al hetgeen daarmee verband houdt;</span></li>
    <li><span class="letter">b.</span><span class="text">de Vertrouwelijke Informatie niet gebruiken voor enig ander doel dan in het kader van diens deelname aan het Verkoopproces;</span></li>
    <li><span class="letter">c.</span><span class="text">de Vertrouwelijke Informatie niet, geheel of gedeeltelijk, te verstrekken of anderszins bekend te maken aan andere personen dan een Betrokkene die van deze informatie kennis moet kunnen nemen voor de door hem uit te voeren werkzaamheden;</span></li>
    <li><span class="letter">d.</span><span class="text">de Vertrouwelijke Informatie vertrouwelijk te behandelen, zorgvuldig te (doen) bewaren en ervoor te zorgen dat een derde niet in strijd met deze geheimhoudingsverklaring van zulke Vertrouwelijke Informatie kennis krijgt;</span></li>
    <li><span class="letter">e.</span><span class="text">de Vertrouwelijke Informatie uitsluitend te &lsquo;doen&rsquo; gebruiken voor zover dat noodzakelijk is met het oog op deelname aan het Verkoopproces;</span></li>
    <li><span class="letter">f.</span><span class="text">de Vertrouwelijke Informatie uitsluitend te vermenigvuldigen voor zover dat noodzakelijk is met het oog op het onder d. bedoelde gebruik; en</span></li>
    <li><span class="letter">g.</span><span class="text">alle correspondentie of communicatie met betrekking tot het Verkoopproces uitsluitend te richten aan <span class="field-inline">{{BROKER_NAME}}</span> en geen contact te zoeken met enige directeur of medewerker verbonden aan de Verkoper en/of aan NLV B.V., huurders of gebruikers van de registergoederen met betrekking tot de Verkoopprocedure, tenzij schriftelijk met de Verkoper of <span class="field-inline">{{BROKER_NAME}}</span> overeengekomen.</span></li>
  </ol>

  <h2>3. OPENBAARMAKING AAN EN GEBRUIK DOOR EEN BETROKKENE</h2>
  <p>Gegadigde is gerechtigd Vertrouwelijke Informatie zonder toestemming van Verkoper aan een Betrokkene openbaar te maken, voor zover dat noodzakelijk is het met oog op deelname aan het Verkoopproces, en mits de betreffende Betrokkene zich tot het in deze geheimhoudingsverklaring bepaalde heeft verplicht. Op eerste verzoek zal Gegadigde haar Adviseur eenzelfde geheimhoudingsverklaring laten tekenen als de onderhavige. Adviseur die reeds op grond van hun professie een geheimhoudingsplicht hebben, zoals advocaten en notarissen, behoeven deze verklaring niet te tekenen. Gegadigde staat er jegens Eigenaar voor in, dat haar medewerkers en ingeschakelde Adviseur respectievelijk de hiervoor bedoelde geheimhoudingsverplichting nakomt.</p>

  <h2>4. GEEN EXCLUSIVITEIT</h2>
  <p>De Gegadigde zal op geen enkel moment aanspraak kunnen maken op exclusiviteit en het is de Verkoper op ieder moment toegestaan om enige onderhandelingen met Gegadigde te beëindigen, om het Verkoopproces te bespreken met enige andere potentiële koper of om het Verkoopproces te beëindigen, tenzij met Gegadigde schriftelijk anders is overeengekomen.</p>

  <h2>5. SCHENDING VAN DE GEHEIMHOUDINGSVERKLARING</h2>
  <p>In geval van schending door Gegadigde of een Betrokkene van het in deze geheimhoudingsverklaring bepaalde, is Gegadigde aansprakelijk &ndash; zowel jegens Eigenaar als enige andere partij die als gevolg van die schending schade lijdt &ndash; voor alle de door die schending ontstane schade. Gegadigde vrijwaart Eigenaar en voormelde partijen voor enige aanspraken van derden dienaangaande. Eigenaar heeft het recht Gegadigde uit te sluiten van het verkoopproces.</p>

  <h2>6. EINDE VERKOOPPROCES</h2>
  <p>Indien het Verkoopproces anders eindigt dan door gunning aan Gegadigde:</p>
  <ol class="letter-list">
    <li><span class="letter">a.</span><span class="text">eindigen de verplichtingen van Gegadigde uit deze geheimhoudingsverklaring in alle gevallen na ommekomst van een periode van 12 maanden na ondertekening; en</span></li>
    <li><span class="letter">b.</span><span class="text">zal Gegadigde na ontvangst van een bericht daartoe van Verkoper terstond alle Vertrouwelijke Informatie aan Verkoper retourneren met inbegrip van kopieën daarvan, dan wel de Vertrouwelijke Informatie vernietigen.</span></li>
  </ol>

  <h2>7. TOEPASSELIJK RECHT</h2>
  <p>Op deze geheimhoudingsverklaring is Nederlands recht van toepassing. Geschillen die in verband met deze geheimhoudingsverklaring ontstaan, zullen bij uitsluiting worden beslecht door de bevoegde rechter te Amsterdam.</p>

  <p style="margin-top:24px;"><strong>GEGADIGDE:</strong></p>

  <div class="signature-block">
    <p class="signature-row">Voor akkoord getekend te <span class="field-inline">{{SIGNING_PLACE}}</span> op <span class="field-inline">{{DATE}}</span>.</p>
    <p class="signature-row"><span class="signature-label">Handtekening:</span> {{SIGNATURE_BLOCK}}</p>
    <p class="signature-row"><span class="signature-label">Naam:</span> <span class="field-inline">{{NAME}}</span></p>
  </div>
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
export const RESERVED_TOKENS = new Set([
  "SIGNATURE",
  "SIGNATURE_BLOCK",
  "DATE",
  "FIRST_NAMES",
  "SURNAME",
  "EMAIL",
]);

/**
 * After renderTemplate, swap any signature placeholder for the actual image.
 * Accepts {SIGNATURE}, {{SIGNATURE}}, {SIGNATURE_BLOCK}, {{SIGNATURE_BLOCK}}
 * (case-insensitive) so it works whatever the lawyer typed.
 */
export function injectSignature(html: string, signatureHtml: string): string {
  return html.replace(
    /\{\{?(SIGNATURE(?:_BLOCK)?)\}?\}/gi,
    () => signatureHtml
  );
}
