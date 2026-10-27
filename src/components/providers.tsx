"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { registerServiceWorker } from "@/lib/data/push";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/components/ui";

function Preferences({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  return (
    <ThemeProvider profileTheme={profile?.theme}>
      <I18nProvider initialLanguage={profile?.language}>{children}</I18nProvider>
    </ThemeProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") void registerServiceWorker();
  }, []);

  return (
    <AuthProvider>
      <Preferences>
        <ToastProvider>{children}</ToastProvider>
      </Preferences>
    </AuthProvider>
  );
}
