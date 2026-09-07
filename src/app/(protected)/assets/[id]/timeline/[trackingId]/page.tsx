import { getCurrentUser } from "@/lib/permissions";
import { loadTrackingTimeline } from "@/lib/timeline";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TimelineView } from "@/components/timeline/timeline-view";

export default async function TimelinePage(
  props: {
    params: Promise<{ id: string; trackingId: string }>;
  }
) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await loadTrackingTimeline(user, params.id, params.trackingId);
  if (!data) notFound();

  const { tracking, events } = data;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-dils-200 bg-white px-6 py-5">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/assets/${params.id}`} className="text-muted-foreground hover:text-dils-black">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </Link>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {tracking.asset.title} &rsaquo; {tracking.company.name}
          </span>
        </div>
        <h1 className="dils-accent inline-block font-heading text-3xl font-bold tracking-tight text-dils-black">
          Timeline
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-prose">
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
