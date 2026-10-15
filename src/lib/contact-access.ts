import { prisma } from "@/lib/db";
import { hashUnusablePassword } from "@/lib/security";
import { ensureUserCompanyMembership } from "@/lib/user-companies";

export type ContactAccessResult = {
  /** A CompanyContact row was created (false when it already existed). */
  contactCreated: boolean;
  /** A portal User was created (false when the email already had one). */
  accountCreated: boolean;
  /** Why no account was provisioned, when that's the case. */
  skipped?: "no-email" | "non-investor-account";
};

/**
 * Make sure a person we track can get into the portal.
 *
 * "Request access" only works for an email that is either an existing User or
 * a CompanyContact (requestPasswordReset JIT-promotes contacts), so a company
 * saved with only `Company.contactEmail` — which is what the Add Company
 * dialog used to do — left that person locked out with "not on the list".
 * This guarantees both halves for one person:
 *
 *   1. a CompanyContact row for (company, email)
 *   2. an INVESTOR User with a membership on that company
 *
 * It never sends an email. The account starts with an unusable password, so
 * nothing can sign in until the person redeems a set-password link, either from
 * an invite the admin chooses to send or by requesting access themselves.
 * Idempotent: safe to call again for someone already set up.
 */
export async function ensureContactAccess({
  companyId,
  name,
  email,
  source = "STAFF",
}: {
  companyId: string;
  name?: string | null;
  email?: string | null;
  source?: string;
}): Promise<ContactAccessResult> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { contactCreated: false, accountCreated: false, skipped: "no-email" };
  }
  const contactName = (name ?? "").trim() || null;

  const existingContact = await prisma.companyContact.findUnique({
    where: { companyId_email: { companyId, email: normalized } },
    select: { id: true, name: true },
  });
  if (!existingContact) {
    await prisma.companyContact.create({
      data: { companyId, email: normalized, name: contactName, source },
    });
  } else if (!existingContact.name && contactName) {
    await prisma.companyContact.update({
      where: { id: existingContact.id },
      data: { name: contactName },
    });
  }

  let user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  let accountCreated = false;

  if (!user) {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true },
    });
    try {
      user = await prisma.user.create({
        data: {
          email: normalized,
          name: contactName || company.name,
          passwordHash: await hashUnusablePassword(),
          role: "INVESTOR",
          companyId,
          // passwordChangedAt stays NULL, like sendInvestorInvite, so the
          // first sign-in still forces a password change.
        },
      });
      accountCreated = true;
    } catch (e: any) {
      // Lost a race with another request creating the same email (User.email
      // is unique) — use theirs.
      if (e?.code !== "P2002") throw e;
      user = await prisma.user.findFirst({
        where: { email: { equals: normalized, mode: "insensitive" } },
      });
      if (!user) throw e;
    }
  }

  // Never attach an admin/editor/viewer login to an investor company; they
  // already have their own way in and elevating across roles isn't ours to do.
  if (user.role !== "INVESTOR") {
    return {
      contactCreated: !existingContact,
      accountCreated: false,
      skipped: "non-investor-account",
    };
  }

  await ensureUserCompanyMembership(user.id, companyId);
  return { contactCreated: !existingContact, accountCreated };
}
