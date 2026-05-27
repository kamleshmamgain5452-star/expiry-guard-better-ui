import { useMemo, useState } from "react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { Button } from "@/components/Button";
import { OnboardingIllustration } from "@/components/OnboardingIllustration";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/utils/cn";

type OnboardingFlowProps = {
  onFinish: () => void;
};

export function OnboardingFlow({ onFinish }: OnboardingFlowProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);

  const slides = useMemo(
    () => [
      {
        title: t("onboarding1Title"),
        subtitle: t("onboarding1Subtitle"),
        illustration: "scan" as const
      },
      {
        title: t("onboarding2Title"),
        subtitle: t("onboarding2Subtitle"),
        illustration: "alert" as const
      },
      {
        title: t("onboarding3Title"),
        subtitle: t("onboarding3Subtitle"),
        illustration: "language" as const
      }
    ],
    [t]
  );

  const isLast = index === slides.length - 1;

  const goNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex((current) => Math.min(current + 1, slides.length - 1));
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -60) goNext();
    if (info.offset.x > 60) setIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <main className="flex h-full w-full flex-col justify-between overflow-y-auto no-scrollbar px-5 pb-8 pt-5 safe-top">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-guard-50 px-4 py-2 text-sm font-black text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
          {t("appName")}
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="min-h-11 rounded-full px-4 text-sm font-bold text-slate-500 dark:text-slate-300"
        >
          {t("skip")}
        </button>
      </div>

      <div className="flex flex-1 items-center overflow-hidden py-4">
        <AnimatePresence mode="wait">
          <motion.section
            key={index}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, x: 42 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -42 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="w-full touch-pan-y select-none"
          >
            <OnboardingIllustration type={slides[index].illustration} />
            <h1 className="mt-4 text-balance text-2xl sm:text-3xl font-black leading-tight tracking-normal text-slate-950 dark:text-white">
              {slides[index].title}
            </h1>
            <p className="mt-2 text-pretty text-sm sm:text-base font-medium leading-6 sm:leading-7 text-slate-500 dark:text-slate-300">
              {slides[index].subtitle}
            </p>
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <div className="flex justify-center gap-2">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.title}
              aria-label={`${slideIndex + 1}`}
              type="button"
              onClick={() => setIndex(slideIndex)}
              className={cn(
                "h-2.5 rounded-full transition",
                slideIndex === index ? "w-8 bg-guard-600" : "w-2.5 bg-slate-300"
              )}
            />
          ))}
        </div>
        <Button size="md" className="w-full" onClick={goNext}>
          {isLast ? t("start") : t("next")}
        </Button>
      </div>
    </main>
  );
}
