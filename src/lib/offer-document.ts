import { prisma } from "@/lib/db";
import { uploadFile, deleteFile } from "@/lib/supabase-storage";

/**
 * Shared OFFER-document write path.
 *
 * Two authorized callers reach the same behaviour from opposite sides of
 * the app: the admin's uploadOfferDocument (EDITOR, records an offer on
 * behalf of an investor) and the portal's submitInvestorOffer (INVESTOR,
 * submits their own). Keeping one implementation means the atomic-replace
 * semantics, the NBO stage anchoring and the storage cleanup can't drift
 * between the two.
 *
 * Lives in a plain server-side module (NOT a "use server" action file) on
 * purpose — same rationale as stage-sync.ts: it writes a Document for an
 * arbitrary trackingId and must only ever be reached through an already
 * authorized action, never as a directly-invokable endpoint.
 */

const MAX_OFFER_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validate an uploaded offer PDF and return its bytes. Throws with a
 * user-facing message on any failure.
 */
export async function readOfferPdf(file: File): Promise<Buffer> {
  if (file.size > MAX_OFFER_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 10MB.");
  }
  if (file.type !== "application/pdf" && file.type !== "application/x-pdf") {
    throw new Error("Only PDF files are allowed");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.slice(0, 4).toString().startsWith("%PDF")) {
    throw new Error("Invalid PDF file (failed magic byte check)");
  }
  return buffer;
}

/**
 * Resolve the PipelineStage an OFFER doc anchors to. OFFER docs anchor to
 * the NBO stage; bid data itself lives on the tracking. The stage anchor
 * only controls where the doc appears in journey views. If the NBO stage
 * has been renamed/disabled, fall back to the tracking's current stage so
 * the FK constraint is still satisfied.
 */
export async function resolveOfferStageId(trackingId: string): Promise<string> {
  const tracking = await prisma.assetCompanyTracking.findUniqueOrThrow({
    where: { id: trackingId },
    select: { currentStageKey: true },
  });
  const nboStage = await prisma.pipelineStage.findUnique({
    where: { key: "nbo" },
    select: { id: true },
  });
  let stageId: string | undefined = nboStage?.id;
  if (!stageId && tracking.currentStageKey) {
    const fallback = await prisma.pipelineStage.findUnique({
      where: { key: tracking.currentStageKey },
      select: { id: true },
    });
    stageId = fallback?.id;
  }
  if (!stageId) {
    throw new Error(
      "No NBO stage configured on this pipeline — add one under Admin → Stages first."
    );
  }
  return stageId;
}

/**
 * Upload `buffer` and atomically replace any existing OFFER doc on this
 * tracking. `extraWrites` runs inside the same transaction so a caller can
 * persist the bid amount / stage transition alongside the document without
 * a second commit.
 *
 * The storage upload happens BEFORE the transaction (Supabase isn't
 * transactional with Postgres) and is cleaned up if the transaction fails.
 */
export async function replaceOfferDocument(args: {
  trackingId: string;
  stageId: string;
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedByUserId: string;
  /** ActivityLog action, e.g. "OFFER_DOCUMENT_UPLOADED". */
  action: string;
  /** Extra metadata merged into the ActivityLog entry. */
  metadata?: Record<string, unknown>;
  extraWrites?: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>;
}) {
  const {
    trackingId,
    stageId,
    buffer,
    fileName,
    fileSize,
    mimeType,
    uploadedByUserId,
    action,
    metadata,
    extraWrites,
  } = args;

  const safeName = (fileName || "offer.pdf").replace(/[^\w.\-]/g, "_");
  const path = `documents/${trackingId}/offer_${Date.now()}_${safeName}`;
  const storagePath = await uploadFile(buffer, path, mimeType);

  const previousOffers = await prisma.document.findMany({
    where: { trackingId, kind: "OFFER" },
    select: { id: true, fileUrl: true, signedFileUrl: true },
  });

  let document;
  try {
    document = await prisma.$transaction(async (tx) => {
      if (previousOffers.length > 0) {
        await tx.signingToken.deleteMany({
          where: { documentId: { in: previousOffers.map((d) => d.id) } },
        });
        await tx.document.deleteMany({
          where: { id: { in: previousOffers.map((d) => d.id) } },
        });
      }

      const doc = await tx.document.create({
        data: {
          trackingId,
          stageId,
          kind: "OFFER",
          fileName,
          fileUrl: storagePath,
          mimeType,
          fileSize,
          uploadedByUserId,
          // status stays PENDING (the existing DocumentStatus enum has no
          // "REFERENCE"-style value); downstream code keys off `kind`,
          // not `status`, for offer docs.
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: "Document",
          entityId: doc.id,
          action,
          metadata: { trackingId, fileName, fileSize, ...metadata },
          userId: uploadedByUserId,
        },
      });

      if (extraWrites) await extraWrites(tx);

      return doc;
    });
  } catch (e) {
    // Tx failed — the just-uploaded file is now an orphan in Supabase.
    // Best-effort cleanup; log only, never shadow the original error.
    try {
      await deleteFile(storagePath);
    } catch (cleanupErr) {
      console.error("[replaceOfferDocument] orphan cleanup failed:", cleanupErr);
    }
    throw e;
  }

  for (const old of previousOffers) {
    for (const u of [old.fileUrl, old.signedFileUrl]) {
      if (!u || u.startsWith("http") || u.startsWith("html:")) continue;
      try {
        await deleteFile(u);
      } catch (e) {
        console.error(`[replaceOfferDocument] cleanup failed for ${u}:`, e);
      }
    }
  }

  return document;
}
