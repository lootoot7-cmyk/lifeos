"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Receipt, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ConfigMissing, Splash } from "@/components/shell";
import { LanguageSwitch } from "@/components/language-switch";
import { Button } from "@/components/ui";

export default function WelcomePage() {
  const { configured, loading, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && user) router.replace("/");
  }, [configured, loading, user, router]);

  if (!configured) return <ConfigMissing />;
  if (loading || user) return <Splash />;

  const points = [
    { icon: Shield, text: t("onboarding.privacy1") },
    { icon: Receipt, text: t("module.receipts") + " · " + t("module.documents") },
    { icon: Bell, text: t("onboarding.notifyBody") },
  ];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="animate-rise w-full max-w-lg">
        <div className="rounded-[1.5rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-9">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand text-brand-fg shadow-sm">
              <Shield aria-hidden className="size-6" />
            </span>
            <LanguageSwitch />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {t("app.tagline")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {t("welcome.title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t("welcome.body")}</p>

          <ul className="mt-6 space-y-2.5">
            {points.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.text} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="text-muted">{point.text}</span>
                </li>
              );
            })}
          </ul>

          <Button block size="lg" className="mt-7" onClick={() => router.push("/login/")}>
            {t("welcome.getStarted")}
          </Button>

          <p className="mt-3 text-center text-xs text-muted">{t("app.promise")}</p>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          {t("auth.noAccount")}{" "}
          <Link href="/signup/" className="font-medium text-brand underline-offset-4 hover:underline">
            {t("auth.signUp")}
          </Link>
        </p>
      </div>
    </main>
  );
}
