"use client";

import Link from "next/link";
import { Bell, BellOff, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNotifications, useScheduledReminders } from "@/lib/data/hooks";
import { markNotificationsRead, setNotificationRead, setReminderStatus } from "@/lib/data/writes";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page";
import { DueBadge, useFormatDate } from "@/components/due";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  SectionTitle,
  Spinner,
  cn,
  useToast,
} from "@/components/ui";
import type { AppNotification, Reminder } from "@/lib/types";

function reminderHref(reminder: Reminder): string {
  if (reminder.sourceType === "document" && reminder.sourceId) return `/vault/view/?id=${reminder.sourceId}`;
  if (reminder.sourceType === "receipt" && reminder.sourceId) return `/receipts/view/?id=${reminder.sourceId}`;
  return "/alerts/";
}

export default function AlertsPage() {
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  const toast = useToast();
  const notifications = useNotifications(50);
  const reminders = useScheduledReminders(200);
  const formatDate = useFormatDate();

  const unread = notifications.items.filter((item) => !item.read);
  const timeZone = profile?.timeZone || "UTC";

  function stamp(notification: AppNotification): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(notification.createdAt.toDate());
    } catch {
      return "";
    }
  }

  async function complete(reminder: Reminder, status: "done" | "dismissed") {
    try {
      await setReminderStatus(reminder.id, status);
      toast(status === "done" ? t("alerts.markDone") : t("alerts.dismiss"));
    } catch (cause) {
      toast(t(errorKey(cause)), "danger");
    }
  }

  const failure = notifications.error ?? reminders.error;
  if (failure) {
    return (
      <ErrorState
        message={t(errorKey(failure))}
        detail={String((failure as { message?: string })?.message ?? failure)}
        onRetry={() => {
          notifications.retry();
          reminders.retry();
        }}
      />
    );
  }

  if (notifications.loading || reminders.loading) return <Spinner label={t("common.loading")} />;

  return (
    <div className="animate-fade">
      <PageHeader
        title={t("alerts.title")}
        action={
          unread.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await markNotificationsRead(unread.map((item) => item.id));
                } catch (cause) {
                  toast(t(errorKey(cause)), "danger");
                }
              }}
            >
              <Check aria-hidden className="size-4" />
              {t("alerts.markAllRead")}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title={t("alerts.notifications")} />
          {notifications.items.length === 0 ? (
            <EmptyState
              icon={<BellOff aria-hidden className="size-7" />}
              title={t("alerts.empty")}
              body={t("home.briefingNote")}
            />
          ) : (
            <ul className="divide-y divide-line">
              {notifications.items.map((notification) => {
                const content = (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        notification.read ? "bg-transparent" : "bg-brand",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm",
                          notification.read ? "font-normal text-muted" : "font-semibold",
                        )}
                      >
                        {notification.title}
                      </span>
                      {notification.body && (
                        <span className="mt-0.5 block text-xs text-muted">{notification.body}</span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted">{stamp(notification)}</span>
                    </span>
                  </>
                );

                return (
                  <li key={notification.id}>
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        onClick={() => {
                          if (!notification.read) void setNotificationRead(notification.id, true).catch(() => undefined);
                        }}
                        className="flex gap-2.5 py-3 hover:opacity-80"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!notification.read) void setNotificationRead(notification.id, true).catch(() => undefined);
                        }}
                        className="flex w-full gap-2.5 py-3 text-start hover:opacity-80"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle
            title={t("alerts.upcoming")}
            action={<Bell aria-hidden className="size-4 text-muted" />}
          />
          {reminders.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("alerts.noUpcoming")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {reminders.items.map((reminder) => (
                <li key={reminder.id} className="py-3">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <Link href={reminderHref(reminder)} className="block text-sm font-medium hover:underline">
                        {reminder.title}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted">
                        {t("alerts.remindOn", { date: formatDate(reminder.dueDate) })}
                      </span>
                    </span>
                    <DueBadge date={reminder.dueDate} kind={reminder.kind} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void complete(reminder, "done")}>
                      {t("alerts.markDone")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void complete(reminder, "dismissed")}>
                      {t("alerts.dismiss")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
