"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Company } from "@prisma/client";
import { createTracking } from "@/actions/tracking-actions";
import { createCompany } from "@/actions/asset-actions";
import { sendInvestorInvite } from "@/actions/invite-actions";
import { toast } from "sonner";

const newCompanySchema = z.object({
  name: z.string().min(1, "Name required"),
  type: z.enum(["INVESTOR", "BROKER", "ADVISOR", "TENANT", "OTHER"]),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
});

export function AddTrackingDialog({
  open,
  onOpenChange,
  assetId,
  companies,
  existingCompanyIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  companies: Company[];
  existingCompanyIds: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("existing");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [relationshipType, setRelationshipType] = useState("Investor");
  const [sendInvite, setSendInvite] = useState(true);
  const [loading, setLoading] = useState(false);

  const availableCompanies = companies.filter((c) => !existingCompanyIds.includes(c.id));
  const selectedCompany = availableCompanies.find((c) => c.id === selectedCompanyId);
  const selectedCompanyEmail = selectedCompany?.contactEmail ?? "";

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof newCompanySchema>>({
    resolver: zodResolver(newCompanySchema),
    defaultValues: { name: "", type: "INVESTOR", contactName: "", contactEmail: "" },
  });

  async function maybeSendInvite(companyId: string, email: string | null | undefined) {
    if (!sendInvite) return;
    // Tell the admin clearly that no email goes out — silently skipping was
    // confusing ("I checked the box, where's the email?"). They can edit the
    // company afterwards to add an address and re-invite.
    if (!email) {
      toast.warning("No email on file for this company — invite skipped. Add an email and re-invite from the Invites page.");
      return;
    }
    try {
      const result = await sendInvestorInvite({ companyId, assetId, email });
      if (result.emailSent) {
        toast.success("Invite email sent");
      } else {
        // The account + signing link are still created — only the email
        // failed. Tell the admin so they can copy the link manually.
        toast.warning(
          `Tracking added; invite email didn't send: ${result.emailError ?? "unknown error"}. Resend from the Invites page.`,
          { duration: 12000 }
        );
      }
    } catch (e: any) {
      toast.error(`Tracking added, but invite failed: ${e.message ?? "unknown error"}`);
    }
  }

  async function handleAddExisting() {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      await createTracking({ assetId, companyId: selectedCompanyId, relationshipType });
      toast.success("Company added to pipeline");
      await maybeSendInvite(selectedCompanyId, selectedCompanyEmail);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to add company");
    } finally {
      setLoading(false);
    }
  }

  async function handleNewCompany(data: z.infer<typeof newCompanySchema>) {
    setLoading(true);
    try {
      const company = await createCompany({
        name: data.name,
        type: data.type,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
      });
      await createTracking({ assetId, companyId: company.id, relationshipType });
      toast.success("Company created and added");
      await maybeSendInvite(company.id, data.contactEmail);
      reset();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Company to Pipeline</DialogTitle>
          <DialogDescription>Select an existing company or create a new one.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Relationship Type</Label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Investor">Investor</SelectItem>
                <SelectItem value="Advisor">Advisor</SelectItem>
                <SelectItem value="Broker">Broker</SelectItem>
                <SelectItem value="Tenant">Tenant</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Also send invite email</span>{" "}
              — creates a portal account for the contact and emails them a sign-in link. Skipped if no email is on file.
            </span>
          </label>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="existing" className="flex-1">Existing Company</TabsTrigger>
              <TabsTrigger value="new" className="flex-1">New Company</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-3 mt-3">
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleAddExisting} disabled={loading || !selectedCompanyId}>
                  {loading ? "Adding..." : "Add Company"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="new" className="space-y-3 mt-3">
              <form onSubmit={handleSubmit(handleNewCompany)} className="space-y-3">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input {...register("name")} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select defaultValue="INVESTOR" onValueChange={(v: any) => setValue("type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INVESTOR">Investor</SelectItem>
                      <SelectItem value="BROKER">Broker</SelectItem>
                      <SelectItem value="ADVISOR">Advisor</SelectItem>
                      <SelectItem value="TENANT">Tenant</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input {...register("contactName")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input {...register("contactEmail")} type="email" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create & Add"}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
