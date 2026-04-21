"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LayoutDashboard, Settings, Users, LogOut, Mail, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

const adminItems = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/stages", label: "Stages", icon: Settings },
  { href: "/admin/invites", label: "Invites", icon: Mail },
];

function SidebarContent({
  pathname,
  isAdmin,
  role,
  userName,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  role?: string;
  userName?: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-14 flex-col justify-center gap-0 border-b border-dils-200 px-4">
        <span className="font-heading font-bold text-base tracking-tight text-dils-black">DILS</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Investment Tracker
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-dils-black text-white"
                : "text-dils-600 hover:bg-dils-50 hover:text-dils-black"
            )}
          >
            <item.icon className="h-4 w-4" strokeWidth={2} />
            {item.label}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="px-3 pt-4 pb-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
            </div>
            {adminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-dils-black text-white"
                    : "text-dils-600 hover:bg-dils-50 hover:text-dils-black"
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-dils-200 p-3">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-dils-black">{userName}</p>
            <div className="flex items-center gap-1">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-1.5 py-0 border-0",
                  role === "ADMIN"
                    ? "bg-dils-black text-white"
                    : "bg-dils-100 text-dils-800"
                )}
              >
                {role}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const role = session?.user?.role;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer whenever the route changes (after a nav link is tapped)
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Mobile top bar — visible only on <md */}
      <header className="flex h-14 items-center justify-between border-b border-dils-200 bg-white px-4 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 -ml-2"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </Button>
        <div className="flex flex-col items-center leading-none">
          <span className="font-heading font-bold text-base tracking-tight text-dils-black">DILS</span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
            Investment Tracker
          </span>
        </div>
        <div className="flex items-center gap-2">
          {role && (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-1.5 py-0 border-0",
                role === "ADMIN"
                  ? "bg-dils-black text-white"
                  : "bg-dils-100 text-dils-800"
              )}
            >
              {role}
            </Badge>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:hidden" />
          <DialogPrimitive.Content
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-dils-200 bg-white shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <SidebarContent
              pathname={pathname}
              isAdmin={isAdmin}
              role={role}
              userName={session?.user?.name}
              onNavigate={() => setDrawerOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-col border-r border-dils-200 bg-white md:flex">
        <SidebarContent
          pathname={pathname}
          isAdmin={isAdmin}
          role={role}
          userName={session?.user?.name}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-dils-50/50">
        {children}
      </main>
    </div>
  );
}
