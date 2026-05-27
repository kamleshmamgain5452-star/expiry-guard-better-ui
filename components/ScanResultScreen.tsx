import { useMemo, useState } from "react";
import { ArrowLeft, Check, Info, RefreshCcw, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/hooks/useI18n";
import type { ScanResult } from "@/types/product";
import {
  daysUntil,
  formatDateForInput,
  fromDateInput,
  statusFromExpiry,
  validateAndCorrectDates
} from "@/utils/dates";
import { parseRelativeExpiry } from "@/utils/ocrParser";

type ScanResultScreenProps = {
  result: ScanResult;
  imageDataUrl?: string;
  onBack: () => void;
  onRescan: () => void;
  onConfirm: (result: ScanResult) => void;
};

export function ScanResultScreen({
  result,
  imageDataUrl,
  onBack,
  onRescan,
  onConfirm
}: ScanResultScreenProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(result.confidence < 0.75);
  const [draft, setDraft] = useState<ScanResult>(result);
  const [dateMessage, setDateMessage] = useState<string | null>(null);
  const days = daysUntil(draft.expiry_date);
  const status = statusFromExpiry(draft.expiry_date);
  const confidencePercent = Math.round((draft.confidence || 0) * 100);
  const lowConfidence = draft.confidence < 0.75 || !draft.expiry_date;

  // Live date validation
  const dateValidation = useMemo(
    () => validateAndCorrectDates(draft.mfd_date, draft.expiry_date),
    [draft.mfd_date, draft.expiry_date]
  );

  const handleDateChange = (field: "mfd_date" | "expiry_date", value: string | null) => {
    setDraft((current) => {
      let updated = { ...current, [field]: value };

      // Live relative date parsing if MFD was missing for a detected duration
      if (updated.mfd_missing_for_duration && field === "mfd_date" && value) {
        const relative = parseRelativeExpiry(updated.raw_text || [], value);
        if (relative.expiryDate) {
          updated.expiry_date = relative.expiryDate;
          updated.mfd_missing_for_duration = false;
        }
      }

      const validated = validateAndCorrectDates(updated.mfd_date, updated.expiry_date);
      if (validated.wasSwapped) {
        setDateMessage(t("datesSwapped"));
        return { ...updated, mfd_date: validated.mfdDate, expiry_date: validated.expiryDate };
      }
      if (validated.sameDates) {
        setDateMessage(t("datesIdentical"));
      } else if (validated.unrealisticRange) {
        setDateMessage(t("unrealisticDateRange"));
      } else {
        setDateMessage(null);
      }
      return updated;
    });
  };

  const finalResult = useMemo<ScanResult>(
    () => ({
      ...draft,
      product_name: draft.product_name || t("unknownProduct"),
      barcode: draft.barcode || null,
      status
    }),
    [draft, status, t]
  );

  return (
    <main className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-8 pt-4 safe-top">
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
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">
            {t("resultTitle")}
          </h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
            {t("resultSubtitle")}
          </p>
        </div>
      </header>

      {imageDataUrl && (
        <motion.img
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          src={imageDataUrl}
          alt=""
          className="mb-4 h-48 w-full rounded-[32px] object-cover shadow-soft"
        />
      )}

      {lowConfidence && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
          <div className="flex gap-3">
            <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-300" />
            <div>
              <p className="font-black text-amber-900 dark:text-amber-100">
                {t("lowConfidence")}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-amber-800 dark:text-amber-200">
                {t("pleaseVerify")}
              </p>
            </div>
          </div>
        </Card>
      )}

      <AnimatePresence>
        {draft.mfd_missing_for_duration && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="mb-4 border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/50">
              <div className="flex gap-2.5 items-start">
                <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300 mt-0.5" />
                <p className="text-sm font-semibold leading-5 text-amber-800 dark:text-amber-200">
                  {t("mfdMissingForDuration")}
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dateMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="mb-4 border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/50">
              <div className="flex gap-2.5 items-start">
                <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300 mt-0.5" />
                <p className="text-sm font-semibold leading-5 text-amber-800 dark:text-amber-200">
                  {dateMessage}
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
              {t("status")}
            </p>
            <div className="mt-2">
              <StatusBadge status={status} label={t(status)} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
              {t("confidenceScore")}
            </p>
            <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
              {confidencePercent}%
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <EditableField
            label={t("productName")}
            value={draft.product_name}
            editing={editing}
            placeholder={t("unknownProduct")}
            onChange={(value) => setDraft((current) => ({ ...current, product_name: value }))}
          />
          <DateField
            label={t("manufacturingDate")}
            value={draft.mfd_date}
            editing={editing}
            emptyLabel={t("notDetected")}
            onChange={(value) => handleDateChange("mfd_date", value)}
          />
          <DateField
            label={t("expiryDate")}
            value={draft.expiry_date}
            editing={editing}
            emptyLabel={t("notDetected")}
            autoFocus={lowConfidence}
            highlight={lowConfidence}
            onChange={(value) => handleDateChange("expiry_date", value)}
          />
          <EditableField
            label={t("batchNumber")}
            value={draft.batch_number || ""}
            editing={editing}
            placeholder={t("notDetected")}
            onChange={(value) => setDraft((current) => ({ ...current, batch_number: value }))}
          />
          <EditableField
            label={t("barcodeNumber")}
            value={draft.barcode || ""}
            editing={editing}
            placeholder={t("notDetected")}
            inputMode="numeric"
            onChange={(value) => setDraft((current) => ({ ...current, barcode: value }))}
          />
        </div>

        <div className="mt-5 rounded-3xl bg-slate-50 p-4 dark:bg-white/5">
          <div className="text-sm font-bold text-slate-500 dark:text-slate-300">
            {t("expiryCountdown")}
          </div>
          <div className="mt-1 text-xl font-black text-slate-950 dark:text-white">
            {countdownText(days, t)}
          </div>
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Button variant="secondary" onClick={() => setEditing((current) => !current)}>
          {editing ? t("done") : t("edit")}
        </Button>
        <Button variant="secondary" onClick={onRescan} icon={<RefreshCcw className="h-5 w-5" />}>
          {t("rescan")}
        </Button>
        <Button onClick={() => onConfirm(finalResult)} icon={<Check className="h-5 w-5" />}>
          {t("confirm")}
        </Button>
      </div>
    </main>
  );
}

function EditableField({
  label,
  value,
  editing,
  placeholder,
  inputMode,
  onChange
}: {
  label: string;
  value: string;
  editing: boolean;
  placeholder: string;
  inputMode?: "text" | "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
        {label}
      </span>
      {editing ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          placeholder={placeholder}
          className="h-[52px] min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
        />
      ) : (
        <div className="min-h-[52px] rounded-2xl bg-slate-50 px-4 py-3 text-base font-black text-slate-950 dark:bg-white/5 dark:text-white">
          {value || placeholder}
        </div>
      )}
    </label>
  );
}

function DateField({
  label,
  value,
  editing,
  emptyLabel,
  onChange,
  autoFocus,
  highlight
}: {
  label: string;
  value: string | null;
  editing: boolean;
  emptyLabel: string;
  onChange: (value: string | null) => void;
  autoFocus?: boolean;
  highlight?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-500 dark:text-slate-300">
        {label}
      </span>
      {editing ? (
        <input
          type="date"
          autoFocus={autoFocus}
          value={formatDateForInput(value)}
          onChange={(event) => onChange(fromDateInput(event.target.value))}
          className={`h-[52px] min-h-[52px] w-full rounded-2xl border bg-white px-4 text-base font-bold text-slate-950 outline-none focus:border-guard-500 dark:bg-white/10 dark:text-white ${highlight ? "border-amber-400 ring-2 ring-amber-200/70 dark:border-amber-500 dark:ring-amber-900/50" : "border-slate-200 dark:border-white/10"}`}
        />
      ) : (
        <div className="min-h-[52px] rounded-2xl bg-slate-50 px-4 py-3 text-base font-black text-slate-950 dark:bg-white/5 dark:text-white">
          {value || emptyLabel}
        </div>
      )}
    </label>
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
