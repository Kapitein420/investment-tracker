import Image from "next/image";
import type { Metadata } from "next";

// Public, unauthenticated page (src/middleware.ts only protects "/",
// "/assets", "/admin" and "/portal" — see isProtected()). Content is a
// faithful JSX conversion of the EN section of
// compliance/privacy-statement-portal-addendum.md, the controller block in
// compliance/README.md, and the recipients/retention facts in
// compliance/record-of-processing-activities.md +
// compliance/data-retention-schedule.md. Do not add or remove obligations
// here without updating those source docs first — see the ⚖️ legal-review
// note in compliance/README.md.

export const metadata: Metadata = {
  title: "Investor Portal privacy notice — Dils",
  description: "How Dils Netherlands B.V. processes your personal data in the DILS Investor Portal.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-dils-50 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl space-y-8 rounded-md border border-dils-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="space-y-3 text-center">
          <Image
            src="/dils-logo.png"
            alt="DILS"
            width={140}
            height={44}
            priority
            className="mx-auto h-10 w-auto object-contain sm:h-11"
          />
          <div className="space-y-1">
            <h1 className="dils-accent inline-block text-lg font-medium text-dils-black">
              Investor Portal privacy notice
            </h1>
            <p className="text-xs text-muted-foreground">
              How Dils Netherlands B.V. processes your personal data in the DILS Investor Portal
            </p>
          </div>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section className="space-y-2 rounded-md border border-dils-100 bg-dils-50/60 p-4 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Controller:</strong> Dils Netherlands B.V. · KvK 33.180.131 ·
              BTW NL0073.12.969.B.01 · Gustav Mahlerplein 72, 1082 MA Amsterdam ·{" "}
              <a href="mailto:privacy.netherlands@dils.com" className="underline underline-offset-2 hover:text-foreground">
                privacy.netherlands@dils.com
              </a>
            </p>
            <p>
              This notice covers the <strong className="text-foreground">DILS Investor Portal</strong> only. It
              inherits the company&rsquo;s existing privacy framework (
              <a
                href="https://dils.nl/privacyverklaring/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                dils.nl/privacyverklaring
              </a>
              ), which this page supplements rather than replaces.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-dils-black">The DILS Investor Portal</h2>
            <p>
              When DILS invites you to, or gives you access to, the DILS Investor Portal (the secure web
              application used to manage commercial-real-estate transactions and investor relationships), we
              process the following personal data about you.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-dils-black">Personal data we process in the portal</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Account &amp; identity:</strong> your name, business email
                address and an encrypted password; your role and the company/companies you are associated with.
              </li>
              <li>
                <strong className="text-foreground">Contact details:</strong> name, business email and telephone
                number of contacts at investor, broker and advisory firms (these may be entered by a DILS employee
                or a broker on your behalf).
              </li>
              <li>
                <strong className="text-foreground">Transaction data:</strong> the deals you are associated with,
                your interest level, and any bid/offer amounts you submit.
              </li>
              <li>
                <strong className="text-foreground">Electronic signatures:</strong> when you sign a document in the
                portal (e.g. an NDA), your name, email, the signature image and the signed document, plus the IP
                address and browser identifier recorded at the time of signing.
              </li>
              <li>
                <strong className="text-foreground">Communications:</strong> invitation and notification emails we
                send you, and notes/comments DILS staff record about the relationship.
              </li>
              <li>
                <strong className="text-foreground">Technical &amp; security data:</strong> sign-in events, IP
                address and activity logs used to keep the portal secure.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-dils-black">Why we process it and on what legal basis</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                To give you access to and operate the portal for you —{" "}
                <strong className="text-foreground">performance of a contract</strong> (Art. 6(1)(b) GDPR).
              </li>
              <li>
                To manage the deal pipeline and our investor/broker relationships, and to keep the portal secure
                and prevent abuse — our <strong className="text-foreground">legitimate interests</strong> (Art.
                6(1)(f) GDPR) in running our real-estate advisory business securely. You may object to this
                processing (see &ldquo;Your rights&rdquo;).
              </li>
              <li>
                To comply with legal obligations, including any applicable record-keeping and anti-money-laundering
                rules — <strong className="text-foreground">legal obligation</strong> (Art. 6(1)(c) GDPR).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-dils-black">Source of your data</h2>
            <p>
              If you did not give us your details yourself, they reached us through one of the following (Art.
              14(1)(f) GDPR):
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>provided by your firm, as part of an existing business relationship;</li>
              <li>shared by a DILS deal contact (e.g. a broker or advisor working the transaction);</li>
              <li>a public business source (e.g. a company register or firm website);</li>
              <li>or entered by yourself, for example via the &ldquo;request access&rdquo; form.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-dils-black">Who we share it with</h2>
            <p>
              The portal is operated using a small number of carefully selected service providers who process data
              on our behalf under a data-processing agreement:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Supabase</strong> (EU — Ireland) — database and private file
                storage.
              </li>
              <li>
                <strong className="text-foreground">Vercel</strong> — application hosting.
              </li>
              <li>
                <strong className="text-foreground">Mailgun</strong> (EU endpoint) — transactional email.
              </li>
              <li>
                <strong className="text-foreground">Upstash</strong> — rate-limiting / security.
              </li>
            </ul>
            <p>
              <strong className="text-foreground">International transfers.</strong> Portal data is hosted within
              the European Economic Area (EEA). Where a provider&rsquo;s parent company is outside the EEA,
              transfers are protected by an adequacy decision (the EU-US Data Privacy Framework) and/or the
              European Commission&rsquo;s Standard Contractual Clauses.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-dils-black">How long we keep it</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Signing tokens and unaccepted invites: deleted 30 days after they expire.</li>
              <li>Activity logs: kept 24 months.</li>
              <li>User accounts: kept for the life of the account plus 12 months after deactivation.</li>
              <li>
                Deal/tracking data: kept for the active deal plus 24 months after it closes or drops.
              </li>
              <li>
                Signed documents and signatures: kept for the statutory/AML retention period (generally at least
                5 years), under legal hold — not deleted automatically.
              </li>
            </ul>
          </section>

          <section className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-xs">
            <p className="font-medium text-foreground">Please do not enter sensitive data</p>
            <p>
              The portal is not intended to hold special-category data (such as health, ethnicity or religion) or
              government identification numbers such as the Dutch BSN (burgerservicenummer). Please do not enter
              such data in free-text fields.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-dils-black">Your rights</h2>
            <p>
              You have the right to access, rectify, erase, restrict or object to the processing of your data, and
              the right to data portability. To exercise these rights for portal data, contact{" "}
              <a href="mailto:privacy.netherlands@dils.com" className="underline underline-offset-2 hover:text-foreground">
                privacy.netherlands@dils.com
              </a>
              . You also have the right to lodge a complaint with the Dutch data protection authority, the{" "}
              <a
                href="https://www.autoriteitpersoonsgegevens.nl/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Autoriteit Persoonsgegevens
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-dils-black">Cookies</h2>
            <p>
              The portal uses only a strictly-necessary cookie to keep you signed in; it does not use analytics or
              marketing cookies, so no cookie banner is shown there. See our Cookie Policy for the cookies used on
              dils.nl.
            </p>
          </section>
        </div>

        <p className="border-t border-dils-100 pt-4 text-center text-[10px] text-muted-foreground">
          Version 2026-09
        </p>
      </div>
    </div>
  );
}
