"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, Check } from "lucide-react";
import { setMyTrackingConsent } from "@/actions/email-tracking-actions";

interface Props {
  userEmail: string;
  initialConsent: boolean;
}

export function EmailPreferencesClient({ userEmail, initialConsent }: Props) {
  const [consented, setConsented] = useState(initialConsent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const r = await setMyTrackingConsent(consented);
      if (!r.ok) {
        setError(r.error ?? "Couldn't save — try again.");
        return;
      }
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-dils-100 bg-white p-8 shadow-soft-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dils-50">
            <Eye className="h-4 w-4 text-dils-600" strokeWidth={2} />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Email preferences
            </p>
            <p className="text-xs text-muted-foreground">
              Control whether DILS can see how you interact with the emails we send you.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-dils-100 bg-soft-bg-surface-alt px-3 py-2 text-xs text-muted-foreground">
          Signed in as <span className="font-mono text-foreground">{userEmail}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-start gap-3 rounded-md border border-dils-100 p-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => {
                setConsented(e.target.checked);
                setSaved(false);
              }}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-foreground">
                Let DILS see when I open deal emails and which links I click
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                We use this only to follow up at the right moment. Off by default;
                you can change it any time. When on, DILS receives open and click
                events from our email provider (Mailgun, EU).
              </p>
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save preferences"}
          </Button>

          {saved && (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-700">
              <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />
              Saved.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
