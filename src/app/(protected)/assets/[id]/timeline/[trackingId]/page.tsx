import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TimelineView, type TimelineEvent } from "@/components/timeline/timeline-view";

export default async function TimelinePage({
  params,
}: {
  params: { id: string; trackingId: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: { id: params.trackingId },
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

  if (!tracking || tracking.assetId !== params.id) notFound();

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
      userName: h.changedBy.name,
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
      userName: c.author.name,
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
      userName: d.uploadedBy.name,
      metadata: { status: d.status, fileName: d.fileName },
    });

    if (d.signedAt) {
      events.push({
        id: `doc-signed-${d.id}`,
        type: "document",
        date: d.signedAt.toISOString(),
        title: `Document signed: ${d.fileName}`,
        description: `Signed by ${d.signedByName} (${d.signedByEmail})`,
        userName: d.signedByName ?? "Unknown",
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

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-gradient-to-r from-gold-50 to-gold-100/50 px-6 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/assets/${params.id}`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm text-muted-foreground">
            {tracking.asset.title} &rsaquo; {tracking.company.name}
          </span>
        </div>
        <h1 className="text-xl font-semibold">Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Full history for {tracking.company.name}
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <TimelineView
          events={events}
          companyName={tracking.company.name}
          assetTitle={tracking.asset.title}
        />
      </div>
    </div>
  );
}
