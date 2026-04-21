"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LayoutDashboard, Settings, Users, LogOut, Mail } from "lucide-react";
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const role = session?.user?.role;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-dils-200 bg-white">
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
              <p className="text-sm font-medium truncate text-dils-black">{session?.user?.name}</p>
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-dils-50/50">
        {children}
      </main>
    </div>
  );
}
