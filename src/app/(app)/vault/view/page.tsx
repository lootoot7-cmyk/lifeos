"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Pencil, Paperclip, Receipt, Star, Trash2 } from "lucide-react";
import { useOwnedDoc, useScheduledReminders } from "@/lib/data/hooks";
import { deleteVaultDocument } from "@/lib/data/writes";
import { fileUrl } from "@/lib/data/storage";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import type { VaultDocument } from "@/lib/types";
import { PageHeader } from "@/components/page";
import { DueBadge, useFormatDate } from "@/components/due";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  SectionTitle,
  Spinner,
  useToast,
} from "@/components/ui";

export default function VaultViewPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VaultView />
    </Suspense>
  );
}

function VaultView() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const formatDate = useFormatDate();

  const document = useOwnedDoc<VaultDocument>("documents", id);
  const reminders = useScheduledReminders(200);

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  if (!id) {
    return (
      <div className="py-10 text-center text-sm text-muted">
        {t("errors.notFound")}{" "}
        <Link href="/vault/" className="font-medium text-brand hover:underline">
          {t("vault.title")}
        </Link>
      </div>
    );
  }

  if (document.loading) return <Spinner label={t("common.loading")} />;

  if (document.error) {
    return (
      <ErrorState
        message={t(errorKey(document.error))}
        detail={String((document.error as { message?: string })?.message ?? document.error)}
        onRetry={document.retry}
      />
    );
  }

  const doc = document.item;
  if (!doc) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted">{t("errors.notFound")}</p>
        <Link href="/vault/" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
          {t("vault.title")}
        </Link>
      </div>
    );
  }

  const docReminders = reminders.items.filter((reminder) => reminder.sourceId === doc.id);

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteVaultDocument(doc!.id);
      toast(t("vault.deleted"));
      router.replace("/vault/");
    } catch (cause) {
      setDeleteError(cause);
      setDeleting(false);
    }
  }

  return (
    <div className="animate-fade">
      <PageHeader
        title={doc.name}
        back={{ href: "/vault/" }}
        action={
          <>
            <Link href={`/vault/edit/?id=${doc.id}`}>
              <Button size="sm" variant="secondary">
                <Pencil aria-hidden className="size-4" />
                {t("common.edit")}
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={t("common.delete")}>
              <Trash2 aria-hidden className="size-4 text-danger" />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{t(`cat.${doc.category}`)}</Badge>
              {doc.important && (
                <Badge tone="warn">
                  <Star aria-hidden className="size-3 fill-current" />
                  {t("vault.important")}
                </Badge>
              )}
              {doc.tags.map((tag) => (
                <span key={tag} className="text-xs text-muted">
                  #{tag}
                </span>
              ))}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">{t("vault.issueDate")}</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {doc.issueDate ? formatDate(doc.issueDate) : t("common.notSet")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("vault.expiryDate")}</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium">
                  {doc.expiryDate ? formatDate(doc.expiryDate) : t("common.notSet")}
                  {doc.expiryDate && <DueBadge date={doc.expiryDate} kind="expiry" />}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("vault.renewalDate")}</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium">
                  {doc.renewalDate ? formatDate(doc.renewalDate) : t("common.notSet")}
                  {doc.renewalDate && <DueBadge date={doc.renewalDate} kind="renewal" />}
                </dd>
              </div>
              {doc.receiptId && (
                <div>
                  <dt className="text-xs text-muted">{t("receipts.title")}</dt>
                  <dd className="mt-0.5 text-sm">
                    <Link
                      href={`/receipts/view/?id=${doc.receiptId}`}
                      className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                    >
                      <Receipt aria-hidden className="size-4" />
                      {t("vault.viewReceipt")}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>

            {doc.notes && (
              <div className="mt-4 border-t border-line pt-3">
                <h2 className="text-xs text-muted">{t("vault.notes")}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm">{doc.notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle title={t("vault.attachments")} />
            {doc.attachments.length === 0 ? (
              <p className="text-sm text-muted">{t("receipts.noFile")}</p>
            ) : (
              <ul className="space-y-2">
                {doc.attachments.map((attachment) => (
                  <li key={attachment.path}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-start text-sm hover:border-brand/40"
                      onClick={async () => {
                        try {
                          window.open(await fileUrl(attachment.path), "_blank", "noopener");
                        } catch {
                          toast(t("errors.notFound"), "danger");
                        }
                      }}
                    >
                      <Paperclip aria-hidden className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                      <span className="text-xs text-brand">{t("common.open")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle title={t("vault.upcomingReminders")} />
            {docReminders.length === 0 ? (
              <p className="text-sm text-muted">{t("vault.noReminders")}</p>
            ) : (
              <ul className="space-y-3">
                {docReminders.map((reminder) => (
                  <li key={reminder.id} className="flex items-center gap-2">
                    <CalendarDays aria-hidden className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 text-sm">{formatDate(reminder.dueDate)}</span>
                    <DueBadge date={reminder.dueDate} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {deleteError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {t(errorKey(deleteError))}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
        title={t("common.delete")}
        body={t("vault.deleteConfirm", { name: doc.name })}
        confirmLabel={t("common.delete")}
        busy={deleting}
      />
    </div>
  );
}
