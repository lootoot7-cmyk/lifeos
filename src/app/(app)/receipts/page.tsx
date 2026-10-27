"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Camera, Paperclip, Receipt as ReceiptIcon, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePurchases, useReceipts } from "@/lib/data/hooks";
import { startOfMonth, startOfWeek, todayIn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { DueBadge, useFormatDate } from "@/components/due";
import { PageHeader } from "@/components/page";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import { PURCHASE_CATEGORIES, type Purchase, type PurchaseCategory } from "@/lib/types";

interface CurrencyTotal {
  currency: string;
  amount: number;
}

function totalsFor(purchases: Purchase[]): CurrencyTotal[] {
  const map = new Map<string, number>();
  for (const purchase of purchases) {
    map.set(purchase.currency, (map.get(purchase.currency) ?? 0) + purchase.totalPrice);
  }
  return Array.from(map, ([currency, amount]) => ({ currency, amount })).sort(
    (a, b) => b.amount - a.amount,
  );
}

function formatTotals(totals: CurrencyTotal[], locale: string): string {
  if (totals.length === 0) return "—";
  return totals.map((total) => formatMoney(total.amount, total.currency, locale)).join(" · ");
}

export default function ReceiptsPage() {
  const { profile } = useAuth();
  const { t, locale } = useI18n();
  const receipts = useReceipts();
  const purchases = usePurchases();
  const formatDate = useFormatDate();
  const [query, setQuery] = useState("");

  const timeZone = profile?.timeZone || "UTC";
  const today = todayIn(timeZone);
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  const spending = useMemo(() => {
    const all = purchases.items;
    return {
      today: totalsFor(all.filter((purchase) => purchase.purchaseDate === today)),
      week: totalsFor(
        all.filter((purchase) => purchase.purchaseDate >= weekStart && purchase.purchaseDate <= today),
      ),
      month: totalsFor(
        all.filter((purchase) => purchase.purchaseDate >= monthStart && purchase.purchaseDate <= today),
      ),
      mixed: new Set(all.map((purchase) => purchase.currency)).size > 1,
    };
  }, [purchases.items, today, weekStart, monthStart]);

  const byCategory = useMemo(() => {
    const groups = new Map<PurchaseCategory, Purchase[]>();
    for (const purchase of purchases.items) {
      if (purchase.purchaseDate < monthStart || purchase.purchaseDate > today) continue;
      const list = groups.get(purchase.category) ?? [];
      list.push(purchase);
      groups.set(purchase.category, list);
    }
    return PURCHASE_CATEGORIES.filter((category) => groups.has(category)).map((category) => ({
      category,
      totals: totalsFor(groups.get(category) ?? []),
    }));
  }, [purchases.items, monthStart, today]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return receipts.items;
    return receipts.items.filter(
      (receipt) =>
        receipt.store.toLowerCase().includes(needle) ||
        receipt.notes.toLowerCase().includes(needle) ||
        receipt.items.some((item) => item.name.toLowerCase().includes(needle)),
    );
  }, [receipts.items, query]);

  const failure = receipts.error ?? purchases.error;
  if (failure) {
    return (
      <ErrorState
        message={t(errorKey(failure))}
        detail={String((failure as { message?: string })?.message ?? failure)}
        onRetry={() => {
          receipts.retry();
          purchases.retry();
        }}
      />
    );
  }

  if (receipts.loading || purchases.loading) return <Spinner label={t("common.loading")} />;

  return (
    <div className="animate-fade">
      <PageHeader
        title={t("receipts.title")}
        subtitle={t("receipts.subtitle")}
        action={
          <Link href="/receipts/new/">
            <Button size="sm">
              <Camera aria-hidden className="size-4" />
              {t("receipts.scan")}
            </Button>
          </Link>
        }
      />

      {purchases.items.length > 0 && (
        <Card className="mb-4 p-5">
          <SectionTitle title={t("receipts.spending")} />
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: t("receipts.today"), totals: spending.today },
              { label: t("receipts.week"), totals: spending.week },
              { label: t("receipts.month"), totals: spending.month },
            ].map((period) => (
              <div key={period.label} className="rounded-xl bg-surface-2/70 p-3">
                <p className="text-xs font-medium text-muted">{period.label}</p>
                <p className="tnum mt-1 text-sm font-semibold">{formatTotals(period.totals, locale)}</p>
              </div>
            ))}
          </div>
          {spending.mixed && <p className="mt-2 text-xs text-muted">{t("receipts.mixedCurrency")}</p>}

          {byCategory.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("receipts.byCategory")}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {byCategory.map((group) => (
                  <li key={group.category} className="flex items-start justify-between gap-3">
                    <span>{t(`pcat.${group.category}`)}</span>
                    <span className="tnum text-end font-medium">
                      {formatTotals(group.totals, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {receipts.items.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={<ReceiptIcon aria-hidden className="size-8" />}
            title={t("receipts.empty")}
            body={t("receipts.emptyBody")}
            action={
              <Link href="/receipts/new/">
                <Button>{t("receipts.scan")}</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="relative mb-4">
            <Search
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("receipts.searchPlaceholder")}
              aria-label={t("receipts.searchPlaceholder")}
              className="ps-9"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{t("vault.noMatches")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((receipt) => (
                <li key={receipt.id}>
                  <Link
                    href={`/receipts/view/?id=${receipt.id}`}
                    className="block h-full rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition hover:border-brand/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {receipt.store}
                      </h2>
                      <span className="tnum shrink-0 text-sm font-semibold">
                        {formatMoney(receipt.total, receipt.currency, locale)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted">{formatDate(receipt.purchaseDate)}</span>
                      <Badge tone="neutral">
                        {receipt.items.length === 1
                          ? t("receipts.item1")
                          : t("receipts.items", { n: receipt.items.length })}
                      </Badge>
                      {receipt.file && (
                        <Paperclip aria-label={t("receipts.viewFile")} className="size-3.5 text-muted" />
                      )}
                    </div>
                    {receipt.returnDeadline && (
                      <div className="mt-2">
                        <DueBadge date={receipt.returnDeadline} kind="return" />
                      </div>
                    )}
                    {receipt.items.length > 0 && (
                      <p className="mt-2 truncate text-xs text-muted">
                        {receipt.items.slice(0, 4).map((item) => item.name).join(", ")}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
