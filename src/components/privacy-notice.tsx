import Link from "next/link";

const DILS_STATEMENT_URL = "https://dils.nl/privacyverklaring/";

/**
 * Single source of truth for the Art. 13/14 notice shown at every
 * collection point (compliance/legal-landscape-and-gap-analysis-2026-09.md
 * G2). Replaces the two hand-written, out-of-date notice blocks that used
 * to live in signing-page.tsx and signing-modal.tsx.
 *
 * - "compact": one line for public forms (login, request-access,
 *   forgot-password, investor footer) that links out to the full notice.
 * - "signing": the fuller notice shown next to a signature pad, listing
 *   what signing evidence is captured (name, email, signature image,
 *   timestamp, IP, browser identifier — see Document.signerIp /
 *   signerUserAgent / pdfSha256, prisma/schema.prisma) and how long it's
 *   kept.
 */
export function PrivacyNotice({ variant }: { variant: "compact" | "signing" }) {
  if (variant === "compact") {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Dils Netherlands B.V. processes your details to run this deal process. Read the{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          portal privacy notice
        </Link>{" "}
        or the{" "}
        <a
          href={DILS_STATEMENT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          company privacy statement
        </a>
        .
      </p>
    );
  }

  return (
    <div className="rounded-md bg-gray-50 border p-3 text-[11px] text-muted-foreground space-y-2">
      <p className="font-medium text-foreground">Data privacy notice</p>
      <p>
        By signing this document, you acknowledge that Dils Netherlands B.V. will store your
        name, email, signature image, signing timestamp, IP address and browser identifier as
        part of this deal process. This data is used solely for contract execution and legal
        compliance under the GDPR, and is kept for 7 years as part of the deal record.
      </p>
      <p>
        You have the right to access, rectify, or request deletion of your data. Read the{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          portal privacy notice
        </Link>{" "}
        or contact{" "}
        <a href="mailto:privacy.netherlands@dils.com" className="underline underline-offset-2 hover:text-foreground">
          privacy.netherlands@dils.com
        </a>{" "}
        for any data protection inquiries.
      </p>
    </div>
  );
}
