// Per-asset investor process. See the AccessMode enum in schema.prisma.
export type AccessMode = "STANDARD" | "DIRECT_IM";

export const ACCESS_MODE_LABELS: Record<AccessMode, { label: string; hint: string }> = {
  STANDARD: {
    label: "Standard (NDA + viewing)",
    hint: "Teaser → NDA (signed + approved) → IM → Viewing → NBO",
  },
  DIRECT_IM: {
    label: "Direct IM (click-accept)",
    hint: "Teaser and IM open at first login. Terms click-accept replaces the NDA; no viewing step.",
  },
};

export const isDirectIm = (mode: string | null | undefined): boolean =>
  mode === "DIRECT_IM";
