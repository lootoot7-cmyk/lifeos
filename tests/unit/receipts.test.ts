import { describe, expect, it } from "vitest";
import { buildReceiptRecords, draftFromExtraction, emptyDraft, validateDraft } from "@/lib/domain/receipts";
import type { ReceiptExtraction } from "@/lib/types";

const schedule = { timeZone: "Asia/Karachi", reminderHour: 9, now: new Date("2026-10-25T00:00:00Z") };

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

const extraction: ReceiptExtraction = {
  store: "ABC Electronics",
  purchaseDate: "2026-10-25",
  currency: "PKR",
  subtotal: 8500,
  tax: null,
  total: 8500,
  paymentMethod: "Card",
  returnDeadline: "2026-11-08",
  items: [
    { name: "Wireless Headphones", quantity: 1, unitPrice: 8500, totalPrice: 8500, category: "electronics", warrantyMonths: 12 },
  ],
  confidence: 0.92,
  fieldConfidence: { store: 0.95, purchaseDate: 0.9, total: 0.97, returnDeadline: 0.8 },
  warnings: [],
  model: "test-model",
};

describe("validateDraft", () => {
  it("requires store, date and total", () => {
    const errors = validateDraft(emptyDraft("PKR"));
    expect(errors.store).toBeDefined();
    expect(errors.purchaseDate).toBeDefined();
    expect(errors.total).toBeDefined();
  });

  it("accepts a draft built from a complete extraction", () => {
    expect(validateDraft(draftFromExtraction(extraction, "USD"))).toEqual({});
  });

  it("rejects warranty without a valid month count", () => {
    const d = draftFromExtraction(extraction, "USD");
    d.items[0].warrantyMonths = "0";
    expect(validateDraft(d)["items.0.warrantyMonths"]).toBe("errors.invalidMonths");
  });
});

describe("draftFromExtraction", () => {
  it("leaves missing values empty instead of guessing", () => {
    const d = draftFromExtraction({ ...extraction, store: null, purchaseDate: null, returnDeadline: null }, "USD");
    expect(d.store).toBe("");
    expect(d.purchaseDate).toBe("");
    expect(d.createReturnReminder).toBe(false);
  });
});

describe("buildReceiptRecords", () => {
  it("links receipt, purchase, warranty and reminders", () => {
    const draft = draftFromExtraction(extraction, "USD");
    const out = buildReceiptRecords(draft, { newId: ids(), file: null, extraction: null, schedule });

    expect(out.receipt.total).toBe(8500);
    expect(out.purchases).toHaveLength(1);
    expect(out.warranties).toHaveLength(1);
    expect(out.warranties[0].expiryDate).toBe("2027-10-25");
    expect(out.warranties[0].receiptId).toBe(out.receiptId);
    expect(out.purchases[0].warrantyDocumentId).toBe(out.warranties[0].id);

    const returnReminders = out.reminders.filter((r) => r.kind === "return");
    expect(returnReminders.map((r) => r.offsetDays)).toEqual([3, 1, 0]);
    expect(returnReminders.every((r) => r.sourceId === out.receiptId)).toBe(true);
    expect(out.reminders.filter((r) => r.kind === "warranty").length).toBeGreaterThan(0);
  });

  it("derives line totals from unit price and quantity", () => {
    const draft = draftFromExtraction(extraction, "USD");
    draft.items[0] = { ...draft.items[0], quantity: "2", unitPrice: "100", totalPrice: "", trackWarranty: false };
    const out = buildReceiptRecords(draft, { newId: ids(), file: null, extraction: null, schedule });
    expect(out.purchases[0].totalPrice).toBe(200);
    expect(out.warranties).toHaveLength(0);
  });
});
