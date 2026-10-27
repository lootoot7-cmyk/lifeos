"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { ErrorState } from "@/components/ui";
import { Brand } from "@/components/shell";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-5 p-6">
      <Brand />
      <ErrorState
        message={t("errors.generic")}
        detail={`${error.digest ?? ""} ${error.message}`.trim()}
        onRetry={reset}
      />
    </main>
  );
}
