"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, FilePlus2, Paperclip, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { analyzeCapture } from "@/lib/data/ai";
import { deleteFile, fileUrl, uploadFile, validateFile } from "@/lib/data/storage";
import { saveVaultDocument } from "@/lib/data/writes";
import { useOwnedDoc } from "@/lib/data/hooks";
import { isValidIsoDate } from "@/lib/domain/dates";
import { sanitizeOffsets } from "@/lib/domain/reminders";
import { errorKey } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  DEFAULT_REMINDER_OFFSETS,
  VAULT_CATEGORIES,
  type Attachment,
  type VaultCategory,
  type VaultDocument,
} from "@/lib/types";
import { PageHeader } from "@/components/page";
import {
  Button,
  Card,
  Field,
  Input,
  ProgressBar,
  Select,
  Spinner,
  Textarea,
  Toggle,
  cn,
  useToast,
} from "@/components/ui";

interface FormState {
  name: string;
  category: VaultCategory;
  issueDate: string;
  expiryDate: string;
  renewalDate: string;
  notes: string;
  tags: string;
  offsets: number[];
  important: boolean;
  attachments: Attachment[];
  source: VaultDocument["source"];
  receiptId: string | null;
}

const EMPTY: FormState = {
  name: "",
  category: "records",
  issueDate: "",
  expiryDate: "",
  renewalDate: "",
  notes: "",
  tags: "",
  offsets: [...DEFAULT_REMINDER_OFFSETS],
  important: false,
  attachments: [],
  source: "manual",
  receiptId: null,
};

export default function VaultEditPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VaultEditor />
    </Suspense>
  );
}

function VaultEditor() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const existing = useOwnedDoc<VaultDocument>("documents", id);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [ready, setReady] = useState(!id);
  const [missing, setMissing] = useState(false);
  const [nameError, setNameError] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const [aiNotice, setAiNotice] = useState<MessageKey | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [error, setError] = useState<unknown>(null);
  const removedPaths = useRef<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    if (existing.item) {
      const doc = existing.item;
      setForm({
        name: doc.name,
        category: doc.category,
        issueDate: doc.issueDate ?? "",
        expiryDate: doc.expiryDate ?? "",
        renewalDate: doc.renewalDate ?? "",
        notes: doc.notes,
        tags: doc.tags.join(", "),
        offsets: doc.reminderOffsets.length ? [...doc.reminderOffsets] : [...DEFAULT_REMINDER_OFFSETS],
        important: doc.important,
        attachments: doc.attachments ?? [],
        source: doc.source,
        receiptId: doc.receiptId ?? null,
      });
      setReady(true);
    } else if (!existing.loading) {
      setMissing(true);
    }
  }, [id, existing.item, existing.loading]);

  const patch = (values: Partial<FormState>) => setForm((current) => ({ ...current, ...values }));

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    try {
      validateFile(file);
    } catch (cause) {
      setError(cause);
      return;
    }
    setError(null);
    setUploadProgress(0);
    try {
      const attachment = await uploadFile(user.uid, "vault", file, setUploadProgress);
      patch({ attachments: [...form.attachments, attachment] });
    } catch (cause) {
      setError(cause);
    } finally {
      setUploadProgress(null);
    }
  }

  function removeAttachment(attachment: Attachment) {
    patch({ attachments: form.attachments.filter((item) => item.path !== attachment.path) });
    const wasSaved = existing.item?.attachments?.some((item) => item.path === attachment.path);
    if (wasSaved) {
      removedPaths.current.push(attachment.path);
    } else {
      void deleteFile(attachment.path);
    }
  }

  async function readWithAi() {
    const file = form.attachments[0];
    if (!file) return;
    setAiNotice(null);
    setReading(true);
    setError(null);
    try {
      const analysis = await analyzeCapture({ storagePath: file.path });
      if (analysis.kind === "receipt") {
        setAiNotice("vault.aiIsReceipt");
        return;
      }
      const extracted = analysis.document;
      if (!extracted) {
        setAiNotice("vault.aiUnclear");
        return;
      }
      setForm((current) => ({
        ...current,
        name: current.name || extracted.name || current.name,
        category:
          extracted.category && VAULT_CATEGORIES.includes(extracted.category) && current.category === "records"
            ? extracted.category
            : current.category,
        issueDate: current.issueDate || extracted.issueDate || "",
        expiryDate: current.expiryDate || extracted.expiryDate || "",
        renewalDate: current.renewalDate || extracted.renewalDate || "",
        notes: current.notes || extracted.summary || "",
      }));
      setAiNotice(extracted.confidence < 0.6 ? "review.lowConfidence" : "vault.aiFilled");
    } catch (cause) {
      setError(cause);
    } finally {
      setReading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || !profile) return;
    if (!form.name.trim()) {
      setNameError("errors.required");
      return;
    }
    setNameError(null);
    for (const value of [form.issueDate, form.expiryDate, form.renewalDate]) {
      if (value && !isValidIsoDate(value)) {
        setError(new Error("invalid-date"));
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const documentId = await saveVaultDocument({
        uid: user.uid,
        id: id ?? undefined,
        createdAt: existing.item?.createdAt ?? null,
        values: {
          name: form.name.trim(),
          category: form.category,
          issueDate: form.issueDate || null,
          expiryDate: form.expiryDate || null,
          renewalDate: form.renewalDate || null,
          notes: form.notes.trim(),
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 20),
          attachments: form.attachments,
          reminderOffsets: sanitizeOffsets(form.offsets),
          important: form.important,
          source: form.source,
          receiptId: form.receiptId,
        },
        schedule: {
          timeZone: profile.timeZone,
          reminderHour: profile.notificationPrefs.reminderHour,
          now: new Date(),
        },
      });
      await Promise.all(removedPaths.current.map((path) => deleteFile(path)));
      removedPaths.current = [];
      toast(t("vault.saved"));
      router.replace(`/vault/view/?id=${documentId}`);
    } catch (cause) {
      setError(cause);
      setSaving(false);
    }
  }

  if (id && existing.loading && !ready) return <Spinner label={t("common.loading")} />;
  if (missing) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted">{t("errors.notFound")}</p>
        <Link href="/vault/" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
          {t("vault.title")}
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader
        title={id ? t("vault.editTitle") : t("vault.newTitle")}
        back={{ href: id ? `/vault/view/?id=${id}` : "/vault/" }}
        action={
          <Button type="submit" form="vault-form" loading={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        }
      />

      {form.receiptId && (
        <p className="mb-4 text-xs text-muted">
          {t("vault.fromReceipt")} ·{" "}
          <Link href={`/receipts/view/?id=${form.receiptId}`} className="font-medium text-brand hover:underline">
            {t("vault.viewReceipt")}
          </Link>
        </p>
      )}

      <form id="vault-form" onSubmit={submit} className="space-y-4">
        <Card className="space-y-4 p-5">
          <Field
            label={t("vault.name")}
            htmlFor="vault-name"
            required
            error={nameError ? t(nameError) : undefined}
          >
            <Input
              id="vault-name"
              value={form.name}
              onChange={(event) => {
                setNameError(null);
                patch({ name: event.target.value });
              }}
              maxLength={200}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("vault.category")} htmlFor="vault-category">
              <Select
                id="vault-category"
                value={form.category}
                onChange={(event) => patch({ category: event.target.value as VaultCategory })}
              >
                {VAULT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {t(`cat.${item}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("vault.issueDate")} htmlFor="vault-issued">
              <Input
                id="vault-issued"
                type="date"
                value={form.issueDate}
                onChange={(event) => patch({ issueDate: event.target.value })}
              />
            </Field>
            <Field label={t("vault.expiryDate")} htmlFor="vault-expiry">
              <Input
                id="vault-expiry"
                type="date"
                value={form.expiryDate}
                onChange={(event) => patch({ expiryDate: event.target.value })}
              />
            </Field>
            <Field label={t("vault.renewalDate")} htmlFor="vault-renewal">
              <Input
                id="vault-renewal"
                type="date"
                value={form.renewalDate}
                onChange={(event) => patch({ renewalDate: event.target.value })}
              />
            </Field>
          </div>

          <Field label={t("vault.notes")} htmlFor="vault-notes">
            <Textarea
              id="vault-notes"
              value={form.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              maxLength={5000}
            />
          </Field>

          <Field label={t("vault.tags")} hint={t("vault.tagsHint")} htmlFor="vault-tags">
            <Input
              id="vault-tags"
              value={form.tags}
              onChange={(event) => patch({ tags: event.target.value })}
            />
          </Field>

          <Toggle
            checked={form.important}
            onChange={(value) => patch({ important: value })}
            label={t("vault.important")}
          />
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t("vault.attachments")}</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={readWithAi}
              loading={reading}
              disabled={!form.attachments.length || !profile?.aiAnalysisEnabled}
            >
              <Sparkles aria-hidden className="size-4" />
              {reading ? t("vault.reading") : t("vault.readWithAi")}
            </Button>
          </div>

          {aiNotice && <p className="text-xs font-medium text-brand">{t(aiNotice)}</p>}
          {!profile?.aiAnalysisEnabled && <p className="text-xs text-muted">{t("errors.aiDisabled")}</p>}

          {form.attachments.length > 0 && (
            <ul className="space-y-2">
              {form.attachments.map((attachment) => (
                <li
                  key={attachment.path}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2"
                >
                  <Paperclip aria-hidden className="size-4 shrink-0 text-muted" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-start text-sm hover:underline"
                    onClick={async () => {
                      try {
                        window.open(await fileUrl(attachment.path), "_blank", "noopener");
                      } catch {
                        setError(new Error("file-not-found"));
                      }
                    }}
                  >
                    {attachment.name}
                  </button>
                  <button
                    type="button"
                    aria-label={t("common.remove")}
                    className="rounded-lg p-1 text-muted hover:bg-surface hover:text-danger"
                    onClick={() => removeAttachment(attachment)}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {uploadProgress !== null && (
            <div className="space-y-1">
              <ProgressBar value={uploadProgress} />
              <p className="text-xs text-muted">{t("vault.uploading", { p: Math.round(uploadProgress) })}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              <FilePlus2 aria-hidden className="size-4" />
              {t("vault.addFile")}
            </Button>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface-2">
              <Camera aria-hidden className="size-4" />
              {t("upload.camera")}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={onFile}
              />
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={onFile}
            />
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-base font-semibold">{t("vault.reminders")}</h2>
          <p className="text-xs text-muted">{t("vault.remindersHint")}</p>
          <div className="flex flex-wrap gap-2">
            {sanitizeOffsets([...form.offsets, ...DEFAULT_REMINDER_OFFSETS])
              .filter((offset) => offset > 0)
              .map((offset) => {
                const active = form.offsets.includes(offset);
                return (
                  <button
                    key={offset}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      patch({
                        offsets: active
                          ? form.offsets.filter((value) => value !== offset)
                          : [...form.offsets, offset],
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-line text-muted hover:border-brand/40",
                    )}
                  >
                    {t("common.days", { n: offset })}
                  </button>
                );
              })}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("vault.customDays")} htmlFor="vault-custom-days" className="w-40">
              <Input
                id="vault-custom-days"
                type="number"
                min={1}
                max={3650}
                inputMode="numeric"
                value={customDays}
                onChange={(event) => setCustomDays(event.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const value = Number(customDays);
                if (Number.isInteger(value) && value > 0 && value <= 3650) {
                  patch({ offsets: sanitizeOffsets([...form.offsets, value]) });
                  setCustomDays("");
                }
              }}
            >
              {t("common.add")}
            </Button>
          </div>
        </Card>

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t(errorKey(error))}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pb-2">
          <Link href={id ? `/vault/view/?id=${id}` : "/vault/"}>
            <Button variant="secondary" type="button">
              {t("common.cancel")}
            </Button>
          </Link>
          <Button type="submit" loading={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
