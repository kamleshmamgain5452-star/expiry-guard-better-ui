import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
        variant === "primary" &&
          "bg-guard-600 text-white shadow-soft hover:bg-guard-700",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
        variant === "ghost" &&
          "text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10",
        variant === "danger" && "bg-red-600 text-white shadow-soft hover:bg-red-700",
        size === "sm" && "min-h-11 px-4 text-sm",
        size === "md" && "min-h-12 px-5 text-base",
        size === "lg" && "min-h-14 px-6 text-lg",
        size === "icon" && "h-12 w-12 rounded-2xl p-0",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
