import { useMemo, useState } from "react";
import { ArrowUpDown, CalendarClock, ChevronDown, Edit2, PackageCheck, Plus, ScanLine, Search, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/hooks/useI18n";
import type { Product } from "@/types/product";
import { daysUntil } from "@/utils/dates";
import { cn } from "@/utils/cn";

type ProductsScreenProps = {
  products: Product[];
  onOpenProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onScan: () => void;
  onManualAdd: () => void;
  initialStatusFilter?: "all" | "safe" | "near_expiry" | "expired";
};

const CATEGORIES = ["all", "dairy", "bakery", "beverages", "pantry", "other"];

export function ProductsScreen({
  products,
  onOpenProduct,
  onEditProduct,
  onDeleteProduct,
  onScan,
  onManualAdd,
  initialStatusFilter = "all"
}: ProductsScreenProps) {
  const { t } = useI18n();

  // Search & Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "safe" | "near_expiry" | "expired">(initialStatusFilter);
  const [sortBy, setSortBy] = useState<"expiry" | "added" | "name">("expiry");
  const [sortOpen, setSortOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sync the status filter when the entry point changes (e.g. tapped from the dashboard).
  // Uses React's "adjust state during render" pattern instead of an effect, which avoids the
  // extra render the effect caused on every filter change.
  const [prevInitialStatusFilter, setPrevInitialStatusFilter] = useState(initialStatusFilter);
  if (initialStatusFilter !== prevInitialStatusFilter) {
    setPrevInitialStatusFilter(initialStatusFilter);
    setSelectedStatus(initialStatusFilter);
  }

  // Find product currently selected for deletion
  const deletingProduct = useMemo(() => {
    return products.find(p => p.id === confirmDeleteId) || null;
  }, [confirmDeleteId, products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        p =>
          (p.productName || "").toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q) ||
          (p.batchNumber || "").toLowerCase().includes(q) ||
          (p.notes || "").toLowerCase().includes(q)
      );
    }

    // 2. Category Filter
    if (selectedCategory !== "all") {
      result = result.filter(p => p.category === selectedCategory);
    }

    // 3. Status Filter (Primary filter)
    if (selectedStatus !== "all") {
      result = result.filter(p => {
        const days = daysUntil(p.expiryDate);
        if (selectedStatus === "safe") {
          return days === null || days > 7;
        } else if (selectedStatus === "near_expiry") {
          return days !== null && days >= 4 && days <= 7;
        } else {
          return days !== null && days <= 3;
        }
      });
    }

    // 4. Sort
    result.sort((a, b) => {
      if (sortBy === "expiry") {
        const aDays = daysUntil(a.expiryDate);
        const bDays = daysUntil(b.expiryDate);
        if (aDays === null && bDays === null) return 0;
        if (aDays === null) return 1;
        if (bDays === null) return -1;
        return aDays - bDays;
      } else if (sortBy === "added") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        const aName = (a.productName || "").toLowerCase();
        const bName = (b.productName || "").toLowerCase();
        return aName.localeCompare(bName);
      }
    });

    return result;
  }, [products, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Dynamic Grouping of Filtered Products by Urgency
  const groupedProducts = useMemo(() => {
    const critical: Product[] = [];
    const soon: Product[] = [];
    const safe: Product[] = [];

    filteredProducts.forEach(p => {
      const days = daysUntil(p.expiryDate);
      if (days !== null && days <= 3) {
        critical.push(p);
      } else if (days !== null && days >= 4 && days <= 7) {
        soon.push(p);
      } else {
        safe.push(p);
      }
    });

    return { critical, soon, safe };
  }, [filteredProducts]);

  // Helper for text-color representing remaining days countdown
  const getCountdownColorClass = (days: number | null) => {
    if (days === null) return "text-slate-400 dark:text-slate-550";
    if (days <= 3) return "text-red-600/90 dark:text-red-400/90";
    if (days <= 7) return "text-amber-600/90 dark:text-amber-400/90";
    return "text-emerald-605 dark:text-emerald-400/80";
  };

  // Helper for mapping status badge parameters dynamically
  const getBadgeProps = (product: Product, days: number | null) => {
    if (days === null) {
      return { status: "safe" as const, label: t("safe") };
    }
    if (days < 0) {
      return { status: "expired" as const, label: t("expired") };
    }
    if (days <= 3) {
      return { status: "expired" as const, label: t("critical") };
    }
    if (days <= 7) {
      return { status: "near_expiry" as const, label: t("near_expiry") };
    }
    return { status: "safe" as const, label: t("safe") };
  };

  return (
    <main className="relative h-full w-full overflow-y-auto no-scrollbar px-4 pb-28 pt-3 safe-top">
      {/* Header Section */}
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-950 dark:text-white">
          {t("products")}
        </h1>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onScan}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-95 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] transition-all duration-150"
            aria-label={t("scanProduct")}
          >
            <ScanLine className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onManualAdd}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-95 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] transition-all duration-150"
            aria-label={t("addManuallyTitle")}
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {products.length === 0 ? (
        // --- Complete Empty State ---
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-slate-50 text-slate-500 dark:bg-white/[0.02] dark:text-slate-400"
          >
            <PackageCheck className="h-8 w-8" />
          </motion.div>
          <h2 className="text-lg font-black text-slate-950 dark:text-white">
            {t("noProducts")}
          </h2>
          <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-450 dark:text-slate-400 max-w-xs">
            {t("startAddingHint")}
          </p>
          <div className="mt-6 flex flex-col gap-2 w-full max-w-[200px]">
            <Button size="sm" onClick={onScan} icon={<ScanLine className="h-4 w-4" />}>
              {t("scanProduct")}
            </Button>
            <button
              type="button"
              onClick={onManualAdd}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              {t("addManually")}
            </button>
          </div>
        </div>
      ) : (
        // --- Product Dashboard layout ---
        <div className="space-y-3">
          {/* Search bar */}
          <div className="flex h-9 w-full items-center gap-2 rounded-xl bg-slate-100/50 px-2.5 dark:bg-white/[0.015] transition-all">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-full flex-1 bg-transparent text-xs font-semibold text-slate-900 outline-none dark:text-white placeholder-slate-400 dark:placeholder-slate-550"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="grid h-6 w-6 place-items-center rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Primary Status Filters (Segmented Control style) */}
          <div className="flex p-0.5 rounded-xl bg-slate-100/40 dark:bg-white/[0.01] gap-0.5">
            {(["all", "safe", "near_expiry", "expired"] as const).map(st => {
              const isActive = selectedStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={cn(
                    "flex-1 h-7 rounded-[10px] text-[10.5px] font-bold transition-all duration-150 flex items-center justify-center",
                    isActive
                      ? "bg-white text-slate-950 shadow-sm dark:bg-white/[0.06] dark:text-white"
                      : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-350"
                  )}
                >
                  {st === "all"
                    ? t("filterAll")
                    : st === "safe"
                    ? t("safe")
                    : st === "near_expiry"
                    ? t("expiringSoon").split(" ")[0] // Expiring
                    : t("critical")}
                </button>
              );
            })}
          </div>

          {/* Product Section header: Categories on Left, Sorting on Right */}
          <div className="flex items-center justify-between gap-4 pt-1">
            {/* Secondary Category Filters Chips */}
            <div className="no-scrollbar flex gap-1 overflow-x-auto flex-1 pb-0.5">
              {CATEGORIES.map(cat => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "h-6 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all",
                      isActive
                        ? "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white"
                        : "bg-transparent text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-350"
                    )}
                  >
                    {cat === "all" ? t("filterAll") : t(cat as any)}
                  </button>
                );
              })}
            </div>

            {/* Sorting dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-450 hover:text-slate-750 dark:text-slate-400 dark:hover:text-white transition-all"
              >
                <span>{t("sortBy").split(" ")[0]}: </span>
                <span className="text-slate-800 dark:text-slate-200 font-extrabold flex items-center">
                  {sortBy === "expiry" ? t("sortExpiry").split(" ")[0] : sortBy === "added" ? t("sortAdded").split(" ")[0] : t("sortName").split(" ")[1]}
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </span>
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -4 }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 mt-1 w-32 rounded-xl border border-slate-100 bg-white p-0.5 shadow-md dark:border-white/10 dark:bg-slate-950 z-20"
                    >
                      {(["expiry", "added", "name"] as const).map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setSortBy(option);
                            setSortOpen(false);
                          }}
                          className={cn(
                            "w-full rounded-lg px-2 py-1.5 text-left text-[10px] font-bold transition-all",
                            sortBy === option
                              ? "bg-slate-50 text-slate-950 dark:bg-white/5 dark:text-white"
                              : "text-slate-500 hover:bg-slate-50/50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.02] dark:hover:text-white"
                          )}
                        >
                          {option === "expiry" ? t("sortExpiry") : option === "added" ? t("sortAdded") : t("sortName")}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Grouped Product List */}
          {filteredProducts.length === 0 ? (
            products.length === 0 ? (
              <Card className="grid min-h-56 place-items-center text-center py-8">
                <div>
                  <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
                    <PackageCheck className="h-8 w-8" />
                  </div>
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {t("emptyInventoryTitle")}
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">
                    {t("scanFirstHint")}
                  </p>
                  <div className="mt-5 flex justify-center gap-2">
                    <Button onClick={onScan} icon={<ScanLine className="h-5 w-5" />}>
                      {t("scanProduct")}
                    </Button>
                    <Button variant="secondary" onClick={onManualAdd} icon={<Plus className="h-5 w-5" />}>
                      {t("addManually")}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="grid min-h-40 place-items-center text-center py-6">
                <div>
                  <p className="text-sm font-bold text-slate-850 dark:text-white">
                    {t("noProducts")}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {t("searchPlaceholder")}
                  </p>
                </div>
              </Card>
            )
          ) : (
            <div className="space-y-4 pt-1">
              {/* Critical Urgency Group */}
              {groupedProducts.critical.length > 0 && (
                <div className="space-y-1.5">
                  <h2 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1 flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-red-400/80" />
                    {t("criticalAlerts")} • {groupedProducts.critical.length}
                  </h2>
                  <div className="space-y-1.5">
                    {groupedProducts.critical.map((product, index) => 
                      renderProductCard(product, index, true, false)
                    )}
                  </div>
                </div>
              )}

              {/* Expiring Soon Urgency Group */}
              {groupedProducts.soon.length > 0 && (
                <div className="space-y-1.5">
                  <h2 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1 flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-amber-400/80" />
                    {t("expiringSoon")} • {groupedProducts.soon.length}
                  </h2>
                  <div className="space-y-1.5">
                    {groupedProducts.soon.map((product, index) => 
                      renderProductCard(product, index, false, true)
                    )}
                  </div>
                </div>
              )}

              {/* Safe Products Urgency Group */}
              {groupedProducts.safe.length > 0 && (
                <div className="space-y-1.5">
                  <h2 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1 flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-400/50" />
                    {t("safeProducts")} • {groupedProducts.safe.length}
                  </h2>
                  <div className="space-y-1.5">
                    {groupedProducts.safe.map((product, index) => 
                      renderProductCard(product, index, false, false)
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId && deletingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteId(null)}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", duration: 0.25 }}
              className="relative w-full max-w-xs overflow-hidden rounded-[24px] border border-slate-100 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-950"
            >
              <h2 className="text-base font-black text-slate-950 dark:text-white">
                {t("deleteConfirmTitle")}
              </h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-550 dark:text-slate-350">
                {t("deleteConfirmBody", { name: deletingProduct.productName || t("unknownProduct") }) as any}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 h-9 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProduct(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }}
                  className="flex-1 h-9 rounded-xl bg-red-600/90 text-[11px] font-bold text-white transition hover:bg-red-700 active:scale-95"
                >
                  {t("delete")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );

  // Render function for Product Cards
  function renderProductCard(product: Product, index: number, isCritical: boolean, isSoon: boolean) {
    const days = daysUntil(product.expiryDate);
    const badgeProps = getBadgeProps(product, days);

    return (
      <motion.div
        key={product.id}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.02, 0.15), layout: { duration: 0.25, ease: "easeOut" } }}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-[18px] p-2 border text-left transition-all duration-200",
          isCritical
            ? "border-red-100/40 bg-red-50/[0.06] dark:border-red-950/10 dark:bg-red-950/[0.015]"
            : isSoon
            ? "border-amber-100/40 bg-amber-50/[0.06] dark:border-amber-950/10 dark:bg-amber-950/[0.015]"
            : "border-slate-100 bg-white dark:border-white/5 dark:bg-white/[0.01]"
        )}
      >
        {/* Left Urgency Accent Indicator Strip */}
        <span
          className={cn(
            "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all",
            isCritical
              ? "bg-red-400"
              : isSoon
              ? "bg-amber-400"
              : "bg-emerald-450/40"
          )}
        />

        <button
          type="button"
          onClick={() => onOpenProduct(product)}
          className="flex flex-1 items-center gap-2.5 min-w-0 pl-1"
        >
          <ProductThumb product={product} isCritical={isCritical} isSoon={isSoon} />
          
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                {product.productName || t("unknownProduct")}
              </h3>
              <StatusBadge
                status={badgeProps.status}
                label={badgeProps.label}
                compact
              />
            </div>
            <p className={cn("mt-0.5 text-[11px] font-semibold", getCountdownColorClass(days))}>
              {countdownText(days, t)}
            </p>
            {product.expiryDate && (
              <p className="mt-0.5 text-[9px] font-bold text-slate-400 dark:text-slate-500">
                EXP: {product.expiryDate}
              </p>
            )}
          </div>
        </button>

        {/* Right Actions rounded group */}
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-50/20 p-0.5 dark:bg-white/[0.01] shrink-0 opacity-40 hover:opacity-100 dark:opacity-50 dark:hover:opacity-100 transition-opacity duration-150">
          <button
            type="button"
            onClick={() => onEditProduct(product)}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-405 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-white transition-all duration-150"
            aria-label={t("edit")}
          >
            <Edit2 className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => setConfirmDeleteId(product.id)}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-405 hover:bg-slate-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-red-400 transition-all duration-150"
            aria-label={t("delete")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </motion.div>
    );
  }
}

type ProductThumbProps = {
  product: Product;
  isCritical: boolean;
  isSoon: boolean;
};

function ProductThumb({ product, isCritical, isSoon }: ProductThumbProps) {
  if (product.imageDataUrl) {
    return (
      <div className="relative shrink-0">
        <img
          src={product.imageDataUrl}
          alt=""
          className="h-9 w-9 rounded-lg object-cover"
        />
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white dark:border-slate-900 transition-all",
            isCritical
              ? "bg-red-400"
              : isSoon
              ? "bg-amber-400"
              : "bg-emerald-450"
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all duration-150",
        isCritical
          ? "bg-red-50/40 text-red-500/80 dark:bg-red-950/20 dark:text-red-300/80"
          : isSoon
          ? "bg-amber-50/40 text-amber-500/80 dark:bg-amber-950/20 dark:text-amber-300/80"
          : "bg-slate-50 text-slate-400 dark:bg-white/[0.01] dark:text-slate-550"
      )}
    >
      <CalendarClock className="h-4.5 w-4.5" />
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
