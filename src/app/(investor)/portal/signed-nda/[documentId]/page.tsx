import { getSignedHtmlNda } from "@/actions/html-nda-actions";
import { notFound } from "next/navigation";
import { PrintableSignedNda } from "@/components/investor/printable-signed-nda";

export default async function SignedNdaPage({ params }: { params: { documentId: string } }) {
  const result = await getSignedHtmlNda(params.documentId).catch(() => null);
  if (!result || !result.signedHtml) notFound();

  return <PrintableSignedNda data={result} />;
}
