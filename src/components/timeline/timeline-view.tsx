"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCommitHorizontal, MessageSquare, FileText, Activity, Filter } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  type: "stage_change" | "comment" | "document" | "lifecycle";
  date: string;
  title: string;
  description: string | null;
  userName: string;
  metadata?: Record<string, any>;
}

interface TimelineViewProps {
  events: TimelineEvent[];
  companyName: string;
  assetTitle: string;
}

const TYPE_CONFIG = {
  stage_change: {
    icon: GitCommitHorizontal,
    color: "bg-blue-500",
    borderColor: "border-blue-200",
    bgColor: "bg-blue-50",
    label: "Stage Changes",
  },
  comment: {
    icon: MessageSquare,
    color: "bg-gray-400",
    borderColor: "border-gray-200",
    bgColor: "bg-gray-50",
    label: "Comments",
  },
  document: {
    icon: FileText,
    color: "bg-purple-500",
    borderColor: "border-purple-200",
    bgColor: "bg-purple-50",
    label: "Documents",
  },
  lifecycle: {
    icon: Activity,
    color: "bg-amber-500",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
    label: "Lifecycle",
  },
};

function groupByDate(events: TimelineEvent[]) {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const event of events) {
    const dateKey = new Date(event.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(event);
  }
  return groups;
}

export function TimelineView({ events, companyName, assetTitle }: TimelineViewProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(["stage_change", "comment", "document", "lifecycle"])
  );

  function toggleFilter(type: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const filtered = useMemo(
    () => events.filter((e) => activeFilters.has(e.type)),
    [events, activeFilters]
  );

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Activity className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">No timeline events yet</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {Object.entries(TYPE_CONFIG).map(([key, config]) => {
          const count = events.filter((e) => e.type === key).length;
          if (count === 0) return null;
          return (
            <Button
              key={key}
              variant="outline"
              size="sm"
              className={cn(
                "h-7 text-xs gap-1.5",
                activeFilters.has(key) && config.bgColor
              )}
              onClick={() => toggleFilter(key)}
            >
              <span className={cn("h-2 w-2 rounded-full", config.color)} />
              {config.label}
              <span className="text-muted-foreground">({count})</span>
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

        {Object.entries(grouped).map(([dateLabel, dayEvents]) => (
          <div key={dateLabel} className="mb-6">
            {/* Date header */}
            <div className="relative flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-background border-2 border-border flex items-center justify-center z-10">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {new Date(dayEvents[0].date).getDate()}
                </span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{dateLabel}</span>
            </div>

            {/* Events for this day */}
            <div className="space-y-3 ml-[19px] pl-8 border-l border-transparent">
              {dayEvents.map((event) => {
                const config = TYPE_CONFIG[event.type];
                const Icon = config.icon;

                return (
                  <div key={event.id} className="relative">
                    {/* Dot on the timeline */}
                    <div
                      className={cn(
                        "absolute -left-[29px] top-2 h-3 w-3 rounded-full border-2 border-white z-10",
                        config.color
                      )}
                    />

                    {/* Event card */}
                    <div className={cn("rounded-lg border p-3", config.borderColor)}>
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              {event.userName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateTime(event.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
