import { ArrowLeft, Barcode, CalendarDays, Check, Folder, Layers, Package, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FreshnessRing } from "@/components/FreshnessRing";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/hooks/useI18n";
import type { Product } from "@/types/product";
import { daysUntil, freshnessPercent, upcomingWeekday } from "@/utils/dates";

type ProductDetailScreenProps = {
  product: Product;
  onBack: () => void;
  onMarkUsed?: () => void;
  onDelete?: () => void;
};

export function ProductDetailScreen({ product, onBack, onMarkUsed, onDelete }: ProductDetailScreenProps) {
  const { t, locale } = useI18n();
  const days = daysUntil(product.expiryDate);
  const freshness = freshnessPercent(product.expiryDate);
  const weekday = upcomingWeekday(product.expiryDate, locale);
  const expiryDisplay = product.expiryDate
    ? weekday
      ? `${product.expiryDate} · ${weekday}`
      : product.expiryDate
    : t("notDetected");

  return (
    <main className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-28 pt-4 safe-top">
      <header className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm dark:bg-white/10 dark:text-white"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-right">
          <p className="text-sm font-bold text-guard-700 dark:text-guard-200">
            {t("productDetail")}
          </p>
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">
            {product.productName || t("unknownProduct")}
          </h1>
        </div>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[34px] bg-slate-950 shadow-glass"
      >
        {product.imageDataUrl ? (
          <img
            src={product.imageDataUrl}
            alt=""
            className="h-64 w-full object-cover opacity-90"
          />
        ) : (
          <div className="grid h-64 place-items-center bg-gradient-to-br from-guard-700 to-slate-950 text-white">
            <Package className="h-20 w-20" />
          </div>
        )}
        <div className="p-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <StatusBadge
                status={product.status}
                label={
                  product.status === "expired"
                    ? days !== null && days >= 0
                      ? t("critical")
                      : t("expired")
                    : t(product.status)
                }
              />
              <p className="mt-3 text-sm font-semibold text-white/70">
                {t("expiryCountdown")}
              </p>
              <p className="text-2xl font-black">{countdownText(days, t)}</p>
            </div>
            <FreshnessRing
              percent={freshness}
              status={product.status}
              label={t("freshness")}
            />
          </div>
        </div>
      </motion.section>

      <section className="mt-5 space-y-3">
        <DetailRow
          icon={<CalendarDays className="h-5 w-5" />}
          label={t("manufacturingDate")}
          value={product.mfdDate || t("notDetected")}
        />
        <DetailRow
          icon={<CalendarDays className="h-5 w-5" />}
          label={t("expiryDate")}
          value={expiryDisplay}
        />
        <DetailRow
          icon={<Package className="h-5 w-5" />}
          label={t("batchNumber")}
          value={product.batchNumber || t("notDetected")}
        />
        <DetailRow
          icon={<Barcode className="h-5 w-5" />}
          label={t("barcodeNumber")}
          value={product.barcode || t("notDetected")}
        />
        {product.quantity !== undefined && (
          <DetailRow
            icon={<Layers className="h-5 w-5" />}
            label={t("quantity")}
            value={product.quantity.toString()}
          />
        )}
        {product.category && (
          <DetailRow
            icon={<Folder className="h-5 w-5" />}
            label={t("category")}
            value={t(product.category as any)}
          />
        )}
        {product.notes && (
          <Card className="flex flex-col gap-1 p-4">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
              {t("notes")}
            </p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
              {product.notes}
            </p>
          </Card>
        )}
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
              {t("confidenceScore")}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              {Math.round(product.confidence * 100)}%
            </p>
          </div>
          <div className="rounded-full bg-guard-50 px-3 py-1.5 text-xs font-black text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
            {product.confidence > 0.75 ? t("highConfidence") : t("lowConfidence")}
          </div>
        </Card>
      </section>

      {(onMarkUsed || onDelete) && (
        <section className="mt-5 grid grid-cols-2 gap-3">
          {onMarkUsed && (
            <Button onClick={onMarkUsed} icon={<Check className="h-5 w-5" />}>
              {t("markAsUsed")}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="secondary"
              onClick={onDelete}
              icon={<Trash2 className="h-5 w-5" />}
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300"
            >
              {t("delete")}
            </Button>
          )}
        </section>
      )}
    </main>
  );
}

function DetailRow({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-300">{label}</p>
        <p className="truncate text-lg font-black text-slate-950 dark:text-white">{value}</p>
      </div>
    </Card>
  );
}

function countdownText(
  days: number | null,
  t: (key: "daysLeft" | "dayLeft" | "expiresToday" | "expiredAgo" | "expiredYesterday" | "notDetected", values?: Record<string, string | number>) => string
) {
  if (days === null) return t("notDetected");
  if (days === 0) return t("expiresToday");
  if (days === 1) return t("dayLeft");
  if (days > 1) return t("daysLeft", { count: days });
  if (days === -1) return t("expiredYesterday");
  return t("expiredAgo", { count: Math.abs(days) });
}
