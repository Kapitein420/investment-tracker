# Code fact sheet — Investment Tracker (for legal mapping)

Generated 2026-09-07 against `master` @ `6017154`. Every fact carries a `path:line` reference so a lawyer or engineer can verify it. "NOT FOUND" is a deliberate output: it means the feature or control does not exist in the codebase. This sheet is the evidence base for [legal-landscape-and-gap-analysis-2026-09.md](legal-landscape-and-gap-analysis-2026-09.md).

Stack: Next.js 16 App Router, NextAuth 4 (JWT / credentials), Prisma 6 + PostgreSQL (Supabase), Supabase Storage, Mailgun (EU endpoint), optional Upstash Redis. Controller named in-app: "DILS Group B.V." (`src/components/signing/signing-page.tsx:342`) vs "Dils Netherlands B.V." in `compliance/README.md` — **inconsistent controller identity**.

---

## 1. Data inventory

Schema: `prisma/schema.prisma` (477 lines). 14 models. No soft-delete columns, no `deletedAt`, no TTL columns anywhere.

| # | Model | Line | Personal-data fields | Deleted anywhere? |
|---|---|---|---|---|
| 1 | `User` | :60 | `name` :62, `email` :63, `passwordHash` :64, `role` :65, `passwordChangedAt` :78 | YES — `user.delete` `src/actions/invite-actions.ts:478`; fallback = soft-delete via email obfuscation `email: "<email>.removed-<ts>"` + `isActive:false` :480-482. `prisma.user.deleteMany()` in seed `prisma/seed.ts:30`. **No self-service delete.** |
| 1b | `UserCompanyMembership` | :107 | userId/companyId link | Cascade only (`onDelete: Cascade` :115-116) |
| 2 | `Asset` | :124 | `address` :126, `ownerEntity` :133, `description` :134 (free text), `brokerLabel` :130, `fieldDefaults` Json :140 (may hold names/addresses) | YES `src/actions/asset-actions.ts:135` |
| 2b | `AssetViewerAccess` | :161 | `userId`, `grantedByUserId` :166 | `deleteMany` `src/actions/admin-actions.ts:195`; cascade :168-169 |
| 3 | `Company` | :178 | `contactName` :189, `contactEmail` :190, `contactPhone` :191, `notes` :192 (free text), `legalName` :180 | **NOT FOUND** — no `company.delete` in `src/`. Only `prisma/seed.ts:28`. |
| 3b | `CompanyContact` | :212 | `name` :215, `email` :216, `role` :217 (job title, free text), `notes` :218 | **NOT FOUND** — no delete path in app code. Cascade from Company :222 only. |
| 4 | `PipelineStage` | :229 | none | seed only |
| 5 | `AssetCompanyTracking` | :244 | `ownerUserId` :254, `latestCommentPreview` :255, `bidAmount`/`bidCurrency`/`bidSubmittedAt` :261-263 (commercially sensitive) | YES `src/actions/tracking-actions.ts:159` |
| 6 | `StageStatus` | :284 | `updatedByUserId` :291, `approvedByUserId` :293 | Cascade only :297-298 |
| 7 | `Comment` | :307 | `authorUserId` :310, `body` :311 (free text, 10k cap) | YES `src/actions/comment-actions.ts:131` |
| 8 | `StageHistory` | :323 | `changedByUserId` :330, `oldValue`/`newValue` :328-329, `note` :331 | **NOT FOUND** — no delete path. Cascade from tracking :334. |
| 9 | `ActivityLog` | :343 | `userId` :349, `metadata` Json :348 (**contains `email`, `signedByName`, `recipient`, `companyName`, `storagePath`**) | **NOT FOUND** in app code (only test cleanup `src/actions/asset-actions.test.ts:65` and seed `prisma/seed.ts:21`). `user` relation has **no** `onDelete: Cascade` :352 → blocks hard user delete. |
| 10 | `SavedView` | :362 | `userId` :363, `filterConfig` Json | YES `src/actions/view-actions.ts:49` |
| 11 | `Document` | :376 | `signedByName` :392, `signedByEmail` :393, **`signatureData`** :394 (base64 PNG of handwritten signature), `fieldConfig` Json :396 (stores merged investor-typed values + full signed HTML), `rejectionReason` :400 | YES `src/actions/document-actions.ts:388, :494` |
| 12 | `SigningToken` | :414 | `token` :421, `expiresAt` :422, `usedAt` :423 | `deleteMany` `src/actions/document-actions.ts:385, :493` (only when replacing/deleting parent doc) |
| 13 | `InvestorInvite` | :432 | `email` :435, `token` :439 | `deleteMany` `src/actions/invite-actions.ts:464` |
| 14 | `AssetContent` | :454 | `htmlContent` :462 (NDA body incl. merged personal data), `description` :461, `imageUrls`/`keyMetrics` Json | YES `src/actions/content-actions.ts:170`, `src/actions/html-nda-actions.ts:245` |

**TTL / purge / cron / retention on master: NOT FOUND.**
- `vercel.json`: NOT FOUND → no Vercel Cron.
- `package.json:8-19` scripts: no `purge`, `cron`, `cleanup`, `retention`.
- `.github/workflows/ci.yml` — weekly cron (`:11-14`) is dependency audit only.
- `scripts/` (19 files): no purge/retention script on master.
- No anonymisation function anywhere. The only pseudonymisation is the ad-hoc email scramble at `src/actions/invite-actions.ts:481`.

---

## 2. Signing evidence

Two parallel signing flows: PDF (`signDocument`) and HTML NDA (`signHtmlNda`). A third: investor uploads a pre-signed PDF (`uploadInvestorNda`).

| Item | PDF flow | HTML-NDA flow |
|---|---|---|
| Signer name | `src/actions/document-actions.ts:989` | `src/actions/html-nda-actions.ts:525` |
| Signer email | `:990` | `:526` |
| Signature image (base64 PNG) | `:991` → `Document.signatureData` | `:527` |
| Timestamp | `signedAt = new Date()` `:958`, persisted `:988` | `:524` |
| Typed vs drawn | **Drawn only** — canvas `src/components/signing/signature-pad.tsx:1-60`. No typed-signature option. | same pad, `src/components/signing/html-nda-signing-page.tsx:355` |
| Token | consumed, `usedAt` set `:979-982` | `:515-518` |
| **IP address** | **NOT FOUND** — never persisted | **NOT FOUND** |
| **User agent** | **NOT FOUND** — `userAgent` appears nowhere in `src/` | **NOT FOUND** |

IP is computed only as a rate-limit key (`getClientIp` `src/lib/rate-limit.ts:159-172`, called at `src/app/sign/[token]/page.tsx:17`) and discarded. IP persists only transiently in Upstash keys (`sign-page:<ip>`, `auth:ip:<ip>`, `pwreset:ip:<ip>`; 15–60 min TTL) and in plaintext Vercel console logs (`src/lib/auth.ts:86`, `src/actions/auth-actions.ts:73`).

**Storage of the signed PDF**
- Bucket `documents`, private — `src/lib/supabase-storage.ts:16, :31`.
- Path `documents/${trackingId}/signed_${Date.now()}_${fileName}` — `src/actions/document-actions.ts:103`.
- Signed-URL TTL 7200 s — `src/actions/document-actions.ts:667, :897`; default `src/lib/supabase-storage.ts:60`. Invite hero images get a 7-day signed URL — `src/actions/invite-actions.ts:332`.
- Rendering is post-commit and best-effort; on failure the PDF is re-rendered lazily on first download (`ensureSignedPdf` `src/actions/document-actions.ts:120-169`). The stored artefact is regenerated, not a fixed byte-stable original.

**Hash / checksum of the signed PDF: NOT FOUND.** No `createHash`/`digest` on document bytes anywhere in `src/`. No `Document.hash` column.

**Completion certificate / audit page: NOT FOUND.** `src/lib/pdf-signing.ts` only stamps signature image / name / date (`:70-264`, `:266-326`).

**Copy to signer: NOT FOUND.** Neither `signDocument` (`:912-1085`) nor `signHtmlNda` (`:406-583`) sends an email. Signer can only re-access via `/portal/signed-nda/[documentId]`.

**Token:** single-use (atomic claim `where: { id, usedAt: null }` `:979-982`, `:515-518`); 30-day expiry (`document-actions.ts:286`, `html-nda-actions.ts:305`, invites `invite-actions.ts:118, :279`); entropy `randomUUID() + "-" + randomUUID()` (~244 bits). Expired/used tokens never purged.

**Consent / agree checkbox: NOT FOUND** on either signing surface. Sign button enabled purely by name + email + signature presence (`src/components/signing/signing-page.tsx:355-362`).

**Exact on-screen legal text (all English):**
1. `src/components/signing/signing-page.tsx:339-348` and byte-identical `src/components/investor/signing-modal.tsx:363-372`:
   > "Data Privacy Notice — By signing this document, you acknowledge that your name, email, signature image, and signing timestamp will be stored by DILS Group B.V. as part of this deal process. This data is used solely for contract execution and legal compliance under GDPR. You have the right to access, rectify, or request deletion of your data. Contact privacy@dils.com for any data protection inquiries."
2. `src/components/signing/html-nda-signing-page.tsx:352`: "Draw with your mouse or finger. By signing you agree to the NDA above."
3. `src/components/signing/html-nda-signing-page.tsx:366`: "By submitting, you confirm the values above are accurate and you have authority to bind {companyName}."

Notes: `privacy@dils.com` conflicts with `privacy.netherlands@dils.com` in `compliance/README.md`; the notice omits retention, legal basis, recipients and transfers; the HTML-NDA page has no privacy notice at all.

---

## 3. Audit / activity log

**`ActivityLog`** — `prisma/schema.prisma:343-359`. Actor: single required `userId` :349. **Caveat:** for signing events the actor recorded is `document.uploadedByUserId` — the admin who uploaded the document, not the investor who signed — `src/actions/document-actions.ts:1041`, `src/actions/html-nda-actions.ts:562`. Same for the Mailgun webhook (`src/app/api/mailgun/webhook/route.ts:117`). Attribution is misleading for exactly the events with legal weight.

Action vocabulary: `CREATED`, `UPDATED`, `DELETED`, `ASSET_FIELD_DEFAULTS_UPDATED`, `STATUS_UPDATED`, `STAGE_REVERTED`, `DEAL_FINALIZED`, `STAGE_APPROVED`, `DOCUMENT_UPLOADED`, `OFFER_DOCUMENT_UPLOADED`, `DOCUMENT_DELETED`, `DOCUMENT_SIGNED`, `DOCUMENT_INVESTOR_UPLOADED`, `DOCUMENT_REJECTED`, `DOCUMENT_PLACEMENTS_SAVED`, `HTML_NDA_SIGNED`, `HTML_NDA_CLONED_FROM_MASTER`, `NDA_CLONED_FROM_MASTER`, `CREATED_FROM_INVITE`, `INVITE_SENT`, `INVITE_CREATED_EMAIL_FAILED`, `INVESTOR_REMOVED`, `BULK_INVITE_BATCH_STARTED/_COMPLETED`, `CONTENT_ACCESSED`, `INVESTOR_STAGE_EVENT`, `VIEWING_REQUESTED`, `VIEWER_ASSET_ACCESS_UPDATED`, `PASSWORD_RESET`, `PASSWORD_RESET_REQUESTED`, `ACCESS_REQUESTED`, `PASSWORD_RESET_REQUESTED_INACTIVE`, `PASSWORD_CHANGED_BY_USER`, `EMAIL_*` (webhook).

`metadata` Json routinely stores personal data: `email` (`auth-actions.ts:157,:262`; `admin-actions.ts:316`; `invite-actions.ts:396`), `signedByName` (`document-actions.ts:1039`; `html-nda-actions.ts:561`), `recipient` (webhook `:112`), `companyName` (`portal-actions.ts:354`), `storagePath` (`content-actions.ts:286`).

Who can view: `src/app/(protected)/admin/invites/page.tsx:52-72` (ADMIN); `src/actions/content-actions.ts:314` (EDITOR+); `src/actions/asset-actions.ts:203`, `src/actions/tracking-actions.ts:630` (EDITOR+). **Retention: NOT FOUND** — unbounded growth.

**`StageHistory`** — `prisma/schema.prisma:323-340`. Actor `changedByUserId` :330 (again `doc.uploadedByUserId` for signing: `document-actions.ts:1028`, `html-nda-actions.ts:552`). **Retention: NOT FOUND.**

**Per-employee activity UI:** `src/app/(protected)/assets/[id]/timeline/[trackingId]/page.tsx` — full timeline naming the staff member behind every change (`:28`, `:39`). **Guarded only by `getCurrentUser()` (:14) — no `requireRole`, no `requireAssetAccess`.** A VIEWER who knows a `trackingId` reaches it, bypassing the `AssetViewerAccess` gate applied at `src/app/(protected)/assets/[id]/page.tsx:23`, and contrary to `src/lib/permissions.ts:54-62` (VIEWERs never see DILS-side staff identities). `src/app/(protected)/admin/email-log/page.tsx` — Mailgun feed scoped to the calling admin's own sends via `actor-<userId>` tag (`src/actions/mailgun-events.ts:96`, tag set `src/lib/email.ts:90`): every outbound message is labelled with the sending employee's user id inside Mailgun. No dedicated employee-monitoring dashboard.

---

## 4. Portal texts (user-facing legal / privacy)

| Location | Text | Lang |
|---|---|---|
| `src/components/investor/investor-shell.tsx:55` | "© {year} DILS Group B.V. · P.IVA 07575790154" — Italian VAT number on a Dutch-facing portal | EN/IT |
| `src/components/investor/investor-shell.tsx:58-65` | link → `https://dils.nl/privacyverklaring/`, label "Privacy" | EN/NL |
| `src/components/investor/investor-shell.tsx:66-73` | link → `https://dils.nl/algemene-voorwaarden/`, label "Algemene voorwaarden" | NL |
| `src/lib/email-template.ts:39-43` (footer on every email) | "You're receiving this email because you have access to the DILS Investor Portal. Read our privacy statement for details on how we handle your personal data." (`PRIVACY_URL` :11) | EN |
| `src/components/signing/signing-page.tsx:339-348` / `signing-modal.tsx:363-372` | Data Privacy Notice (quoted in §2) | EN |
| `src/components/signing/html-nda-signing-page.tsx:352, :366` | see §2 | EN |
| `src/app/request-access/page.tsx:40-43, :54-62` | "Enter the email your DILS broker has on file…" / "If {email} is on the access list…" | EN |
| `src/actions/invite-actions.ts:383-392` (invite body) | "You have been granted access to review {asset}…" / "Keep these credentials secure…" | EN |
| `src/actions/auth-actions.ts:186-199, :205-216` | welcome / reset flavour texts | EN |
| `src/actions/admin-actions.ts:293-303` | admin reset text | EN |
| `src/app/sign/[token]/page.tsx:53-54, :76-77` | expired / on-file texts | EN |

**NOT FOUND:** cookie banner/notice (none needed for the auth cookie, but none exists); in-app terms-of-use page (external link only, investor footer only); privacy link on login, request-access, forgot-password and `/sign/[token]` pages on master; any Dutch-language privacy copy; Art. 13/14 notice at point of collection (CSV import, request-access); unsubscribe link in email footer (`src/lib/email-template.ts:36-54`).

---

## 5. Email

Sender `src/lib/email.ts`. Endpoint default `https://api.eu.mailgun.net/v3` (`:4-5`; `src/actions/mailgun-events.ts:8-9`); US endpoint is a one-env-var change (`.env.example:40-42`). From: `MAILGUN_FROM`, fallback `"Investor Portal <investments.netherlands@mg.dils.com>"` (`:8-10`). Per-send From override via `MAILGUN_FROM_ACCESS` (`src/actions/auth-actions.ts:226-229`). Reply-To from `MAILGUN_REPLY_TO` (`:75`).

**Open/click tracking flags `o:tracking*`: NOT FOUND in code.** Only option sent is `o:tag` = `actor-<userId>` (`src/lib/email.ts:90`). Tracking therefore falls back to the Mailgun domain-level setting, and the app relies on it being ON:
- Webhook setup instructions list `opened, clicked` — `src/app/api/mailgun/webhook/route.ts:8-10`.
- `EMAIL_OPENED` / `EMAIL_CLICKED` rendered on the admin invites page — `src/app/(protected)/admin/invites/page.tsx:60-61`.
- `opened`/`clicked` classified in `src/actions/mailgun-events.ts:52-55`.

**What is sent:** investor invite with **plaintext password + deal teaser + hero image** (`src/actions/invite-actions.ts:378-395`); welcome/first-access credentials (`src/actions/auth-actions.ts:233-250`); password reset with **new plaintext password** (same call); admin reset with plaintext password (`src/actions/admin-actions.ts:286-307`). `renderCredentialsTable` `src/lib/email-template.ts:194-210`.

**Email-log model: NOT FOUND.** Substitutes: live Mailgun Events API read (ADMIN, actor-scoped) `src/actions/mailgun-events.ts:76-178`; webhook → `ActivityLog` `src/app/api/mailgun/webhook/route.ts:105-119` persisting `messageId`, `recipient` (email), `reason`, `rawEvent`, `eventTimestamp`. IP / geolocation / device: NOT persisted. Webhook security: HMAC-SHA256 + `timingSafeEqual` (`:44-60`), 5-minute staleness window (`:65-68`).

**Unsubscribe / opt-out: NOT FOUND.** No `List-Unsubscribe` header, no unsubscribe URL. `EMAIL_UNSUBSCRIBED` / `EMAIL_COMPLAINED` are recorded (`webhook/route.ts:103`) and displayed (`admin/invites/page.tsx:64-65`) but **no code path suppresses future sends**. Only kill switch: global `INVITES_PAUSED=true` (`src/actions/auth-actions.ts:45-48`).

---

## 6. Cookies / third parties

**Cookies:** NextAuth session JWT (`next-auth.session-token` / `__Secure-…`), `next-auth.csrf-token`, `next-auth.callback-url` — from `src/lib/auth.ts:28-34` (`strategy: "jwt"`, `maxAge` 8 h, `updateAge` 1 h). No other `Set-Cookie` anywhere; `src/proxy.ts` sets none.

**Client-side third parties / beacons: NOT FOUND.** `src/app/layout.tsx:1-49` — no `<Script>`, no `@vercel/analytics`, no `@vercel/speed-insights`, no GTM/GA/Sentry. Fonts self-hosted via `next/font/local` (`:9-34`). Only optional remote image: `EMAIL_LOGO_URL` (`src/lib/email-template.ts:24-25`).

**CSP** — `next.config.js:70-87`: `default-src 'self'`; `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` dev); `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https:`; `font-src 'self' data:`; `connect-src 'self' https://*.supabase.co`; `worker-src 'self' blob:`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; `object-src 'self' https://*.supabase.co`. Other headers `:93-99`: HSTS 2 y preload, `X-Frame-Options: DENY`, nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Server-action origins `:27-32`: `www.dils-investorportal.nl`, `dils-investorportal.nl`, `investment-tracker-wd1b.vercel.app`, `*.vercel.app`.

**Runtime external calls (complete):** Mailgun send `src/lib/email.ts:92-102`; Mailgun events `src/actions/mailgun-events.ts:103-107`; Upstash REST `src/lib/rate-limit.ts:96-108` (region not asserted); Supabase Storage `src/lib/supabase-storage.ts:25`; Supabase Postgres `src/lib/db.ts`. No maps, geocoding, FX, KYC/AML screening, CRM, payments or AI.

---

## 7. Access control & security

Roles `prisma/schema.prisma:10-15`: `ADMIN`, `EDITOR`, `VIEWER`, `INVESTOR`. Hierarchy `src/lib/permissions.ts:20-25`; `canSeeContactDetails` :60-62 (VIEWER excluded); `getViewerAccessibleAssetIds` :77-106 (fails closed); `requireAssetAccess` :114-127. Route gating `src/proxy.ts:54-79`. Tests `src/lib/permissions.test.ts`.

**MFA / 2FA / WebAuthn: NOT FOUND** (grep `totp|mfa|2fa|otp|webauthn|authenticator` → zero real hits). Single-factor for all roles incl. ADMIN.

**Password policy:** admin-created users min 6 chars (`src/lib/validators.ts:96`); self-change min 10 chars, no complexity by design (`src/actions/change-password-actions.ts:12, :35-37`); system-issued 16 chars via `crypto.randomInt` (`src/lib/security.ts:21-28`). Breach/HIBP check, history, rotation: NOT FOUND. Hashing bcrypt cost 12 (`src/lib/security.ts:9`). Force-change-on-first-login exists but OFF by default (`src/proxy.ts:32-52`).

**Session:** 8 h / refresh 1 h (`src/lib/auth.ts:31-32`); JWT invalidated on deactivation or password rotation (`:150-186`, `:191-193`). No idle timeout, no session list, no "log out everywhere".

**Rate limits** (`src/lib/rate-limit.ts`): login 15/15 min per email, 60/15 min per IP (`src/lib/auth.ts:65-70`); reset/request-access 2/60 min per email, 6/60 min per IP (`src/actions/auth-actions.ts:68-69`); public sign page 30/60 s per IP (`src/app/sign/[token]/page.tsx:18`). Auth fails closed when limiter degraded (`auth.ts:78-83`); password reset fails open (`auth-actions.ts:71-77`). In-memory fallback is explicitly not a real limiter (`rate-limit.ts:125-148`). No rate limit on `signDocument`, `bulkInviteInvestors`, `getSignedDocumentUrl`.

**Account lockout: NOT FOUND.** **Password-reset token: NOT FOUND** — the flow generates a new password server-side and emails it in plaintext, invalidating the old one (`src/actions/auth-actions.ts:169-176`; admin `src/actions/admin-actions.ts:277-283`; tradeoff documented `:30-33`). Anyone who can trigger the endpoint for a known email rotates that user's live password (mitigated by the 2/h cap and uniform response).

**Admin impersonation: NOT FOUND.** ADMIN can reach `/portal` and `requestViewing` accepts ADMIN on an investor's deal (`src/actions/portal-actions.ts:261`), logged under the admin.

**Download logging — NOT FOUND for documents.** `getSignedDocumentUrl` (`src/actions/document-actions.ts:610-667`) authorises but writes no ActivityLog row; `getSignedHtmlNda` (`html-nda-actions.ts:596+`) same. Only `getSignedContentUrl` logs, and only for `INVESTOR` (`src/actions/content-actions.ts:268-291`). "Who downloaded which document when" is not answerable for staff or VIEWER clients.

**Signed URL TTLs** (`src/lib/supabase-storage.ts`): default 7200 s `:60`, cached to 90 % `:70` (unbounded Map `:4`); 7-day URL for invite hero images (`src/actions/invite-actions.ts:332`) embedded in outbound email. App uses the service-role key (`:23-25`), which bypasses the RLS policies in `supabase-rls-policies.sql`.

Hardening present: PDF magic-byte + MIME + 10 MB checks (`document-actions.ts:177-193`); `src/lib/sanitize-html.ts` (+ test); signature data-URL regex/length cap (`html-nda-actions.ts:429-434`); `getDocumentsByTracking` EDITOR+ after a documented IDOR (`document-actions.ts:670-679`); dev quick-login gated on `NODE_ENV` (`src/app/login/page.tsx:115`).

---

## 8. Data-subject rights (on master)

| Right | Status |
|---|---|
| Art. 15 / 20 export | **NOT FOUND** (`src/actions/data-export-actions.ts` merged in #170 on 2026-09-07, ADMIN-only, not self-service) |
| Art. 17 erasure (self-service) | **NOT FOUND** |
| Art. 16 rectification (self-service) | **NOT FOUND** — investors can change password only |
| Anonymisation | **NOT FOUND** |
| Art. 21 objection / opt-out | **NOT FOUND** |
| Art. 12 procedure | **NOT FOUND** on master (branch-only) |

**Admin removal** — `removeInvestor`, `src/actions/invite-actions.ts:453-505`: deletes `InvestorInvite` rows (`:464-466`), attempts `tx.user.delete` (`:478`); because `ActivityLog.user`, `Comment.author`, `StageHistory.changedBy`, `Document.uploadedBy`, `Asset.createdBy`, `StageStatus.*By` have no cascade (`schema.prisma:352, :317, :336, :406, :145, :299-300`) any real activity makes the hard delete throw. Fallback (`:481-483`): `isActive:false` + email rewritten to `<email>.removed-<ts>` — **obfuscation, not erasure**. Name, comments, signature images, signed PDFs, invite metadata and ActivityLog `metadata.email` survive. Storage objects are not deleted on user removal (only on explicit `deleteDocument`, `document-actions.ts:477-487`). Scope bug: lookup uses legacy scalar `companyId` (`:471-473`), so non-primary memberships silently no-op.

---

## 9. CSV import / bulk

`src/actions/bulk-invite-actions.ts` (`bulkInviteInvestors`, `:64-242`): EDITOR+ (`:71`), 200 rows/call (`:15`). Fields: `companyName`, `contactName`, `email` (`:17-21`, `:107-109`, `:112-117`). Writes `Company` (`:131-151`), `CompanyContact` (`:158-174`), then `sendInvestorInvite` (`:183-187`) creating `User`, membership, `InvestorInvite`, tracking + stage rows. Batch audit `:88-96`, `:213-228`.

**Source of the data:** external broker/market lists — `prisma/schema.prisma:203-211` (contacts stored "long before anyone is ready to actually invite them"); `docs/bulk-import-sample.csv`; `scripts/reimport-csvs-to-asset.ts:1-25` ("No emails sent. Pure data reconciliation."); `scripts/backfill-company-contacts.ts`, `scripts/fix-misaligned-import.ts`, `scripts/check-zero-contact-companies.ts`. **No consent field, no source/provenance column, no collection-date field** on `CompanyContact` (`schema.prisma:212-226`).

**Art. 14 notice to imported contacts: NOT FOUND.** Three ingestion paths: (1) reimport/backfill scripts → stored silently, zero email; (2) `bulkInviteInvestors` → first contact is the invite itself, sent inside the import loop (`:183`), containing the teaser and a plaintext password, with only the generic footer link as privacy text — no source of data, categories, retention or right to object; (3) `/request-access` JIT-creates a `User` from a silently imported `CompanyContact` (`src/actions/auth-actions.ts:96-137`).

---

## 10. AI

**NOT FOUND.** No LLM/AI SDK in `src/`, `scripts/`, or `package.json`. No vector/embedding column. No automated decision-making; `InterestLevel` (`schema.prisma:47-52`) is set manually by staff.

---

## 11. Env / regions

| Service | Vars | Region evidence |
|---|---|---|
| Supabase Postgres + Storage | `DATABASE_URL` (`.env.example:19`), `NEXT_PUBLIC_SUPABASE_URL` `:27`, `SUPABASE_SERVICE_ROLE_KEY` `:29` | Not pinned in repo. Compliance branch README asserts EU Ireland `eu-west-1` (claim in `compliance/README.md`, not enforced by code). |
| Mailgun | `MAILGUN_API_KEY` `:34`, `MAILGUN_DOMAIN` `:36` (`mg.dils.com`), `MAILGUN_FROM` `:38`, `MAILGUN_API_BASE` `:42` | EU by default; US endpoint documented as an option (`:40-41`). |
| Mailgun webhook | `MAILGUN_WEBHOOK_SIGNING_KEY` | used `webhook/route.ts:39`; absent from `.env.example`; endpoint 500s if unset (`:40-43`). |
| Upstash / Vercel KV | `UPSTASH_REDIS_REST_*`, `KV_REST_API_*` (`src/lib/rate-limit.ts:32-56`) | **Region: NOT FOUND**; not in `.env.example`. Stores IPs and emails as key material. |
| Vercel hosting | implicit | **Function region: NOT FOUND** — no `vercel.json`, no `regions` key. Vercel default for many accounts is `iad1` (US East). |
| Other | `EMAIL_LOGO_URL` `:46`, `HEALTH_SECRET` `:50`; undocumented: `MAILGUN_FROM_ACCESS`, `MAILGUN_REPLY_TO`, `INVITES_PAUSED`, `AUTH_LIMIT_BOOST`, `FORCE_PASSWORD_CHANGE_ON_FIRST_LOGIN` | |

Sub-processors identifiable from code: Supabase, Mailgun (Sinch), Vercel, Upstash. Sub-processor list / DPA register: NOT FOUND on master.

---

## 12. Tests / CI

`.github/workflows/ci.yml`: `pull_request`, `push: master`, weekly cron. Job `verify`: Postgres 16 service, `prisma db push` + seed, `npm test`, PDF-scanner smoke test, `npm run build`. Job `audit`: `npm audit --audit-level=high` (`:101-102`). `.github/dependabot.yml` present. Tests: `src/lib/permissions.test.ts`, `sanitize-html.test.ts`, `security.test.ts`, `src/actions/asset-actions.test.ts`.

NOT FOUND in CI: SAST/CodeQL, secret scanning, DAST, coverage gate, SBOM.

**`public/.well-known/security.txt`: NOT FOUND.** No `.well-known/` directory. No public vulnerability-disclosure notice; internal-only `CTO-SECURITY-BRIEF.md`, `SECURITY-REVIEW.md`, `SECURITY-REMEDIATION-PLAN.md` at repo root; no `.github/SECURITY.md`. Also committed at root: `sql-test-scripts.sql`, `supabase-setup.sql`, `supabase-rls-policies.sql`.

---

## 13. Branch `claude/trusting-elion-63a5ed` (June 2026 remediation — merged to master 2026-09-07 as #170, squash `919923e`)

`git diff master...claude/trusting-elion-63a5ed --stat` → 19 files, +641 / −9 (merge-base `e639abe`). Adds `compliance/` (README, breach runbook, retention schedule, DSAR procedure, lawful-basis + LIA, MFA plan, privacy-statement portal addendum, RoPA, sub-processor/DPA register), `scripts/purge-expired-data.ts` + `purge:dry`/`purge` scripts, `src/actions/data-export-actions.ts` (ADMIN-only export), `src/lib/log-redact.ts` (+ call sites in `auth.ts`, `auth-actions.ts`, `email.ts`), BSN elfproef guard in `src/lib/validators.ts` (+ test), privacy link on the login page.

Retention schedule proposes: SigningToken 30 d after expiry; unaccepted InvestorInvite 30 d after expiry; ActivityLog 24 months; User active + 12 months after deactivation then anonymise; signed documents and `signatureData` under legal hold ≥5 years, never auto-purged (Wwft). Purge script is not scheduled.

**Applies cleanly:** `git merge-tree --write-tree master claude/trusting-elion-63a5ed` → exit 0, zero conflicts. Master changes since June (`cea9a21`, `45c2d80`, `0f999bd`) do not collide with the branch hunks.

**Still NOT FOUND after the merge:** signature-time IP/UA capture; PDF hash; completion certificate; copy-to-signer; consent checkbox; email tracking controls; unsubscribe / `List-Unsubscribe`; document download logging; MFA (plan only); account lockout; reset-token flow; self-service export/erasure/rectification; true anonymisation on removal; `security.txt`/VDP; scheduled purge; Vercel region pinning; the unguarded timeline page; misattributed actor on `DOCUMENT_SIGNED`/`HTML_NDA_SIGNED`.
