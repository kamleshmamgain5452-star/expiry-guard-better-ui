import { Bell, Home, Package, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

export type BottomTab = "home" | "products" | "alerts" | "settings";

type BottomNavProps = {
  active: BottomTab;
  onChange: (tab: BottomTab) => void;
  labels: Record<BottomTab, string>;
  notificationsEnabled?: boolean;
};

const items: Array<{ id: BottomTab; icon: typeof Home }> = [
  { id: "home", icon: Home },
  { id: "products", icon: Package },
  { id: "alerts", icon: Bell },
  { id: "settings", icon: Settings }
];

export function BottomNav({ active, onChange, labels, notificationsEnabled = true }: BottomNavProps) {
  const filteredItems = items.filter((item) => item.id !== "alerts" || notificationsEnabled);

  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 safe-bottom px-4">
      <div className={cn(
        "mx-auto grid max-w-md gap-1 rounded-[28px] border border-white/70 bg-white/90 p-2 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85",
        filteredItems.length === 3 ? "grid-cols-3" : "grid-cols-4"
      )}>
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-bold transition",
                selected
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
              )}
            >
              {selected && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="absolute inset-y-1.5 inset-x-1 rounded-xl bg-slate-100/60 dark:bg-white/[0.025]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative h-4.5 w-4.5" />
              <span className="relative font-bold">{labels[item.id]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
