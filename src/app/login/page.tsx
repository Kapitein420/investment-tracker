"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      // Use window.location for a full page load so middleware can route
      // INVESTOR → /portal, others → /
      window.location.href = "/";
    }
  }

  function quickLogin(role: string) {
    setEmail(`${role}@example.com`);
    setPassword("password123");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-dils-50">
      <div className="w-full max-w-sm space-y-8 rounded-md border border-dils-200 bg-white p-8 shadow-sm">
        <div className="space-y-3 text-center">
          <h1 className="font-heading text-5xl font-bold tracking-tight text-dils-black">DILS</h1>
          <div className="space-y-1">
            <p className="dils-accent inline-block text-sm font-medium text-dils-black">
              Investment Tracker
            </p>
            <p className="text-xs text-muted-foreground">Sign in to your account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {process.env.NODE_ENV === "development" && (
          <div className="space-y-2 pt-2 border-t border-dils-100">
            <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">Quick login</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => quickLogin("admin")}>
                Admin
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => quickLogin("editor")}>
                Editor
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => quickLogin("viewer")}>
                Viewer
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs border-dils-300 text-dils-black hover:bg-dils-50"
              onClick={() => quickLogin("investor")}
            >
              Investor (Portal View)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
