import { getDocumentForSigning } from "@/actions/document-actions";
import { SigningPage } from "@/components/signing/signing-page";
import { Building2, AlertTriangle } from "lucide-react";

export default async function SignPage({ params }: { params: { token: string } }) {
  const result = await getDocumentForSigning(params.token);

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Invalid or Expired Link</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This signing link is no longer valid. It may have expired or already been used.
            Please contact the sender for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (result.status === "SIGNED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Building2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Already Signed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This document has already been signed. No further action is needed.
          </p>
        </div>
      </div>
    );
  }

  return <SigningPage document={result} token={params.token} />;
}
