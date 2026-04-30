"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Mail, Search } from "lucide-react";
import { getRecentMailgunEvents, type MailgunEventsResult, type MailgunEvent } from "@/actions/mailgun-events";

const STATUS_BADGE_CLS: Record<MailgunEvent["status"], string> = {
  delivered: "bg-status-success-soft text-status-success",
  accepted: "bg-dils-100 text-dils-700",
  failed: "bg-status-danger-soft text-status-danger",
  rejected: "bg-status-danger-soft text-status-danger",
  complained: "bg-status-warning-soft text-status-warning",
  opened: "bg-banner-info text-banner-info-foreground",
  clicked: "bg-banner-info text-banner-info-foreground",
  stored: "bg-muted text-muted-foreground",
  other: "bg-muted text-muted-foreground",
};

function formatTime(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function EmailLogClient({
  initialResult,
  initialRecipient,
}: {
  initialResult: MailgunEventsResult;
  initialRecipient: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<MailgunEventsResult>(initialResult);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [pending, startTransition] = useTransition();

  function refresh(nextRecipient?: string) {
    const r = (nextRecipient ?? recipient).trim();
    startTransition(async () => {
      const next = await getRecentMailgunEvents({
        limit: 200,
        recipient: r || undefined,
      });
      setResult(next);
      // Sync URL so the filter survives a reload / share
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      if (r) sp.set("recipient", r);
      else sp.delete("recipient");
      router.replace(`/admin/email-log${sp.toString() ? `?${sp}` : ""}`);
    });
  }

  const failedCount = result.events.filter(
    (e) => e.status === "failed" || e.status === "rejected"
  ).length;

  return (
    <div className="px-6 py-6 lg:px-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">Email log</h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Live feed of the last {result.events.length || 200} Mailgun events for the configured sending domain.
            Use it to confirm whether transactional emails (invites, NDA approvals, password resets) reached the
            recipient&rsquo;s mailbox or got held / bounced upstream.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={pending}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Banners */}
      {!result.configured && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-status-warning/40 bg-status-warning-soft p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-status-warning" strokeWidth={2.4} />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Mailgun not configured</p>
            <p className="mt-1 text-muted-foreground">
              {result.error ?? "Set MAILGUN_API_KEY and MAILGUN_DOMAIN in Vercel env."}
            </p>
          </div>
        </div>
      )}
      {result.configured && !result.ok && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-status-danger/40 bg-status-danger-soft p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-status-danger" strokeWidth={2.4} />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Couldn&rsquo;t reach Mailgun</p>
            <p className="mt-1 break-all text-muted-foreground">{result.error}</p>
          </div>
        </div>
      )}
      {result.ok && failedCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-status-danger/40 bg-status-danger-soft p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-status-danger" strokeWidth={2.4} />
          <div className="text-sm">
            <p className="font-semibold text-foreground">
              {failedCount} failed / rejected event{failedCount === 1 ? "" : "s"} in the visible window
            </p>
            <p className="mt-1 text-muted-foreground">
              Filter on the recipient or open the row for the SMTP reason.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") refresh();
            }}
            placeholder="Filter by recipient (e.g. n.maatoke@dils.com)"
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={() => refresh()} disabled={pending}>
          Apply
        </Button>
        {recipient && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRecipient("");
              refresh("");
            }}
            disabled={pending}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {result.events.length === 0 && result.ok ? (
        <div className="flex items-center justify-center rounded-md border border-dils-100 bg-white p-10">
          <div className="text-center">
            <Mail className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.6} />
            <p className="mt-3 text-sm font-medium text-foreground">No events</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {recipient ? `No Mailgun events for ${recipient} in the last window.` : "Mailgun returned an empty event list."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-dils-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dils-100 text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Recipient</th>
                <th className="px-3 py-2 text-left">Subject</th>
                <th className="px-3 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.events.map((ev) => (
                <tr key={ev.id} className="border-b border-dils-100 last:border-0 hover:bg-dils-50/40">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatTime(ev.timestamp)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={`border-0 text-[11px] font-semibold ${STATUS_BADGE_CLS[ev.status]}`}>
                      {ev.event}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{ev.recipient}</td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-xs" title={ev.subject ?? ""}>
                    {ev.subject ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="max-w-[320px] px-3 py-2 text-xs text-muted-foreground">
                    {ev.smtpCode ? (
                      <span className="mr-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {ev.smtpCode}
                      </span>
                    ) : null}
                    {ev.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
