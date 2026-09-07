import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/rate-limit";

/**
 * Best-effort ActivityLog write for signed-URL / document access issuance
 * (G10: trade-secret "reasonable measures" and Art. 15 access requests both
 * need "who downloaded which document when," for every role — not just
 * investors). Shared by getSignedDocumentUrl, getSignedHtmlNda and
 * getSignedContentUrl so the action strings and metadata shape stay in one
 * place. Never throws: a logging failure must not block the download.
 */
export async function logDownloadAccess(params: {
  action: "DOCUMENT_ACCESSED" | "CONTENT_ACCESSED";
  entityType: "Document" | "AssetContent";
  entityId: string;
  userId: string;
  role: Role;
  metadata: Record<string, unknown>;
}) {
  try {
    const ip = await getClientIp();
    await prisma.activityLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        userId: params.userId,
        metadata: { ...params.metadata, role: params.role, ip },
      },
    });
  } catch (e) {
    console.error(`[logDownloadAccess] ${params.action} log failed:`, e);
  }
}
