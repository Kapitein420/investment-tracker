"use client";

import { useEffect, useState } from "react";
import { getAssetClickActivity, getAssetLoginActivity } from "@/actions/asset-actions";

type ClickRow = Awaited<ReturnType<typeof getAssetClickActivity>>[number];
type LoginRow = Awaited<ReturnType<typeof getAssetLoginActivity>>[number];

function InvestorCell({ r }: { r: { investor: string; email: string | null } }) {
  return (
    <td className="px-4 py-2.5">
      {r.investor}
      {r.email && r.email !== r.investor && (
        <span className="block text-xs text-muted-foreground">{r.email}</span>
      )}
    </td>
  );
}

const TABLE = "overflow-x-auto rounded-md border border-dils-200 bg-white";
const HEAD = "bg-soft-bg-surface-alt text-left text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground";

export function ClickActivityTab({ assetId }: { assetId: string }) {
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [logins, setLogins] = useState<LoginRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAssetClickActivity(assetId), getAssetLoginActivity(assetId)])
      .then(([c, l]) => {
        if (cancelled) return;
        setClicks(c);
        setLogins(l);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (error) return <p className="text-sm text-destructive">Could not load activity.</p>;
  if (!clicks || !logins) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Document clicks</h3>
        {clicks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No document clicks yet. Every time an investor opens or downloads a file it shows up here.
          </p>
        ) : (
          <div className={TABLE}>
            <table className="w-full text-sm">
              <thead className={HEAD}>
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Investor</th>
                  <th className="px-4 py-2.5">Company</th>
                  <th className="px-4 py-2.5">Document</th>
                  <th className="px-4 py-2.5">Stage</th>
                </tr>
              </thead>
              <tbody>
                {clicks.map((r) => (
                  <tr key={r.id} className="border-t border-dils-100">
                    <td className="whitespace-nowrap px-4 py-2.5">{new Date(r.at).toLocaleString("nl-NL")}</td>
                    <InvestorCell r={r} />
                    <td className="px-4 py-2.5">{r.company ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium">{r.documentTitle ?? "—"}</td>
                    <td className="px-4 py-2.5 uppercase text-xs text-muted-foreground">{r.stageKey ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Portal logins</h3>
        {logins.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No logins recorded yet. Every investor sign-in shows up here with a timestamp.
          </p>
        ) : (
          <div className={TABLE}>
            <table className="w-full text-sm">
              <thead className={HEAD}>
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Investor</th>
                  <th className="px-4 py-2.5">Company</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((r) => (
                  <tr key={r.id} className="border-t border-dils-100">
                    <td className="whitespace-nowrap px-4 py-2.5">{new Date(r.at).toLocaleString("nl-NL")}</td>
                    <InvestorCell r={r} />
                    <td className="px-4 py-2.5">{r.company ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
