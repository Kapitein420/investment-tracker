"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTracking } from "@/actions/tracking-actions";
import { toast } from "sonner";

// Relationship-type values, stored free-form on
// AssetCompanyTracking.relationshipType. Mirrors the CompanyType enum but
// is per-deal: the same firm can be a Broker on one asset and an Investor
// on another. Picking a value here normalises legacy/odd casings (e.g. a
// bulk-imported "INVESTOR") to these capitalised labels.
const RELATIONSHIP_TYPES = [
  "Investor",
  "Broker",
  "Advisor",
  "Tenant",
  "Other",
] as const;

interface RelationshipTypeCellProps {
  trackingId: string;
  relationshipType: string;
  editable: boolean;
}

export function RelationshipTypeCell({
  trackingId,
  relationshipType,
  editable,
}: RelationshipTypeCellProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(relationshipType);

  if (!editable) {
    return (
      <span className="text-xs text-muted-foreground">{relationshipType}</span>
    );
  }

  function handleChange(newType: string) {
    if (newType === value) return;
    const prev = value;
    setValue(newType); // optimistic
    startTransition(async () => {
      try {
        await updateTracking(trackingId, { relationshipType: newType });
        toast.success(`Type changed to ${newType}`);
        router.refresh();
      } catch {
        toast.error("Failed to update type");
        setValue(prev); // rollback
      }
    });
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger
        className="h-7 w-full px-2 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="—">{value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RELATIONSHIP_TYPES.map((type) => (
          <SelectItem key={type} value={type} className="text-xs">
            {type}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
