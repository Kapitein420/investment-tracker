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
 * Values are normalised through `formatHighlightValue` so numeric keys
 * (annual_rent_income) render with €1.500.000 formatting regardless of how
 * the admin typed them in.
 */
export function orderedHighlightEntries(
  metrics: Record<string, string> | null | undefined
): Array<{ key: string; label: string; value: string }> {
  const m = metrics ?? {};
  const out: Array<{ key: string; label: string; value: string }> = [];

  for (const key of STANDARD_HIGHLIGHT_KEYS) {
    const v = (m[key] ?? "").toString().trim();
    if (v) out.push({ key, label: STANDARD_HIGHLIGHT_LABELS[key], value: formatHighlightValue(key, v) });
  }

  const customKeys = Object.keys(m)
    .filter((k) => !STANDARD_KEY_SET.has(k))
    .sort();
  for (const key of customKeys) {
    const v = (m[key] ?? "").toString().trim();
    if (v) out.push({ key, label: humaniseKey(key), value: formatHighlightValue(key, v) });
  }

  return out;
}

/**
 * Display-time formatter for highlight values. Today only handles
 * annual_rent_income — admin types a raw amount (e.g. "1500000",
 * "1,500,000", "€1.5M"); investor sees "€1.500.000" (Dutch locale,
 * dot-separated thousands). Falls back to the raw string if we can't
 * parse a clean integer out of the input.
 */
export function formatHighlightValue(key: string, raw: string): string {
  if (key === "annual_rent_income") {
    // Strip currency symbols / spaces, then any thousands separators
    // (both . and , are common in EU). Accept a single decimal too.
    const stripped = raw.replace(/[€$\s]/g, "");
    // If the input has a comma or dot followed by exactly 3 digits, treat
    // the separator as a thousands separator (drop it). Otherwise leave it
    // as a decimal separator.
    const noThousand = stripped.replace(/[.,](?=\d{3}(\D|$))/g, "");
    const num = Number(noThousand.replace(",", "."));
    if (Number.isFinite(num) && num > 0) {
      return "€" + Math.round(num).toLocaleString("nl-NL");
    }
  }
  return raw;
}

export function humaniseKey(k: string): string {
  return k
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
