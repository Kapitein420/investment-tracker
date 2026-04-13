"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Building2, LayoutDashboard, Settings, Users, LogOut, Mail } from "lucide-react";
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

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r bg-white">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Building2 className="h-5 w-5 text-gold-500" />
          <span className="font-semibold text-sm">Investment Tracker</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-gold-50 text-gold-700"
                  : "text-muted-foreground hover:bg-gray-50 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="px-3 pt-4 pb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin</p>
              </div>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-gold-50 text-gold-700"
                      : "text-muted-foreground hover:bg-gray-50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.name}</p>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {session?.user?.role}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50/50">
        {children}
      </main>
    </div>
  );
}
