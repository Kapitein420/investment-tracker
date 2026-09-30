"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateAsset } from "@/actions/asset-actions";
import { ACCESS_MODE_LABELS, type AccessMode } from "@/lib/access-mode";

/** Per-asset investor process switch. Affects NEW invites only. */
export function AccessModeSelect({
  assetId,
  value,
}: {
  assetId: string;
  value: AccessMode;
}) {
  const [mode, setMode] = useState<AccessMode>(value);
  const [pending, startTransition] = useTransition();

  function onChange(next: AccessMode) {
    const prev = mode;
    setMode(next);
    startTransition(async () => {
      try {
        await updateAsset(assetId, { accessMode: next });
        toast.success(`Process set to ${ACCESS_MODE_LABELS[next].label}. Applies to new invites.`);
      } catch {
        setMode(prev);
        toast.error("Could not change the process");
      }
    });
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <span>Process:</span>
      <select
        value={mode}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as AccessMode)}
        title={ACCESS_MODE_LABELS[mode].hint}
        className="rounded border border-dils-200 bg-white px-1.5 py-0.5 text-xs font-medium text-dils-black"
      >
        {(Object.keys(ACCESS_MODE_LABELS) as AccessMode[]).map((m) => (
          <option key={m} value={m}>
            {ACCESS_MODE_LABELS[m].label}
          </option>
        ))}
      </select>
    </label>
  );
}
