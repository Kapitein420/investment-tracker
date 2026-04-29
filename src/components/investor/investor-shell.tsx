"use client";

import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvestorShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col bg-soft-bg-main">
      {/* Top nav */}
      <header className="border-b border-dils-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 leading-none">
            <Image
              src="/dils-logo.png"
              alt="DILS"
              width={88}
              height={28}
              priority
              className="h-7 w-auto object-contain"
            />
            <span className="hidden sm:inline-block h-5 w-px bg-dils-200" />
            <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="mt-auto border-t border-dils-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-4 text-[12px] text-muted-foreground sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} DILS Group B.V. · P.IVA 07575790154
          </p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href="https://dils.nl/privacyverklaring/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-dils-black hover:underline underline-offset-2"
            >
              Privacy
            </a>
            <a
              href="https://dils.nl/algemene-voorwaarden/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-dils-black hover:underline underline-offset-2"
            >
              Algemene voorwaarden
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
