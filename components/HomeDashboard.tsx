import { useMemo } from "react";
import { Bell, CalendarClock, ChevronRight, FlaskConical, Languages, PackageCheck, ScanLine, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/hooks/useI18n";
import type { Product } from "@/types/product";
import { daysUntil, parseProductDate } from "@/utils/dates";
import { cn } from "@/utils/cn";

type HomeDashboardProps = {
  products: Product[];
  summary: {
    safe: number;
    expiring_soon: number;
    critical: number;
  };
  onScan: () => void;
  onManualAdd: () => void;
  onPurityTest?: () => void;
  onOpenPurityHistory?: () => void;
  onOpenProduct: (product: Product) => void;
  onOpenAlerts: () => void;
  onViewAlerts?: () => void;
  onDismissBanner?: () => void;
  alertViewed?: boolean;
  onSelectStatusFilter: (status: "safe" | "near_expiry" | "expired") => void;
  notificationsEnabled?: boolean;
};

export function HomeDashboard({
  products,
  summary,
  onScan,
  onManualAdd,
  onPurityTest,
  onOpenPurityHistory,
  onOpenProduct,
  onOpenAlerts,
  onViewAlerts,
  onDismissBanner,
  alertViewed = false,
  onSelectStatusFilter,
  notificationsEnabled = true
}: HomeDashboardProps) {
  const { t, locale, setLocale } = useI18n();
  const recent = products.slice(0, 4);

  const alertBanner = useMemo(() => {
    const criticalProducts = products
      .map(p => ({ product: p, days: daysUntil(p.expiryDate) }))
      .filter(item => item.days !== null && item.days <= 3)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

    if (criticalProducts.length > 0) {
      if (criticalProducts.length === 1) {
        const item = criticalProducts[0];
        const days = item.days ?? 0;
        const text = days < 0
          ? t("criticalUrgentOneExpired", { name: item.product.productName || t("unknownProduct") })
          : t("criticalUrgentOne", { name: item.product.productName || t("unknownProduct"), count: days });
        return { type: "critical", text };
      } else {
        return { 
          type: "critical", 
          text: t("criticalUrgentMany", { count: criticalProducts.length }) 
        };
      }
    }

    const soonProducts = products
      .map(p => ({ product: p, days: daysUntil(p.expiryDate) }))
      .filter(item => item.days !== null && item.days >= 4 && item.days <= 7)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

    if (soonProducts.length > 0) {
      if (soonProducts.length === 1) {
        const item = soonProducts[0];
        const days = item.days ?? 0;
        const text = t("standardSoonOne", { name: item.product.productName || t("unknownProduct"), count: days });
        return { type: "standard", text };
      } else {
        return { 
          type: "standard", 
          text: t("standardSoonMany", { count: soonProducts.length }) 
        };
      }
    }

    return null;
  }, [products, t]);

  return (
    <main className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-28 pt-4 safe-top">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-guard-700 dark:text-guard-200">
            {t("appName")}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-slate-950 dark:text-white">
            {t("greeting")}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
            {t("todayHint")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "hi" : "en")}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
            aria-label={t("language")}
          >
            <Languages className="h-5 w-5" />
          </button>
          {notificationsEnabled && (
            <button
              type="button"
              onClick={onOpenAlerts}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
              aria-label={t("notifications")}
            >
              <Bell className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {notificationsEnabled && alertBanner && !alertViewed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.25 } }}
            className={cn(
              "mb-5 flex items-center justify-between rounded-[24px] p-4 border shadow-sm overflow-hidden",
              alertBanner.type === "critical"
                ? "bg-red-50/90 border-red-200 text-red-950 dark:bg-red-950/15 dark:border-red-900/30 dark:text-red-100"
                : "bg-blue-50/90 border-blue-200 text-blue-950 dark:bg-blue-950/15 dark:border-blue-900/30 dark:text-blue-100"
            )}
          >
            <div className="flex items-center min-w-0">
              <span className="text-sm font-bold leading-5 truncate">
                {alertBanner.text}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onViewAlerts ?? onOpenAlerts}
                className={cn(
                  "text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider transition-opacity active:opacity-75",
                  alertBanner.type === "critical"
                    ? "bg-red-200/50 text-red-900 dark:bg-red-900/40 dark:text-red-200"
                    : "bg-blue-200/50 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
                )}
              >
                {t("view")}
              </button>
              <button
                type="button"
                onClick={onDismissBanner}
                aria-label={t("dismiss")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full transition-opacity active:opacity-75",
                  alertBanner.type === "critical"
                    ? "text-red-700/70 hover:bg-red-200/40 dark:text-red-200/70 dark:hover:bg-red-900/30"
                    : "text-blue-700/70 hover:bg-blue-200/40 dark:text-blue-200/70 dark:hover:bg-blue-900/30"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="rounded-[32px] bg-slate-950 p-5 text-white shadow-glass">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-guard-200">{t("tagline")}</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal">
              {t("scanProduct")}
            </h2>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white/10">
            <ScanLine className="h-8 w-8 text-guard-200" />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            variant="secondary"
            className="w-full border-0 bg-white text-slate-950 hover:bg-guard-50"
            onClick={onScan}
            icon={<ScanLine className="h-5 w-5" />}
          >
            {t("scanProduct")}
          </Button>
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 text-sm font-bold text-white transition-colors duration-200 hover:bg-white/10"
            onClick={onManualAdd}
          >
            {t("addManually")}
          </button>
        </div>
      </section>

      {onPurityTest && (
        <button
          type="button"
          onClick={onPurityTest}
          className="mt-4 flex w-full items-center gap-4 rounded-[28px] border border-guard-200/70 bg-guard-50/70 p-4 text-left transition active:scale-[0.99] dark:border-guard-900/50 dark:bg-guard-900/20"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-guard-500 text-white">
            <FlaskConical className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black text-slate-950 dark:text-white">
              {t("purityTitle")}
            </span>
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
              {t("purityHomeHint")}
            </span>
          </span>
          {onOpenPurityHistory && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onOpenPurityHistory();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onOpenPurityHistory();
                }
              }}
              className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black text-guard-700 dark:bg-white/10 dark:text-guard-200"
            >
              {t("purityHistoryShort")}
            </span>
          )}
        </button>
      )}

      <AnimatePresence mode="popLayout">
        {notificationsEnabled && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-5 grid grid-cols-3 gap-3"
          >
            <SummaryCard
              label={t("safeProducts")}
              value={summary.safe}
              tone="safe"
              onClick={() => onSelectStatusFilter("safe")}
            />
            <SummaryCard
              label={t("expiringSoon")}
              value={summary.expiring_soon}
              tone="near"
              onClick={() => onSelectStatusFilter("near_expiry")}
            />
            <SummaryCard
              label={t("criticalAlerts")}
              value={summary.critical}
              tone="expired"
              onClick={() => onSelectStatusFilter("expired")}
            />
          </motion.section>
        )}
      </AnimatePresence>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-normal text-slate-950 dark:text-white">
            {t("recentScans")}
          </h2>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
            {t("inventory")}
          </span>
        </div>

        {recent.length === 0 ? (
          <Card className="grid min-h-48 place-items-center text-center">
            <div>
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
                <PackageCheck className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                {t("noRecentScans")}
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">
                {t("scanFirstHint")}
              </p>
              <Button
                onClick={onScan}
                icon={<ScanLine className="h-5 w-5" />}
                className="mx-auto mt-5"
              >
                {t("scanProduct")}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {recent.map((product, index) => {
              const days = daysUntil(product.expiryDate);
              const badgeLabel =
                product.status === "expired"
                  ? days !== null && days >= 0
                    ? t("critical")
                    : t("expired")
                  : t(product.status);

              return (
                <motion.button
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  type="button"
                  onClick={() => onOpenProduct(product)}
                  className="flex w-full items-center gap-3 rounded-[26px] border border-white/80 bg-white/90 p-3 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07] transition hover:scale-[1.01]"
                  aria-label={t("openDetail")}
                >
                  <ProductThumb product={product} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-black text-slate-950 dark:text-white">
                      {product.productName || t("unknownProduct")}
                    </h3>
                    {notificationsEnabled ? (
                      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                        {countdownText(days, t)}
                      </p>
                    ) : (
                      product.expiryDate && (
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 font-medium">
                          EXP: {product.expiryDate}
                        </p>
                      )
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {notificationsEnabled && (
                      <StatusBadge status={product.status} label={badgeLabel} compact />
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  onClick
}: {
  label: string;
  value: number;
  tone: "safe" | "near" | "expired";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left focus:outline-none transition active:scale-[0.97]"
    >
      <Card className="min-h-28 p-3 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-200">
        <div
          className={cn(
            "mb-3 h-2 w-10 rounded-full",
            tone === "safe" && "bg-emerald-500",
            tone === "near" && "bg-amber-500",
            tone === "expired" && "bg-red-500"
          )}
        />
        <div className="text-3xl font-black text-slate-950 dark:text-white">{value}</div>
        <div className="mt-1 text-[11px] font-bold leading-4 text-slate-500 dark:text-slate-300">
          {label}
        </div>
      </Card>
    </button>
  );
}

function ProductThumb({ product }: { product: Product }) {
  if (product.imageDataUrl) {
    return (
      <img
        src={product.imageDataUrl}
        alt=""
        className="h-16 w-16 rounded-2xl object-cover"
      />
    );
  }

  return (
    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
      <CalendarClock className="h-7 w-7" />
    </div>
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
