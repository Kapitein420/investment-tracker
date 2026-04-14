"use client";

import { signOut, useSession } from "next-auth/react";
import { Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvestorShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Top nav */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gold-100">
              <Building2 className="h-4 w-4 text-gold-600" />
            </div>
            <div>
              <span className="text-sm font-semibold">Investor Portal</span>
              {session?.user?.name && (
                <span className="ml-2 text-xs text-muted-foreground">{session.user.name}</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
        <footer className="mt-16 pt-8 border-t text-center">
          <p className="text-[10px] text-muted-foreground">
            © 2026 DILS Group B.V. — <a href="mailto:privacy@dils.com" className="underline hover:text-foreground">Privacy</a>
          </p>
        </footer>
      </main>
    </div>
  );
}
