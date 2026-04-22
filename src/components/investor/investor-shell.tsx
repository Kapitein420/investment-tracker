"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvestorShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-7 w-7 place-items-center rounded-sm bg-primary text-[13px] font-bold text-primary-foreground">
              D
            </div>
            <div className="flex flex-col gap-0 leading-none">
              <span className="font-heading font-bold text-base tracking-tight text-foreground">DILS</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Investor Portal
              </span>
            </div>
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
        <footer className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-[10px] text-muted-foreground">
            © 2026 DILS Group B.V. — <a href="mailto:privacy@dils.com" className="underline hover:text-foreground">Privacy</a>
          </p>
        </footer>
      </main>
    </div>
  );
}
