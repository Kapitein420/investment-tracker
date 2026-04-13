"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, MapPin } from "lucide-react";
import { acceptInvite } from "@/actions/invite-actions";
import { toast } from "sonner";

interface AcceptInvitePageProps {
  invite: {
    token: string;
    email: string;
    companyName: string;
    assetTitle: string;
    assetCity: string;
    assetCountry: string;
  };
}

export function AcceptInvitePage({ invite }: AcceptInvitePageProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await acceptInvite(invite.token, password);

      // Auto-login after account creation
      const result = await signIn("credentials", {
        email: invite.email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Account created. Please log in manually.");
        router.push("/login");
      } else {
        router.push("/portal");
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gold-100 mb-4">
            <Building2 className="h-6 w-6 text-gold-600" />
          </div>
          <h1 className="text-xl font-semibold">Welcome to the Investor Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You&apos;ve been invited to review an investment opportunity
          </p>
        </div>

        <div className="rounded-lg bg-gold-50 border border-gold-200 p-4 mb-6">
          <p className="font-medium text-sm">{invite.assetTitle}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3" />
            {invite.assetCity}, {invite.assetCountry}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Invited as: <span className="font-medium">{invite.companyName}</span>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={invite.email} disabled className="bg-gray-50" />
          </div>
          <div className="space-y-2">
            <Label>Create a password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              onKeyDown={(e) => e.key === "Enter" && handleAccept()}
            />
          </div>

          <Button className="w-full" onClick={handleAccept} disabled={loading}>
            {loading ? "Setting up your account..." : "Accept Invitation & Continue"}
          </Button>

          <p className="text-[10px] text-center text-muted-foreground">
            By accepting, you&apos;ll create an account to access deal materials and sign documents.
          </p>
        </div>
      </div>
    </div>
  );
}
