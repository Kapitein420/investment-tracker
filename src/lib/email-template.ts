/**
 * Single source of truth for transactional email styling.
 *
 * Logo is shipped at public/email/dils-logo.png and served from
 * `${getAppUrl()}/email/dils-logo.png` by default. Set EMAIL_LOGO_URL to
 * override (e.g. host on a CDN).
 */

import { getAppUrl } from "@/lib/app-url";

const PRIVACY_URL = "https://dils.nl/privacyverklaring/";

const COLORS = {
  ink: "#101820",
  brass: "#AB8B5F",
  red: "#EE2E24",
  paper: "#FFFFFF",
  surface: "#F5F6F7",
  border: "#E6E8EB",
  muted: "#6B7280",
};

function renderHeader() {
  const logoUrl =
    process.env.EMAIL_LOGO_URL || `${getAppUrl()}/email/dils-logo.png`;

  return `
    <div style="background: ${COLORS.ink}; padding: 28px 32px; text-align: left;">
      <img src="${logoUrl}" alt="DILS" style="height:32px;width:auto;display:block;border:0;" />
      <div style="color: ${COLORS.paper}; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; font-weight: 400;">Investment Portal</div>
    </div>
    <div style="background: ${COLORS.red}; height: 2px; line-height: 2px; font-size: 0;">&nbsp;</div>
  `;
}

function renderFooter(meta?: string) {
  return `
    <div style="background: ${COLORS.surface}; padding: 24px 32px; border-top: 1px solid ${COLORS.border};">
      <p style="color: ${COLORS.muted}; font-size: 11px; line-height: 1.6; margin: 0 0 12px 0;">
        You're receiving this email because you have access to the DILS Investment Portal.
        Read our <a href="${PRIVACY_URL}" style="color: ${COLORS.ink}; text-decoration: underline;">privacy statement</a>
        for details on how we handle your personal data.
      </p>
      ${
        meta
          ? `<p style="color: ${COLORS.muted}; font-size: 10px; letter-spacing: 1px; margin: 0; text-transform: uppercase;">${meta}</p>`
          : ""
      }
      <p style="color: ${COLORS.muted}; font-size: 10px; margin: 12px 0 0 0;">
        DILS &middot; Commercial Real Estate Investment Sales
      </p>
    </div>
  `;
}

/**
 * Wrap body HTML with the standard DILS header, brass-rule heading, and
 * privacy-statement footer. Body content is fully owned by the caller —
 * pass arbitrary HTML (paragraphs, tables, CTAs, etc.) keyed off the
 * COLORS palette below.
 */
export function renderEmail(opts: {
  heading: string;
  bodyHtml: string;
  meta?: string;
}): string {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: ${COLORS.paper};">
      ${renderHeader()}
      <div style="background: ${COLORS.paper}; padding: 40px 32px 32px 32px;">
        <h1 style="font-family: Georgia, 'Times New Roman', serif; color: ${COLORS.ink}; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; line-height: 1.2;">
          ${opts.heading}
        </h1>
        <div style="background: ${COLORS.brass}; height: 2px; width: 40px; margin: 14px 0 24px 0; line-height: 2px; font-size: 0;">&nbsp;</div>
        ${opts.bodyHtml}
      </div>
      ${renderFooter(opts.meta)}
    </div>
  `;
}

/**
 * Standard primary CTA button — drop into a renderEmail body.
 */
export function renderCta(text: string, url: string): string {
  return `
    <div style="margin: 0 0 28px 0;">
      <a href="${url}"
         style="background: ${COLORS.ink}; color: ${COLORS.paper}; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: 700; display: inline-block; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, Helvetica, sans-serif;">
        ${text}
      </a>
    </div>
  `;
}

// Friendly labels for the standard teaser highlight keys (kept in sync with
// the admin-side STANDARD_HIGHLIGHTS in content-tab.tsx). Anything outside
// this map is rendered with humanise(snake_case → Title Case) fallback.
const HIGHLIGHT_LABELS: Record<string, string> = {
  office_lfa: "Office LFA",
  construction_year: "Construction year",
  epc_label: "EPC label",
  ownership: "Ownership",
  annual_rent_income: "Annual rent income",
  walt_walb: "WALT / WALB",
};

function humaniseKey(k: string): string {
  return k
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/**
 * Teaser preview block for the invite email — short pitch with up to 6
 * key investment highlights and (optionally) the hero image. Renders
 * nothing if there's no description AND no highlights AND no image, so
 * an asset without a teaser uploaded yet still gets a clean email.
 */
export function renderTeaserPreview(opts: {
  assetTitle: string;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  highlights?: Record<string, string> | null;
  heroImageUrl?: string | null;
}): string {
  const description = (opts.description ?? "").trim();
  const highlights = opts.highlights ?? {};
  const highlightEntries = Object.entries(highlights)
    .filter(([, v]) => v && v.trim())
    .slice(0, 6);

  if (!description && highlightEntries.length === 0 && !opts.heroImageUrl) {
    return "";
  }

  const location = [opts.city, opts.country].filter(Boolean).join(", ");

  const heroBlock = opts.heroImageUrl
    ? `<img src="${opts.heroImageUrl}" alt="${opts.assetTitle}" style="display:block; width:100%; max-width:600px; height:auto; border:0; border-radius:4px; margin:0 0 20px 0;" />`
    : "";

  const truncated =
    description.length > 320 ? description.slice(0, 317).trimEnd() + "…" : description;
  const descriptionBlock = truncated
    ? `<p style="color: ${COLORS.ink}; line-height: 1.6; font-size: 14px; margin: 0 0 20px 0; font-style: italic;">${escape(truncated)}</p>`
    : "";

  const highlightsBlock =
    highlightEntries.length > 0
      ? `
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
        ${highlightEntries
          .map(
            ([k, v], i) => `
          <tr>
            <td style="padding: 10px 12px; width: 50%; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${COLORS.ink}; font-weight: 700; background: ${COLORS.surface}; ${i < highlightEntries.length - 1 ? `border-bottom: 1px solid ${COLORS.border};` : ""}">${escape(HIGHLIGHT_LABELS[k] ?? humaniseKey(k))}</td>
            <td style="padding: 10px 12px; font-size: 13px; color: ${COLORS.ink}; ${i < highlightEntries.length - 1 ? `border-bottom: 1px solid ${COLORS.border};` : ""}">${escape(v.trim())}</td>
          </tr>`,
          )
          .join("")}
      </table>`
      : "";

  return `
    <div style="margin: 0 0 28px 0; padding: 24px; background: ${COLORS.surface}; border: 1px solid ${COLORS.border}; border-radius: 4px;">
      ${heroBlock}
      <p style="color: ${COLORS.brass}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0;">Investment Opportunity</p>
      <h2 style="font-family: Georgia, 'Times New Roman', serif; color: ${COLORS.ink}; font-size: 18px; font-weight: 700; margin: 0 0 ${location ? "4" : "16"}px 0; line-height: 1.3;">${escape(opts.assetTitle)}</h2>
      ${location ? `<p style="color: ${COLORS.muted ?? "#6B7280"}; font-size: 12px; margin: 0 0 16px 0;">${escape(location)}</p>` : ""}
      ${descriptionBlock}
      ${highlightsBlock}
    </div>
  `;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Editorial credentials table — used by the invite + password-reset emails.
 */
export function renderCredentialsTable(rows: { label: string; value: string; mono?: boolean }[]): string {
  const tr = rows
    .map(
      (r, i) => `
      <tr>
        <td style="padding: 14px 16px; width: 110px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${COLORS.ink}; font-weight: 700; ${i < rows.length - 1 ? `border-bottom: 1px solid ${COLORS.border};` : ""}">${r.label}</td>
        <td style="padding: 14px 16px; font-size: 14px; color: ${COLORS.ink}; ${r.mono ? "font-family: 'Courier New', Courier, monospace; letter-spacing: 1px;" : ""} background: ${COLORS.surface}; ${i < rows.length - 1 ? `border-bottom: 1px solid ${COLORS.border};` : ""}">${r.value}</td>
      </tr>`,
    )
    .join("");

  return `
    <table style="width: 100%; border: 1px solid ${COLORS.border}; border-collapse: collapse; margin: 0 0 28px 0;">
      ${tr}
    </table>
  `;
}
