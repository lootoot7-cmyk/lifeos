"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, Paperclip, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useDocuments, useOwnedDoc } from "@/lib/data/hooks";
import { fileUrl } from "@/lib/data/storage";
import { deleteReceipt } from "@/lib/data/writes";
import { formatMoney } from "@/lib/domain/money";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { DueBadge, useFormatDate } from "@/components/due";
import { PageHeader } from "@/components/page";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SectionTitle,
  Spinner,
  useToast,
} from "@/components/ui";
import type { Receipt } from "@/lib/types";

export default function ReceiptViewPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReceiptViewer />
    </Suspense>
  );
}

function ReceiptViewer() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const receipt = useOwnedDoc<Receipt>("receipts", id);
  const documents = useDocuments();
  const formatDate = useFormatDate();

  const [fileHref, setFileHref] = useState<string | null>(null);
  const [fileError, setFileError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  const path = receipt.item?.file?.path;
  useEffect(() => {
    let active = true;
    setFileHref(null);
    setFileError(null);
    if (!path) return;
    fileUrl(path)
      .then((url) => {
        if (active) setFileHref(url);
      })
      .catch((cause) => {
        if (active) setFileError(cause);
      });
    return () => {
      active = false;
    };
  }, [path]);

  const warranties = documents.items.filter((doc) => doc.receiptId === id);

  if (receipt.error) {
    return (
      <ErrorState
        message={t(errorKey(receipt.error))}
        detail={String((receipt.error as { message?: string })?.message ?? receipt.error)}
        onRetry={receipt.retry}
      />
    );
  }

  if (receipt.loading || documents.loading) return <Spinner label={t("common.loading")} />;

  if (!id || !receipt.item) {
    return (
      <div className="animate-fade">
        <PageHeader title={t("receipts.title")} back={{ href: "/receipts/" }} />
        <EmptyState
          title={t("errors.notFound")}
          action={
            <Link href="/receipts/">
              <Button>{t("common.back")}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const item = receipt.item;
  const price = (value: number | null) =>
    value == null ? "—" : formatMoney(value, item.currency, locale);

  async function remove() {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteReceipt(id);
      toast(t("receipts.deleted"));
      router.replace("/receipts/");
    } catch (cause) {
      setDeleteError(cause);
      setDeleting(false);
    }
  }

  return (
    <div className="animate-fade">
      <PageHeader
        title={item.store}
        subtitle={formatDate(item.purchaseDate)}
        back={{ href: "/receipts/" }}
      />

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("review.total")}
              </p>
              <p className="tnum mt-1 text-3xl font-semibold tracking-tight">
                {formatMoney(item.total, item.currency, locale)}
              </p>
            </div>
            {item.returnDeadline && (
              <DueBadge date={item.returnDeadline} kind="return" className="mt-1" />
            )}
          </div>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            {item.subtotal != null && (
              <div>
                <dt className="text-xs text-muted">{t("review.subtotal")}</dt>
                <dd className="tnum font-medium">{price(item.subtotal)}</dd>
              </div>
            )}
            {item.tax != null && (
              <div>
                <dt className="text-xs text-muted">{t("review.tax")}</dt>
                <dd className="tnum font-medium">{price(item.tax)}</dd>
              </div>
            )}
            {item.paymentMethod && (
              <div>
                <dt className="text-xs text-muted">{t("review.payment")}</dt>
                <dd className="font-medium">{item.paymentMethod}</dd>
              </div>
            )}
          </dl>

          {item.file ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Paperclip aria-hidden className="size-4 text-muted" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{item.file.name}</span>
              {fileHref ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.open(fileHref, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink aria-hidden className="size-4" />
                  {t("receipts.viewFile")}
                </Button>
              ) : fileError ? (
                <Badge tone="warn">{t(errorKey(fileError))}</Badge>
              ) : (
                <Loader2 aria-hidden className="size-4 animate-spin text-muted" />
              )}
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{t("receipts.noFile")}</p>
          )}
        </Card>

        {item.items.length > 0 && (
          <Card className="p-5">
            <SectionTitle
              title={t("review.items")}
              action={
                <Badge tone="neutral">
                  {item.items.length === 1
                    ? t("receipts.item1")
                    : t("receipts.items", { n: item.items.length })}
                </Badge>
              }
            />
            <ul className="divide-y divide-line">
              {item.items.map((line, index) => (
                <li key={index} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>
                        {line.quantity} × {price(line.unitPrice)}
                      </span>
                      <Badge tone="neutral">{t(`pcat.${line.category}`)}</Badge>
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-sm font-semibold">{price(line.totalPrice)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {warranties.length > 0 && (
          <Card className="p-5">
            <SectionTitle title={t("receipts.linkedWarranties")} />
            <ul className="space-y-2">
              {warranties.map((warranty) => (
                <li key={warranty.id}>
                  <Link
                    href={`/vault/view/?id=${warranty.id}`}
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:border-brand/40"
                  >
                    <ShieldCheck aria-hidden className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate font-medium">{warranty.name}</span>
                    {warranty.expiryDate && (
                      <DueBadge date={warranty.expiryDate} kind="warranty" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {item.notes && (
          <Card className="p-5">
            <SectionTitle title={t("review.notes")} />
            <p className="whitespace-pre-wrap text-sm text-muted">{item.notes}</p>
          </Card>
        )}

        {item.extraction && (
          <Card className="p-5">
            <SectionTitle
              title={t("review.aiConfidence", {
                p: Math.round(item.extraction.confidence * 100),
              })}
              action={<Sparkles aria-hidden className="size-4 text-muted" />}
            />
            {item.extraction.warnings.length > 0 && (
              <>
                <p className="text-sm font-medium">{t("review.warnings")}</p>
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm text-muted">
                  {item.extraction.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}

        {deleteError ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t(errorKey(deleteError))}
          </p>
        ) : null}

        <div className="flex justify-end pb-2">
          <Button variant="danger" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden className="size-4" />
            {t("common.delete")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
        title={t("common.delete")}
        body={t("receipts.deleteConfirm")}
        confirmLabel={t("common.delete")}
        busy={deleting}
      />
    </div>
  );
}
