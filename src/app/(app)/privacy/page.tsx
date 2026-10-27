"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Download,
  FileDown,
  FileText,
  Paperclip,
  Receipt as ReceiptIcon,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserX,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useDocuments, useOwnedCollection, usePurchases, useReceipts, useAuditLogs } from "@/lib/data/hooks";
import { deleteMyAccount, deleteMyData, exportMyData } from "@/lib/data/ai";
import { browserPermission } from "@/lib/data/push";
import { fileUrl } from "@/lib/data/storage";
import { errorKey } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { PageHeader } from "@/components/page";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  SectionTitle,
  Spinner,
  Toggle,
  useToast,
} from "@/components/ui";
import type { AuditLog, Reminder } from "@/lib/types";

const AUDIT_LABELS: Record<string, MessageKey> = {
  data_exported: "privacy.audit.data_exported",
  document_deleted: "privacy.audit.document_deleted",
  receipt_deleted: "privacy.audit.receipt_deleted",
  data_deleted: "privacy.audit.data_deleted",
};

export default function PrivacyPage() {
  const { profile, saveProfile } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const documents = useDocuments();
  const receipts = useReceipts();
  const purchases = usePurchases();
  const reminders = useOwnedCollection<Reminder>("reminders", { max: 2000 });
  const activity = useAuditLogs(20);

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [savingAi, setSavingAi] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<unknown>(null);
  const [confirmData, setConfirmData] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [typed, setTyped] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<unknown>(null);

  useEffect(() => {
    setPermission(browserPermission());
  }, []);

  const fileCount = useMemo(() => {
    const files = new Set<string>();
    documents.items.forEach((doc) => doc.attachments.forEach((item) => files.add(item.path)));
    receipts.items.forEach((receipt) => {
      if (receipt.file) files.add(receipt.file.path);
    });
    return files.size;
  }, [documents.items, receipts.items]);

  const failure =
    documents.error ?? receipts.error ?? purchases.error ?? reminders.error ?? activity.error;

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
          activity.retry();
        }}
      />
    );
  }

  if (
    documents.loading ||
    receipts.loading ||
    purchases.loading ||
    reminders.loading ||
    activity.loading ||
    !profile
  ) {
    return <Spinner label={t("common.loading")} />;
  }

  const timeZone = profile.timeZone;

  function stamp(log: AuditLog): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(log.createdAt.toDate());
    } catch {
      return "";
    }
  }

  async function toggleAi(value: boolean) {
    if (savingAi) return;
    setSavingAi(true);
    try {
      await saveProfile({ aiAnalysisEnabled: value });
    } catch (cause) {
      toast(t(errorKey(cause)), "danger");
    } finally {
      setSavingAi(false);
    }
  }

  async function runExport() {
    setExporting(true);
    setExportError(null);
    try {
      const { path } = await exportMyData();
      const url = await fileUrl(path);
      setExportUrl(url);
      toast(t("privacy.exportReady"));
    } catch (cause) {
      setExportError(cause);
    } finally {
      setExporting(false);
    }
  }

  async function removeData() {
    setDataBusy(true);
    try {
      await deleteMyData();
      setExportUrl(null);
      toast(t("privacy.dataDeleted"));
    } catch (cause) {
      toast(t(errorKey(cause)), "danger");
    } finally {
      setDataBusy(false);
      setConfirmData(false);
    }
  }

  async function removeAccount() {
    if (typed !== "DELETE") return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      await deleteMyAccount();
      router.replace("/welcome/");
    } catch (cause) {
      setAccountError(cause);
      setAccountBusy(false);
    }
  }

  const permissionLabel =
    permission === "unsupported" ? t("privacy.perm.unsupported") : t(`privacy.perm.${permission}`);

  return (
    <div className="animate-fade">
      <PageHeader title={t("privacy.title")} subtitle={t("privacy.subtitle")} />

      <div className="grid max-w-3xl gap-4">
        <Card className="p-5">
          <SectionTitle title={t("privacy.stored")} />
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              {
                icon: FileText,
                label: t("privacy.records", { n: documents.items.length }),
              },
              {
                icon: ReceiptIcon,
                label: t("privacy.receiptsCount", { n: receipts.items.length }),
              },
              {
                icon: ShoppingBag,
                label: t("privacy.purchasesCount", { n: purchases.items.length }),
              },
              {
                icon: Bell,
                label: t("privacy.remindersCount", { n: reminders.items.length }),
              },
              {
                icon: Paperclip,
                label: t("privacy.filesCount", { n: fileCount }),
              },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-xl bg-surface-2/70 px-3 py-2.5 text-sm"
              >
                <Icon aria-hidden className="size-4 shrink-0 text-muted" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title={t("privacy.ai")}
            action={<Sparkles aria-hidden className="size-4 text-muted" />}
          />
          <p className="text-sm text-muted">{t("privacy.aiBody")}</p>
          <div className="mt-2 border-t border-line">
            <Toggle
              checked={profile.aiAnalysisEnabled}
              onChange={(value) => void toggleAi(value)}
              label={t("privacy.aiToggle")}
              disabled={savingAi}
            />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title={t("privacy.permissions")} />
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t("privacy.notifPermissionLabel")}</span>
            <Badge
              tone={
                permission === "granted" ? "ok" : permission === "denied" ? "danger" : "neutral"
              }
            >
              {permissionLabel}
            </Badge>
          </p>
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-sm font-medium">{t("privacy.services")}</p>
            <p className="mt-1 text-sm text-muted">{t("privacy.servicesBody")}</p>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title={t("privacy.actions")} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={exporting}
              onClick={() => void runExport()}
            >
              <FileDown aria-hidden className="size-4" />
              {exporting ? t("privacy.exporting") : t("privacy.export")}
            </Button>
            {exportUrl && (
              <a
                href={exportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"
              >
                <Download aria-hidden className="size-4" />
                {t("privacy.download")}
              </a>
            )}
          </div>
          {exportUrl && (
            <p className="mt-2 text-xs text-ok">{t("privacy.exportReady")}</p>
          )}
          {exportError ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {t(errorKey(exportError))}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button variant="danger" onClick={() => setConfirmData(true)}>
              <Trash2 aria-hidden className="size-4" />
              {t("privacy.deleteData")}
            </Button>
            <Button variant="danger" onClick={() => setConfirmAccount(true)}>
              <UserX aria-hidden className="size-4" />
              {t("privacy.deleteAccount")}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title={t("privacy.activity")}
            action={<ShieldCheck aria-hidden className="size-4 text-muted" />}
          />
          {activity.items.length === 0 ? (
            <EmptyState title={t("privacy.noActivity")} />
          ) : (
            <ul className="divide-y divide-line">
              {activity.items.map((log) => {
                const key = AUDIT_LABELS[log.action];
                return (
                  <li key={log.id} className="flex items-start justify-between gap-3 py-2.5">
                    <span className="text-sm">{key ? t(key) : log.action}</span>
                    <span className="shrink-0 text-xs text-muted">{stamp(log)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmData}
        onClose={() => setConfirmData(false)}
        onConfirm={() => void removeData()}
        title={t("privacy.deleteData")}
        body={t("privacy.deleteDataConfirm")}
        confirmLabel={t("privacy.deleteData")}
        busy={dataBusy}
      />

      <Dialog
        open={confirmAccount}
        onClose={() => {
          if (!accountBusy) {
            setConfirmAccount(false);
            setTyped("");
            setAccountError(null);
          }
        }}
        title={t("privacy.deleteAccount")}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={accountBusy}
              onClick={() => {
                setConfirmAccount(false);
                setTyped("");
                setAccountError(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={typed !== "DELETE"}
              loading={accountBusy}
              onClick={() => void removeAccount()}
            >
              {t("privacy.deleteAccount")}
            </Button>
          </>
        }
      >
        <p className="text-muted">{t("privacy.deleteAccountConfirm")}</p>
        <Field label={t("privacy.typeDelete")} htmlFor="delete-account-confirm">
          <Input
            id="delete-account-confirm"
            value={typed}
            dir="ltr"
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </Field>
        {accountError ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t(errorKey(accountError))}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
