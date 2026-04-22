"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvestorShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-dils-50/50">
      {/* Top nav */}
      <header className="border-b border-dils-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex flex-col gap-0 leading-none">
            <span className="font-heading font-bold text-base tracking-tight text-dils-black">DILS</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Investor Portal
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {session?.user?.name && (
              <span className="hidden text-xs text-muted-foreground sm:inline">{session.user.name}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
        <footer className="mt-16 pt-8 border-t border-dils-200 text-center">
          <p className="text-[10px] text-muted-foreground">
            © 2026 DILS Group B.V. — <a href="mailto:privacy@dils.com" className="underline hover:text-dils-black">Privacy</a>
          </p>
        </footer>
      </main>
    </div>
  );
}
