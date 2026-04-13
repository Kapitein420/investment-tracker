import { z } from "zod";

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
  description: z.string().optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

// ─── Company ────────────────────────────────────────────────────────────────
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  legalName: z.string().optional(),
  type: z.enum(["INVESTOR", "BROKER", "ADVISOR", "TENANT", "OTHER"]),
  website: z.string().url().optional().or(z.literal("")),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

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
});

// ─── Stage Status ───────────────────────────────────────────────────────────
export const updateStageStatusSchema = z.object({
  trackingId: z.string().min(1),
  stageId: z.string().min(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED", "DECLINED"]),
});

// ─── Comment ────────────────────────────────────────────────────────────────
export const createCommentSchema = z.object({
  trackingId: z.string().min(1),
  body: z.string().min(1, "Comment cannot be empty"),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty"),
});

// ─── User management ────────────────────────────────────────────────────────
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).optional(),
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
  signatureData: z.string().min(1, "Signature is required"),
});

export const rejectDocumentSchema = z.object({
  token: z.string().min(1),
  rejectionReason: z.string().optional(),
});

export type SignDocumentInput = z.infer<typeof signDocumentSchema>;
export type RejectDocumentInput = z.infer<typeof rejectDocumentSchema>;

// Export types
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type CreateTrackingInput = z.infer<typeof createTrackingSchema>;
export type UpdateTrackingInput = z.infer<typeof updateTrackingSchema>;
export type UpdateStageStatusInput = z.infer<typeof updateStageStatusSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
