"use client";

import { useEffect, useState } from "react";
import { getAssetClickActivity } from "@/actions/asset-actions";

type Row = Awaited<ReturnType<typeof getAssetClickActivity>>[number];

export function ClickActivityTab({ assetId }: { assetId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAssetClickActivity(assetId)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (error) return <p className="text-sm text-destructive">Could not load click activity.</p>;
  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No document clicks yet. Every time an investor opens or downloads a file it shows up here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-dils-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-soft-bg-surface-alt text-left text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">When</th>
            <th className="px-4 py-2.5">Investor</th>
            <th className="px-4 py-2.5">Company</th>
            <th className="px-4 py-2.5">Document</th>
            <th className="px-4 py-2.5">Stage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-dils-100">
              <td className="whitespace-nowrap px-4 py-2.5">{new Date(r.at).toLocaleString("nl-NL")}</td>
              <td className="px-4 py-2.5">
                {r.investor}
                {r.email && r.email !== r.investor && (
                  <span className="block text-xs text-muted-foreground">{r.email}</span>
                )}
              </td>
              <td className="px-4 py-2.5">{r.company ?? "—"}</td>
              <td className="px-4 py-2.5 font-medium">{r.documentTitle ?? "—"}</td>
              <td className="px-4 py-2.5 uppercase text-xs text-muted-foreground">{r.stageKey ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
