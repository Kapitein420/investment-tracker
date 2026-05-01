"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal] segment error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4 rounded-lg border border-dils-200 bg-white p-8 shadow-soft-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-warning-soft text-status-warning">
          <AlertTriangle className="h-6 w-6" strokeWidth={2} />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-dils-black">
            We couldn&apos;t load your portal
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This usually clears up on retry. If it keeps happening, contact your
            DILS deal team.
          </p>
        </div>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground/70 tabular-nums">
            Error ref · {error.digest}
          </p>
        )}
        <Button onClick={reset} className="w-full">
          Try again
        </Button>
      </div>
    </div>
  );
}
