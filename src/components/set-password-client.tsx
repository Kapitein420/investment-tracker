"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { revealPasswordWithToken } from "@/actions/set-password-actions";

interface Props {
  token: string;
  userEmail: string;
}

export function SetPasswordClient({ token, userEmail }: Props) {
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleReveal() {
    setError(null);
    setSubmitting(true);
    try {
      const r = await revealPasswordWithToken(token);
      if (r.ok) setPassword(r.password);
      else setError(r.error);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't generate your password. Try again.");
    }
    setSubmitting(false);
  }

  async function handleCopy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {}
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
              {password ? "Your password" : "Get your password"}
            </p>
            <p className="text-xs text-muted-foreground">
              {password
                ? "Copy it now. It is shown once and cannot be recovered."
                : "We generate a password for your DILS Investor Portal account. This link works once."}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-dils-100 bg-soft-bg-surface-alt px-3 py-2 text-xs text-muted-foreground">
          Account <span className="font-mono text-foreground">{userEmail}</span>
        </div>

        {password ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-dils-200 bg-white px-4 py-3">
              <span className="select-all font-mono text-lg tracking-wider text-foreground">{password}</span>
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Capital letters and numbers, with the dashes. You can paste it
              straight into the sign-in form.
            </p>
            <Link href="/login?set=1">
              <Button type="button" className="w-full">Continue to sign in</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="button" className="w-full" onClick={handleReveal} disabled={submitting}>
              <KeyRound className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
              {submitting ? "Generating..." : "Show my password"}
            </Button>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
              Your password is hashed before storage. Nobody at DILS can read it,
              not even an admin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
