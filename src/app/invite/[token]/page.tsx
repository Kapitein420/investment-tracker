import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AcceptInvitePage } from "@/components/investor/accept-invite-page";
import { Building2, AlertTriangle } from "lucide-react";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invite = await prisma.investorInvite.findUnique({
    where: { token: params.token },
    include: {
      company: { select: { id: true, name: true } },
      asset: { select: { id: true, title: true, city: true, country: true } },
    },
  });

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Invalid Invitation</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation link is not valid. Please contact the sender.
          </p>
        </div>
      </div>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Invitation Expired</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation has expired. Please request a new one.
          </p>
        </div>
      </div>
    );
  }

  if (invite.acceptedAt) {
    // Already accepted — redirect to login
    redirect("/login");
  }

  return (
    <AcceptInvitePage
      invite={{
        token: invite.token,
        email: invite.email,
        companyName: invite.company.name,
        assetTitle: invite.asset.title,
        assetCity: invite.asset.city,
        assetCountry: invite.asset.country,
      }}
    />
  );
}
