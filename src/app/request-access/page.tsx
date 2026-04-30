"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { requestAccessEmail } from "@/actions/auth-actions";

export default function RequestAccessPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestAccessEmail(email);
    } catch {
      // requestAccessEmail is designed to never throw to the client; belt-
      // and-suspenders so a network blip doesn't reveal anything.
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg-surface-alt px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-dils-100 bg-white p-8 shadow-soft-card">
        <div className="flex items-start gap-3">
          <Image src="/dils-logo.png" alt="DILS Investment Tracker" width={56} height={20} className="h-5 w-auto" />
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Get your DILS Investor Portal login
            </p>
            <p className="text-xs text-muted-foreground">
              Enter the email your DILS broker has on file. We&rsquo;ll send your
              sign-in details to your inbox &mdash; usually within a minute.
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
                    If <strong>{email}</strong> is on the access list for the DILS
                    Investment Portal, you&rsquo;ll receive an email with your login
                    credentials shortly. Use those to sign in, then change your
                    password once you&rsquo;re in.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    No email arrives within 5 minutes? Reply to the message your
                    DILS contact sent you so they can verify the address on file.
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
              <Label htmlFor="access-email">Email</Label>
              <Input
                id="access-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              <Lock className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
              {loading ? "Sending..." : "Send my sign-in details"}
            </Button>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={2.4} />
              Already have credentials? Sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
