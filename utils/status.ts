import type { ExpiryStatus } from "@/types/product";

export const statusStyles: Record<
  ExpiryStatus,
  {
    text: string;
    bg: string;
    border: string;
    ring: string;
    accent: string;
  }
> = {
  safe: {
    text: "text-emerald-700 dark:text-emerald-200",
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    border: "border-emerald-200 dark:border-emerald-800",
    ring: "#1ea672",
    accent: "bg-emerald-500"
  },
  near_expiry: {
    text: "text-amber-700 dark:text-amber-200",
    bg: "bg-amber-50 dark:bg-amber-950/60",
    border: "border-amber-200 dark:border-amber-800",
    ring: "#f59e0b",
    accent: "bg-amber-500"
  },
  expired: {
    text: "text-red-700 dark:text-red-200",
    bg: "bg-red-50 dark:bg-red-950/60",
    border: "border-red-200 dark:border-red-800",
    ring: "#ef4444",
    accent: "bg-red-500"
  }
};
