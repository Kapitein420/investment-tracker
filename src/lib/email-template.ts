/**
 * Single source of truth for transactional email styling.
 *
 * Visual language matches the DILS marketing/newsletter template:
 * - Black band header (#121212) with the DILS logo.
 * - DILS red (#E73838) for accents — heading rule, key labels.
 * - Roboto body font (Arial fallback), Arial display font for headings.
 * - Black brand footer with logo + office address.
 * - White content card with light-gray privacy strip below it.
 *
 * Logo is shipped at public/email/dils-logo.png and served from
 * `${getAppUrl()}/email/dils-logo.png`. Set EMAIL_LOGO_URL to override.
 */

import { getAppUrl } from "@/lib/app-url";

const PRIVACY_URL = "https://dils.nl/privacyverklaring/";
const DILS_HOME_URL = "https://dils.nl/";
const OFFICE_ADDRESS = "Gustav Mahlerplein 72, 1082 MA Amsterdam — Netherlands";
const OFFICE_PHONE = "+31 (0)20 664 85 85";

const COLORS = {
  ink: "#121212",
  red: "#E73838",
  paper: "#FFFFFF",
  body: "#333333",
  surface: "#F5F6F7",
  border: "#E6E8EB",
  muted: "#6B7280",
};

const BODY_FONT = "Roboto, Arial, Helvetica, sans-serif";
const DISPLAY_FONT = "Arial, Helvetica, sans-serif";

function logoUrl(): string {
  return process.env.EMAIL_LOGO_URL || `${getAppUrl()}/email/dils-logo.png`;
}

function renderHeader() {
  return `
    <div style="background: ${COLORS.ink}; padding: 24px 32px; text-align: left;">
      <img src="${logoUrl()}" alt="DILS" style="height:32px;width:auto;display:block;border:0;" />
    </div>
  `;
}

/**
 * Optional dark band that mirrors the DILS marketing pattern — shows the
 * deal/asset context (e.g. "Keizersgracht 250 · Amsterdam") between the
 * logo header and the body. Renders nothing if no meta is passed.
 */
function renderMetaBand(meta?: string) {
  if (!meta) return "";
  return `
    <div style="background: ${COLORS.ink}; padding: 14px 32px; border-top: 1px solid #2a2a2a;">
      <p style="margin:0;font-family:${DISPLAY_FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.paper};">${meta}</p>
    </div>
  `;
}

function renderBrandFooter() {
  return `
    <div style="background: ${COLORS.ink}; padding: 28px 32px; text-align: left;">
      <img src="${logoUrl()}" alt="DILS" style="height:24px;width:auto;display:block;border:0;margin-bottom:16px;" />
      <p style="margin:0 0 4px 0;font-family:${BODY_FONT};font-size:12px;color:${COLORS.paper};line-height:1.6;">
        <a href="${DILS_HOME_URL}" style="color:${COLORS.paper};text-decoration:none;">dils.nl</a>
        &nbsp;·&nbsp; ${OFFICE_PHONE}
      </p>
      <p style="margin:0;font-family:${BODY_FONT};font-size:11px;color:#9CA3AF;line-height:1.6;">
        ${OFFICE_ADDRESS}
      </p>
    </div>
  `;
}

function renderPrivacyStrip() {
  return `
    <div style="background: ${COLORS.surface}; padding: 18px 32px; border-top: 1px solid ${COLORS.border};">
      <p style="color: ${COLORS.muted}; font-family:${BODY_FONT}; font-size: 11px; line-height: 1.6; margin: 0;">
        You're receiving this email because you have access to the DILS Investment Portal.
        Read our <a href="${PRIVACY_URL}" style="color: ${COLORS.ink}; text-decoration: underline;">privacy statement</a>
        for details on how we handle your personal data.
      </p>
    </div>
  `;
}

/**
 * Wrap body HTML with the standard DILS chrome — logo header, optional
 * meta band, body card with red-rule heading, brand footer, privacy strip.
 * Body content is fully owned by the caller — pass arbitrary HTML keyed
 * off the COLORS palette below.
 */
export function renderEmail(opts: {
  heading: string;
  bodyHtml: string;
  meta?: string;
}): string {
  return `
    <div style="font-family: ${BODY_FONT}; max-width: 600px; margin: 0 auto; background: ${COLORS.paper};">
      ${renderHeader()}
      ${renderMetaBand(opts.meta)}
      <div style="background: ${COLORS.paper}; padding: 36px 32px 32px 32px;">
        <h1 style="font-family: ${DISPLAY_FONT}; color: ${COLORS.ink}; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.2px; line-height: 1.25;">
          ${opts.heading}
        </h1>
        <div style="background: ${COLORS.red}; height: 2px; width: 40px; margin: 14px 0 24px 0; line-height: 2px; font-size: 0;">&nbsp;</div>
        <div style="font-family:${BODY_FONT};color:${COLORS.body};font-size:14px;line-height:1.6;">
          ${opts.bodyHtml}
        </div>
      </div>
      ${renderBrandFooter()}
      ${renderPrivacyStrip()}
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
         style="background: ${COLORS.ink}; color: ${COLORS.paper}; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: 700; display: inline-block; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-family: ${DISPLAY_FONT};">
        ${text}
      </a>
    </div>
  `;
}

/**
 * Editorial credentials table — used by the invite + password-reset emails.
 * Label cells use DILS red so they pop against the surface fill.
 */
export function renderCredentialsTable(rows: { label: string; value: string; mono?: boolean }[]): string {
  const tr = rows
    .map(
      (r, i) => `
      <tr>
        <td style="padding: 14px 16px; width: 110px; font-family:${DISPLAY_FONT}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${COLORS.red}; font-weight: 700; ${i < rows.length - 1 ? `border-bottom: 1px solid ${COLORS.border};` : ""}">${r.label}</td>
        <td style="padding: 14px 16px; font-size: 14px; color: ${COLORS.ink}; ${r.mono ? "font-family: 'Courier New', Courier, monospace; letter-spacing: 1px;" : `font-family: ${BODY_FONT};`} background: ${COLORS.surface}; ${i < rows.length - 1 ? `border-bottom: 1px solid ${COLORS.border};` : ""}">${r.value}</td>
      </tr>`,
    )
    .join("");

  return `
    <table style="width: 100%; border: 1px solid ${COLORS.border}; border-collapse: collapse; margin: 0 0 28px 0;">
      ${tr}
    </table>
  `;
}
