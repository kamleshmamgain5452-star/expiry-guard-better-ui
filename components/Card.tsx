import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/[0.07]",
        className
      )}
      {...props}
    />
  );
}
