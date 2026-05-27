import { cn } from "@/utils/cn";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-8 w-14 rounded-full p-1 transition",
        checked ? "bg-guard-600" : "bg-slate-200 dark:bg-white/15"
      )}
    >
      <span
        className={cn(
          "block h-6 w-6 rounded-full bg-white shadow-sm transition",
          checked && "translate-x-6"
        )}
      />
    </button>
  );
}
