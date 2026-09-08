import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivacyNotice } from "@/components/privacy-notice";
import { getCurrentUser } from "@/lib/permissions";
import { hasAcceptedCurrentTerms, TERMS_URL, TERMS_VERSION } from "@/lib/terms";
import { acceptTerms } from "@/actions/terms-actions";

// Outside the (gated) route group on purpose — this is the one page an
// investor who hasn't accepted yet must still be able to reach (G13).
export default async function PortalTermsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Already accepted (re-visited via the footer link, or a non-investor
  // role) — nothing to gate, send them back into the portal.
  if (await hasAcceptedCurrentTerms(user.id)) redirect("/portal");

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-dils-100 bg-white p-8 shadow-soft-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dils-50">
            <FileText className="h-4 w-4 text-dils-600" strokeWidth={2} />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Terms of use
            </p>
            <p className="text-xs text-muted-foreground">
              Before using the Investor Portal you need to accept the DILS general terms
              and conditions. They open in a new tab; you can re-read them at any time
              from the portal footer.
            </p>
          </div>
        </div>

        <a
          href={TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md border border-dils-100 bg-soft-bg-surface-alt px-3 py-2 text-xs text-dils-700 underline underline-offset-2 hover:text-dils-black"
        >
          Read the DILS general terms and conditions
        </a>

        <form action={acceptTerms} className="space-y-4">
          <label className="flex items-start gap-3 rounded-md border border-dils-100 p-3 text-sm cursor-pointer">
            <input type="checkbox" name="accepted" required className="mt-0.5" />
            <span className="text-foreground">
              I have read and accept the DILS general terms and conditions (version{" "}
              {TERMS_VERSION})
            </span>
          </label>

          <Button type="submit" className="w-full">
            Accept
          </Button>
        </form>

        <PrivacyNotice variant="compact" />
      </div>
    </div>
  );
}
