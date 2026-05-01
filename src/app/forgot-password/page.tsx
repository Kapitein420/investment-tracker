"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "@/actions/auth-actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // requestPasswordReset is designed to never throw to the client, but
      // belt-and-suspenders so a network blip doesn't reveal anything.
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg-surface-alt px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-dils-100 bg-white p-8 shadow-soft-card">
        <div className="flex items-start gap-3">
          <Image src="/dils-logo.png" alt="DILS Investment Portal" width={56} height={20} className="h-5 w-auto" />
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Reset your password
            </p>
            <p className="text-xs text-muted-foreground">
              Enter your email — we&rsquo;ll send you a fresh password.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-md border border-status-success/35 bg-status-success-soft p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-0.5 text-status-success" strokeWidth={2.2} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Check your inbox</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    If an account exists for <strong>{email}</strong>, you&rsquo;ll receive an
                    email with a fresh password within a minute. Use it to sign in, then change it
                    once you&rsquo;re inside.
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={2.4} />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Email me a new password"}
            </Button>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={2.4} />
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
