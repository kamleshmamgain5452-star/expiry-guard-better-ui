import type { ExpiryStatus } from "@/types/product";
import { statusStyles } from "@/utils/status";
import { cn } from "@/utils/cn";

type StatusBadgeProps = {
  status: ExpiryStatus;
  label: string;
  compact?: boolean;
};

export function StatusBadge({ status, label, compact }: StatusBadgeProps) {
  const styles = statusStyles[status] || statusStyles.near_expiry;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-bold transition-all",
        styles.bg,
        styles.border,
        styles.text,
        compact ? "px-1.5 py-0.5 text-[9px] gap-1 tracking-wider uppercase" : "px-3 py-1.5 text-xs gap-1.5"
      )}
    >
      <span className={cn("rounded-full shrink-0", compact ? "h-1 w-1" : "h-1.5 w-1.5", styles.accent)} />
      {label}
    </span>
  );
}
