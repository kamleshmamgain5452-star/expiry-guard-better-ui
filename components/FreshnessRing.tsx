import type { ExpiryStatus } from "@/types/product";
import { statusStyles } from "@/utils/status";

type FreshnessRingProps = {
  percent: number;
  status: ExpiryStatus;
  label: string;
};

export function FreshnessRing({ percent, status, label }: FreshnessRingProps) {
  const color = (statusStyles[status] || statusStyles.near_expiry).ring;
  const safePercent = Math.max(0, Math.min(100, percent));

  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-slate-100 dark:text-white/10"
        />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={`${safePercent * 3.14} 314`}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-black text-slate-950 dark:text-white">
          {safePercent}%
        </div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">
          {label}
        </div>
      </div>
    </div>
  );
}
