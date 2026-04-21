"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Tokens the signing form handles with dedicated UI — don't render as generic inputs. */
const RESERVED_TOKENS = new Set(["NAME", "EMAIL", "DATE"]);

/** Return the custom token keys the investor should fill in (sorted, stable). */
export function extractCustomFields(
  placeholderMap: Record<string, unknown> | null | undefined
): string[] {
  if (!placeholderMap) return [];
  const keys = Object.keys(placeholderMap).filter(
    (k) => !RESERVED_TOKENS.has(k) && k !== "SIGNATURE" && !k.startsWith("SIGNATURE_")
  );
  keys.sort();
  return keys;
}

/** Convert a placeholder token like "COMPANY_ADDRESS" into "Company address". */
export function humanizeToken(key: string): string {
  const parts = key.split("_").map((p) => p.toLowerCase());
  if (parts.length === 0) return key;
  const [first, ...rest] = parts;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/** Decide an appropriate HTML input type from a token name. */
function inputTypeFor(key: string): string {
  if (key.includes("EMAIL")) return "email";
  if (key.includes("PHONE") || key.includes("TEL")) return "tel";
  if (key.includes("URL") || key.includes("WEBSITE")) return "url";
  return "text";
}

interface DynamicFieldInputsProps {
  fieldKeys: string[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  disabled?: boolean;
}

export function DynamicFieldInputs({
  fieldKeys,
  values,
  onChange,
  disabled,
}: DynamicFieldInputsProps) {
  if (fieldKeys.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fieldKeys.map((key) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={`field-${key}`} className="flex items-center gap-2">
            <span>{humanizeToken(key)}</span>
            <code className="rounded bg-dils-50 px-1.5 py-0.5 text-[9px] text-dils-600 tracking-wider">
              {`{{${key}}}`}
            </code>
          </Label>
          <Input
            id={`field-${key}`}
            type={inputTypeFor(key)}
            value={values[key] ?? ""}
            onChange={(e) => onChange({ ...values, [key]: e.target.value })}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
