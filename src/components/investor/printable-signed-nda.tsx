"use client";

import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  data: {
    documentId: string;
    assetTitle: string;
    signedAt: Date | null;
    signedByName: string | null;
    signedByEmail: string | null;
    signedHtml: string;
  };
}

export function PrintableSignedNda({ data }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white px-6 py-3 print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/portal" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to portal
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Signed by</p>
              <p className="text-sm font-medium">{data.signedByName}</p>
            </div>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6 print:p-0">
        <div className="rounded-xl border bg-white p-12 shadow-sm print:border-0 print:shadow-none print:p-0">
          <div
            className="prose prose-sm max-w-none text-[13px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: data.signedHtml }}
          />
        </div>
      </main>
    </div>
  );
}
