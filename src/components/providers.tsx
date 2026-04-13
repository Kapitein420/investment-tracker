"use client";

import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </SessionProvider>
  );
}
