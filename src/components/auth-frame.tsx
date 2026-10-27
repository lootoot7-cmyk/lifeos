"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/shell";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/lib/i18n";

export function AuthFrame({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-bg px-4 py-6 sm:grid sm:place-items-center sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/welcome/" aria-label={t("app.name")} className="rounded-xl">
            <Brand />
          </Link>
          <LanguageSwitch />
        </header>
        <div className="animate-rise rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7">
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
    >
      {message}
    </p>
  );
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-ok/40 bg-ok-soft px-3 py-2 text-sm font-medium text-ok"
    >
      {message}
    </p>
  );
}
