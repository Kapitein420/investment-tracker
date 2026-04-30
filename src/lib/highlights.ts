// Single source of truth for the six standard "Key Investment Highlights"
// — keys, labels, and display order. Used by:
//   - the admin teaser editor (content-tab.tsx)
//   - the investor portal deal page (deal-journey.tsx)
//   - the invite email template (email-template.ts)
// so the order an admin types in is the order an investor sees.

export const STANDARD_HIGHLIGHT_KEYS = [
  "office_lfa",
  "construction_year",
  "epc_label",
  "ownership",
  "annual_rent_income",
  "walt_walb",
] as const;

export const STANDARD_HIGHLIGHT_LABELS: Record<string, string> = {
  office_lfa: "Office LFA",
  construction_year: "Construction year",
  epc_label: "EPC label",
  ownership: "Ownership",
  annual_rent_income: "Annual rent income",
  walt_walb: "WALT / WALB",
};

const STANDARD_KEY_SET = new Set<string>(STANDARD_HIGHLIGHT_KEYS);

/**
 * Take the keyMetrics blob from an AssetContent (teaser) and return entries
 * in a stable display order: standard keys first in the canonical sequence,
 * followed by any custom keys (alphabetised). Empty values are dropped.
 */
export function orderedHighlightEntries(
  metrics: Record<string, string> | null | undefined
): Array<{ key: string; label: string; value: string }> {
  const m = metrics ?? {};
  const out: Array<{ key: string; label: string; value: string }> = [];

  for (const key of STANDARD_HIGHLIGHT_KEYS) {
    const v = (m[key] ?? "").toString().trim();
    if (v) out.push({ key, label: STANDARD_HIGHLIGHT_LABELS[key], value: v });
  }

  const customKeys = Object.keys(m)
    .filter((k) => !STANDARD_KEY_SET.has(k))
    .sort();
  for (const key of customKeys) {
    const v = (m[key] ?? "").toString().trim();
    if (v) out.push({ key, label: humaniseKey(key), value: v });
  }

  return out;
}

export function humaniseKey(k: string): string {
  return k
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
