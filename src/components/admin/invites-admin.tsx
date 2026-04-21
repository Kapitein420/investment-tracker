"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Mail, Check, Clock, X, Copy, Trash2, AlertTriangle } from "lucide-react";
import { sendInvestorInvite, removeInvestor } from "@/actions/invite-actions";
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

type InvestorGroup = {
  key: string;                        // `${companyId}|${email}`
  email: string;
  company: { id: string; name: string };
  invites: InviteRow[];               // one per asset, newest first
  status: "accepted" | "pending" | "expired";
  latestCreatedAt: Date;
};

function groupByInvestor(invites: InviteRow[]): InvestorGroup[] {
  const byKey = new Map<string, InvestorGroup>();
  const now = new Date();

  for (const inv of invites) {
    const key = `${inv.company.id}|${inv.email.toLowerCase()}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        email: inv.email,
        company: inv.company,
        invites: [],
        status: "expired",
        latestCreatedAt: inv.createdAt,
      };
      byKey.set(key, group);
    }
    group.invites.push(inv);
    if (inv.createdAt > group.latestCreatedAt) {
      group.latestCreatedAt = inv.createdAt;
    }
  }

  // Resolve per-group status and sort invite lists newest-first
  const groups = Array.from(byKey.values());
  for (const group of groups) {
    group.invites.sort((a: InviteRow, b: InviteRow) => +b.createdAt - +a.createdAt);
    const hasAccepted = group.invites.some((i: InviteRow) => i.acceptedAt != null);
    const hasActive = group.invites.some(
      (i: InviteRow) => i.acceptedAt == null && i.expiresAt >= now
    );
    group.status = hasAccepted ? "accepted" : hasActive ? "pending" : "expired";
  }

  return groups.sort(
    (a: InvestorGroup, b: InvestorGroup) =>
      +b.latestCreatedAt - +a.latestCreatedAt
  );
}

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
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<InvestorGroup | null>(null);
  const [resendingKey, setResendingKey] = useState<string | null>(null);

  const groups = useMemo(() => groupByInvestor(invites), [invites]);

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Invite link copied");
    setTimeout(() => setCopiedToken(null), 2000);
  }

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

  async function handleResendFor(group: InvestorGroup, inviteAssetId: string) {
    setResendingKey(group.key + "|" + inviteAssetId);
    try {
      await sendInvestorInvite({
        companyId: group.company.id,
        assetId: inviteAssetId,
        email: group.email,
      });
      toast.success("Invitation resent");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to resend");
    } finally {
      setResendingKey(null);
    }
  }

  async function handleRemove(group: InvestorGroup) {
    setRemovingKey(group.key);
    try {
      const res = await removeInvestor({
        email: group.email,
        companyId: group.company.id,
      });
      if (res.userDeleted) {
        toast.success(`Investor removed (${res.invitesDeleted} invites)`);
      } else if (res.userDeactivated) {
        toast.success(
          `Invites deleted; user had activity so account was deactivated`
        );
      } else {
        toast.success(`${res.invitesDeleted} invites deleted`);
      }
      setConfirmRemove(null);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    } finally {
      setRemovingKey(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="dils-accent inline-block font-heading text-3xl font-bold tracking-tight text-dils-black">
            Investor Invitations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose">
            One row per investor. Each investor can be invited to multiple assets.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
          Send Invite
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-dils-200 bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-dils-50">
            <tr className="border-b border-dils-100">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Investor</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Assets</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-dils-600">Last sent</th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider font-semibold text-dils-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No invitations sent yet
                </td>
              </tr>
            ) : (
              groups.map((group) => {
                const latest = group.invites[0];
                return (
                  <tr key={group.key} className="border-b border-dils-100 align-top hover:bg-dils-50/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dils-black">{group.company.name}</p>
                      <p className="text-xs text-muted-foreground">{group.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {group.invites.map((inv) => {
                          const thisStatus = inv.acceptedAt
                            ? "accepted"
                            : inv.expiresAt < new Date()
                            ? "expired"
                            : "pending";
                          return (
                            <div
                              key={inv.id}
                              className="group/asset flex items-center gap-1 rounded border border-dils-200 bg-white px-2 py-1"
                            >
                              <span className="text-xs text-dils-black">{inv.asset.title}</span>
                              {thisStatus === "accepted" && (
                                <Check className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />
                              )}
                              {thisStatus === "expired" && (
                                <X className="h-3 w-3 text-red-500" strokeWidth={2.5} />
                              )}
                              {thisStatus === "pending" && (
                                <Clock className="h-3 w-3 text-amber-500" strokeWidth={2.5} />
                              )}
                              <button
                                type="button"
                                className="ml-1 text-[10px] text-muted-foreground hover:text-dils-black"
                                onClick={() => handleResendFor(group, inv.asset.id)}
                                disabled={resendingKey === group.key + "|" + inv.asset.id}
                                title="Resend invitation for this asset"
                              >
                                {resendingKey === group.key + "|" + inv.asset.id ? "…" : "↻"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {group.status === "accepted" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                          <Check className="mr-1 h-3 w-3" />Accepted
                        </Badge>
                      ) : group.status === "pending" ? (
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                          <Clock className="mr-1 h-3 w-3" />Pending
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                          <X className="mr-1 h-3 w-3" />Expired
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(group.latestCreatedAt)}
                      <p className="text-[10px] text-muted-foreground/70">by {latest.createdBy.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Copy link — always use the most recent pending invite if any */}
                        {(() => {
                          const active = group.invites.find(
                            (i) => i.acceptedAt == null && i.expiresAt >= new Date()
                          );
                          if (!active) return null;
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => copyInviteLink(active.token)}
                              title="Copy the active signing link"
                            >
                              {copiedToken === active.token ? (
                                <><Check className="mr-1 h-3 w-3" />Copied</>
                              ) : (
                                <><Copy className="mr-1 h-3 w-3" />Link</>
                              )}
                            </Button>
                          );
                        })()}
                        {/* Resend — always available. Re-sends the most recent asset invite */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleResendFor(group, latest.asset.id)}
                          disabled={resendingKey === group.key + "|" + latest.asset.id}
                          title={
                            group.status === "accepted"
                              ? "Send a login reminder (no password reset)"
                              : "Resend invitation email"
                          }
                        >
                          <Mail className="mr-1 h-3 w-3" />
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmRemove(group)}
                          disabled={removingKey === group.key}
                          title="Remove investor + all their invites"
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
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

      {/* Remove investor confirmation */}
      <Dialog open={confirmRemove != null} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={2} />
              </div>
              <div>
                <DialogTitle>Remove investor</DialogTitle>
                <DialogDescription>This cannot be undone.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {confirmRemove && (
            <div className="space-y-3 rounded-md border border-dils-200 bg-dils-50/40 p-4 text-sm">
              <p>
                <span className="font-medium text-dils-black">{confirmRemove.company.name}</span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span>{confirmRemove.email}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {confirmRemove.invites.length} invitation
                {confirmRemove.invites.length === 1 ? "" : "s"} will be deleted and
                the investor account will lose portal access. If they have any
                recorded activity (signed documents, comments) the account will
                be deactivated instead of hard-deleted.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
              disabled={removingKey != null}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {removingKey ? "Removing…" : "Remove investor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
