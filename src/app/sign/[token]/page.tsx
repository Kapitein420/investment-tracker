import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocumentForSigning } from "@/actions/document-actions";
import { getHtmlNdaForSigning } from "@/actions/html-nda-actions";
import { SigningPage } from "@/components/signing/signing-page";
import { HtmlNdaSigningPage } from "@/components/signing/html-nda-signing-page";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default async function SignPage({ params }: { params: { token: string } }) {
  // Try HTML NDA first — its tokens look identical, but the document
  // mimeType is text/html instead of application/pdf.
  const html = await getHtmlNdaForSigning(params.token);
  if (html) {
    return <HtmlNdaSigningPage data={html} token={params.token} />;
  }

  const result = await getDocumentForSigning(params.token);

  // Invalid / expired / unknown token → 404 with the friendly card from
  // ./not-found.tsx. Calling notFound() (instead of returning the card
  // inline at HTTP 200) keeps HTTP semantics honest for monitors,
  // browser history, and crawlers.
  if (!result) {
    notFound();
  }

  if (result.status === "SIGNED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Already signed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This document is on file. The deal team will be in touch with the next step.
          </p>
          <Link
            href="/portal"
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-dils-700 hover:text-dils-black"
          >
            Go to your portal
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return <SigningPage document={result} token={params.token} />;
}
