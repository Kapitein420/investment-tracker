"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";

export async function sendInvestorInvite({
  companyId,
  assetId,
  email,
}: {
  companyId: string;
  assetId: string;
  email: string;
}) {
  const user = await requireRole("EDITOR");

  const token = Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join("");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const [asset, company] = await Promise.all([
    prisma.asset.findUniqueOrThrow({ where: { id: assetId } }),
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
  ]);

  const invite = await prisma.investorInvite.create({
    data: {
      companyId,
      assetId,
      email,
      token,
      expiresAt,
      createdById: user.id,
    },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;

  try {
    await sendEmail({
      to: email,
      subject: `You're invited to review ${asset.title}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #b8860b, #daa520); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">Investment Tracker</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a1a; margin-top: 0;">You've been invited</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              <strong>${company.name}</strong> has invited you to review the investment opportunity
              <strong>${asset.title}</strong>.
            </p>
            <p style="color: #4b5563; line-height: 1.6;">
              Click the button below to access your investor portal and view deal materials.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}"
                 style="background: linear-gradient(135deg, #b8860b, #daa520); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Investment Opportunity
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">
              This invitation expires in 30 days. If you did not expect this email, you can safely ignore it.
            </p>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error("Email send failed (invite still created):", e);
  }

  await prisma.activityLog.create({
    data: {
      entityType: "InvestorInvite",
      entityId: invite.id,
      action: "INVITE_SENT",
      metadata: {
        email,
        assetId,
        companyId,
        assetName: asset.title,
        companyName: company.name,
      },
      userId: user.id,
    },
  });

  revalidatePath("/invites");
  revalidatePath(`/assets/${assetId}`);

  return invite;
}

export async function acceptInvite(token: string, password?: string) {
  const invite = await prisma.investorInvite.findUnique({
    where: { token },
    include: { company: true },
  });

  if (!invite) throw new Error("Invalid invite token");
  if (invite.expiresAt < new Date()) throw new Error("Invite has expired");
  if (invite.acceptedAt) throw new Error("Invite already accepted");

  // Check if an INVESTOR user already exists for this company
  const existingUser = await prisma.user.findFirst({
    where: {
      companyId: invite.companyId,
      role: "INVESTOR",
      email: invite.email,
    },
  });

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const pw = password || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const passwordHash = await bcrypt.hash(pw, 12);

    const newUser = await prisma.user.create({
      data: {
        email: invite.email,
        name: invite.company.contactName || invite.company.name,
        passwordHash,
        role: "INVESTOR",
        companyId: invite.companyId,
      },
    });

    userId = newUser.id;
  }

  await prisma.investorInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  return {
    userId,
    email: invite.email,
    companyId: invite.companyId,
  };
}

export async function getInvites(assetId?: string) {
  await requireRole("EDITOR");

  const invites = await prisma.investorInvite.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      company: true,
      asset: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return invites;
}
