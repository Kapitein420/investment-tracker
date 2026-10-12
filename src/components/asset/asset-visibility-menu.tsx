"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Eye, EyeOff } from "lucide-react";
import { setAssetVisibility } from "@/actions/asset-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Hide/show an asset on the admin dashboard and in the investor portal. */
export function AssetVisibilityMenu({
  assetId,
  isHidden,
  hiddenFromInvestors,
}: {
  assetId: string;
  isHidden: boolean;
  hiddenFromInvestors: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(
    patch: { isHidden?: boolean; hiddenFromInvestors?: boolean },
    message: string
  ) {
    startTransition(async () => {
      try {
        await setAssetVisibility(assetId, patch);
        toast.success(message);
        router.refresh();
      } catch {
        toast.error("Could not change visibility");
      }
    });
  }

  const Icon = isHidden || hiddenFromInvestors ? EyeOff : Eye;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label="Visibility"
          title="Visibility"
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Visibility</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            update(
              { isHidden: !isHidden },
              isHidden ? "Asset shown on the dashboard" : "Asset hidden from the dashboard"
            )
          }
        >
          <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
            {!isHidden && <Check className="h-4 w-4" />}
          </span>
          Show on dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            update(
              { hiddenFromInvestors: !hiddenFromInvestors },
              hiddenFromInvestors ? "Asset visible to investors" : "Asset hidden from investors"
            )
          }
        >
          <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
            {!hiddenFromInvestors && <Check className="h-4 w-4" />}
          </span>
          Visible to investors
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
