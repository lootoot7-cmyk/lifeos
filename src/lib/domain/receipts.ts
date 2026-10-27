import { addMonths, isValidIsoDate } from "@/lib/domain/dates";
import {
  RETURN_REMINDER_OFFSETS,
  planReminders,
  planVaultReminders,
  type PlannedReminder,
  type ScheduleContext,
} from "@/lib/domain/reminders";
import {
  DEFAULT_REMINDER_OFFSETS,
  PURCHASE_CATEGORIES,
  type Attachment,
  type IsoDate,
  type PurchaseCategory,
  type ReceiptExtraction,
  type ReceiptExtractionMeta,
  type ReceiptItem,
} from "@/lib/types";

export interface DraftItem {
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  category: PurchaseCategory;
  trackWarranty: boolean;
  warrantyMonths: string;
}

export interface ReceiptDraft {
  store: string;
  purchaseDate: string;
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  paymentMethod: string;
  returnDeadline: string;
  notes: string;
  items: DraftItem[];
  createReturnReminder: boolean;
}

export const LOW_CONFIDENCE = 0.6;

const numToStr = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "" : String(n));

export function emptyDraftItem(): DraftItem {
  return {
    name: "",
    quantity: "1",
    unitPrice: "",
    totalPrice: "",
    category: "other",
    trackWarranty: false,
    warrantyMonths: "",
  };
}

export function emptyDraft(currency: string): ReceiptDraft {
  return {
    store: "",
    purchaseDate: "",
    currency,
    subtotal: "",
    tax: "",
    total: "",
    paymentMethod: "",
    returnDeadline: "",
    notes: "",
    items: [emptyDraftItem()],
    createReturnReminder: true,
  };
}

/** Prefills the review form. Low-confidence values are kept but flagged by the UI; nothing is invented. */
export function draftFromExtraction(x: ReceiptExtraction, fallbackCurrency: string): ReceiptDraft {
  return {
    store: x.store ?? "",
    purchaseDate: x.purchaseDate ?? "",
    currency: x.currency ?? fallbackCurrency,
    subtotal: numToStr(x.subtotal),
    tax: numToStr(x.tax),
    total: numToStr(x.total),
    paymentMethod: x.paymentMethod ?? "",
    returnDeadline: x.returnDeadline ?? "",
    notes: "",
    items:
      x.items.length > 0
        ? x.items.map((it) => ({
            name: it.name,
            quantity: numToStr(it.quantity) || "1",
            unitPrice: numToStr(it.unitPrice),
            totalPrice: numToStr(it.totalPrice),
            category: PURCHASE_CATEGORIES.includes(it.category) ? it.category : "other",
            trackWarranty: it.warrantyMonths != null && it.warrantyMonths > 0,
            warrantyMonths: numToStr(it.warrantyMonths),
          }))
        : [emptyDraftItem()],
    createReturnReminder: x.returnDeadline != null,
  };
}

function parseAmount(v: string): number | null {
  const trimmed = v.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

export type DraftErrors = Partial<Record<string, string>>;

/** Returns i18n error keys per field path; empty object means valid. */
export function validateDraft(d: ReceiptDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.store.trim()) e.store = "errors.required";
  if (!isValidIsoDate(d.purchaseDate)) e.purchaseDate = "errors.invalidDate";
  const total = parseAmount(d.total);
  if (total == null || Number.isNaN(total)) e.total = "errors.invalidAmount";
  if (!/^[A-Z]{3}$/.test(d.currency)) e.currency = "errors.invalidCurrency";
  for (const f of ["subtotal", "tax"] as const) {
    if (Number.isNaN(parseAmount(d[f]))) e[f] = "errors.invalidAmount";
  }
  if (d.returnDeadline && !isValidIsoDate(d.returnDeadline)) e.returnDeadline = "errors.invalidDate";
  d.items.forEach((it, i) => {
    if (!it.name.trim()) {
      if (it.totalPrice.trim() || it.unitPrice.trim()) e[`items.${i}.name`] = "errors.required";
      return;
    }
    const q = Number(it.quantity);
    if (!Number.isFinite(q) || q <= 0) e[`items.${i}.quantity`] = "errors.invalidAmount";
    if (Number.isNaN(parseAmount(it.unitPrice))) e[`items.${i}.unitPrice`] = "errors.invalidAmount";
    if (Number.isNaN(parseAmount(it.totalPrice))) e[`items.${i}.totalPrice`] = "errors.invalidAmount";
    if (it.trackWarranty) {
      const m = Number(it.warrantyMonths);
      if (!Number.isInteger(m) || m <= 0 || m > 240) e[`items.${i}.warrantyMonths`] = "errors.invalidMonths";
    }
  });
  return e;
}

export interface ReceiptRecordData {
  store: string;
  purchaseDate: IsoDate;
  currency: string;
  subtotal: number | null;
  tax: number | null;
  total: number;
  paymentMethod: string | null;
  items: ReceiptItem[];
  returnDeadline: IsoDate | null;
  file: Attachment | null;
  extraction: ReceiptExtractionMeta | null;
  notes: string;
}

export interface PurchaseRecordData {
  id: string;
  receiptId: string;
  name: string;
  category: PurchaseCategory;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number;
  currency: string;
  store: string;
  purchaseDate: IsoDate;
  warrantyDocumentId: string | null;
}

export interface WarrantyDocumentData {
  id: string;
  name: string;
  category: "warranties";
  issueDate: IsoDate;
  expiryDate: IsoDate;
  renewalDate: null;
  notes: string;
  tags: string[];
  attachments: Attachment[];
  reminderOffsets: number[];
  important: boolean;
  source: "receipt";
  receiptId: string;
}

export interface LinkedReceiptRecords {
  receiptId: string;
  receipt: ReceiptRecordData;
  purchases: PurchaseRecordData[];
  warranties: WarrantyDocumentData[];
  reminders: PlannedReminder[];
}

/** Turns a validated draft into every record the receipt touches: receipt, purchases, warranty vault entries and reminders. */
export function buildReceiptRecords(
  d: ReceiptDraft,
  opts: {
    newId: () => string;
    file: Attachment | null;
    extraction: ReceiptExtractionMeta | null;
    schedule: ScheduleContext;
  },
): LinkedReceiptRecords {
  const receiptId = opts.newId();
  const store = d.store.trim();
  const purchaseDate = d.purchaseDate as IsoDate;
  const items = d.items
    .filter((it) => it.name.trim())
    .map((it) => {
      const quantity = Number(it.quantity) || 1;
      const unitPrice = parseAmount(it.unitPrice);
      const totalPrice = parseAmount(it.totalPrice) ?? (unitPrice != null ? Math.round(unitPrice * quantity * 100) / 100 : null);
      return { draft: it, item: { name: it.name.trim(), quantity, unitPrice, totalPrice, category: it.category } satisfies ReceiptItem };
    });

  const returnDeadline = d.returnDeadline ? (d.returnDeadline as IsoDate) : null;
  const receipt: ReceiptRecordData = {
    store,
    purchaseDate,
    currency: d.currency,
    subtotal: parseAmount(d.subtotal),
    tax: parseAmount(d.tax),
    total: parseAmount(d.total) ?? 0,
    paymentMethod: d.paymentMethod.trim() || null,
    items: items.map((x) => x.item),
    returnDeadline,
    file: opts.file,
    extraction: opts.extraction,
    notes: d.notes.trim(),
  };

  const purchases: PurchaseRecordData[] = [];
  const warranties: WarrantyDocumentData[] = [];
  const reminders: PlannedReminder[] = [];

  for (const { draft, item } of items) {
    let warrantyDocumentId: string | null = null;
    if (draft.trackWarranty) {
      const months = Number(draft.warrantyMonths);
      warrantyDocumentId = opts.newId();
      const warranty: WarrantyDocumentData = {
        id: warrantyDocumentId,
        name: item.name,
        category: "warranties",
        issueDate: purchaseDate,
        expiryDate: addMonths(purchaseDate, months),
        renewalDate: null,
        notes: store,
        tags: [item.category],
        attachments: opts.file ? [opts.file] : [],
        reminderOffsets: [...DEFAULT_REMINDER_OFFSETS],
        important: false,
        source: "receipt",
        receiptId,
      };
      warranties.push(warranty);
      reminders.push(...planVaultReminders(warranty, opts.schedule));
    }
    if (item.totalPrice != null) {
      purchases.push({
        id: opts.newId(),
        receiptId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        currency: d.currency,
        store,
        purchaseDate,
        warrantyDocumentId,
      });
    }
  }

  if (returnDeadline && d.createReturnReminder) {
    reminders.push(
      ...planReminders(
        {
          title: store,
          kind: "return",
          sourceType: "receipt",
          sourceId: receiptId,
          dueDate: returnDeadline,
          offsets: RETURN_REMINDER_OFFSETS,
        },
        opts.schedule,
      ),
    );
  }

  return { receiptId, receipt, purchases, warranties, reminders };
}
