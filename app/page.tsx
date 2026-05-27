"use client";

import { ExpiryGuardApp } from "@/components/ExpiryGuardApp";
import { I18nProvider } from "@/hooks/useI18n";
import { ThemeProvider } from "@/hooks/useTheme";

export default function Page() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ExpiryGuardApp />
      </I18nProvider>
    </ThemeProvider>
  );
}
