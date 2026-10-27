"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Paperclip, Plus, Search, Star } from "lucide-react";
import { useDocuments } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { errorKey } from "@/lib/errors";
import { VAULT_CATEGORIES, type VaultCategory } from "@/lib/types";
import { PageHeader } from "@/components/page";
import { DueBadge } from "@/components/due";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Select, Spinner } from "@/components/ui";

export default function VaultPage() {
  const { t } = useI18n();
  const documents = useDocuments();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<VaultCategory | "all">("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.items.filter((doc) => {
      if (category !== "all" && doc.category !== category) return false;
      if (!needle) return true;
      return (
        doc.name.toLowerCase().includes(needle) ||
        doc.notes.toLowerCase().includes(needle) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [documents.items, query, category]);

  return (
    <div className="animate-fade">
      <PageHeader
        title={t("vault.title")}
        subtitle={t("vault.subtitle")}
        action={
          <Link href="/vault/edit/">
            <Button size="sm">
              <Plus aria-hidden className="size-4" />
              {t("vault.new")}
            </Button>
          </Link>
        }
      />

      {documents.error ? (
        <ErrorState
          message={t(errorKey(documents.error))}
          detail={String((documents.error as { message?: string })?.message ?? documents.error)}
          onRetry={documents.retry}
        />
      ) : documents.loading ? (
        <Spinner label={t("common.loading")} />
      ) : documents.items.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={<Star aria-hidden className="size-8" />}
            title={t("vault.empty")}
            body={t("vault.emptyBody")}
            action={
              <Link href="/vault/edit/">
                <Button>{t("vault.new")}</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("vault.searchPlaceholder")}
                aria-label={t("vault.searchPlaceholder")}
                className="ps-9"
              />
            </div>
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value as VaultCategory | "all")}
              aria-label={t("vault.category")}
              className="sm:max-w-52"
            >
              <option value="all">{t("common.all")}</option>
              {VAULT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(`cat.${item}`)}
                </option>
              ))}
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{t("vault.noMatches")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((doc) => {
                const date = doc.expiryDate ?? doc.renewalDate;
                return (
                  <li key={doc.id}>
                    <Link
                      href={`/vault/view/?id=${doc.id}`}
                      className="block h-full rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition hover:border-brand/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                          <span className="line-clamp-2">{doc.name}</span>
                        </h2>
                        {doc.important && (
                          <Star aria-label={t("vault.important")} className="size-4 shrink-0 fill-warn text-warn" />
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone="brand">{t(`cat.${doc.category}`)}</Badge>
                        {date && <DueBadge date={date} kind={doc.expiryDate ? undefined : "renewal"} />}
                      </div>
                      {doc.tags.length > 0 && (
                        <p className="mt-2 truncate text-xs text-muted">#{doc.tags.join(" #")}</p>
                      )}
                      {doc.attachments.length > 0 && (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                          <Paperclip aria-hidden className="size-3.5" />
                          {doc.attachments.length}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
