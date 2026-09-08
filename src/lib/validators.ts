import { z } from "zod";

// ─── BSN / sensitive-data guard (UAVG Art. 46) ───────────────────────────────
// The Dutch BSN (burgerservicenummer) may not be processed without a statutory
// basis the portal doesn't have. Reject free-text containing a number that
// passes the BSN "elfproef" (11-test) so a national ID can't be pasted into a
// notes/comment field. Precise by construction — a random 9-digit string rarely
// satisfies the checksum — so false positives on ordinary numbers are unlikely.
function passesElfproef(digits: string): boolean {
  if (digits.length !== 9) return false;
  const weights = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * weights[i];
  return sum % 11 === 0;
}

export function containsBSN(text?: string | null): boolean {
  if (!text) return false;
  const candidates = text.match(/\b\d{8,9}\b/g);
  return !!candidates?.some((c) => passesElfproef(c.padStart(9, "0")));
}

const NO_BSN_MSG =
  "Please remove the national identification number (BSN) — the portal must not store BSNs.";
export const noBsn = (v?: string | null) => !containsBSN(v);

// ─── Asset ──────────────────────────────────────────────────────────────────
export const createAssetSchema = z.object({
  title: z.string().min(1, "Title is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  brokerLabel: z.string().optional(),
  assetType: z.string().optional(),
  transactionType: z.string().optional(),
  ownerEntity: z.string().optional(),
  description: z.string().optional().refine(noBsn, NO_BSN_MSG),
});

export const updateAssetSchema = createAssetSchema.partial();

// Map of UPPERCASE placeholder token → default value. Used to pre-fill
// project-level fields on NDA / IM documents before the investor signs.
export const assetFieldDefaultsSchema = z.record(
  z.string().regex(/^[A-Z_][A-Z0-9_]*$/),
  z.string().max(1000)
);

// ─── Company ────────────────────────────────────────────────────────────────
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  legalName: z.string().optional(),
  type: z.enum(["INVESTOR", "BROKER", "ADVISOR", "TENANT", "OTHER"]),
  website: z.string().url().optional().or(z.literal("")),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  notes: z.string().optional().refine(noBsn, NO_BSN_MSG),
});

export const updateCompanySchema = createCompanySchema.partial();

// ─── Company CDD / Wwft attestation (G7) ──────────────────────────────────
export const setCompanyCddSchema = z.object({
  companyId: z.string().min(1),
  cddStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "CLEARED", "ESCALATED"]),
  cddNote: z
    .string()
    .max(500, "Note is too long (max 500 characters)")
    .refine(noBsn, NO_BSN_MSG)
    .optional()
    .nullable(),
  sanctionsScreened: z.boolean(),
});

// ─── Tracking Row ───────────────────────────────────────────────────────────
export const createTrackingSchema = z.object({
  assetId: z.string().min(1),
  companyId: z.string().min(1),
  relationshipType: z.string().default("Investor"),
  interestLevel: z.enum(["HOT", "WARM", "COLD", "NONE"]).optional(),
  ownerUserId: z.string().optional(),
});

export const updateTrackingSchema = z.object({
  relationshipType: z.string().optional(),
  lifecycleStatus: z.enum(["ACTIVE", "COMPLETED", "DROPPED", "ON_HOLD"]).optional(),
  interestLevel: z.enum(["HOT", "WARM", "COLD", "NONE"]).nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  currentStageManualOverride: z.boolean().optional(),
  currentStageKey: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
  // Bid amount in bidCurrency. Capped at 999,999,999,999.99 to match
  // the column's DECIMAL(14, 2) precision; nullable to support clearing.
  bidAmount: z.number().min(0).max(999_999_999_999.99).nullable().optional(),
  bidCurrency: z.string().length(3).regex(/^[A-Z]{3}$/, "3-letter ISO code").optional(),
  bidSubmittedAt: z.coerce.date().nullable().optional(),
});

// ─── Stage Status ───────────────────────────────────────────────────────────
export const updateStageStatusSchema = z.object({
  trackingId: z.string().min(1),
  stageId: z.string().min(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED", "DECLINED"]),
});

// ─── Comment ────────────────────────────────────────────────────────────────
// Cap at 10k chars. Plenty for any reasonable comment; protects against a
// malicious or fat-fingered paste (whole PDF text, 100MB blob, etc.) that
// would otherwise bloat the row and slow every subsequent loadDetail()
// since the drawer refetches the full comment list on every mutation.
const COMMENT_MAX = 10_000;

export const createCommentSchema = z.object({
  trackingId: z.string().min(1),
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(COMMENT_MAX, `Comment is too long (max ${COMMENT_MAX} characters)`)
    .refine(noBsn, NO_BSN_MSG),
});

export const updateCommentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(COMMENT_MAX, `Comment is too long (max ${COMMENT_MAX} characters)`)
    .refine(noBsn, NO_BSN_MSG),
});

// ─── User management ────────────────────────────────────────────────────────
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  // 12, not the self-change flow's 10: an admin types this for someone else
  // and has to communicate it out of band, so it is the one remaining path
  // where a human picks a password on another human's behalf.
  password: z.string().min(12, "Password must be at least 12 characters"),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER", "INVESTOR"]),
  // VIEWER-only: which assets the new viewer is allowed to see. Empty
  // array = no access (empty dashboard until an admin grants assets via
  // Manage access). Ignored for non-VIEWER roles.
  accessibleAssetIds: z.array(z.string()).optional(),
});

// ─── Set password via one-time link ─────────────────────────────────────────
// 10 chars, no complexity rule — same policy as the self-change flow in
// change-password-actions (NIST SP 800-63B).
export const setPasswordSchema = z
  .object({
    newPassword: z.string().min(10, "Password must be at least 10 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER", "INVESTOR"]).optional(),
  isActive: z.boolean().optional(),
});

// ─── Pipeline Stage admin ───────────────────────────────────────────────────
export const updatePipelineStageSchema = z.object({
  label: z.string().min(1).optional(),
  sequence: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ─── Saved View ─────────────────────────────────────────────────────────────
export const savedViewSchema = z.object({
  name: z.string().min(1, "View name is required"),
  assetId: z.string().optional(),
  filterConfig: z.record(z.any()),
});

// ─── Document ──────────────────────────────────────────────────────────────
export const signDocumentSchema = z.object({
  token: z.string().min(1),
  signedByName: z.string().min(1, "Name is required"),
  signedByEmail: z.string().email("Valid email is required"),
  signatureData: z.string().min(1, "Signature is required").max(500000, "Signature data too large"),
  // Arbitrary placeholder values the investor fills in (e.g. COMPANY, ADDRESS, KVK).
  // Keys must match the {{TOKEN}} syntax the scanner produces: A-Z, 0-9, _
  fieldValues: z
    .record(z.string().regex(/^[A-Z_][A-Z0-9_]*$/), z.string().max(1000))
    .optional()
    .default({}),
  // Must be the literal `true` — the signer explicitly ticked "I intend
  // this electronic signature to be my legally binding signature..."
  // (BW 3:15a evidence, G8). Anything else (missing, false) fails parse.
  intentConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Please confirm your intent to sign before submitting." }),
  }),
});

export const rejectDocumentSchema = z.object({
  token: z.string().min(1),
  rejectionReason: z.string().optional(),
});

// ─── Field Placement (manual drag-drop mode) ───────────────────────────────
export const fieldPlacementSchema = z.object({
  page: z.number().int().min(1, "Page must be >= 1"),
  type: z.enum(["signature", "name", "date"]),
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const saveDocumentPlacementsSchema = z.object({
  documentId: z.string().min(1),
  placements: z.array(fieldPlacementSchema).max(50, "Too many placements"),
});

export type FieldPlacementInput = z.infer<typeof fieldPlacementSchema>;
export type SaveDocumentPlacementsInput = z.infer<typeof saveDocumentPlacementsSchema>;

export type SignDocumentInput = z.infer<typeof signDocumentSchema>;
export type RejectDocumentInput = z.infer<typeof rejectDocumentSchema>;

// Export types
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type SetCompanyCddInput = z.infer<typeof setCompanyCddSchema>;
export type CreateTrackingInput = z.infer<typeof createTrackingSchema>;
export type UpdateTrackingInput = z.infer<typeof updateTrackingSchema>;
export type UpdateStageStatusInput = z.infer<typeof updateStageStatusSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
