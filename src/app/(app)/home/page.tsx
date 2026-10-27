"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  FileText,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useDocuments, usePurchases, useReceipts, useScheduledReminders } from "@/lib/data/hooks";
import { daysBetween, dueBucket, todayIn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useI18n } from "@/lib/i18n";
import { errorKey } from "@/lib/errors";
import { DueBadge, dueLabel, useFormatDate } from "@/components/due";
import { PageHeader } from "@/components/page";
import { Button, Card, EmptyState, ErrorState, SectionTitle, Spinner } from "@/components/ui";
import type { Reminder } from "@/lib/types";

function greetingKey(hour: number) {
  if (hour < 12) return "home.morning" as const;
  if (hour < 17) return "home.afternoon" as const;
  return "home.evening" as const;
}

function reminderHref(reminder: Reminder): string {
  if (reminder.sourceType === "document" && reminder.sourceId) return `/vault/view/?id=${reminder.sourceId}`;
  if (reminder.sourceType === "receipt" && reminder.sourceId) return `/receipts/view/?id=${reminder.sourceId}`;
  return "/alerts/";
}

export default function HomePage() {
  const { profile, user } = useAuth();
  const { t, locale } = useI18n();
  const formatDate = useFormatDate();

  const documents = useDocuments();
  const receipts = useReceipts();
  const purchases = usePurchases();
  const reminders = useScheduledReminders();

  const timeZone = profile?.timeZone || "UTC";
  const today = todayIn(timeZone);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
  const name = (profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "").trim();

  const loading = documents.loading || receipts.loading || purchases.loading || reminders.loading;
  const failure = documents.error ?? receipts.error ?? purchases.error ?? reminders.error;

  if (failure) {
    return (
      <ErrorState
        message={t(errorKey(failure))}
        detail={String((failure as { message?: string })?.message ?? failure)}
        onRetry={() => {
          documents.retry();
          receipts.retry();
          purchases.retry();
          reminders.retry();
        }}
      />
    );
  }

  if (loading) return <Spinner label={t("common.loading")} />;

  const urgent = reminders.items.filter((item) => {
    const bucket = dueBucket(item.dueDate, today);
    return bucket === "overdue" || bucket === "today";
  });
  const thisWeek = reminders.items.filter((item) => dueBucket(item.dueDate, today) === "week");
  const warrantiesSoon = documents.items.filter(
    (doc) =>
      doc.category === "warranties" &&
      doc.expiryDate &&
      daysBetween(today, doc.expiryDate) >= 0 &&
      daysBetween(today, doc.expiryDate) <= 30,
  );
  const expiringWeek = documents.items.filter(
    (doc) => doc.expiryDate && daysBetween(today, doc.expiryDate) >= 0 && daysBetween(today, doc.expiryDate) <= 7,
  );
  const important = documents.items.filter((doc) => doc.important).slice(0, 4);
  const recent = purchases.items.slice(0, 4);
  const soonCount = urgent.length + thisWeek.length;
  const totalRecords = documents.items.length + receipts.items.length;

  const suggestion = reminders.items[0] ?? null;

  return (
    <div className="animate-fade">
      <PageHeader
        title={t(greetingKey(hour), { name: name || t("nav.profile") })}
        subtitle={
          soonCount === 0
            ? t("home.nothingToday")
            : soonCount === 1
              ? t("home.oneThing")
              : t("home.thingsToday", { n: soonCount })
        }
        action={
          <Link href="/capture/">
            <Button size="sm">
              <Plus aria-hidden className="size-4" />
              {t("home.addAnything")}
            </Button>
          </Link>
        }
      />

      {totalRecords === 0 && reminders.items.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={<ShieldCheck aria-hidden className="size-8" />}
            title={t("home.emptyTitle")}
            body={t("home.emptyBody")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/vault/edit/">
                  <Button>
                    <FileText aria-hidden className="size-4" />
                    {t("home.addDocument")}
                  </Button>
                </Link>
                <Link href="/receipts/new/">
                  <Button variant="secondary">
                    <Receipt aria-hidden className="size-4" />
                    {t("home.scanReceipt")}
                  </Button>
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-5">
              <SectionTitle
                title={t("home.briefing")}
                action={
                  <Link
                    href="/alerts/"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                  >
                    {t("nav.alerts")}
                    <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
                  </Link>
                }
              />
              <ul className="space-y-2.5">
                <li className="flex items-center gap-3 rounded-xl bg-surface-2/70 px-3 py-2.5">
                  <BellRing aria-hidden className="size-4 text-danger" />
                  <span className="flex-1 text-sm">
                    <strong className="tnum">{urgent.length}</strong> {t("home.urgent")}
                  </span>
                  <span className="text-xs text-muted">{t("bucket.overdue")} · {t("bucket.today")}</span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-surface-2/70 px-3 py-2.5">
                  <CalendarClock aria-hidden className="size-4 text-warn" />
                  <span className="flex-1 text-sm">
                    <strong className="tnum">{thisWeek.length}</strong> {t("home.thisWeek")}
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-surface-2/70 px-3 py-2.5">
                  <ShieldCheck aria-hidden className="size-4 text-info" />
                  <span className="flex-1 text-sm">
                    <strong className="tnum">{warrantiesSoon.length}</strong> {t("home.warrantiesSoon")}
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-surface-2/70 px-3 py-2.5">
                  <ShoppingBag aria-hidden className="size-4 text-ok" />
                  <span className="flex-1 text-sm">
                    <strong className="tnum">{expiringWeek.length}</strong> {t("module.expiry")} ·{" "}
                    {t("due.inDays", { n: 7 })}
                  </span>
                </li>
              </ul>
              {suggestion && (
                <div className="mt-4 rounded-xl border border-brand/30 bg-brand-soft/60 px-3 py-2.5 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                    {t("home.suggested")}
                  </p>
                  <p className="mt-0.5">
                    {suggestion.title} — {dueLabel(suggestion.dueDate, today, t).label}
                  </p>
                </div>
              )}
              <p className="mt-3 text-xs text-muted">{t("home.briefingNote")}</p>
            </Card>

            <Card className="p-5">
              <SectionTitle
                title={t("home.upcoming")}
                action={
                  <Link href="/alerts/" className="text-xs font-medium text-brand hover:underline">
                    {t("common.viewAll")}
                  </Link>
                }
              />
              {reminders.items.length === 0 ? (
                <p className="text-sm text-muted">{t("alerts.noUpcoming")}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {reminders.items.slice(0, 5).map((reminder) => (
                    <li key={reminder.id}>
                      <Link
                        href={reminderHref(reminder)}
                        className="flex items-center gap-3 py-3 transition hover:opacity-80"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{reminder.title}</span>
                          <span className="block text-xs text-muted">
                            {formatDate(reminder.dueDate)}
                          </span>
                        </span>
                        <DueBadge date={reminder.dueDate} kind={reminder.kind} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <SectionTitle title={t("home.recentPurchases")} />
              {recent.length === 0 ? (
                <p className="text-sm text-muted">{t("home.noPurchases")}</p>
              ) : (
                <ul className="space-y-3">
                  {recent.map((purchase) => (
                    <li key={purchase.id} className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{purchase.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {purchase.store} · {formatDate(purchase.purchaseDate)}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-sm font-semibold">
                        {formatMoney(purchase.totalPrice, purchase.currency, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/receipts/"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                {t("nav.receipts")}
                <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
              </Link>
            </Card>

            <Card className="p-5">
              <SectionTitle title={t("home.importantDocs")} />
              {important.length === 0 ? (
                <p className="text-sm text-muted">{t("home.noImportant")}</p>
              ) : (
                <ul className="space-y-3">
                  {important.map((doc) => (
                    <li key={doc.id}>
                      <Link href={`/vault/view/?id=${doc.id}`} className="block hover:opacity-80">
                        <span className="block truncate text-sm font-medium">{doc.name}</span>
                        <span className="block text-xs text-muted">{t(`cat.${doc.category}`)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle title={t("home.addAnything")} />
              <p className="text-sm text-muted">{t("home.addAnythingBody")}</p>
              <div className="mt-3 grid gap-2">
                <Link href="/vault/edit/">
                  <Button variant="secondary" block>
                    <FileText aria-hidden className="size-4" />
                    {t("home.addDocument")}
                  </Button>
                </Link>
                <Link href="/receipts/new/">
                  <Button variant="secondary" block>
                    <Receipt aria-hidden className="size-4" />
                    {t("home.scanReceipt")}
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
