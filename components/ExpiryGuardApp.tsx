import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertsScreen } from "@/components/AlertsScreen";
import { BottomNav, BottomTab } from "@/components/BottomNav";
import { HomeDashboard } from "@/components/HomeDashboard";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { ProductDetailScreen } from "@/components/ProductDetailScreen";
import { ScanResultScreen } from "@/components/ScanResultScreen";
import { ScannerScreen } from "@/components/ScannerScreen";
import { ManualAddScreen } from "@/components/ManualAddScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { SplashScreen } from "@/components/SplashScreen";
import { ProductsScreen } from "@/components/ProductsScreen";
import { useI18n } from "@/hooks/useI18n";
import { useProducts } from "@/hooks/useProducts";
import { daysUntil } from "@/utils/dates";
import type { Product, ScanResult } from "@/types/product";

const ACK_KEY = "expiryguard_ack_alert";

// A compact fingerprint of which products are currently expiring and how urgent each is.
// Used to decide whether the home alert banner should reappear after being viewed.
function alertSignature(products: Product[]): string | null {
  const urgent = products
    .map((p) => ({ id: p.id, days: daysUntil(p.expiryDate) }))
    .filter((x) => x.days !== null && x.days <= 7)
    .map((x) => `${x.id}:${(x.days as number) <= 3 ? "c" : "s"}`)
    .sort();
  return urgent.length ? urgent.join("|") : null;
}

type Screen =
  | "splash"
  | "onboarding"
  | "home"
  | "scanner"
  | "manual_add"
  | "edit_product"
  | "result"
  | "detail"
  | "alerts"
  | "products"
  | "settings";

export function ExpiryGuardApp() {
  const { t } = useI18n();
  const { products, summary, addProduct, updateProduct, deleteProduct, restoreProduct } = useProducts();
  const [screen, setScreen] = useState<Screen>("splash");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "safe" | "near_expiry" | "expired">("all");
  const [pendingResult, setPendingResult] = useState<ScanResult | null>(null);
  const [pendingImage, setPendingImage] = useState<string | undefined>();
  const [undoToast, setUndoToast] = useState<{ product: Product; mode: "deleted" | "used" } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  // Remove a product but keep it recoverable for 5s via the Undo toast.
  const removeWithUndo = (id: string, mode: "deleted" | "used") => {
    const removed = deleteProduct(id);
    if (!removed) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndoToast({ product: removed, mode });
    undoTimerRef.current = window.setTimeout(() => setUndoToast(null), 5000);
  };

  const undoRemove = () => {
    if (undoToast) restoreProduct(undoToast.product);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndoToast(null);
  };

  // Signature of the alert state the user has already viewed. The home banner stays
  // hidden until the situation changes (a new item starts expiring, or one gets worse),
  // at which point the signature differs and the banner returns.
  const [ackAlertSignature, setAckAlertSignature] = useState<string | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Load notifications preference + last-viewed alert signature from localStorage on mount
  useEffect(() => {
    const stored = window.localStorage.getItem("expiryguard_notifications_enabled");
    const ack = window.localStorage.getItem(ACK_KEY);
    // Deferred so these don't run as synchronous setState inside the mount effect.
    window.queueMicrotask(() => {
      if (stored !== null) setNotificationsEnabled(stored === "true");
      if (ack !== null) setAckAlertSignature(ack);
    });
  }, []);

  const currentAlertSignature = alertSignature(products);
  // Hide the banner once its exact situation has been viewed; show it again when it changes.
  const alertViewed = currentAlertSignature !== null && currentAlertSignature === ackAlertSignature;

  const acknowledgeAlerts = () => {
    setAckAlertSignature(currentAlertSignature);
    if (currentAlertSignature) window.localStorage.setItem(ACK_KEY, currentAlertSignature);
    else window.localStorage.removeItem(ACK_KEY);
  };

  const handleToggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    window.localStorage.setItem("expiryguard_notifications_enabled", enabled ? "true" : "false");
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const onboarded = window.localStorage.getItem("expiryguard_onboarded") === "true";
      setScreen(onboarded ? "home" : "onboarding");
    }, 1450);

    return () => window.clearTimeout(timeout);
  }, []);

  const finishOnboarding = () => {
    window.localStorage.setItem("expiryguard_onboarded", "true");
    setScreen("home");
  };

  const activeTab: BottomTab =
    screen === "alerts"
      ? "alerts"
      : screen === "settings"
      ? "settings"
      : screen === "products"
      ? "products"
      : "home";

  const goToTab = (tab: BottomTab) => {
    setSelectedProduct(null);
    setEditingProduct(null);
    if (tab === "home") setScreen("home");
    if (tab === "products") {
      setStatusFilter("all");
      setScreen("products");
    }
    if (tab === "alerts") setScreen("alerts");
    if (tab === "settings") setScreen("settings");
  };

  const showBottomNav =
    screen === "home" ||
    screen === "products" ||
    screen === "alerts" ||
    screen === "settings" ||
    screen === "detail";

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-guard-50/20 p-0 dark:from-slate-950 dark:via-slate-900 dark:to-guard-950/10 sm:p-6 md:p-8">
      {/* Premium device frame mockup */}
      <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#f6faf8] dark:bg-[#101714] shadow-none sm:h-[840px] sm:rounded-[40px] sm:border sm:border-slate-200/80 sm:shadow-2xl dark:sm:border-white/5">
        
        {/* Dynamic Island / Notch for desktop mockup */}
        <div className="hidden sm:block absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-full z-50 shadow-inner">
          <div className="absolute right-4 top-2 h-2 w-2 rounded-full bg-slate-800" />
          <div className="absolute left-1/3 top-2.5 h-1 w-6 rounded-full bg-slate-800" />
        </div>

        {/* Content area */}
        <div className="relative flex-1 flex flex-col overflow-hidden pt-0 sm:pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="h-full w-full flex flex-col overflow-hidden"
            >
              {screen === "splash" && <SplashScreen />}
              {screen === "onboarding" && <OnboardingFlow onFinish={finishOnboarding} />}
              {screen === "home" && (
                <HomeDashboard
                  products={products}
                  summary={summary}
                  notificationsEnabled={notificationsEnabled}
                  onScan={() => setScreen("scanner")}
                  onManualAdd={() => setScreen("manual_add")}
                  onOpenAlerts={() => setScreen("alerts")}
                  alertViewed={alertViewed}
                  onViewAlerts={() => {
                    acknowledgeAlerts();
                    setScreen("alerts");
                  }}
                  onOpenProduct={(product) => {
                    setSelectedProduct(product);
                    setScreen("detail");
                  }}
                  onSelectStatusFilter={(status) => {
                    setStatusFilter(status);
                    setScreen("products");
                  }}
                />
              )}
              {(screen === "manual_add" || (screen === "edit_product" && editingProduct)) && (
                <ManualAddScreen
                  product={editingProduct || undefined}
                  onBack={() => {
                    if (screen === "edit_product") {
                      setScreen("products");
                    } else {
                      setScreen("home");
                    }
                    setEditingProduct(null);
                  }}
                  onConfirm={(result) => {
                    if (screen === "edit_product" && editingProduct) {
                      const updated: Product = {
                        ...editingProduct,
                        productName: result.product_name,
                        expiryDate: result.expiry_date,
                        mfdDate: result.mfd_date,
                        barcode: result.barcode,
                        batchNumber: result.batch_number,
                        quantity: result.quantity,
                        category: result.category,
                        notes: result.notes,
                        status: result.status
                      };
                      updateProduct(updated);
                      setScreen("products");
                    } else {
                      const product = addProduct(result);
                      setSelectedProduct(product);
                      setScreen("detail");
                    }
                    setEditingProduct(null);
                  }}
                />
              )}
              {screen === "products" && (
                <ProductsScreen
                  products={products}
                  initialStatusFilter={statusFilter}
                  onOpenProduct={(product) => {
                    setSelectedProduct(product);
                    setScreen("detail");
                  }}
                  onEditProduct={(product) => {
                    setEditingProduct(product);
                    setScreen("edit_product");
                  }}
                  onDeleteProduct={(id) => removeWithUndo(id, "deleted")}
                  onScan={() => setScreen("scanner")}
                  onManualAdd={() => setScreen("manual_add")}
                />
              )}
              {screen === "scanner" && (
                <ScannerScreen
                  onBack={() => setScreen("home")}
                  onComplete={(result, imageDataUrl) => {
                    setPendingResult(result);
                    setPendingImage(imageDataUrl);
                    setScreen("result");
                  }}
                />
              )}
              {screen === "result" && pendingResult && (
                <ScanResultScreen
                  result={pendingResult}
                  imageDataUrl={pendingImage}
                  onBack={() => setScreen("scanner")}
                  onRescan={() => setScreen("scanner")}
                  onConfirm={(result) => {
                    const product = addProduct(result, pendingImage);
                    setSelectedProduct(product);
                    setPendingResult(null);
                    setPendingImage(undefined);
                    setScreen("detail");
                  }}
                />
              )}
              {screen === "detail" && selectedProduct && (
                <ProductDetailScreen
                  product={selectedProduct}
                  onBack={() => setScreen(activeTab)}
                  onMarkUsed={() => {
                    removeWithUndo(selectedProduct.id, "used");
                    setScreen(activeTab);
                  }}
                  onDelete={() => {
                    removeWithUndo(selectedProduct.id, "deleted");
                    setScreen(activeTab);
                  }}
                />
              )}
              {screen === "alerts" && (
                <AlertsScreen
                  products={products}
                  onOpenProduct={(product) => {
                    setSelectedProduct(product);
                    setScreen("detail");
                  }}
                />
              )}
              {screen === "settings" && (
                <SettingsScreen
                  notificationsEnabled={notificationsEnabled}
                  onToggleNotifications={handleToggleNotifications}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {undoToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-x-4 bottom-24 z-50 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl dark:bg-white/10 dark:backdrop-blur"
            >
              <span className="text-sm font-bold">
                {undoToast.mode === "used" ? t("markedAsUsed") : t("productRemoved")}
              </span>
              <button
                type="button"
                onClick={undoRemove}
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-guard-200 transition hover:bg-white/25"
              >
                {t("undo")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {showBottomNav && (
          <BottomNav
            active={activeTab}
            onChange={goToTab}
            notificationsEnabled={notificationsEnabled}
            labels={{
              home: t("home"),
              products: t("products"),
              alerts: t("alerts"),
              settings: t("settings")
            }}
          />
        )}
      </div>
    </div>
  );
}
