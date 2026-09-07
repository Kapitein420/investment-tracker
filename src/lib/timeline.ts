import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAssetAccess, canSeeContactDetails } from "@/lib/permissions";
import type { TimelineEvent } from "@/components/timeline/timeline-view";

export type TimelineUser = { id: string; role: Role };

export type TrackingTimeline = {
  tracking: { asset: { title: string }; company: { name: string } };
  events: TimelineEvent[];
};

/**
 * Loads a single tracking's timeline, gated by the same per-asset VIEWER
 * access check the asset detail page uses. Returns null (→ notFound) rather
 * than throwing so a disallowed caller can't distinguish "no access" from
 * "doesn't exist".
 */
export async function loadTrackingTimeline(
  user: TimelineUser,
  assetId: string,
  trackingId: string
): Promise<TrackingTimeline | null> {
  try {
    await requireAssetAccess(user.id, user.role, assetId);
  } catch {
    return null;
  }

  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: { id: trackingId },
    include: {
      company: true,
      asset: { select: { id: true, title: true } },
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
      stageHistory: {
        include: {
          changedBy: { select: { name: true } },
          stage: { select: { label: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        include: {
          stage: { select: { label: true } },
          uploadedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!tracking || tracking.assetId !== assetId) return null;

  const showPII = canSeeContactDetails(user.role);

  // Merge all events into a unified timeline
  const events: TimelineEvent[] = [];

  // Stage history events
  for (const h of tracking.stageHistory) {
    const stageLabel = h.stage?.label ?? "";
    const isLifecycle = h.fieldName === "lifecycleStatus";

    events.push({
      id: h.id,
      type: isLifecycle ? "lifecycle" : "stage_change",
      date: h.createdAt.toISOString(),
      title: isLifecycle
        ? `Lifecycle changed to ${h.newValue}`
        : `${stageLabel} ${h.fieldName}: ${h.oldValue ?? "—"} → ${h.newValue}`,
      description: null,
      userName: showPII ? h.changedBy.name : "Team member",
      metadata: {
        fieldName: h.fieldName,
        oldValue: h.oldValue,
        newValue: h.newValue,
        stageLabel,
      },
    });
  }

  // Comment events
  for (const c of tracking.comments) {
    events.push({
      id: c.id,
      type: "comment",
      date: c.createdAt.toISOString(),
      title: "Comment added",
      description: c.body,
      userName: showPII ? c.author.name : "Team member",
    });
  }

  // Document events
  for (const d of tracking.documents) {
    events.push({
      id: `doc-upload-${d.id}`,
      type: "document",
      date: d.createdAt.toISOString(),
      title: `Document uploaded: ${d.fileName}`,
      description: `For ${d.stage.label} stage`,
      userName: showPII ? d.uploadedBy.name : "Team member",
      metadata: { status: d.status, fileName: d.fileName },
    });

    if (d.signedAt) {
      events.push({
        id: `doc-signed-${d.id}`,
        type: "document",
        date: d.signedAt.toISOString(),
        title: `Document signed: ${d.fileName}`,
        description: showPII
          ? `Signed by ${d.signedByName} (${d.signedByEmail})`
          : "Signed by counterparty",
        userName: showPII ? d.signedByName ?? "Unknown" : "Counterparty",
        metadata: { status: "SIGNED", fileName: d.fileName },
      });
    }

    if (d.rejectedAt) {
      events.push({
        id: `doc-rejected-${d.id}`,
        type: "document",
        date: d.rejectedAt.toISOString(),
        title: `Document declined: ${d.fileName}`,
        description: d.rejectionReason || "No reason provided",
        userName: "Counterparty",
        metadata: { status: "REJECTED", fileName: d.fileName },
      });
    }
  }

  // Sort all events by date descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { tracking, events };
}
