"use client";

import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { daysBetween, dueBucket, formatDate, todayIn } from "@/lib/domain/dates";
import { Badge, type Tone } from "@/components/ui";
import type { IsoDate, ReminderKind } from "@/lib/types";

export function useToday(): IsoDate {
  const { profile } = useAuth();
  return todayIn(profile?.timeZone || "UTC");
}

export function useFormatDate(): (date: IsoDate) => string {
  const { locale } = useI18n();
  return (date: IsoDate) => formatDate(date, locale);
}

const BUCKET_TONE: Record<string, Tone> = {
  overdue: "danger",
  today: "danger",
  week: "warn",
  month: "info",
  future: "neutral",
};

export function dueLabel(
  date: IsoDate,
  today: IsoDate,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): { label: string; tone: Tone } {
  const diff = daysBetween(today, date);
  const tone = BUCKET_TONE[dueBucket(date, today)] ?? "neutral";
  if (diff < 0) return { label: diff === -1 ? t("due.overdue1") : t("due.overdue", { n: -diff }), tone };
  if (diff === 0) return { label: t("due.today"), tone };
  if (diff === 1) return { label: t("due.tomorrow"), tone };
  return { label: t("due.inDays", { n: diff }), tone };
}

export function DueBadge({
  date,
  kind,
  className,
}: {
  date: IsoDate;
  kind?: ReminderKind;
  className?: string;
}) {
  const { t } = useI18n();
  const today = useToday();
  const { label, tone } = dueLabel(date, today, t);
  const kindLabel = kind ? t(`due.kind.${kind}` as MessageKey) : null;
  return (
    <Badge tone={tone} className={className}>
      {kindLabel ? `${kindLabel} · ${label}` : label}
    </Badge>
  );
}
