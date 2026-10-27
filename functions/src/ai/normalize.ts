import { addDays, daysBetween, isValidIsoDate } from "../dates";
import { PURCHASE_CATEGORIES, VAULT_CATEGORIES } from "./schemas";

type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];
type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export interface ReceiptExtraction {
  store: string | null;
  purchaseDate: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  paymentMethod: string | null;
  returnDeadline: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number | null;
    totalPrice: number | null;
    category: PurchaseCategory;
    warrantyMonths: number | null;
  }>;
  confidence: number;
  fieldConfidence: { store: number; purchaseDate: number; total: number; returnDeadline: number };
  warnings: string[];
  model: string;
}

export interface DocumentExtraction {
  name: string | null;
  category: VaultCategory | null;
  issueDate: string | null;
  expiryDate: string | null;
  renewalDate: string | null;
  summary: string;
  confidence: number;
  fieldConfidence: { expiryDate: number; issueDate: number };
  warnings: string[];
  model: string;
}

export interface CaptureAnalysis {
  kind: "receipt" | "document" | "note" | "unknown";
  confidence: number;
  summary: string;
  receipt: ReceiptExtraction | null;
  document: DocumentExtraction | null;
}

type Raw = Record<string, unknown>;

const asObj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});

function str(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t ? t : null;
}

function amount(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e12) return null;
  return Math.round(v * 100) / 100;
}

function conf(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

function date(v: unknown, field: string, warnings: string[]): string | null {
  if (v == null) return null;
  if (isValidIsoDate(v)) return v;
  warnings.push(`${field} could not be read reliably and was left empty.`);
  return null;
}

function warningsFrom(v: unknown): string[] {
  return Array.isArray(v) ? v.map((w) => str(w, 300)).filter((w): w is string => !!w).slice(0, 10) : [];
}

const MASK_RE = /\b\d[\d -]{8,}\d\b/g;
const maskNumbers = (s: string) => s.replace(MASK_RE, (m) => `••••${m.replace(/\D/g, "").slice(-4)}`);

export function normalizeReceipt(input: unknown, model: string, today: string): ReceiptExtraction {
  const r = asObj(input);
  const warnings = warningsFrom(r.warnings);
  const fc = asObj(r.fieldConfidence);
  const purchaseDate = date(r.purchaseDate, "Purchase date", warnings);
  let returnDeadline = date(r.returnDeadline, "Return deadline", warnings);
  const policyDays = typeof r.returnPolicyDays === "number" && Number.isInteger(r.returnPolicyDays) ? r.returnPolicyDays : null;
  let returnConfidence = conf(fc.returnDeadline);
  if (!returnDeadline && purchaseDate && policyDays && policyDays > 0 && policyDays <= 365) {
    returnDeadline = addDays(purchaseDate, policyDays);
    warnings.push(`Return deadline calculated from the printed ${policyDays}-day return policy.`);
    returnConfidence = Math.min(returnConfidence || 0.7, 0.7);
  }
  if (purchaseDate && daysBetween(today, purchaseDate) > 1) {
    warnings.push("Purchase date is in the future. Please check it.");
  }
  const currencyRaw = str(r.currency, 3)?.toUpperCase() ?? null;
  const currency = currencyRaw && /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : null;

  const items = (Array.isArray(r.items) ? r.items : []).slice(0, 200).flatMap((raw) => {
    const it = asObj(raw);
    const name = str(it.name);
    if (!name) return [];
    const quantity = typeof it.quantity === "number" && it.quantity > 0 && it.quantity < 1e6 ? it.quantity : 1;
    const category = PURCHASE_CATEGORIES.includes(it.category as PurchaseCategory) ? (it.category as PurchaseCategory) : "other";
    const wm = it.warrantyMonths;
    const warrantyMonths = typeof wm === "number" && Number.isInteger(wm) && wm > 0 && wm <= 240 ? wm : null;
    return [{ name, quantity, unitPrice: amount(it.unitPrice), totalPrice: amount(it.totalPrice), category, warrantyMonths }];
  });

  const paymentMethod = str(r.paymentMethod, 100);
  return {
    store: str(r.store),
    purchaseDate,
    currency,
    subtotal: amount(r.subtotal),
    tax: amount(r.tax),
    total: amount(r.total),
    paymentMethod: paymentMethod ? maskNumbers(paymentMethod) : null,
    returnDeadline,
    items,
    confidence: conf(r.confidence),
    fieldConfidence: {
      store: conf(fc.store),
      purchaseDate: purchaseDate ? conf(fc.purchaseDate) : 0,
      total: conf(fc.total),
      returnDeadline: returnDeadline ? returnConfidence : 0,
    },
    warnings,
    model,
  };
}

export function normalizeDocument(input: unknown, model: string): DocumentExtraction {
  const r = asObj(input);
  const warnings = warningsFrom(r.warnings);
  const fc = asObj(r.fieldConfidence);
  const category = VAULT_CATEGORIES.includes(r.category as VaultCategory) ? (r.category as VaultCategory) : null;
  const expiryDate = date(r.expiryDate, "Expiry date", warnings);
  const issueDate = date(r.issueDate, "Issue date", warnings);
  if (!expiryDate) warnings.push("Expiry date could not be confidently detected.");
  const name = str(r.name);
  return {
    name: name ? maskNumbers(name) : null,
    category,
    issueDate,
    expiryDate,
    renewalDate: date(r.renewalDate, "Renewal date", warnings),
    summary: maskNumbers(str(r.summary, 500) ?? ""),
    confidence: conf(r.confidence),
    fieldConfidence: {
      expiryDate: expiryDate ? conf(fc.expiryDate) : 0,
      issueDate: issueDate ? conf(fc.issueDate) : 0,
    },
    warnings,
    model,
  };
}

export function normalizeCapture(input: unknown, model: string, today: string): CaptureAnalysis {
  const r = asObj(input);
  const kinds = ["receipt", "document", "note", "unknown"] as const;
  const kind = kinds.includes(r.kind as (typeof kinds)[number]) ? (r.kind as CaptureAnalysis["kind"]) : "unknown";
  return {
    kind,
    confidence: conf(r.confidence),
    summary: maskNumbers(str(r.summary, 500) ?? ""),
    receipt: kind === "receipt" && r.receipt ? normalizeReceipt(r.receipt, model, today) : null,
    document: kind === "document" && r.document ? normalizeDocument(r.document, model) : null,
  };
}
