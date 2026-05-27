import { useState } from "react";
import { ArrowLeft, Check, Edit2, FileText, Folder, Hash, Info, Layers, Tag } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/hooks/useI18n";
import type { Product, ScanResult } from "@/types/product";
import { formatDateForInput, statusFromExpiry, validateAndCorrectDates } from "@/utils/dates";

type ManualAddScreenProps = {
  onBack: () => void;
  onConfirm: (result: ScanResult) => void;
  product?: Product;
};

const CATEGORIES = ["dairy", "bakery", "beverages", "pantry", "other"];

export function ManualAddScreen({ onBack, onConfirm, product }: ManualAddScreenProps) {
  const { t } = useI18n();
  const [isReview, setIsReview] = useState(false);
  
  // Form state
  const [productName, setProductName] = useState(product?.productName || "");
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [expiryDate, setExpiryDate] = useState(product?.expiryDate ? formatDateForInput(product.expiryDate) : "");
  const [mfdDate, setMfdDate] = useState(product?.mfdDate ? formatDateForInput(product.mfdDate) : "");
  const [batchNumber, setBatchNumber] = useState(product?.batchNumber || "");
  const [quantity, setQuantity] = useState(product?.quantity || 1);
  const [category, setCategory] = useState(product?.category || "other");
  const [notes, setNotes] = useState(product?.notes || "");
  const [datesCorrectedMessage, setDatesCorrectedMessage] = useState<string | null>(null);
  
  // Error state
  const [errors, setErrors] = useState<{ productName?: string; expiryDate?: string }>({}); 

  const validateForm = () => {
    const tempErrors: typeof errors = {};
    if (!productName.trim()) {
      tempErrors.productName = t("required");
    }
    if (!expiryDate) {
      tempErrors.expiryDate = t("required");
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleReview = () => {
    if (validateForm()) {
      // Validate date order before review
      const rawExp = formatInputDate(expiryDate);
      const rawMfd = formatInputDate(mfdDate);
      const validated = validateAndCorrectDates(rawMfd, rawExp);

      if (validated.wasSwapped) {
        // Swap the input values (YYYY-MM-DD format)
        const tempExp = expiryDate;
        setExpiryDate(mfdDate);
        setMfdDate(tempExp);
        setDatesCorrectedMessage(t("datesSwapped"));
      } else if (validated.sameDates) {
        setDatesCorrectedMessage(t("datesIdentical"));
      } else if (validated.unrealisticRange) {
        setDatesCorrectedMessage(t("unrealisticDateRange"));
      } else {
        setDatesCorrectedMessage(null);
      }

      setIsReview(true);
    }
  };

  // Convert input YYYY-MM-DD to DD/MM/YYYY
  const formatInputDate = (dateStr: string) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const computedExpiryDate = formatInputDate(expiryDate);
  const computedMfdDate = formatInputDate(mfdDate);
  const computedStatus = statusFromExpiry(computedExpiryDate);

  const handleSave = () => {
    // Final validation guard before save
    const validated = validateAndCorrectDates(computedMfdDate, computedExpiryDate);
    const result: ScanResult = {
      product_name: productName.trim(),
      expiry_date: validated.expiryDate,
      mfd_date: validated.mfdDate,
      barcode: barcode.trim() || null,
      batch_number: batchNumber.trim() || null,
      confidence: 1.0, // Manual entry has 100% confidence
      status: statusFromExpiry(validated.expiryDate),
      quantity: quantity,
      category: category,
      notes: notes.trim() || undefined
    };
    onConfirm(result);
  };

  return (
    <main className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-28 pt-4 safe-top">
      <header className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={isReview ? () => setIsReview(false) : onBack}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm dark:bg-white/10 dark:text-white"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">
            {isReview ? t("resultTitle") : (product ? t("editProduct") : t("addManuallyTitle"))}
          </h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
            {isReview ? t("resultSubtitle") : (product ? t("pleaseVerify") : t("addManuallySubtitle"))}
          </p>
        </div>
      </header>

      {!isReview ? (
        // --- Form Entry State ---
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card className="space-y-4">
            {/* Product Name */}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
                {t("productName")} <span className="text-red-500">*</span>
              </span>
              <input
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  if (errors.productName) setErrors((prev) => ({ ...prev, productName: undefined }));
                }}
                placeholder={t("productName")}
                className={`h-[52px] min-h-[52px] w-full rounded-2xl border ${
                  errors.productName ? "border-red-500" : "border-slate-200 dark:border-white/10"
                } bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:bg-white/10 dark:text-white`}
              />
              {errors.productName && (
                <p className="mt-1 text-xs font-bold text-red-500">{errors.productName}</p>
              )}
            </label>

            {/* Expiry Date */}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
                {t("expiryDate")} <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  if (errors.expiryDate) setErrors((prev) => ({ ...prev, expiryDate: undefined }));
                }}
                className={`h-[52px] min-h-[52px] w-full rounded-2xl border ${
                  errors.expiryDate ? "border-red-500" : "border-slate-200 dark:border-white/10"
                } bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:bg-white/10 dark:text-white`}
              />
              {errors.expiryDate && (
                <p className="mt-1 text-xs font-bold text-red-500">{errors.expiryDate}</p>
              )}
            </label>

            {/* Manufacturing Date */}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
                {t("manufacturingDate")}
              </span>
              <input
                type="date"
                value={mfdDate}
                onChange={(e) => setMfdDate(e.target.value)}
                className="h-[52px] min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
              />
            </label>

            {/* Barcode */}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
                {t("barcodeNumber")}
              </span>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder={t("barcodeNumber")}
                inputMode="numeric"
                className="h-[52px] min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
              />
            </label>
          </Card>

          <Card className="space-y-4">
            {/* Batch Number */}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
                {t("batchNumber")}
              </span>
              <input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder={t("batchNumber")}
                className="h-[52px] min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
              />
            </label>

            {/* Quantity and Category */}
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
                  {t("quantity")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-[52px] min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
                  {t("category")}
                </span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-[52px] min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {t(cat as any)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Additional Notes */}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
                {t("notes")}
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notes")}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-base font-semibold text-slate-950 outline-none focus:border-guard-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
              />
            </label>
          </Card>

          <Button size="lg" className="w-full" onClick={handleReview}>
            {t("reviewDetails")}
          </Button>
        </motion.div>
      ) : (
        // --- Summary Review State ---
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-5"
        >
          <Card>
            <AnimatePresence>
              {datesCorrectedMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4"
                >
                  <Card className="border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/50">
                    <div className="flex gap-2.5 items-start">
                      <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300 mt-0.5" />
                      <p className="text-sm font-semibold leading-5 text-amber-800 dark:text-amber-200">
                        {datesCorrectedMessage}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/5">
              <div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
                  {t("status")}
                </p>
                <div className="mt-1.5">
                  <StatusBadge status={computedStatus} label={t(computedStatus)} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
                  {t("category")}
                </p>
                <span className="mt-1.5 inline-block rounded-full bg-guard-50 px-3 py-1 text-xs font-black uppercase text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
                  {t(category as any)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <ReviewRow
                icon={<Tag className="h-5 w-5 text-guard-600" />}
                label={t("productName")}
                value={productName}
              />
              <ReviewRow
                icon={<Info className="h-5 w-5 text-guard-600" />}
                label={t("expiryDate")}
                value={computedExpiryDate || t("notDetected")}
              />
              {computedMfdDate && (
                <ReviewRow
                  icon={<Info className="h-5 w-5 text-guard-600" />}
                  label={t("manufacturingDate")}
                  value={computedMfdDate}
                />
              )}
              {barcode.trim() && (
                <ReviewRow
                  icon={<Hash className="h-5 w-5 text-guard-600" />}
                  label={t("barcodeNumber")}
                  value={barcode}
                />
              )}
              {batchNumber.trim() && (
                <ReviewRow
                  icon={<Layers className="h-5 w-5 text-guard-600" />}
                  label={t("batchNumber")}
                  value={batchNumber}
                />
              )}
              <ReviewRow
                icon={<Hash className="h-5 w-5 text-guard-600" />}
                label={t("quantity")}
                value={quantity.toString()}
              />
              {notes.trim() && (
                <div className="flex gap-4 p-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                      {t("notes")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {notes}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsReview(false)}
              icon={<Edit2 className="h-5 w-5" />}
            >
              {t("edit")}
            </Button>
            <Button onClick={handleSave} icon={<Check className="h-5 w-5" />}>
              {t("confirm")}
            </Button>
          </div>
        </motion.div>
      )}
    </main>
  );
}

function ReviewRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 p-2">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600 dark:bg-white/5 dark:text-slate-300">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-300">{label}</p>
        <p className="truncate text-base font-black text-slate-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
