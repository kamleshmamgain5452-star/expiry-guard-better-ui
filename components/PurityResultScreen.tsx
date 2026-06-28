import { ArrowLeft, CheckCircle2, AlertTriangle, HelpCircle, Sparkles, Smartphone, RefreshCcw, Save } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useI18n } from "@/hooks/useI18n";
import type { IodineApiResult, IodineFood, IodineIntensity } from "@/types/product";

type PurityResultScreenProps = {
  result: IodineApiResult;
  food: IodineFood;
  imageDataUrl?: string;
  source: "ai" | "device";
  productName?: string | null;
  onBack: () => void;
  onSave: () => void;
  onRetest: () => void;
};

const INTENSITY_INDEX: Record<IodineIntensity, number> = {
  none: 0,
  trace: 1,
  moderate: 2,
  high: 3
};

export function PurityResultScreen({
  result,
  food,
  imageDataUrl,
  source,
  productName,
  onBack,
  onSave,
  onRetest
}: PurityResultScreenProps) {
  const { t } = useI18n();

  const verdictStyle = {
    pure: {
      icon: CheckCircle2,
      ring: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
      bar: "bg-emerald-500"
    },
    adulterated: {
      icon: AlertTriangle,
      ring: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200",
      bar: "bg-red-500"
    },
    inconclusive: {
      icon: HelpCircle,
      ring: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
      bar: "bg-amber-500"
    }
  }[result.verdict];

  const VerdictIcon = verdictStyle.icon;
  const confidencePct = Math.round(result.confidence * 100);
  const intensityIdx = INTENSITY_INDEX[result.intensity];
  // Position the marker on the amber→blue-black reference scale.
  const markerPct = [6, 36, 66, 92][intensityIdx];

  return (
    <main className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-28 pt-4 safe-top">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm dark:bg-white/10 dark:text-white"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-black text-slate-950 dark:text-white">
          {t("purityResultTitle")}
        </h1>
      </header>

      {/* Verdict banner — icon + text + number (not colour alone) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-4 rounded-[28px] p-5 ${verdictStyle.ring}`}
        role="status"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/60 dark:bg-white/10">
          <VerdictIcon className="h-8 w-8" />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-black leading-tight">
            {t(`verdict_${result.verdict}` as "verdict_pure")}
          </p>
          <p className="mt-0.5 text-sm font-bold opacity-80">
            {t(`food_${food}` as "food_milk")}
            {productName ? ` · ${productName}` : ""}
          </p>
        </div>
      </motion.div>

      {imageDataUrl && (
        <img
          src={imageDataUrl}
          alt={t("purityColorMatch")}
          className="mt-4 h-40 w-full rounded-[28px] object-cover"
        />
      )}

      {/* Starch level gauge */}
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-slate-950 dark:text-white">
            {t("purityStarchLevel")}
          </p>
          <p className="text-sm font-black text-slate-500 dark:text-slate-300">
            {t(`intensity_${result.intensity}` as "intensity_none")}
          </p>
        </div>
        <div
          className="mt-3 flex gap-1.5"
          role="img"
          aria-label={`${t("purityStarchLevel")}: ${t(`intensity_${result.intensity}` as "intensity_none")}`}
        >
          {[0, 1, 2, 3].map((seg) => (
            <span
              key={seg}
              className={`h-2.5 flex-1 rounded-full ${
                seg <= intensityIdx
                  ? verdictStyle.bar
                  : "bg-slate-200 dark:bg-white/10"
              }`}
            />
          ))}
        </div>
      </Card>

      {/* Colour-match reference bar */}
      <Card className="mt-3">
        <p className="text-sm font-black text-slate-950 dark:text-white">
          {t("purityColorMatch")}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span
            className="h-10 w-10 shrink-0 rounded-xl border border-black/10 dark:border-white/15"
            style={{ backgroundColor: result.colorHex }}
            aria-hidden
          />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {result.colorName}
            <span className="ml-1 font-mono text-xs text-slate-400">
              {result.colorHex}
            </span>
          </span>
        </div>
        <div className="relative mt-4">
          <div className="h-3 w-full rounded-full bg-gradient-to-r from-[#d9a441] via-[#7a5fb0] to-[#101733]" />
          <span
            className="absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-slate-900 shadow dark:border-slate-900 dark:bg-white"
            style={{ left: `${markerPct}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <span>{t("purityReferenceAmber")}</span>
          <span>{t("purityReferenceBlue")}</span>
        </div>
      </Card>

      {/* Confidence + source */}
      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {source === "ai" ? (
              <Sparkles className="h-4 w-4 text-guard-600 dark:text-guard-300" />
            ) : (
              <Smartphone className="h-4 w-4 text-guard-600 dark:text-guard-300" />
            )}
            <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
              {source === "ai" ? t("purityConfirmedAI") : t("purityOnDevice")}
            </span>
          </div>
          <span className="text-sm font-black text-slate-950 dark:text-white">
            {t("purityConfidence")}: {confidencePct}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-guard-500"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
          {result.note}
        </p>
      </Card>

      <p className="mt-4 px-1 text-xs font-semibold leading-5 text-slate-400 dark:text-slate-500">
        {t("purityDisclaimer")}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onRetest} icon={<RefreshCcw className="h-5 w-5" />}>
          {t("purityRetest")}
        </Button>
        <Button onClick={onSave} icon={<Save className="h-5 w-5" />}>
          {t("puritySaveResult")}
        </Button>
      </div>
    </main>
  );
}
