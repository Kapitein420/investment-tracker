# Data retention schedule — Art. 5(1)(e) GDPR

> **Controller:** Dils Netherlands B.V. **Principle:** keep personal data no longer than necessary for the purpose. Periods below are proposals — confirm the legal-hold / AML periods with counsel. Enforced by `scripts/purge-expired-data.ts` (run on a schedule) plus the deletion flows in the app.
> **Last reviewed:** 2026-06-22.

| Data category | Retention period | Trigger | Mechanism |
|---|---|---|---|
| **Signing tokens** (`SigningToken`) | Delete 30 days after `expiresAt` | Token expired/used | Purge script |
| **Investor invites** (`InvestorInvite`) | Delete 30 days after `expiresAt` if not accepted | Invite expired, unaccepted | Purge script |
| **Activity logs** (`ActivityLog`) | 24 months | `createdAt` older than 24m | Purge script (keep AML-relevant events longer if required) |
| **User accounts** (`User`) | Active + 12 months after deactivation | Account `isActive=false` for 12m | Erasure/anonymise (DSAR or admin) |
| **Comments / notes** (free-text) | Tied to parent record / relationship | Relationship closed | Deleted with parent (cascade) or on erasure |
| **Bid / tracking data** | Active deal + 24 months after deal closes/drops | Lifecycle `COMPLETED`/`DROPPED` + 24m | Manual/admin; review |
| **Signed documents** (`Document`, signed) | **Statutory / AML period (confirm — generally ≥5 years)** | Document signed | **Legal hold — NOT auto-purged** |
| **Signature images** (`signatureData`) | Same as the signed document they belong to | — | Legal hold |
| **Rate-limit keys** (Upstash) | Minutes (TTL) | Automatic | Provider TTL |

## Notes
- **Legal hold beats erasure.** Where the Wwft (anti-money-laundering) or other law requires retention, that period overrides a GDPR erasure request for the affected records. The DSAR procedure and purge script both exclude signed documents from automatic deletion.
- **Soft-deleted users.** Today removal soft-deletes (obfuscates email, `isActive=false`) when foreign keys prevent a hard delete. After the 12-month window, anonymise residual fields. Activity logs referencing a removed user are retained for the audit-log period, then aged out.
- **The purge script is conservative by default** (`npm run purge:dry` prints what would be deleted; `npm run purge` performs it). Wire it to a scheduled job (e.g. a Vercel Cron hitting a protected route, or a daily GitHub Action) once the periods are signed off.
