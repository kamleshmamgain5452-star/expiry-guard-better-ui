import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/hooks/useI18n";

export function SplashScreen() {
  const { t } = useI18n();

  return (
    <main className="grid h-full w-full place-items-center px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="text-center"
      >
        <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-[32px] bg-guard-600 text-white shadow-soft">
          <ShieldCheck className="h-12 w-12" />
        </div>
        <h1 className="text-4xl font-black tracking-normal text-slate-950 dark:text-white">
          {t("appName")}
        </h1>
        <p className="mt-3 text-base font-medium text-slate-500 dark:text-slate-300">
          {t("tagline")}
        </p>
      </motion.div>
    </main>
  );
}
