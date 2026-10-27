"use client";

import { useState } from "react";
import { Check, Paperclip, Plus, Sparkles, TriangleAlert, X } from "lucide-react";
import {
  LOW_CONFIDENCE,
  emptyDraftItem,
  validateDraft,
  type DraftErrors,
  type DraftItem,
  type ReceiptDraft,
} from "@/lib/domain/receipts";
import { errorKey } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { PURCHASE_CATEGORIES, type Attachment, type ReceiptExtraction } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  SectionTitle,
  Select,
  Textarea,
  Toggle,
  cn,
} from "@/components/ui";

interface ReceiptReviewProps {
  initial: ReceiptDraft;
  extraction: ReceiptExtraction | null;
  file: Attachment | null;
  onSave: (draft: ReceiptDraft) => Promise<void>;
  onBack?: () => void;
  backLabel?: string;
}

export function ReceiptReview({ initial, extraction, file, onSave, onBack, backLabel }: ReceiptReviewProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<ReceiptDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const fieldWarning = (field: keyof ReceiptExtraction["fieldConfidence"]) =>
    extraction && extraction.fieldConfidence[field] < LOW_CONFIDENCE ? t("review.unsure") : undefined;

  function clear(paths: string[]) {
    setErrors((current) => {
      if (!paths.some((path) => current[path])) return current;
      const next = { ...current };
      paths.forEach((path) => delete next[path]);
      return next;
    });
  }

  function change<K extends keyof ReceiptDraft>(key: K, value: ReceiptDraft[K], paths: string[] = [key]) {
    setDraft({ ...draft, [key]: value });
    clear(paths);
  }

  function changeItem(index: number, patch: Partial<DraftItem>, paths: string[]) {
    setDraft({
      ...draft,
      items: draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
    clear(paths);
  }

  function removeItem(index: number) {
    if (draft.items.length === 1) return;
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) });
    setErrors({});
  }

  const purchaseCount = draft.items.filter(
    (item) => item.name.trim() && item.totalPrice.trim(),
  ).length;
  const warrantyCount = draft.items.filter((item) => {
    const months = Number(item.warrantyMonths);
    return item.name.trim() && item.trackWarranty && Number.isInteger(months) && months > 0 && months <= 240;
  }).length;
  const returnReminder = Boolean(draft.returnDeadline && draft.createReturnReminder);
  const errorCount = Object.keys(errors).length;

  async function submit() {
    const next = validateDraft(draft);
    setErrors(next);
    setSaveError(null);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await onSave(draft);
    } catch (cause) {
      setSaveError(cause);
      setSaving(false);
    }
  }

  const errorText = (path: string) => {
    const key = errors[path];
    return key ? t(key as MessageKey) : undefined;
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle
          title={t("review.title")}
          action={
            extraction ? (
              <Badge tone={extraction.confidence < LOW_CONFIDENCE ? "warn" : "ok"}>
                <Sparkles aria-hidden className="size-3" />
                {t("review.aiConfidence", { p: Math.round(extraction.confidence * 100) })}
              </Badge>
            ) : file ? (
              <Badge tone="neutral">
                <Paperclip aria-hidden className="size-3" />
                {file.name}
              </Badge>
            ) : undefined
          }
        />

        {extraction && extraction.confidence < LOW_CONFIDENCE && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn-soft px-3 py-2 text-xs font-medium text-warn"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{t("review.lowConfidence")}</span>
          </div>
        )}

        {extraction && extraction.warnings.length > 0 && (
          <div className="mt-3 rounded-xl border border-info/40 bg-info-soft px-3 py-2 text-xs text-info">
            <p className="font-medium">{t("review.warnings")}</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-4">
              {extraction.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label={t("review.store")}
            htmlFor="receipt-store"
            required
            error={errorText("store")}
            warning={fieldWarning("store")}
          >
            <Input
              id="receipt-store"
              value={draft.store}
              maxLength={200}
              autoComplete="organization"
              onChange={(event) => change("store", event.target.value)}
            />
          </Field>

          <Field
            label={t("review.date")}
            htmlFor="receipt-date"
            required
            error={errorText("purchaseDate")}
            warning={fieldWarning("purchaseDate")}
          >
            <Input
              id="receipt-date"
              type="date"
              value={draft.purchaseDate}
              onChange={(event) => change("purchaseDate", event.target.value)}
            />
          </Field>

          <Field
            label={t("review.currency")}
            htmlFor="receipt-currency"
            required
            error={errorText("currency")}
          >
            <Input
              id="receipt-currency"
              value={draft.currency}
              maxLength={3}
              autoCapitalize="characters"
              onChange={(event) => change("currency", event.target.value.toUpperCase())}
            />
          </Field>

          <Field label={t("review.payment")} htmlFor="receipt-payment">
            <Input
              id="receipt-payment"
              value={draft.paymentMethod}
              maxLength={100}
              onChange={(event) => change("paymentMethod", event.target.value)}
            />
          </Field>

          <Field label={t("review.subtotal")} htmlFor="receipt-subtotal" error={errorText("subtotal")}>
            <Input
              id="receipt-subtotal"
              inputMode="decimal"
              value={draft.subtotal}
              onChange={(event) => change("subtotal", event.target.value)}
            />
          </Field>

          <Field label={t("review.tax")} htmlFor="receipt-tax" error={errorText("tax")}>
            <Input
              id="receipt-tax"
              inputMode="decimal"
              value={draft.tax}
              onChange={(event) => change("tax", event.target.value)}
            />
          </Field>

          <Field
            label={t("review.total")}
            htmlFor="receipt-total"
            required
            error={errorText("total")}
            warning={fieldWarning("total")}
          >
            <Input
              id="receipt-total"
              inputMode="decimal"
              value={draft.total}
              onChange={(event) => change("total", event.target.value)}
            />
          </Field>

          <Field
            label={t("review.returnDeadline")}
            htmlFor="receipt-return"
            error={errorText("returnDeadline")}
            warning={fieldWarning("returnDeadline")}
          >
            <Input
              id="receipt-return"
              type="date"
              value={draft.returnDeadline}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  returnDeadline: event.target.value,
                  createReturnReminder: event.target.value ? true : false,
                })
              }
            />
          </Field>
        </div>

        <div className="mt-2 border-t border-line">
          <Toggle
            checked={draft.createReturnReminder}
            onChange={(value) => change("createReturnReminder", value)}
            label={t("review.returnReminder")}
            disabled={!draft.returnDeadline}
          />
        </div>

        <div className="mt-4">
          <SectionTitle title={t("review.items")} />
          <ul className="space-y-3">
            {draft.items.map((item, index) => (
              <li key={index} className="rounded-xl border border-line p-3">
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    <Field
                      label={t("review.itemName")}
                      htmlFor={`item-name-${index}`}
                      error={errorText(`items.${index}.name`)}
                      className="sm:col-span-2"
                    >
                      <Input
                        id={`item-name-${index}`}
                        value={item.name}
                        maxLength={200}
                        onChange={(event) =>
                          changeItem(index, { name: event.target.value }, [`items.${index}.name`])
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                      <Field label={t("review.qty")} htmlFor={`item-qty-${index}`} error={errorText(`items.${index}.quantity`)}>
                        <Input
                          id={`item-qty-${index}`}
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(event) =>
                            changeItem(index, { quantity: event.target.value }, [
                              `items.${index}.quantity`,
                            ])
                          }
                        />
                      </Field>
                      <Field label={t("review.unitPrice")} htmlFor={`item-unit-${index}`} error={errorText(`items.${index}.unitPrice`)}>
                        <Input
                          id={`item-unit-${index}`}
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(event) =>
                            changeItem(index, { unitPrice: event.target.value }, [
                              `items.${index}.unitPrice`,
                            ])
                          }
                        />
                      </Field>
                      <Field label={t("review.lineTotal")} htmlFor={`item-total-${index}`} error={errorText(`items.${index}.totalPrice`)}>
                        <Input
                          id={`item-total-${index}`}
                          inputMode="decimal"
                          value={item.totalPrice}
                          onChange={(event) =>
                            changeItem(index, { totalPrice: event.target.value }, [
                              `items.${index}.totalPrice`,
                            ])
                          }
                        />
                      </Field>
                    </div>

                    <Field label={t("review.category")} htmlFor={`item-category-${index}`}>
                      <Select
                        id={`item-category-${index}`}
                        value={item.category}
                        onChange={(event) =>
                          changeItem(index, {
                            category: event.target.value as DraftItem["category"],
                          }, [])
                        }
                      >
                        {PURCHASE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {t(`pcat.${category}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <IconButton
                    label={t("common.remove")}
                    disabled={draft.items.length === 1}
                    onClick={() => removeItem(index)}
                  >
                    <X aria-hidden className="size-4" />
                  </IconButton>
                </div>

                <Toggle
                  checked={item.trackWarranty}
                  onChange={(value) =>
                    changeItem(index, { trackWarranty: value }, [])
                  }
                  label={t("review.trackWarranty")}
                />
                {item.trackWarranty && (
                  <Field
                    label={t("review.warrantyMonths")}
                    htmlFor={`item-warranty-${index}`}
                    error={errorText(`items.${index}.warrantyMonths`)}
                    className="mt-2 max-w-40"
                  >
                    <Input
                      id={`item-warranty-${index}`}
                      type="number"
                      min={1}
                      max={240}
                      inputMode="numeric"
                      value={item.warrantyMonths}
                      onChange={(event) =>
                        changeItem(index, { warrantyMonths: event.target.value }, [
                          `items.${index}.warrantyMonths`,
                        ])
                      }
                    />
                  </Field>
                )}
              </li>
            ))}
          </ul>

          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setDraft({ ...draft, items: [...draft.items, emptyDraftItem()] })}
          >
            <Plus aria-hidden className="size-4" />
            {t("review.addItem")}
          </Button>
        </div>

        <Field label={t("review.notes")} htmlFor="receipt-notes" className="mt-4">
          <Textarea
            id="receipt-notes"
            value={draft.notes}
            maxLength={5000}
            onChange={(event) => change("notes", event.target.value)}
          />
        </Field>

        <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("review.saveTo")}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <Check aria-hidden className="size-4 text-ok" />
              {t("review.saveReceipt")}
            </li>
            {purchaseCount > 0 && (
              <li className="flex items-center gap-2">
                <Check aria-hidden className="size-4 text-ok" />
                {t("review.savePurchases", { n: purchaseCount })}
              </li>
            )}
            {warrantyCount > 0 && (
              <li className="flex items-center gap-2">
                <Check aria-hidden className="size-4 text-ok" />
                {t("review.saveWarranties", { n: warrantyCount })}
              </li>
            )}
            {returnReminder && (
              <li className="flex items-center gap-2">
                <Check aria-hidden className="size-4 text-ok" />
                {t("review.saveReturn")}
              </li>
            )}
          </ul>
        </div>

        {errorCount > 0 && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {t("review.fixErrors")}
          </p>
        )}

        {saveError ? (
          <p role="alert" className="mt-3 rounded-xl border border-danger/40 bg-danger-soft/40 px-3 py-2 text-sm text-danger">
            {t(errorKey(saveError))}
          </p>
        ) : null}

        <div className={cn("mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4")}>
          {onBack && (
            <Button variant="secondary" onClick={onBack} disabled={saving}>
              {backLabel ?? t("common.back")}
            </Button>
          )}
          <Button onClick={() => void submit()} loading={saving}>
            <Check aria-hidden className="size-4" />
            {t("review.confirmAll")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
