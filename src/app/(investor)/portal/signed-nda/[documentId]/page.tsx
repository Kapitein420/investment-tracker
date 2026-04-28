import { getSignedHtmlNda } from "@/actions/html-nda-actions";
import { notFound } from "next/navigation";
import { PrintableSignedNda } from "@/components/investor/printable-signed-nda";

export default async function SignedNdaPage({ params }: { params: { documentId: string } }) {
  // Distinguish "doesn't exist" from "not yours". The previous catch-all
  // collapsed both into 404, which let an investor enumerate doc IDs and
  // tell which ones were real (404 = doesn't exist, 403 = exists but
  // belongs to another company). Now we let "Forbidden" propagate as a
  // proper 403 via Next's error boundary; everything else 404s.
  let result;
  try {
    result = await getSignedHtmlNda(params.documentId);
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "Forbidden") {
      // Triggers app's error.tsx with status 403-ish (Next renders the
      // generic error page). Better than leaking existence via 404.
      throw new Error("Forbidden");
    }
    notFound();
  }
  if (!result || !result.signedHtml) notFound();

  return <PrintableSignedNda data={result} />;
}
