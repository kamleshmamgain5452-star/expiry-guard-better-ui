import { Info, Languages, Moon, Server, ShieldCheck, Smartphone, Bell, BellRing, Check } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { Toggle } from "@/components/Toggle";
import { useI18n } from "@/hooks/useI18n";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/utils/cn";

type SettingsScreenProps = {
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  pushSupported: boolean;
  pushNeedsInstall: boolean;
  pushSubscribed: boolean;
  pushBusy: boolean;
  pushPermission: NotificationPermission | "unsupported";
  onEnablePush: () => Promise<{ ok: boolean; reason?: string }>;
  onDisablePush: () => Promise<void>;
  onTestPush: () => Promise<boolean>;
};

export function SettingsScreen({
  notificationsEnabled,
  onToggleNotifications,
  pushSupported,
  pushNeedsInstall,
  pushSubscribed,
  pushBusy,
  pushPermission,
  onEnablePush,
  onDisablePush,
  onTestPush
}: SettingsScreenProps) {
  const { t, locale, setLocale } = useI18n();
  const { darkMode, setDarkMode } = useTheme();
  const [testSent, setTestSent] = useState(false);

  const handleTest = async () => {
    const ok = await onTestPush();
    if (ok) {
      setTestSent(true);
      window.setTimeout(() => setTestSent(false), 4000);
    }
  };

  return (
    <main className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-28 pt-4 safe-top">
      <header className="mb-5">
        <p className="text-sm font-bold text-guard-700 dark:text-guard-200">
          {t("appName")}
        </p>
        <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
          {t("settingsTitle")}
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
          {t("settingsSubtitle")}
        </p>
      </header>

      <section className="space-y-4">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
              <Languages className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">
                {t("language")}
              </h2>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
                {locale === "en" ? t("english") : t("hindi")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/10">
            <LanguageOption
              active={locale === "en"}
              label={t("english")}
              onClick={() => setLocale("en")}
            />
            <LanguageOption
              active={locale === "hi"}
              label={t("hindi")}
              onClick={() => setLocale("hi")}
            />
          </div>
        </Card>

        <SettingRow
          icon={<Moon className="h-6 w-6" />}
          title={t("darkMode")}
          control={
            <Toggle
              checked={darkMode}
              onChange={setDarkMode}
              label={t("darkMode")}
            />
          }
        />
        <SettingRow
          icon={<Bell className="h-6 w-6" />}
          title={t("notificationsToggle")}
          subtitle="Disable expiry reminders and expiry-related dashboard alerts."
          control={
            <Toggle
              checked={notificationsEnabled}
              onChange={onToggleNotifications}
              label={t("notificationsToggle")}
            />
          }
        />
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
              <BellRing className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-slate-950 dark:text-white">
                {t("phonePush")}
              </h2>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">
                {t("phonePushDesc")}
              </p>
            </div>
          </div>

          {!pushSupported ? (
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold leading-6 text-slate-600 dark:bg-white/5 dark:text-slate-300">
              {pushNeedsInstall ? t("phonePushIosHint") : t("phonePushUnsupported")}
            </p>
          ) : pushPermission === "denied" ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {t("phonePushBlocked")}
            </p>
          ) : pushSubscribed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-2xl bg-guard-50 px-4 py-3 text-sm font-black text-guard-800 dark:bg-guard-900/50 dark:text-guard-100">
                <Check className="h-5 w-5" />
                {t("phonePushEnabled")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={pushBusy}
                  className="min-h-12 rounded-2xl bg-slate-900 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-50 dark:bg-white/10"
                >
                  {testSent ? t("phonePushTestSent") : t("phonePushTest")}
                </button>
                <button
                  type="button"
                  onClick={onDisablePush}
                  disabled={pushBusy}
                  className="min-h-12 rounded-2xl border border-slate-200 text-sm font-black text-slate-600 transition active:scale-[0.98] disabled:opacity-50 dark:border-white/10 dark:text-slate-300"
                >
                  {t("phonePushTurnOff")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onEnablePush}
              disabled={pushBusy}
              className="min-h-12 w-full rounded-2xl bg-guard-600 text-sm font-black text-white transition active:scale-[0.98] hover:bg-guard-700 disabled:opacity-50"
            >
              {t("phonePushEnable")}
            </button>
          )}
        </Card>

        <SettingRow
          icon={<Server className="h-6 w-6" />}
          title={t("apiStatus")}
          subtitle={t("connected")}
          control={<span className="h-3 w-3 rounded-full bg-guard-500" />}
        />
        <SettingRow
          icon={<Smartphone className="h-6 w-6" />}
          title={t("mobileReady")}
          subtitle={t("browserWarning")}
        />

        <Card>
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white">
              <Info className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">
              {t("about")}
            </h2>
          </div>
          <p className="text-sm font-semibold leading-7 text-slate-500 dark:text-slate-300">
            {t("aboutBody")}
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-guard-50 px-4 py-3 text-sm font-black text-guard-800 dark:bg-guard-900/60 dark:text-guard-100">
            <ShieldCheck className="h-5 w-5" />
            {t("tagline")}
          </div>
        </Card>
      </section>
    </main>
  );
}

function LanguageOption({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-xl text-sm font-black transition",
        active
          ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white"
          : "text-slate-500 dark:text-slate-300"
      )}
    >
      {label}
    </button>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  control
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  control?: ReactNode;
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-guard-50 text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-black text-slate-950 dark:text-white">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">
            {subtitle}
          </p>
        )}
      </div>
      {control}
    </Card>
  );
}
