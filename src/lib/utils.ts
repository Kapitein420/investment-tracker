import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function truncate(str: string, maxLength: number) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function isStaleDate(date: Date | string, staleDays = 14) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return diff > staleDays * 24 * 60 * 60 * 1000;
}

// Format a bid amount for the trackings table + drawer. Prisma Decimals
// arrive over the wire as strings, so we accept string | number and only
// abbreviate millions/billions in the compact form.
export function formatBid(
  amount: string | number | null | undefined,
  currency = "EUR",
  opts: { compact?: boolean } = {}
): string {
  if (amount == null || amount === "") return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";

  if (opts.compact) {
    const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : `${currency} `;
    if (Math.abs(n) >= 1_000_000_000) return `${sym}${(n / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(n) >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${sym}${(n / 1_000).toFixed(0)}K`;
    return `${sym}${n.toFixed(0)}`;
  }

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("en-GB")}`;
  }
}
