"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Boxes, Calendar, FileText, Receipt, Search, Shield, Tag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { enablePush } from "@/lib/data/push";
import { useI18n } from "@/lib/i18n";
import { MANAGED_MODULES, type ManagedModule } from "@/lib/types";
import { ConfigMissing, Splash } from "@/components/shell";
import { LanguageSwitch } from "@/components/language-switch";
import { Button, Toggle, cn } from "@/components/ui";

const MODULE_ICONS: Record<ManagedModule, typeof FileText> = {
  documents: FileText,
  receipts: Receipt,
  inventory: Boxes,
  expiry: Calendar,
  lostFound: Search,
  prices: Tag,
  reminders: Bell,
  emergency: Shield,
};

export default function OnboardingPage() {
  const { configured, loading, profileLoading, user, profile, saveProfile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [modules, setModules] = useState<ManagedModule[] | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<"idle" | "busy" | "granted" | "blocked" | "unsupported">("idle");
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!configured || loading || profileLoading) return;
    if (!user) {
      router.replace("/welcome/");
      return;
    }
    if (profile?.onboardingCompleted) router.replace("/home/");
  }, [configured, loading, profileLoading, user, profile, router]);

  if (!configured) return <ConfigMissing />;
  if (loading || profileLoading || !user) return <Splash />;
  if (!profile) return <Splash />;

  const selected = modules ?? profile.modules;
  const ai = aiEnabled ?? profile.aiAnalysisEnabled;
  const total = 3;

  function toggleModule(module: ManagedModule) {
    setModules((current) => {
      const base = current ?? profile!.modules;
      return base.includes(module) ? base.filter((item) => item !== module) : [...base, module];
    });
  }

  async function finish(options: { requestPush?: boolean } = {}) {
    setFinishing(true);
    setError(false);
    try {
      if (options.requestPush) {
        setPermission("busy");
        const outcome = await enablePush(user!.uid);
        setPermission(outcome);
      }
      await saveProfile({
        modules: selected,
        aiAnalysisEnabled: ai,
        onboardingCompleted: true,
      });
      router.replace("/home/");
    } catch {
      setFinishing(false);
      setError(true);
    }
  }

  async function changeLanguage(language: "en" | "ur") {
    try {
      await saveProfile({ language });
    } catch {
      setError(true);
    }
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-6">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("onboarding.step", { n: step + 1, total })}
            </p>
            <div className="mt-2 flex gap-1.5" aria-hidden>
              {Array.from({ length: total }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1.5 w-8 rounded-full",
                    index <= step ? "bg-brand" : "bg-surface-2",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch onChange={changeLanguage} />
            <Button
              variant="ghost"
              size="sm"
              disabled={finishing}
              onClick={() => void finish()}
            >
              {t("common.skip")}
            </Button>
          </div>
        </header>

        <div className="animate-rise rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7">
          {step === 0 && (
            <section aria-labelledby="modules-title">
              <h1 id="modules-title" className="text-xl font-semibold tracking-tight">
                {t("onboarding.modulesTitle")}
              </h1>
              <p className="mt-1 text-sm text-muted">{t("onboarding.modulesBody")}</p>
              <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MANAGED_MODULES.map((module) => {
                  const Icon = MODULE_ICONS[module];
                  const active = selected.includes(module);
                  return (
                    <li key={module}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleModule(module)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-start text-sm transition",
                          active
                            ? "border-brand bg-brand-soft text-fg"
                            : "border-line bg-surface text-muted hover:border-brand/40",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-lg",
                            active ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted",
                          )}
                        >
                          <Icon aria-hidden className="size-4" />
                        </span>
                        <span className="flex-1 font-medium">{t(`module.${module}`)}</span>
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-5 place-items-center rounded-full border text-[10px]",
                            active ? "border-brand bg-brand text-brand-fg" : "border-line",
                          )}
                        >
                          {active ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {step === 1 && (
            <section aria-labelledby="privacy-title">
              <h1 id="privacy-title" className="text-xl font-semibold tracking-tight">
                {t("onboarding.privacyTitle")}
              </h1>
              <ul className="mt-4 space-y-3 text-sm text-muted">
                {[t("onboarding.privacy1"), t("onboarding.privacy2"), t("onboarding.privacy3")].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Shield aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl border border-line bg-surface-2/60 px-3">
                <Toggle
                  checked={ai}
                  onChange={(value) => setAiEnabled(value)}
                  label={t("onboarding.aiToggle")}
                  description={t("privacy.aiBody")}
                />
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="notify-title">
              <h1 id="notify-title" className="text-xl font-semibold tracking-tight">
                {t("onboarding.notifyTitle")}
              </h1>
              <p className="mt-1 text-sm text-muted">{t("onboarding.notifyBody")}</p>
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-surface-2/60 p-4 text-sm text-muted">
                <Bell aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
                <p>{t("settings.pushUnsupported")}</p>
              </div>
              {permission === "granted" && (
                <p className="mt-3 text-sm font-medium text-ok">{t("onboarding.notificationsOn")}</p>
              )}
              {permission === "blocked" && (
                <p className="mt-3 text-sm font-medium text-warn">{t("onboarding.notificationsBlocked")}</p>
              )}
              <Button
                block
                size="lg"
                className="mt-5"
                loading={permission === "busy" || finishing}
                onClick={() => void finish({ requestPush: true })}
              >
                {t("onboarding.enableNotifications")}
              </Button>
              <Button
                block
                variant="ghost"
                className="mt-2"
                disabled={permission === "busy" || finishing}
                onClick={() => void finish()}
              >
                {t("onboarding.finish")}
              </Button>
            </section>
          )}

          {step < 2 && (
            <div className="mt-6 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
              >
                {t("common.back")}
              </Button>
              <Button onClick={() => setStep((value) => Math.min(2, value + 1))}>
                {t("common.continue")}
              </Button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-danger">
              {t("errors.generic")}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
