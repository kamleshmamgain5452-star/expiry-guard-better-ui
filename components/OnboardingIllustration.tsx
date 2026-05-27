import { BellRing, Camera, Languages, ScanLine } from "lucide-react";
import { cn } from "@/utils/cn";

type OnboardingIllustrationProps = {
  type: "scan" | "alert" | "language";
};

export function OnboardingIllustration({ type }: OnboardingIllustrationProps) {
  const Icon = type === "scan" ? Camera : type === "alert" ? BellRing : Languages;

  return (
    <div className="relative mx-auto grid h-52 sm:h-72 w-full max-w-xs place-items-center">
      <div className="absolute h-44 sm:h-56 w-32 sm:w-40 rounded-[1.75rem] sm:rounded-[2.25rem] border border-slate-200 bg-slate-950 p-2 sm:p-3 shadow-glass dark:border-white/10">
        <div className="h-full rounded-[1.25rem] sm:rounded-[1.6rem] bg-gradient-to-b from-guard-100 to-white p-2 sm:p-3 dark:from-guard-900 dark:to-slate-950">
          <div className="mb-2 sm:mb-3 h-1.5 w-12 sm:w-16 rounded-full bg-slate-300/70" />
          <div className="relative h-24 sm:h-32 rounded-xl sm:rounded-3xl bg-slate-900/90 p-3 sm:p-4">
            <div className="scanner-mask absolute inset-2 sm:inset-4 rounded-lg sm:rounded-2xl bg-transparent" />
            {type === "scan" && (
              <ScanLine className="absolute left-1/2 top-1/2 h-10 sm:h-14 w-10 sm:w-14 -translate-x-1/2 -translate-y-1/2 text-guard-300" />
            )}
            {type === "alert" && (
              <BellRing className="absolute left-1/2 top-1/2 h-10 sm:h-14 w-10 sm:w-14 -translate-x-1/2 -translate-y-1/2 text-amber-300" />
            )}
            {type === "language" && (
              <Languages className="absolute left-1/2 top-1/2 h-10 sm:h-14 w-10 sm:w-14 -translate-x-1/2 -translate-y-1/2 text-sky-300" />
            )}
          </div>
          <div className="mt-3 sm:mt-4 grid gap-1.5 sm:gap-2">
            <div className="h-2.5 sm:h-3 rounded-full bg-slate-200 dark:bg-white/10" />
            <div className="h-2.5 sm:h-3 w-2/3 rounded-full bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
      </div>
      <div
        className={cn(
          "absolute right-8 sm:right-5 top-4 sm:top-8 grid h-12 sm:h-16 w-12 sm:w-16 place-items-center rounded-2xl sm:rounded-3xl text-white shadow-soft",
          type === "scan" && "bg-guard-500",
          type === "alert" && "bg-amber-500",
          type === "language" && "bg-sky-500"
        )}
      >
        <Icon className="h-6 sm:h-8 w-6 sm:w-8" />
      </div>
    </div>
  );
}
