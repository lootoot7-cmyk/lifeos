"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { FileText, Receipt as ReceiptIcon, Search, ShoppingBag, Tag } from "lucide-react";
import { useDocuments, usePurchases, useReceipts } from "@/lib/data/hooks";
import { formatMoney } from "@/lib/domain/money";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { DueBadge, useFormatDate } from "@/components/due";
import { PageHeader } from "@/components/page";
import { Badge, Card, EmptyState, ErrorState, SectionTitle, Spinner } from "@/components/ui";

const SHOWN_PER_GROUP = 40;

function hit(needle: string, ...values: Array<string | null | undefined>): boolean {
  return values.some((value) => typeof value === "string" && value.toLowerCase().includes(needle));
}

export default function SearchPage() {
  const { t, locale } = useI18n();
  const documents = useDocuments();
  const receipts = useReceipts();
  const purchases = usePurchases();
  const formatDate = useFormatDate();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const needle = deferredQuery.trim().toLowerCase();

  const found = useMemo(() => {
    if (!needle) {
      return {
        documents: [],
        receipts: [],
        purchases: [],
        totals: { documents: 0, receipts: 0, purchases: 0 },
      };
    }

    const docs = documents.items.filter(
      (doc) =>
        hit(needle, doc.name, doc.notes, t(`cat.${doc.category}`)) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(needle)),
    );
    const rcts = receipts.items.filter(
      (receipt) =>
        hit(needle, receipt.store, receipt.notes, receipt.paymentMethod) ||
        receipt.items.some((item) => hit(needle, item.name)),
    );
    const buys = purchases.items.filter(
      (purchase) =>
        hit(needle, purchase.name, purchase.store, t(`pcat.${purchase.category}`)),
    );

    return {
      documents: docs.slice(0, SHOWN_PER_GROUP),
      receipts: rcts.slice(0, SHOWN_PER_GROUP),
      purchases: buys.slice(0, SHOWN_PER_GROUP),
      totals: { documents: docs.length, receipts: rcts.length, purchases: buys.length },
    };
  }, [needle, documents.items, receipts.items, purchases.items, t]);

  const total = found.totals.documents + found.totals.receipts + found.totals.purchases;
  const failure = documents.error ?? receipts.error ?? purchases.error;

  function countLabel(shown: number, all: number): string {
    return all > shown
      ? t("search.showing", { shown, total: all })
      : t("search.results", { n: all });
  }

  return (
    <div className="animate-fade">
      <PageHeader title={t("search.title")} subtitle={t("search.placeholder")} />

      <div className="relative mb-5">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="w-full rounded-2xl border border-line bg-surface py-3.5 pe-4 ps-11 text-base text-fg placeholder:text-muted/70 focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
        />
      </div>

      {failure ? (
        <ErrorState
          message={t(errorKey(failure))}
          detail={String((failure as { message?: string })?.message ?? failure)}
          onRetry={() => {
            documents.retry();
            receipts.retry();
            purchases.retry();
          }}
        />
      ) : documents.loading || receipts.loading || purchases.loading ? (
        <Spinner label={t("common.loading")} />
      ) : !needle ? (
        <Card className="p-5">
          <EmptyState
            icon={<Search aria-hidden className="size-8" />}
            title={t("search.title")}
            body={t("search.hint")}
          />
        </Card>
      ) : total === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {t("search.noResults", { q: deferredQuery.trim() })}
        </p>
      ) : (
        <div className="space-y-4">
          {found.totals.documents > 0 && (
            <Card className="p-5">
              <SectionTitle
                title={t("search.documents")}
                action={
                  <span className="text-xs text-muted">
                    {countLabel(found.documents.length, found.totals.documents)}
                  </span>
                }
              />
              <ul className="divide-y divide-line">
                {found.documents.map((doc) => {
                  const date = doc.expiryDate ?? doc.renewalDate;
                  return (
                    <li key={doc.id}>
                      <Link
                        href={`/vault/view/?id=${doc.id}`}
                        className="flex items-start gap-3 py-3 hover:opacity-80"
                      >
                        <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{doc.name}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone="brand">{t(`cat.${doc.category}`)}</Badge>
                            {date && (
                              <DueBadge date={date} kind={doc.expiryDate ? undefined : "renewal"} />
                            )}
                            {doc.tags.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted">
                                <Tag aria-hidden className="size-3" />
                                {doc.tags.slice(0, 3).join(" · ")}
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {found.totals.receipts > 0 && (
            <Card className="p-5">
              <SectionTitle
                title={t("search.receipts")}
                action={
                  <span className="text-xs text-muted">
                    {countLabel(found.receipts.length, found.totals.receipts)}
                  </span>
                }
              />
              <ul className="divide-y divide-line">
                {found.receipts.map((receipt) => (
                  <li key={receipt.id}>
                    <Link
                      href={`/receipts/view/?id=${receipt.id}`}
                      className="flex items-start gap-3 py-3 hover:opacity-80"
                    >
                      <ReceiptIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {receipt.store || t("search.receipts")}
                          </span>
                          <span className="tnum shrink-0 text-sm font-semibold">
                            {formatMoney(receipt.total, receipt.currency, locale)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {formatDate(receipt.purchaseDate)} ·{" "}
                          {receipt.items.length === 1
                            ? t("receipts.item1")
                            : t("receipts.items", { n: receipt.items.length })}
                          {receipt.items.length > 0
                            ? ` · ${receipt.items
                                .slice(0, 3)
                                .map((item) => item.name)
                                .join(", ")}`
                            : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {found.totals.purchases > 0 && (
            <Card className="p-5">
              <SectionTitle
                title={t("search.purchases")}
                action={
                  <span className="text-xs text-muted">
                    {countLabel(found.purchases.length, found.totals.purchases)}
                  </span>
                }
              />
              <ul className="divide-y divide-line">
                {found.purchases.map((purchase) => (
                  <li key={purchase.id}>
                    <Link
                      href={`/receipts/view/?id=${purchase.receiptId}`}
                      className="flex items-start gap-3 py-3 hover:opacity-80"
                    >
                      <ShoppingBag aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {purchase.name}
                          </span>
                          <span className="tnum shrink-0 text-sm font-semibold">
                            {formatMoney(purchase.totalPrice, purchase.currency, locale)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {[purchase.store, formatDate(purchase.purchaseDate)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
