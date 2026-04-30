// Default NDA template — Orizon-style Dutch NDA (geheimhoudingsverklaring).
// Used as the seed when an admin enables the HTML NDA flow on an asset for
// the first time. Editable per asset via the admin UI; this constant is the
// fallback / starter for new assets only — existing assets keep whatever
// template was stored on them.

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

/**
 * Capacity (`Handelend als…`) gets a select on the signing form. The value
 * persisted is the literal Dutch sentence; the signing page uses it as-is
 * to build the rendered "Handelend als …" line, optionally suffixed with
 * the signer's company name.
 *
 * Exported so the signing page can branch on it (only "voor zich" omits
 * the company-name suffix when rendering CAPACITY_TEXT).
 */
export const CAPACITY_OPTIONS = [
  "voor zich",
  "rechtsgeldig vertegenwoordiger van",
  "adviseur van",
] as const;
export type CapacityValue = (typeof CAPACITY_OPTIONS)[number];

export const DEFAULT_NDA_TEMPLATE: HtmlNdaTemplate = {
  fields: [
    // ── Asset-level (admin pre-fills once per asset) ─────────────────────
    { key: "SALE_DESCRIPTION", label: "Subject of sale (omschrijving propositie / portefeuille)", adminOnly: true, required: true },
    { key: "BROKER_NAME", label: "Broker name (makelaar verkoper)", adminOnly: true, prefill: "DILS", required: true },
    { key: "VENDOR_NAME", label: "Vendor (legal entity)", adminOnly: true, prefill: "Orizon B.V.", required: true },
    { key: "VENDOR_LEGAL_OFFICE", label: "Vendor — statutair gevestigd te", adminOnly: true, prefill: "'s-Gravenhage", required: true },
    { key: "VENDOR_ADDRESS", label: "Vendor — kantooradres", adminOnly: true, prefill: "Prinses Beatrixlaan 582, 2595 BM 's-Gravenhage", required: true },
    { key: "VENDOR_KVK", label: "Vendor KvK-nummer", adminOnly: true, prefill: "98434322", required: true },
    { key: "FUND_NAME", label: "Fund name (fonds voor gemene rekening)", adminOnly: true, prefill: "Noventa", required: false },
    { key: "THIRD_PARTY", label: "Third party referenced in §2.g", adminOnly: true, prefill: "NLV B.V.", required: false },

    // ── Investor (each signer fills) ─────────────────────────────────────
    // NAME is the single "Full name" input on the signing page header —
    // the signing page splits it into FIRST_NAMES + SURNAME so the
    // template renders the Dutch "Volledige voornamen / Achternaam"
    // structure cleanly without asking the signer twice.
    { key: "NAME", label: "Full name", required: true },
    { key: "DOB_PLACE", label: "Geboortedatum en plaats", prefill: "12-03-1985, Amsterdam", required: true },
    { key: "PHONE", label: "Telefoonnummer", type: "tel", required: true },
    {
      key: "CAPACITY",
      label: "Handelend als",
      type: "select",
      options: [...CAPACITY_OPTIONS],
      required: true,
    },
    { key: "COMPANY_NAME", label: "Naam rechtspersoon of vennootschap", required: false },
    { key: "COMPANY_OFFICE", label: "Statutair gevestigd te", required: false },
    { key: "KVK", label: "KvK-nummer", required: false },
    { key: "COMPANY_ADDRESS", label: "Adres", required: false },
    { key: "POSTCODE_CITY", label: "Postcode en plaats", required: false },
    { key: "SIGNING_PLACE", label: "Plaats van ondertekening", prefill: "Amsterdam", required: true },
  ],
  html: `
<article class="nda">
  <h1 style="text-align:center;font-size:18px;margin:0 0 16px 0;">Geheimhoudingsverklaring</h1>

  <p>De ondergetekende(n):</p>

  <table style="width:100%;border-collapse:collapse;margin:12px 0;">
    <tr><td style="padding:4px 8px;width:40%;">Volledige voornamen</td><td style="padding:4px 8px;">: <span class="field">{{FIRST_NAMES}}</span></td></tr>
    <tr><td style="padding:4px 8px;">Achternaam</td><td style="padding:4px 8px;">: <span class="field">{{SURNAME}}</span></td></tr>
    <tr><td style="padding:4px 8px;">Geboortedatum en plaats</td><td style="padding:4px 8px;">: <span class="field">{{DOB_PLACE}}</span></td></tr>
    <tr><td style="padding:4px 8px;">Email</td><td style="padding:4px 8px;">: <span class="field">{{EMAIL}}</span></td></tr>
    <tr><td style="padding:4px 8px;">Telefoonnummer</td><td style="padding:4px 8px;">: <span class="field">{{PHONE}}</span></td></tr>
  </table>

  <p style="margin:12px 0;"><strong>Handelend als:</strong> <span class="field">{{CAPACITY_TEXT}}</span></p>

  <table style="width:100%;border-collapse:collapse;margin:12px 0;">
    <tr><td style="padding:4px 8px;width:40%;">Naam rechtspersoon of vennootschap</td><td style="padding:4px 8px;">: <span class="field">{{COMPANY_NAME}}</span></td></tr>
    <tr><td style="padding:4px 8px;">Statutair gevestigd te</td><td style="padding:4px 8px;">: <span class="field">{{COMPANY_OFFICE}}</span></td></tr>
    <tr><td style="padding:4px 8px;">KvK-nummer</td><td style="padding:4px 8px;">: <span class="field">{{KVK}}</span></td></tr>
    <tr><td style="padding:4px 8px;">Adres</td><td style="padding:4px 8px;">: <span class="field">{{COMPANY_ADDRESS}}</span></td></tr>
    <tr><td style="padding:4px 8px;">Postcode en plaats</td><td style="padding:4px 8px;">: <span class="field">{{POSTCODE_CITY}}</span></td></tr>
  </table>

  <p>De ondergetekende(n), (&ldquo;<strong>Gegadigde</strong>&rdquo;), verklaart (verklaren) hierbij jegens <span class="field">{{VENDOR_NAME}}</span>, een besloten vennootschap met beperkte aansprakelijkheid, statutair gevestigd te <span class="field">{{VENDOR_LEGAL_OFFICE}}</span>, kantoorhoudende te <span class="field">{{VENDOR_ADDRESS}}</span>, ingeschreven in het Handelsregister van de Kamer van Koophandel onder nummer <span class="field">{{VENDOR_KVK}}</span>, handelend als beheerder en bewaarder van het fonds voor gemene rekening &ldquo;<span class="field">{{FUND_NAME}}</span>&rdquo; (&ldquo;<strong>Verkoper</strong>&rdquo;) dat Gegadigde zich tot het in deze geheimhoudingsverklaring bepaalde verplicht, op grond waarvan Verkoper bereid is aan Gegadigde Vertrouwelijke Informatie, zoals hierna gedefinieerd, mede te delen (of te laten mede delen) in het kader van de verkoop van <span class="field">{{SALE_DESCRIPTION}}</span> (&ldquo;<strong>Verkoopproces</strong>&rdquo;).</p>

  <h2 style="font-size:14px;margin:18px 0 8px 0;">1. DEFINITIES</h2>
  <p>In deze geheimhoudingsverklaring wordt verstaan onder:</p>
  <p><strong>Betrokkene:</strong></p>
  <p style="margin-left:24px;">(i) elke vennootschap en/of rechtspersoon (daaronder begrepen de leden van de organen - en de medewerkers van elke vennootschap en/of rechtspersoon) waarmee Gegadigde in een Groep is verbonden of waarvan Gegadigde een Dochtermaatschappij is; en</p>
  <p style="margin-left:24px;">(ii) elke door Gegadigde in het kader van het Verkoopproces ingeschakelde adviseur (daaronder begrepen, voor zover van toepassing, de leden van de organen - en de medewerkers van de adviseur(s));</p>
  <p style="margin-left:24px;">(iii) elke medewerker van Gegadigde.</p>

  <p><strong>Dochtermaatschappij:</strong></p>
  <p style="margin-left:24px;">een dochtermaatschappij als bedoeld in artikel 2:24a Burgerlijk Wetboek.</p>

  <p><strong>Groep:</strong></p>
  <p style="margin-left:24px;">een groep als bedoeld in artikel 2:24b Burgerlijk Wetboek.</p>

  <p><strong>Vertrouwelijke informatie:</strong></p>
  <p style="margin-left:24px;">alle kennis, gegevens en informatie die in verband met deelname van Gegadigde aan het Verkoopproces te eniger tijd hetzij schriftelijk, hetzij anderszins, door of namens Verkoper aan Gegadigde bekend is gemaakt of door hem is verkregen, alsmede alle daarvan afgeleide kennis, gegevens en informatie, voor zover zulke kennis, gegevens en informatie ten tijde van zulke bekendmaken of verkrijgen niet:</p>
  <p style="margin-left:48px;">(i) reeds rechtmatig in bezit van Gegadigde is; of</p>
  <p style="margin-left:48px;">(ii) openbaar is.</p>

  <h2 style="font-size:14px;margin:18px 0 8px 0;">2. RESTRICTIES</h2>
  <p>Gegadigde verbindt zich:</p>
  <p style="margin-left:24px;"><strong>a.</strong> geen mededeling te doen aan een derde, niet zijnde een Betrokkene, omtrent (de uitnodiging tot) deelname aan het Verkoopproces, en/of het feit dat er besprekingen en onderhandelingen worden gevoerd tussen de Gegadigde en Verkoper, en al hetgeen daarmee verband houdt;</p>
  <p style="margin-left:24px;"><strong>b.</strong> de Vertrouwelijke Informatie niet gebruiken voor enig ander doel dan in het kader van diens deelname aan het Verkoopproces;</p>
  <p style="margin-left:24px;"><strong>c.</strong> de Vertrouwelijke Informatie niet, geheel of gedeeltelijk, te verstrekken of anderszins bekend te maken aan andere personen dan een Betrokkene die van deze informatie kennis moet kunnen nemen voor de door hem uit te voeren werkzaamheden;</p>
  <p style="margin-left:24px;"><strong>d.</strong> de Vertrouwelijke Informatie vertrouwelijk te behandelen, zorgvuldig te (doen) bewaren en ervoor te zorgen dat een derde niet in strijd met deze geheimhoudingsverklaring van zulke Vertrouwelijke Informatie kennis krijgt;</p>
  <p style="margin-left:24px;"><strong>e.</strong> de Vertrouwelijke Informatie uitsluitend te &lsquo;doen&rsquo; gebruiken voor zover dat noodzakelijk is in het kader van de deelname aan het Verkoopproces;</p>
  <p style="margin-left:24px;"><strong>f.</strong> de Vertrouwelijke Informatie uitsluitend te vermenigvuldigen voor zover dat noodzakelijk is met het oog op het onder d. bedoelde gebruik; en</p>
  <p style="margin-left:24px;"><strong>g.</strong> alle correspondentie of communicatie met betrekking tot het Verkoopproces uitsluitend te richten aan <span class="field">{{BROKER_NAME}}</span> en geen contact te zoeken met enige directeur of medewerker verbonden aan de Verkoper en/of aan <span class="field">{{THIRD_PARTY}}</span>, huurders of gebruikers van de registergoederen met betrekking tot de Verkoopprocedure, tenzij schriftelijk met de Verkoper of <span class="field">{{BROKER_NAME}}</span> overeengekomen.</p>

  <h2 style="font-size:14px;margin:18px 0 8px 0;">3. OPENBAARMAKING AAN EN GEBRUIK DOOR EEN BETROKKENE</h2>
  <p>Gegadigde is gerechtigd Vertrouwelijke Informatie zonder toestemming van Verkoper aan een Betrokkene openbaar te maken, voor zover dat noodzakelijk is het met oog op deelname aan het Verkoopproces, en mits de betreffende Betrokkene zich tot het in deze geheimhoudingsverklaring bepaalde heeft verplicht. Op eerste verzoek zal Gegadigde haar Adviseur eenzelfde geheimhoudingsverklaring laten tekenen als de onderhavige. Adviseur die reeds op grond van hun professie een geheimhoudingsplicht hebben, zoals advocaten en notarissen, behoeven deze verklaring niet te tekenen. Gegadigde staat er jegens Eigenaar voor in, dat haar medewerkers en ingeschakelde Adviseur respectievelijk de hiervoor bedoelde geheimhoudingsverplichting nakomt.</p>

  <h2 style="font-size:14px;margin:18px 0 8px 0;">4. GEEN EXCLUSIVITEIT</h2>
  <p>De Gegadigde zal op geen enkel moment aanspraak kunnen maken op exclusiviteit en het is de Verkoper op ieder moment toegestaan om enige onderhandelingen met Gegadigde te beëindigen, om het Verkoopproces te bespreken met enige andere potentiële koper of om het Verkoopproces te beëindigen, tenzij met Gegadigde schriftelijk anders is overeengekomen.</p>

  <h2 style="font-size:14px;margin:18px 0 8px 0;">5. SCHENDING VAN DE GEHEIMHOUDINGSVERKLARING</h2>
  <p>In geval van schending door Gegadigde of een Betrokkene van het in deze geheimhoudingsverklaring bepaalde, is Gegadigde aansprakelijk &ndash; zowel jegens Eigenaar als enige andere partij die als gevolg van die schending schade lijdt &ndash; voor alle de door die schending ontstane schade. Gegadigde vrijwaart Eigenaar en voormelde partijen voor enige aanspraken van derden dienaangaande. Eigenaar heeft het recht Gegadigde uit te sluiten van het verkoopproces.</p>

  <h2 style="font-size:14px;margin:18px 0 8px 0;">6. EINDE VERKOOPPROCES</h2>
  <p>Indien het Verkoopproces anders eindigt dan door gunning aan Gegadigde:</p>
  <p style="margin-left:24px;"><strong>a.</strong> eindigen de verplichtingen van Gegadigde uit deze geheimhoudingsverklaring in alle gevallen na ommekomst van een periode van 12 maanden na ondertekening; en</p>
  <p style="margin-left:24px;"><strong>b.</strong> zal Gegadigde na ontvangst van een bericht daartoe van Verkoper terstond alle Vertrouwelijke Informatie aan Verkoper retourneren met inbegrip van kopieën daarvan, dan wel de Vertrouwelijke Informatie vernietigen.</p>

  <h2 style="font-size:14px;margin:18px 0 8px 0;">7. TOEPASSELIJK RECHT</h2>
  <p>Op deze geheimhoudingsverklaring is Nederlands recht van toepassing. Geschillen die in verband met deze geheimhoudingsverklaring ontstaan, zullen bij uitsluiting worden beslecht door de bevoegde rechter te Amsterdam.</p>

  <p style="margin-top:32px;"><strong>GEGADIGDE:</strong></p>

  <p style="margin-top:16px;">Voor akkoord getekend te <span class="field">{{SIGNING_PLACE}}</span> op <span class="field">{{DATE}}</span>.</p>

  <div style="margin-top:24px;border-top:1px solid #000;padding-top:8px;display:inline-block;min-width:240px;">{{SIGNATURE_BLOCK}}</div>
  <p style="margin:4px 0 0 0;">Naam: <span class="field">{{NAME}}</span></p>
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
  "CAPACITY_TEXT",
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

/**
 * Compute the rendered "Handelend als" sentence given a CAPACITY value
 * and the (optional) company name. "voor zich" is the only option that
 * doesn't take a company-name suffix.
 */
export function buildCapacityText(
  capacity: string | undefined,
  companyName: string | undefined
): string {
  if (!capacity) return "";
  const trimmed = capacity.trim();
  if (trimmed === "voor zich") return "voor zich";
  const co = (companyName ?? "").trim();
  return co ? `${trimmed} ${co}` : trimmed;
}
