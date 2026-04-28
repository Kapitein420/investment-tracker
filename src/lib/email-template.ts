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
