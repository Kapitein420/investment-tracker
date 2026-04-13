"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAssetSchema, type CreateAssetInput } from "@/lib/validators";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createAsset } from "@/actions/asset-actions";

export function CreateAssetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssetInput>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: { country: "Netherlands" },
  });

  async function onSubmit(data: CreateAssetInput) {
    try {
      const asset = await createAsset(data);
      toast.success("Asset created");
      reset();
      onOpenChange(false);
      router.push(`/assets/${asset.id}`);
    } catch {
      toast.error("Failed to create asset");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Asset</DialogTitle>
          <DialogDescription>Add a new asset to track deal pipelines.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register("title")} placeholder="e.g. Generaal Vetterstraat 82" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input {...register("address")} placeholder="Full address" />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input {...register("city")} placeholder="Amsterdam" />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input {...register("country")} />
              {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Input {...register("assetType")} placeholder="Office, Retail..." />
            </div>
            <div className="space-y-2">
              <Label>Broker</Label>
              <Input {...register("brokerLabel")} placeholder="CBRE, JLL..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <Input {...register("transactionType")} placeholder="Investment Sale" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
