"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";

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
      router.push("/");
      router.refresh();
    }
  }

  function quickLogin(role: string) {
    setEmail(`${role}@example.com`);
    setPassword("password123");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gold-100">
            <Building2 className="h-6 w-6 text-gold-600" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Investment Tracker</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
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

        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground">Quick login as:</p>
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
            className="w-full text-xs border-gold-300 text-gold-700 hover:bg-gold-50"
            onClick={() => quickLogin("investor")}
          >
            Investor (Portal View)
          </Button>
        </div>
      </div>
    </div>
  );
}
