"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Brand } from "@/components/shell";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-5 flex justify-center">
          <Brand />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("notFound.body")}</p>
        <Link
          href="/home/"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-medium text-brand-fg"
        >
          {t("notFound.home")}
        </Link>
      </div>
    </main>
  );
}
