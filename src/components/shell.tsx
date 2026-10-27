"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Boxes,
  Home,
  Lock,
  LogOut,
  Mail,
  PlusCircle,
  Receipt,
  Search,
  Settings,
  Shield,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listenForMessages } from "@/lib/data/push";
import { useOnline } from "@/lib/data/hooks";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { REQUIRED_ENV, firebaseConfig } from "@/lib/firebase/client";
import { Button, ErrorState, Spinner, cn, useToast } from "@/components/ui";

interface NavItem {
  href: string;
  key: MessageKey;
  icon: typeof Home;
}

const NAV: NavItem[] = [
  { href: "/home/", key: "nav.home", icon: Home },
  { href: "/vault/", key: "nav.vault", icon: Shield },
  { href: "/receipts/", key: "nav.receipts", icon: Receipt },
  { href: "/capture/", key: "nav.add", icon: PlusCircle },
  { href: "/search/", key: "nav.search", icon: Search },
  { href: "/alerts/", key: "nav.alerts", icon: Bell },
  { href: "/settings/", key: "nav.settings", icon: Settings },
  { href: "/privacy/", key: "nav.privacy", icon: Lock },
];

const MOBILE: NavItem[] = [
  { href: "/home/", key: "nav.home", icon: Home },
  { href: "/search/", key: "nav.search", icon: Search },
  { href: "/capture/", key: "nav.add", icon: PlusCircle },
  { href: "/alerts/", key: "nav.alerts", icon: Bell },
  { href: "/settings/", key: "nav.profile", icon: Settings },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-fg shadow-sm">
        <Boxes aria-hidden className="size-5" />
      </span>
      {!compact && <span className="text-lg font-semibold tracking-tight">LifeOS</span>}
    </span>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href);
}

export function ConfigMissing() {
  const { t } = useI18n();
  const missing = REQUIRED_ENV.filter((key) => !firebaseConfig[key as keyof typeof firebaseConfig]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-5 p-6">
      <Brand />
      <h1 className="text-2xl font-semibold tracking-tight">{t("setup.title")}</h1>
      <p className="text-sm text-muted">{t("setup.body")}</p>
      <ul className="space-y-1 rounded-xl border border-line bg-surface p-4 font-mono text-xs">
        {missing.map((key) => (
          <li key={key} className="text-danger">
            {key}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("setup.docs")}</p>
    </main>
  );
}

export function Splash({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <Brand />
        <Spinner label={label ?? t("common.loading")} />
      </div>
    </div>
  );
}

function Banners() {
  const { user, resendVerification } = useAuth();
  const { t } = useI18n();
  const online = useOnline();
  const [sent, setSent] = useState<"idle" | "sending" | "done" | "error">("idle");

  const needsVerification =
    Boolean(user) &&
    !user?.emailVerified &&
    Boolean(user?.providerData.some((provider) => provider.providerId === "password"));

  return (
    <div className="mb-4 space-y-2">
      {!online && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn-soft px-3 py-2 text-xs font-medium text-warn"
        >
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t("status.offline")}</span>
        </div>
      )}
      {needsVerification && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-info/40 bg-info-soft px-3 py-2 text-xs font-medium text-info">
          <Mail aria-hidden className="size-4 shrink-0" />
          <span className="flex-1">
            {sent === "done" ? t("status.verificationSent") : t("status.verifyEmail")}
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 border-info/30 bg-transparent px-2 text-xs text-info"
            loading={sent === "sending"}
            onClick={async () => {
              setSent("sending");
              try {
                await resendVerification();
                setSent("done");
              } catch {
                setSent("error");
              }
            }}
          >
            {t("status.resendVerification")}
          </Button>
          {sent === "error" && <span>{t("errors.generic")}</span>}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { configured, loading, user, profile, profileLoading, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const toast = useToast();

  useEffect(() => {
    if (!configured || loading || profileLoading) return;
    if (!user) {
      router.replace("/welcome/");
      return;
    }
    if (profile && !profile.onboardingCompleted) router.replace("/onboarding/");
  }, [configured, loading, profileLoading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    let unsubscribe: () => void = () => undefined;
    void listenForMessages((title, body) => {
      toast(body ? `${title} — ${body}` : title, "info");
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe();
  }, [user, toast]);

  useEffect(() => {
    const match = NAV.find((item) => isActive(pathname, item.href));
    document.title = match ? `${t(match.key)} · LifeOS` : "LifeOS";
  }, [pathname, t]);

  if (!configured) return <ConfigMissing />;
  if (loading || profileLoading) return <Splash />;
  if (!user) return <Splash />;
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 p-6">
        <Brand />
        <ErrorState
          message={t("errors.generic")}
          detail="profile-not-loaded"
          onRetry={() => window.location.reload()}
        />
      </main>
    );
  }

  const displayName = profile.displayName || user.displayName || user.email?.split("@")[0] || "";
  const initial = displayName.trim().charAt(0).toUpperCase() || "L";

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-brand-fg"
      >
        {t("nav.skipToContent")}
      </a>

      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-line bg-surface px-3 py-5 md:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav aria-label={t("nav.mainMenu")} className="mt-6 flex-1 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-brand-soft font-semibold text-brand"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-[18px]" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-line pt-3">
          <Link
            href="/settings/"
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2"
          >
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft text-sm font-semibold text-brand">
              {profile.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt="" className="size-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{displayName || t("nav.profile")}</span>
              <span className="block truncate text-xs text-muted">{profile.email ?? ""}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
          >
            <LogOut aria-hidden className="size-[18px]" />
            {t("common.signOut")}
          </button>
        </div>
      </aside>

      <div className="md:ms-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur md:hidden">
          <Link href="/home/" aria-label="LifeOS">
            <Brand />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/alerts/"
              aria-label={t("nav.alerts")}
              className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
            >
              <Bell aria-hidden className="size-5" />
            </Link>
            <Link
              href="/settings/"
              aria-label={t("nav.profile")}
              className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand"
            >
              {initial}
            </Link>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-16">
          <Banners />
          {children}
        </main>
      </div>

      <nav
        aria-label={t("nav.mainMenu")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="flex items-stretch justify-around">
          {MOBILE.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const isAdd = item.key === "nav.add";
            if (isAdd) {
              return (
                <li key={item.href} className="flex flex-1 justify-center">
                  <Link
                    href={item.href}
                    aria-label={t(item.key)}
                    className="-mt-5 grid size-14 place-items-center rounded-full bg-brand text-brand-fg shadow-lg"
                  >
                    <PlusCircle aria-hidden className="size-7" />
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                    active ? "font-semibold text-brand" : "text-muted",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
