import { ArrowLeft, CheckCircle2, AlertTriangle, HelpCircle, FlaskConical, Trash2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useI18n } from "@/hooks/useI18n";
import type { PurityTest, PurityVerdict } from "@/types/product";

type PurityHistoryScreenProps = {
  tests: PurityTest[];
  onBack: () => void;
  onDelete: (id: string) => void;
  onNewTest: () => void;
};

const VERDICT_ICON: Record<PurityVerdict, typeof CheckCircle2> = {
  pure: CheckCircle2,
  adulterated: AlertTriangle,
  inconclusive: HelpCircle
};

const VERDICT_TONE: Record<PurityVerdict, string> = {
  pure: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
  adulterated: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200",
  inconclusive: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
};

export function PurityHistoryScreen({
  tests,
  onBack,
  onDelete,
  onNewTest
}: PurityHistoryScreenProps) {
  const { t, locale } = useI18n();

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
          {t("purityHistoryTitle")}
        </h1>
      </header>

      {tests.length === 0 ? (
        <Card className="grid min-h-72 place-items-center text-center">
          <div>
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
              <FlaskConical className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">
              {t("purityHistoryEmpty")}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
              {t("purityHistoryEmptyHint")}
            </p>
            <Button onClick={onNewTest} icon={<Plus className="h-5 w-5" />} className="mx-auto mt-5">
              {t("purityNewTest")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map((test, index) => {
            const Icon = VERDICT_ICON[test.verdict];
            return (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.2) }}
                className="flex items-center gap-3 rounded-[24px] border border-white/80 bg-white/90 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.05]"
              >
                <span
                  className="h-12 w-12 shrink-0 rounded-2xl border border-black/5 dark:border-white/10"
                  style={{ backgroundColor: test.colorHex }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${VERDICT_TONE[test.verdict]}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(`verdict_${test.verdict}` as "verdict_pure")}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-black text-slate-950 dark:text-white">
                    {test.productName || t(`food_${test.food}` as "food_milk")}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {t(`intensity_${test.intensity}` as "intensity_none")} ·{" "}
                    {new Date(test.createdAt).toLocaleDateString(
                      locale === "hi" ? "hi-IN" : "en-US",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(test.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-white/5 dark:hover:text-red-400"
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </main>
  );
}
