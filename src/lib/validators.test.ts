import { describe, it, expect } from "vitest";
import {
  createCommentSchema,
  createCompanySchema,
  createUserSchema,
  savedViewSchema,
  setPasswordSchema,
  signDocumentSchema,
  submitOfferSchema,
  updateTrackingSchema,
} from "@/lib/validators";

describe("submitOfferSchema (investor NBO offer, G8 offer-letter parity)", () => {
  const base = { amount: 1_000_000, currency: "EUR" as const };

  it("accepts an amount-only submission with no attestation", () => {
    const result = submitOfferSchema.safeParse({ ...base, hasFile: false });
    expect(result.success).toBe(true);
  });

  it("ignores a stray attestation field on the no-file branch", () => {
    const result = submitOfferSchema.safeParse({
      ...base,
      hasFile: false,
      attestation: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a file submission missing attestation", () => {
    const result = submitOfferSchema.safeParse({ ...base, hasFile: true });
    expect(result.success).toBe(false);
  });

  it("rejects a file submission with attestation explicitly false", () => {
    const result = submitOfferSchema.safeParse({
      ...base,
      hasFile: true,
      attestation: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a file submission with attestation ticked", () => {
    const result = submitOfferSchema.safeParse({
      ...base,
      hasFile: true,
      attestation: true,
    });
    expect(result.success).toBe(true);
  });

  it("still enforces the shared amount/currency rules on both branches", () => {
    expect(
      submitOfferSchema.safeParse({ hasFile: false, amount: -5, currency: "EUR" }).success
    ).toBe(false);
    expect(
      submitOfferSchema.safeParse({
        hasFile: true,
        attestation: true,
        amount: 100,
        currency: "JPY",
      }).success
    ).toBe(false);
  });
});

// ─── zod 4 upgrade guard (#116) ────────────────────────────────
// Pins the *behaviour* of the schemas below — what parses, what does not, and
// what a parse produces. Asserts accept/reject and parsed values only, never
// message text or issue shape: zod 4 reformats both, and that churn is not a
// regression. A validator that silently starts accepting or rejecting
// different input is.
//
// bsn-guard.test.ts already covers containsBSN / containsIban /
// containsDutchIdNumber directly, so this covers the schemas wiring them onto
// free-text fields, plus the constructs zod 4 changed: .email(), .url(),
// z.record() with a key schema, z.coerce, z.literal(), and the "" escape
// hatch on optional url/email fields.

const validSignPayload = {
  token: "tok_abc123",
  signedByName: "Jan de Vries",
  signedByEmail: "jan@example.com",
  signatureData: "data:image/png;base64,iVBORw0KGgo=",
  intentConfirmed: true as const,
};

describe("signDocumentSchema", () => {
  it("accepts a complete signing payload", () => {
    expect(signDocumentSchema.safeParse(validSignPayload).success).toBe(true);
  });

  it("defaults fieldValues to an empty object when omitted", () => {
    const parsed = signDocumentSchema.parse(validSignPayload);
    expect(parsed.fieldValues).toEqual({});
  });

  it("accepts placeholder keys in {{TOKEN}} form and rejects lowercase ones", () => {
    const ok = signDocumentSchema.safeParse({
      ...validSignPayload,
      fieldValues: { COMPANY: "DILS", KVK_NUMBER: "12345678" },
    });
    expect(ok.success).toBe(true);

    const bad = signDocumentSchema.safeParse({
      ...validSignPayload,
      fieldValues: { company: "DILS" },
    });
    expect(bad.success).toBe(false);
  });

  // BW 3:15a evidence (G8): anything but literal true must fail.
  it.each([false, "true", 1, undefined])("rejects intentConfirmed = %p", (value) => {
    expect(
      signDocumentSchema.safeParse({ ...validSignPayload, intentConfirmed: value }).success
    ).toBe(false);
  });

  // If an address a real investor uses stops validating, they cannot sign.
  it.each([
    "jan@example.com",
    "jan.de-vries@sub.example.co.uk",
    "jan+deal2026@example.com",
  ])("accepts the real-world address %s", (email) => {
    expect(
      signDocumentSchema.safeParse({ ...validSignPayload, signedByEmail: email }).success
    ).toBe(true);
  });

  it.each(["not-an-email", "jan@", "@example.com", "jan@example"])(
    "rejects the malformed address %s",
    (email) => {
      expect(
        signDocumentSchema.safeParse({ ...validSignPayload, signedByEmail: email }).success
      ).toBe(false);
    }
  );
});

describe("createCompanySchema", () => {
  const base = { name: "DILS Group B.V.", type: "INVESTOR" as const };

  it("accepts the minimum required shape", () => {
    expect(createCompanySchema.safeParse(base).success).toBe(true);
  });

  // `.optional().or(z.literal(""))` — the form posts "" for untouched fields,
  // so empty string has to pass where a URL/email would otherwise be required.
  it("treats empty string as valid for website and contactEmail", () => {
    expect(
      createCompanySchema.safeParse({ ...base, website: "", contactEmail: "" }).success
    ).toBe(true);
  });

  it("accepts a real url and email, rejects malformed ones", () => {
    expect(
      createCompanySchema.safeParse({
        ...base,
        website: "https://dils.nl",
        contactEmail: "info@dils.nl",
      }).success
    ).toBe(true);
    expect(createCompanySchema.safeParse({ ...base, website: "dils" }).success).toBe(false);
    expect(createCompanySchema.safeParse({ ...base, contactEmail: "info@" }).success).toBe(false);
  });

  it("rejects notes carrying a BSN or an IBAN", () => {
    expect(createCompanySchema.safeParse({ ...base, notes: "BSN 111222333" }).success).toBe(false);
    expect(createCompanySchema.safeParse({ ...base, notes: "NL91ABNA0417164300" }).success).toBe(
      false
    );
  });
});

describe("createCommentSchema", () => {
  const base = { trackingId: "trk_1" };

  it("accepts ordinary text and rejects empty", () => {
    expect(createCommentSchema.safeParse({ ...base, body: "Called the broker." }).success).toBe(
      true
    );
    expect(createCommentSchema.safeParse({ ...base, body: "" }).success).toBe(false);
  });

  it("enforces the 10k cap", () => {
    expect(createCommentSchema.safeParse({ ...base, body: "a".repeat(10_000) }).success).toBe(true);
    expect(createCommentSchema.safeParse({ ...base, body: "a".repeat(10_001) }).success).toBe(
      false
    );
  });
});

describe("createUserSchema", () => {
  const base = {
    name: "Noah",
    email: "noah@example.com",
    password: "correct-horse-battery",
    role: "ADMIN" as const,
  };

  it("accepts a valid admin payload", () => {
    expect(createUserSchema.safeParse(base).success).toBe(true);
  });

  // Admin-set passwords are 12, not the self-change flow's 10.
  it("requires at least 12 characters", () => {
    expect(createUserSchema.safeParse({ ...base, password: "a".repeat(12) }).success).toBe(true);
    expect(createUserSchema.safeParse({ ...base, password: "a".repeat(11) }).success).toBe(false);
  });

  it("rejects a role outside the enum", () => {
    expect(createUserSchema.safeParse({ ...base, role: "SUPERUSER" }).success).toBe(false);
  });
});

describe("setPasswordSchema", () => {
  it("requires the confirmation to match, and reports it on confirmPassword", () => {
    expect(
      setPasswordSchema.safeParse({ newPassword: "aaaaaaaaaa", confirmPassword: "aaaaaaaaaa" })
        .success
    ).toBe(true);

    const mismatch = setPasswordSchema.safeParse({
      newPassword: "aaaaaaaaaa",
      confirmPassword: "bbbbbbbbbb",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0].path).toEqual(["confirmPassword"]);
    }
  });

  it("enforces the 10-character floor", () => {
    const short = "a".repeat(9);
    expect(setPasswordSchema.safeParse({ newPassword: short, confirmPassword: short }).success).toBe(
      false
    );
  });
});

describe("updateTrackingSchema", () => {
  it("coerces an ISO string into a Date for bidSubmittedAt", () => {
    const parsed = updateTrackingSchema.parse({ bidSubmittedAt: "2026-09-08T10:00:00.000Z" });
    expect(parsed.bidSubmittedAt).toBeInstanceOf(Date);
    expect((parsed.bidSubmittedAt as Date).toISOString()).toBe("2026-09-08T10:00:00.000Z");
  });

  it("keeps null (clearing the bid) distinct from omitted", () => {
    expect(updateTrackingSchema.parse({ bidSubmittedAt: null }).bidSubmittedAt).toBeNull();
    expect(updateTrackingSchema.parse({}).bidSubmittedAt).toBeUndefined();
  });

  it("holds the DECIMAL(14,2) ceiling on bidAmount", () => {
    expect(updateTrackingSchema.safeParse({ bidAmount: 999_999_999_999.99 }).success).toBe(true);
    expect(updateTrackingSchema.safeParse({ bidAmount: 1_000_000_000_000 }).success).toBe(false);
    expect(updateTrackingSchema.safeParse({ bidAmount: -1 }).success).toBe(false);
  });

  it("requires a 3-letter uppercase currency code", () => {
    expect(updateTrackingSchema.safeParse({ bidCurrency: "EUR" }).success).toBe(true);
    expect(updateTrackingSchema.safeParse({ bidCurrency: "eur" }).success).toBe(false);
    expect(updateTrackingSchema.safeParse({ bidCurrency: "EURO" }).success).toBe(false);
  });
});

describe("savedViewSchema", () => {
  it("accepts an arbitrary filterConfig object", () => {
    const parsed = savedViewSchema.parse({
      name: "Hot investors",
      filterConfig: { interestLevel: ["HOT"], stage: null, page: 2 },
    });
    expect(parsed.filterConfig).toEqual({ interestLevel: ["HOT"], stage: null, page: 2 });
  });

  it("still requires a name", () => {
    expect(savedViewSchema.safeParse({ name: "", filterConfig: {} }).success).toBe(false);
  });
});

// The sensitive-id message is value-dependent: it names whichever identifier
// was actually found, so the person can remove the right thing. That reads the
// rejected input back out of the issue, which is the one place a zod upgrade
// could silently degrade it into always naming the fallback (ID document).
describe("sensitive-id guard message", () => {
  const comment = (body: string) => createCommentSchema.safeParse({ trackingId: "t1", body });

  it("names the IBAN when the free text carries a bank account number", () => {
    const result = comment("pay to NL91ABNA0417164300 please");
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "Please remove the bank account number (IBAN) — the portal must not store it."
    );
  });

  it("names the identity document when the free text carries one", () => {
    const result = comment("paspoort NX1234567 attached");
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "Please remove the identity document number — the portal must not store it."
    );
  });
});
