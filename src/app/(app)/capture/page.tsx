"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FileUp,
  Mic,
  MicOff,
  Paperclip,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { analyzeCapture } from "@/lib/data/ai";
import { deleteFile, uploadFile, validateFile } from "@/lib/data/storage";
import { saveReceipt, saveVaultDocument } from "@/lib/data/writes";
import { isValidIsoDate } from "@/lib/domain/dates";
import { defaultCurrencyFor } from "@/lib/domain/money";
import {
  LOW_CONFIDENCE,
  draftFromExtraction,
  emptyDraft,
  type ReceiptDraft,
} from "@/lib/domain/receipts";
import { errorKey } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { PageHeader } from "@/components/page";
import { ReceiptReview } from "@/components/receipt-review";
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  ProgressBar,
  SectionTitle,
  Select,
  Textarea,
  Toggle,
  useToast,
} from "@/components/ui";
import {
  DEFAULT_REMINDER_OFFSETS,
  VAULT_CATEGORIES,
  type Attachment,
  type CaptureAnalysis,
  type VaultCategory,
} from "@/lib/types";

interface DocDraft {
  name: string;
  category: VaultCategory;
  issueDate: string;
  expiryDate: string;
  renewalDate: string;
  notes: string;
  important: boolean;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function makeRecognition(): Recognition | null {
  const scope = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function CapturePage() {
  const { user, profile } = useAuth();
  const { t, language } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CaptureAnalysis | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [decision, setDecision] = useState<"receipt" | "document" | null>(null);
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft | null>(null);
  const [docDraft, setDocDraft] = useState<DocDraft | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [savingDoc, setSavingDoc] = useState(false);
  const [docError, setDocError] = useState<unknown>(null);
  const [listening, setListening] = useState(false);

  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    return () => {
      recognition.current?.stop();
    };
  }, []);

  if (!user || !profile) return null;

  const uid = user.uid;
  const currency = defaultCurrencyFor(profile.country);
  const reminderHour = profile.notificationPrefs.reminderHour;
  const timeZone = profile.timeZone;

  const schedule = { timeZone, reminderHour, now: new Date() };
  const canAnalyze = Boolean(attachment || text.trim()) && progress === null && !analyzing;

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
      const uploaded = await uploadFile(uid, "captures", selected, setProgress);
      setAttachment(uploaded);
      setAnalysis(null);
      setProgress(null);
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

  async function removeAttachment() {
    if (progress !== null) return;
    if (attachment) await deleteFile(attachment.path);
    setAttachment(null);
    setAnalysis(null);
    setError(null);
  }

  function dictate() {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }

    const rec = makeRecognition();
    if (!rec) {
      toast(t("capture.voiceUnsupported"), "danger");
      return;
    }

    rec.lang = language === "ur" ? "ur-PK" : "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
      }
      if (final.trim()) {
        setText((current) => `${current ? `${current} ` : ""}${final.trim()}`);
        setAnalysis(null);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    rec.start();
  }

  async function runAnalysis() {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeCapture({
        storagePath: attachment?.path,
        text: text.trim() || undefined,
      });
      setAnalysis(result);
    } catch (cause) {
      setError(cause);
    } finally {
      setAnalyzing(false);
    }
  }

  function beginReceipt() {
    const extraction = analysis?.receipt ?? null;
    setReceiptDraft(extraction ? draftFromExtraction(extraction, currency) : emptyDraft(currency));
    setDocDraft(null);
    setDecision("receipt");
  }

  function beginDocument() {
    const doc = analysis?.document ?? null;
    const fallback =
      analysis?.summary.trim().slice(0, 120) ||
      text.trim().split("\n")[0]?.slice(0, 120) ||
      t("capture.title");
    setDocDraft({
      name: doc?.name ?? fallback,
      category: doc?.category ?? "records",
      issueDate: doc?.issueDate ?? "",
      expiryDate: doc?.expiryDate ?? "",
      renewalDate: doc?.renewalDate ?? "",
      notes: doc?.summary ?? text.trim(),
      important: false,
    });
    setDocErrors({});
    setDocError(null);
    setReceiptDraft(null);
    setDecision("document");
  }

  async function startOver() {
    recognition.current?.stop();
    setListening(false);
    if (attachment) await deleteFile(attachment.path);
    setAttachment(null);
    setText("");
    setAnalysis(null);
    setError(null);
    setDecision(null);
    setReceiptDraft(null);
    setDocDraft(null);
    setDocError(null);
    setDocErrors({});
  }

  async function saveReceiptFromCapture(draft: ReceiptDraft) {
    const extraction = analysis?.receipt;
    const saved = await saveReceipt({
      uid,
      draft,
      file: attachment,
      extraction: extraction
        ? {
            model: extraction.model,
            confidence: extraction.confidence,
            warnings: extraction.warnings,
          }
        : null,
      schedule,
    });
    toast(t("receipts.saved"));
    router.push(`/receipts/view/?id=${saved.receiptId}`);
  }

  async function saveDocument() {
    if (!docDraft) return;
    const next: Record<string, string> = {};
    if (!docDraft.name.trim()) next.name = "errors.required";
    for (const field of ["issueDate", "expiryDate", "renewalDate"] as const) {
      const value = docDraft[field];
      if (value && !isValidIsoDate(value)) next[field] = "errors.invalidDate";
    }
    setDocErrors(next);
    if (Object.keys(next).length > 0) return;

    setSavingDoc(true);
    setDocError(null);
    try {
      const documentId = await saveVaultDocument({
        uid,
        values: {
          name: docDraft.name.trim().slice(0, 200),
          category: docDraft.category,
          issueDate: docDraft.issueDate || null,
          expiryDate: docDraft.expiryDate || null,
          renewalDate: docDraft.renewalDate || null,
          notes: docDraft.notes.trim(),
          tags: [],
          attachments: attachment ? [attachment] : [],
          reminderOffsets: [...DEFAULT_REMINDER_OFFSETS],
          important: docDraft.important,
          source: "capture",
          receiptId: null,
        },
        schedule,
      });
      toast(t("vault.saved"));
      router.push(`/vault/view/?id=${documentId}`);
    } catch (cause) {
      setDocError(cause);
      setSavingDoc(false);
    }
  }

  const warnings = analysis?.receipt?.warnings ?? analysis?.document?.warnings ?? [];
  const lowConfidence = Boolean(analysis && analysis.confidence < LOW_CONFIDENCE);
  const docErrorText = (field: string) => {
    const key = docErrors[field];
    return key ? t(key as MessageKey) : undefined;
  };

  if (decision === "receipt" && receiptDraft) {
    return (
      <div className="animate-fade">
        <PageHeader title={t("capture.title")} />
        <ReceiptReview
          initial={receiptDraft}
          extraction={analysis?.receipt ?? null}
          file={attachment}
          onSave={saveReceiptFromCapture}
          onBack={() => {
            setDecision(null);
            setReceiptDraft(null);
          }}
        />
      </div>
    );
  }

  if (decision === "document" && docDraft) {
    return (
      <div className="animate-fade">
        <PageHeader title={t("capture.saveAsDocument")} />
        <Card className="p-5">
          {analysis?.summary && <p className="mb-3 text-sm text-muted">{analysis.summary}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vault.name")}
              htmlFor="capture-name"
              required
              error={docErrorText("name")}
              className="sm:col-span-2"
            >
              <Input
                id="capture-name"
                value={docDraft.name}
                maxLength={200}
                onChange={(event) => {
                  setDocDraft({ ...docDraft, name: event.target.value });
                  setDocErrors((current) => ({ ...current, name: "" }));
                }}
              />
            </Field>

            <Field label={t("vault.category")} htmlFor="capture-category">
              <Select
                id="capture-category"
                value={docDraft.category}
                onChange={(event) =>
                  setDocDraft({ ...docDraft, category: event.target.value as VaultCategory })
                }
              >
                {VAULT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`cat.${category}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t("vault.issueDate")} htmlFor="capture-issue" error={docErrorText("issueDate")}>
              <Input
                id="capture-issue"
                type="date"
                value={docDraft.issueDate}
                onChange={(event) => {
                  setDocDraft({ ...docDraft, issueDate: event.target.value });
                  setDocErrors((current) => ({ ...current, issueDate: "" }));
                }}
              />
            </Field>

            <Field label={t("vault.expiryDate")} htmlFor="capture-expiry" error={docErrorText("expiryDate")}>
              <Input
                id="capture-expiry"
                type="date"
                value={docDraft.expiryDate}
                onChange={(event) => {
                  setDocDraft({ ...docDraft, expiryDate: event.target.value });
                  setDocErrors((current) => ({ ...current, expiryDate: "" }));
                }}
              />
            </Field>

            <Field label={t("vault.renewalDate")} htmlFor="capture-renewal" error={docErrorText("renewalDate")}>
              <Input
                id="capture-renewal"
                type="date"
                value={docDraft.renewalDate}
                onChange={(event) => {
                  setDocDraft({ ...docDraft, renewalDate: event.target.value });
                  setDocErrors((current) => ({ ...current, renewalDate: "" }));
                }}
              />
            </Field>
          </div>

          <Field label={t("vault.notes")} htmlFor="capture-notes" className="mt-4">
            <Textarea
              id="capture-notes"
              value={docDraft.notes}
              maxLength={5000}
              onChange={(event) => setDocDraft({ ...docDraft, notes: event.target.value })}
            />
          </Field>

          <div className="mt-2 border-t border-line">
            <Toggle
              checked={docDraft.important}
              onChange={(value) => setDocDraft({ ...docDraft, important: value })}
              label={t("vault.important")}
            />
          </div>

          {attachment && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
              <Paperclip aria-hidden className="size-3.5" />
              {attachment.name}
            </p>
          )}

          {docError ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {t(errorKey(docError))}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setDecision(null);
                setDocDraft(null);
              }}
              disabled={savingDoc}
            >
              {t("common.back")}
            </Button>
            <Button onClick={() => void saveDocument()} loading={savingDoc}>
              {t("common.save")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const kind = analysis?.kind ?? "unknown";
  const primaryIsDocument = kind !== "receipt";

  return (
    <div className="animate-fade">
      <PageHeader title={t("capture.title")} subtitle={t("capture.subtitle")} />

      <div className="space-y-4">
        <Card className="p-5">
          <div className="rounded-2xl border-2 border-dashed border-line p-4">
            {progress !== null ? (
              <div className="mx-auto max-w-xs space-y-2">
                <p className="text-sm font-medium">{t("vault.uploading", { p: Math.round(progress) })}</p>
                <ProgressBar value={progress} />
              </div>
            ) : attachment ? (
              <div className="flex items-center gap-2">
                <Paperclip aria-hidden className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
                <IconButton
                  label={t("common.remove")}
                  onClick={() => void removeAttachment()}
                  disabled={analyzing}
                >
                  <X aria-hidden className="size-4" />
                </IconButton>
              </div>
            ) : (
              <div className="text-center">
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => cameraInput.current?.click()} disabled={analyzing}>
                    <Camera aria-hidden className="size-4" />
                    {t("capture.photo")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => fileInput.current?.click()}
                    disabled={analyzing}
                  >
                    <FileUp aria-hidden className="size-4" />
                    {t("capture.upload")}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted">{t("upload.dropHint")}</p>
              </div>
            )}
          </div>

          <Field label={t("capture.text")} htmlFor="capture-text" className="mt-4">
            <Textarea
              id="capture-text"
              value={text}
              placeholder={t("capture.textPlaceholder")}
              onChange={(event) => {
                setText(event.target.value);
                if (analysis) setAnalysis(null);
                if (error) setError(null);
              }}
              disabled={analyzing}
            />
          </Field>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={dictate}
              aria-pressed={listening}
              disabled={analyzing}
            >
              {listening ? (
                <MicOff aria-hidden className="size-4" />
              ) : (
                <Mic aria-hidden className="size-4" />
              )}
              {listening ? t("capture.listening") : t("capture.dictate")}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
            {(attachment || text) && (
              <Button variant="ghost" onClick={() => void startOver()} disabled={analyzing}>
                {t("capture.startOver")}
              </Button>
            )}
            <Button onClick={() => void runAnalysis()} loading={analyzing} disabled={!canAnalyze}>
              {!analyzing && <Sparkles aria-hidden className="size-4" />}
              {t("capture.analyze")}
            </Button>
          </div>
        </Card>

        {error ? (
          <Card className="border-danger/40 p-4">
            <div role="alert" className="flex items-start gap-2 text-sm text-danger">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">{t(errorKey(error))}</span>
              <Button size="sm" variant="secondary" onClick={() => void runAnalysis()} disabled={!canAnalyze}>
                {t("common.retry")}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">{t("capture.manualChoice")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={beginDocument} disabled={!attachment && !text.trim()}>
                {t("capture.saveAsDocument")}
              </Button>
              <Button size="sm" variant="secondary" onClick={beginReceipt} disabled={!attachment && !text.trim()}>
                {t("capture.saveAsReceipt")}
              </Button>
            </div>
          </Card>
        ) : null}

        {analysis ? (
          <Card className="p-5">
            <SectionTitle
              title={t("capture.found")}
              action={<Badge tone="brand">{t(`capture.kind.${analysis.kind}` as MessageKey)}</Badge>}
            />
            {analysis.summary && <p className="text-sm">{analysis.summary}</p>}
            <p className="mt-2 text-xs text-muted">
              {t("review.aiConfidence", { p: Math.round(analysis.confidence * 100) })}
            </p>

            {lowConfidence && (
              <div
                role="status"
                className="mt-3 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn-soft px-3 py-2 text-xs font-medium text-warn"
              >
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{t("review.lowConfidence")}</span>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-3 rounded-xl border border-info/40 bg-info-soft px-3 py-2 text-xs text-info">
                <p className="font-medium">{t("review.warnings")}</p>
                <ul className="mt-1 list-disc space-y-0.5 ps-4">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {kind === "unknown" && (
              <p className="mt-3 text-sm font-medium">{t("capture.manualChoice")}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              {kind !== "receipt" && (
                <Button variant={primaryIsDocument ? "primary" : "secondary"} onClick={beginDocument}>
                  {t("capture.saveAsDocument")}
                </Button>
              )}
              {kind !== "note" && (
                <Button variant={primaryIsDocument ? "secondary" : "primary"} onClick={beginReceipt}>
                  {t("capture.saveAsReceipt")}
                </Button>
              )}
              <Button variant="ghost" onClick={() => void startOver()}>
                {t("capture.startOver")}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={t("capture.photo")}
        onChange={onFileInput}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label={t("capture.upload")}
        onChange={onFileInput}
      />
    </div>
  );
}
