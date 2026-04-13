"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Mail, Check, Clock, X, Copy } from "lucide-react";
import { sendInvestorInvite } from "@/actions/invite-actions";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

type InviteRow = {
  id: string;
  email: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  company: { id: string; name: string };
  asset: { id: string; title: string };
  createdBy: { name: string };
};

export function InvitesAdmin({
  invites,
  companies,
  assets,
}: {
  invites: InviteRow[];
  companies: Array<{ id: string; name: string; contactEmail: string | null }>;
  assets: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyInviteLink(token: string, id: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Invite link copied");
    setTimeout(() => setCopiedId(null), 2000);
  }

  const selectedCompany = companies.find((c) => c.id === companyId);

  async function handleSend() {
    if (!companyId || !assetId || !email) {
      toast.error("All fields are required");
      return;
    }
    setLoading(true);
    try {
      await sendInvestorInvite({ companyId, assetId, email });
      toast.success("Invitation sent");
      setDialogOpen(false);
      setCompanyId("");
      setAssetId("");
      setEmail("");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investor Invitations</h1>
          <p className="text-sm text-muted-foreground">Send and manage portal access invitations</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Send Invite
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Asset</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Link</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Sent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">By</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No invitations sent yet
                </td>
              </tr>
            ) : (
              invites.map((inv) => (
                <tr key={inv.id} className="border-b">
                  <td className="px-4 py-3 font-medium">{inv.company.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.asset.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.email}</td>
                  <td className="px-4 py-3">
                    {inv.acceptedAt ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                        <Check className="mr-1 h-3 w-3" />Accepted
                      </Badge>
                    ) : inv.expiresAt < new Date() ? (
                      <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                        <X className="mr-1 h-3 w-3" />Expired
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                        <Clock className="mr-1 h-3 w-3" />Pending
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!inv.acceptedAt && inv.expiresAt >= new Date() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => copyInviteLink(inv.token, inv.id)}
                      >
                        {copiedId === inv.id ? (
                          <><Check className="mr-1 h-3 w-3" />Copied</>
                        ) : (
                          <><Copy className="mr-1 h-3 w-3" />Copy link</>
                        )}
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{inv.createdBy.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Send invite dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Investor Invitation</DialogTitle>
            <DialogDescription>The investor will receive an email with portal access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={companyId} onValueChange={(v) => {
                setCompanyId(v);
                const c = companies.find((c) => c.id === v);
                if (c?.contactEmail) setEmail(c.contactEmail);
              }}>
                <SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Asset</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger><SelectValue placeholder="Select asset..." /></SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investor@company.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={loading}>
              <Mail className="mr-2 h-4 w-4" />
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
