import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

export default function SignNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Link no longer valid</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This signing link has expired or was already used. Please contact the deal team for a new one.
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
