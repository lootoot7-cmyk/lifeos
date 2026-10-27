import type { Timestamp } from "firebase/firestore";

/** Calendar date in YYYY-MM-DD form. Used for due/expiry dates so they never shift across time zones. */
export type IsoDate = string;

export type Language = "en" | "ur";
export type ThemePreference = "system" | "light" | "dark";

export const MANAGED_MODULES = [
  "documents",
  "receipts",
  "inventory",
  "expiry",
  "lostFound",
  "prices",
  "reminders",
  "emergency",
] as const;
export type ManagedModule = (typeof MANAGED_MODULES)[number];

export interface NotificationPrefs {
  push: boolean;
  email: boolean;
  inApp: boolean;
  /** Local hour (0-23) quiet hours start; null disables quiet hours. */
  quietStart: number | null;
  quietEnd: number | null;
  /** Local hour reminders are delivered at. */
  reminderHour: number;
}

export interface Profile {
  displayName: string;
  photoURL: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  timeZone: string;
  language: Language;
  theme: ThemePreference;
  notificationPrefs: NotificationPrefs;
  modules: ManagedModule[];
  onboardingCompleted: boolean;
  aiAnalysisEnabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Plan = "free" | "pro" | "business";

/** Server-managed account record (read-only to clients). */
export interface Account {
  plan: Plan;
  aiUsage?: { day: string; count: number };
}

export const VAULT_CATEGORIES = [
  "bills",
  "warranties",
  "contracts",
  "certificates",
  "ids",
  "passports",
  "vehicle",
  "insurance",
  "property",
  "school",
  "work",
  "records",
  "subscriptions",
  "renewals",
] as const;
export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export interface Attachment {
  path: string;
  name: string;
  contentType: string;
  size: number;
}

export const DEFAULT_REMINDER_OFFSETS = [90, 60, 30, 7] as const;

export interface VaultDocument {
  id: string;
  ownerId: string;
  name: string;
  category: VaultCategory;
  issueDate: IsoDate | null;
  expiryDate: IsoDate | null;
  renewalDate: IsoDate | null;
  notes: string;
  tags: string[];
  attachments: Attachment[];
  reminderOffsets: number[];
  important: boolean;
  source: "manual" | "receipt" | "capture";
  receiptId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ReminderKind = "expiry" | "renewal" | "warranty" | "return" | "bill" | "custom";
export type ReminderSource = "document" | "receipt" | "manual";
export type ReminderStatus = "scheduled" | "sent" | "done" | "dismissed";

export interface Reminder {
  id: string;
  ownerId: string;
  title: string;
  kind: ReminderKind;
  sourceType: ReminderSource;
  sourceId: string | null;
  dueDate: IsoDate;
  offsetDays: number;
  remindAt: Timestamp;
  status: ReminderStatus;
  createdAt: Timestamp;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  category: PurchaseCategory;
}

export const PURCHASE_CATEGORIES = [
  "electronics",
  "appliances",
  "groceries",
  "clothing",
  "home",
  "health",
  "beauty",
  "vehicle",
  "dining",
  "services",
  "other",
] as const;
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];

export interface ReceiptExtractionMeta {
  model: string;
  confidence: number;
  warnings: string[];
}

export interface Receipt {
  id: string;
  ownerId: string;
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
  createdAt: Timestamp;
}

export interface Purchase {
  id: string;
  ownerId: string;
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
  createdAt: Timestamp;
}

export interface AppNotification {
  id: string;
  ownerId: string;
  title: string;
  body: string;
  kind: ReminderKind | "system";
  link: string | null;
  read: boolean;
  createdAt: Timestamp;
}

export interface AuditLog {
  id: string;
  ownerId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: Timestamp;
}

/** Fields the AI extracted from a receipt. Every value may be null when not confidently visible. */
export interface ReceiptExtraction {
  store: string | null;
  purchaseDate: IsoDate | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  paymentMethod: string | null;
  returnDeadline: IsoDate | null;
  items: Array<ReceiptItem & { warrantyMonths: number | null }>;
  confidence: number;
  fieldConfidence: {
    store: number;
    purchaseDate: number;
    total: number;
    returnDeadline: number;
  };
  warnings: string[];
  model: string;
}

export interface DocumentExtraction {
  name: string | null;
  category: VaultCategory | null;
  issueDate: IsoDate | null;
  expiryDate: IsoDate | null;
  renewalDate: IsoDate | null;
  summary: string;
  confidence: number;
  fieldConfidence: { expiryDate: number; issueDate: number };
  warnings: string[];
  model: string;
}

export type CaptureKind = "receipt" | "document" | "note" | "unknown";

export interface CaptureAnalysis {
  kind: CaptureKind;
  confidence: number;
  summary: string;
  receipt: ReceiptExtraction | null;
  document: DocumentExtraction | null;
}
