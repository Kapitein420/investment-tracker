"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { requestAccessEmail } from "@/actions/auth-actions";
import { PrivacyNotice } from "@/components/privacy-notice";

const CONTACT_EMAIL = "M.Burkens@dils.com";
const CONTACT_NAME = "Mats";

function accessRequestMailto(requesterEmail: string): string {
  const subject = "Request for DILS Investor Portal access";
  const body =
    `Hi ${CONTACT_NAME},\n\n` +
    `I tried to request access to the DILS Investor Portal, but my email address ` +
    `is not on the access list.\n\n` +
    `My email address: ${requesterEmail}\n\n` +
    `Could you please add me so I can get my login?\n\n` +
    `Kind regards`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function RequestAccessPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [unknownOpen, setUnknownOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let unknown = false;
    try {
      const result = await requestAccessEmail(email);
      unknown = result.unknown === true;
    } catch {
      // requestAccessEmail is designed to never throw to the client; belt-
      // and-suspenders so a network blip doesn't reveal anything.
    } finally {
      setLoading(false);
      // Unknown email: keep the form and show the contact popup instead of
      // the "check your inbox" screen, since no email is on its way.
      if (unknown) setUnknownOpen(true);
      else setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg-surface-alt px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-dils-100 bg-white p-8 shadow-soft-card">
        <div className="flex items-start gap-3">
          <Image src="/dils-logo.png" alt="DILS Investor Portal" width={56} height={20} className="h-5 w-auto" />
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Get your DILS Investor Portal login
            </p>
            <p className="text-xs text-muted-foreground">
              Enter the email your DILS broker has on file. We&rsquo;ll send you a
              link to get your password, usually within a minute.
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
                    Investor Portal, you&rsquo;ll receive an email with a link to get
                    your password shortly.
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
              {loading ? "Sending..." : "Email me a password link"}
            </Button>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={2.4} />
              Already have a password? Sign in
            </Link>
          </form>
        )}

        <div className="text-center">
          <PrivacyNotice variant="compact" />
        </div>
      </div>

      <Dialog open={unknownOpen} onOpenChange={setUnknownOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>We couldn&rsquo;t find your email</DialogTitle>
            <DialogDescription>
              <strong>{email}</strong> isn&rsquo;t on the access list for the DILS
              Investor Portal. Please get in contact with {CONTACT_NAME} at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline">
                {CONTACT_EMAIL}
              </a>{" "}
              and he will get you set up.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setUnknownOpen(false)}>
              Close
            </Button>
            <Button asChild>
              <a href={accessRequestMailto(email.trim())}>
                <Mail className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} />
                Email {CONTACT_NAME}
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
