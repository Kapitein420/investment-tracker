"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldCheck } from "lucide-react";
import { setPasswordWithToken } from "@/actions/set-password-actions";

interface Props {
  token: string;
  userEmail: string;
}

export function SetPasswordClient({ token, userEmail }: Props) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      // On success the action redirects to /login?set=1 and never returns.
      const r = await setPasswordWithToken({
        token,
        newPassword: next,
        confirmPassword: confirm,
      });
      setError(r.error ?? "Couldn't set your password — try again.");
      setSubmitting(false);
    } catch (e: any) {
      // A Next.js redirect surfaces here as a thrown control-flow signal the
      // framework handles itself — re-throw so navigation isn't swallowed.
      if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
      setError(e?.message ?? "Couldn't set your password — try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg-surface-alt px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-dils-100 bg-white p-8 shadow-soft-card">
        <div className="flex items-start gap-3">
          <Image
            src="/dils-logo.png"
            alt="DILS Investor Portal"
            width={56}
            height={20}
            className="h-5 w-auto"
          />
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Choose your password
            </p>
            <p className="text-xs text-muted-foreground">
              Pick a password for your DILS Investor Portal account. This link
              works once.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-dils-100 bg-soft-bg-surface-alt px-3 py-2 text-xs text-muted-foreground">
          Account <span className="font-mono text-foreground">{userEmail}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="next">New password</Label>
            <Input
              id="next"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={10}
            />
            <p className="text-[11px] text-muted-foreground">
              Minimum 10 characters. Use something you can remember &mdash; you'll
              type it from your phone.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={10}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            <Lock className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
            {submitting ? "Saving..." : "Set password"}
          </Button>

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
            Your password is hashed before storage. Nobody at DILS can read it
            &mdash; not even an admin. Save it somewhere safe.
          </p>
        </form>
      </div>
    </div>
  );
}
