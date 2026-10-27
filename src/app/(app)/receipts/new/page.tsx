"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp, PencilLine } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { extractReceipt } from "@/lib/data/ai";
import { deleteFile, uploadFile, validateFile } from "@/lib/data/storage";
import { saveReceipt } from "@/lib/data/writes";
import { defaultCurrencyFor } from "@/lib/domain/money";
import { draftFromExtraction, emptyDraft, type ReceiptDraft } from "@/lib/domain/receipts";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page";
import { ReceiptReview } from "@/components/receipt-review";
import {
  Button,
  Card,
  ProgressBar,
  SectionTitle,
  Spinner,
  useToast,
} from "@/components/ui";
import type { Attachment, ReceiptExtraction } from "@/lib/types";

export default function NewReceiptPage() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [file, setFile] = useState<Attachment | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!user || !profile) return null;

  const uid = user.uid;
  const currency = defaultCurrencyFor(profile.country);
  const reminderHour = profile.notificationPrefs.reminderHour;
  const timeZone = profile.timeZone;

  async function analyze(path: string) {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await extractReceipt(path);
      setExtraction(result);
      setDraft(draftFromExtraction(result, currency));
    } catch (cause) {
      setError(cause);
      setDraft((current) => current ?? emptyDraft(currency));
      setExtraction(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function pick(selected: File) {
    try {
      validateFile(selected);
    } catch (cause) {
      setError(cause);
      return;
    }

    setError(null);
    setProgress(0);
    try {
      const attachment = await uploadFile(uid, "receipts", selected, setProgress);
      setFile(attachment);
      setProgress(null);
      await analyze(attachment.path);
    } catch (cause) {
      setError(cause);
      setProgress(null);
    }
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (selected) void pick(selected);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const selected = event.dataTransfer.files?.[0];
    if (selected) void pick(selected);
  }

  function startManual() {
    setError(null);
    setExtraction(null);
    setDraft(emptyDraft(currency));
  }

  async function startOver() {
    if (file) await deleteFile(file.path);
    setFile(null);
    setDraft(null);
    setExtraction(null);
    setError(null);
    setAnalyzing(false);
  }

  async function save(value: ReceiptDraft) {
    const saved = await saveReceipt({
      uid,
      draft: value,
      file,
      extraction: extraction
        ? {
            model: extraction.model,
            confidence: extraction.confidence,
            warnings: extraction.warnings,
          }
        : null,
      schedule: {
        timeZone,
        reminderHour,
        now: new Date(),
      },
    });
    toast(t("receipts.saved"));
    router.push(`/receipts/view/?id=${saved.receiptId}`);
  }

  return (
    <div className="animate-fade">
      <PageHeader
        title={t("receipts.scan")}
        subtitle={t("receipts.subtitle")}
        back={{ href: "/receipts/" }}
      />

      {draft ? (
        <>
          {error ? (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger-soft/40 px-3 py-2 text-sm text-danger"
            >
              <span className="flex-1">{t(errorKey(error))}</span>
              {file && (
                <Button size="sm" variant="secondary" onClick={() => void analyze(file.path)}>
                  {t("common.retry")}
                </Button>
              )}
            </div>
          ) : null}

          <ReceiptReview
            initial={draft}
            extraction={extraction}
            file={file}
            onSave={save}
            onBack={() => void startOver()}
            backLabel={t("capture.startOver")}
          />
        </>
      ) : (
        <Card className="p-5">
          <SectionTitle title={t("upload.title")} />
          <p className="text-sm text-muted">{t("upload.body")}</p>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            className="mt-4 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center"
          >
            {progress !== null ? (
              <div className="mx-auto max-w-xs space-y-2">
                <p className="text-sm font-medium">{t("vault.uploading", { p: Math.round(progress) })}</p>
                <ProgressBar value={progress} />
              </div>
            ) : analyzing ? (
              <Spinner label={t("upload.analyzing")} />
            ) : (
              <>
                <p className="text-sm font-medium">{t("upload.body")}</p>
                <p className="mt-1 text-xs text-muted">{t("upload.dropHint")}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => cameraInput.current?.click()}>
                    <Camera aria-hidden className="size-4" />
                    {t("upload.camera")}
                  </Button>
                  <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                    <FileUp aria-hidden className="size-4" />
                    {t("upload.file")}
                  </Button>
                  <Button variant="ghost" onClick={startManual}>
                    <PencilLine aria-hidden className="size-4" />
                    {t("upload.manual")}
                  </Button>
                </div>
              </>
            )}
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger-soft/40 px-3 py-2 text-sm text-danger"
            >
              <span className="flex-1">{t(errorKey(error))}</span>
              {file && (
                <Button size="sm" variant="secondary" onClick={() => void analyze(file.path)}>
                  {t("common.retry")}
                </Button>
              )}
              {file && (
                <Button size="sm" variant="ghost" onClick={startManual}>
                  {t("upload.manual")}
                </Button>
              )}
            </div>
          ) : null}

          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label={t("upload.camera")}
            onChange={onFileInput}
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            aria-label={t("upload.file")}
            onChange={onFileInput}
          />
        </Card>
      )}
    </div>
  );
}
