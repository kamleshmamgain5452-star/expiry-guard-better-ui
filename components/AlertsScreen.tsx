import { useMemo, useState } from "react";
import { BellRing, CalendarClock, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/hooks/useI18n";
import type { Product } from "@/types/product";
import { daysUntil } from "@/utils/dates";

type AlertsScreenProps = {
  products: Product[];
  onOpenProduct: (product: Product) => void;
};

export function AlertsScreen({ products, onOpenProduct }: AlertsScreenProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const alerts = useMemo(
    () =>
      products
        .map((product) => ({ product, days: daysUntil(product.expiryDate) }))
        .filter(
          ({ product, days }) =>
            !dismissed.includes(product.id) && days !== null && days <= 7
        )
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0)),
    [dismissed, products]
  );

  const dismiss = (id: string) => setDismissed((current) => [...current, id]);

  return (
    <main className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-28 pt-4 safe-top">
      <header className="mb-5">
        <p className="text-sm font-bold text-guard-700 dark:text-guard-200">
          {t("notifications")}
        </p>
        <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
          {t("alertsTitle")}
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
          {t("alertsSubtitle")}
        </p>
      </header>

      {alerts.length === 0 ? (
        <Card className="grid min-h-72 place-items-center text-center">
          <div>
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">
              {t("noAlerts")}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
              {t("noAlertsHint")}
            </p>
          </div>
        </Card>
      ) : (
        <section className="space-y-3">
          <p className="px-1 text-xs font-bold text-slate-500 dark:text-slate-300">
            {t("swipeHint")}
          </p>
          <AnimatePresence initial={false}>
          {alerts.map(({ product, days }, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 140 }}
              transition={{ delay: index * 0.04 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info: PanInfo) => {
                if (Math.abs(info.offset.x) > 80) dismiss(product.id);
              }}
            >
              <button
                type="button"
                onClick={() => onOpenProduct(product)}
                className="flex w-full items-center gap-4 rounded-[28px] border border-white/80 bg-white/90 p-4 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07]"
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                  {product.status === "expired" ? (
                    <BellRing className="h-7 w-7" />
                  ) : (
                    <CalendarClock className="h-7 w-7" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-black text-slate-950 dark:text-white">
                    {alertText(product.productName || t("unknownProduct"), days, t)}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                    {product.expiryDate || t("notDetected")}
                  </p>
                </div>
                <StatusBadge
                  status={product.status}
                  label={
                    product.status === "expired"
                      ? days !== null && days >= 0
                        ? t("critical")
                        : t("expired")
                      : t(product.status)
                  }
                  compact
                />
              </button>
            </motion.div>
          ))}
          </AnimatePresence>
        </section>
      )}
    </main>
  );
}

function alertText(
  name: string,
  days: number | null,
  t: (key: "expiresTomorrow" | "expiresInDays" | "expiredAlert" | "expiresToday", values?: Record<string, string | number>) => string
) {
  if (days === null) return name;
  if (days < 0) return t("expiredAlert", { name });
  if (days === 0) return `${name}: ${t("expiresToday")}`;
  if (days === 1) return t("expiresTomorrow", { name });
  return t("expiresInDays", { name, count: days });
}
