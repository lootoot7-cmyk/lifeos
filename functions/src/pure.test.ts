import { describe, expect, it } from "vitest";
import { normalizeCapture, normalizeDocument, normalizeReceipt } from "./ai/normalize";
import { inQuietHours, localParts } from "./dates";
import { reminderMessage } from "./messages";

describe("normalizeReceipt", () => {
  it("keeps only valid, visible values", () => {
    const out = normalizeReceipt(
      {
        store: "  ABC Electronics ",
        purchaseDate: "2026-02-30",
        currency: "pkr",
        total: 8500,
        subtotal: -5,
        paymentMethod: "Card 4111 1111 1111 1234",
        returnDeadline: null,
        returnPolicyDays: null,
        items: [{ name: "Headphones", quantity: 0, unitPrice: 8500, totalPrice: 8500, category: "gadgets", warrantyMonths: 12 }, { name: "" }],
        confidence: 4,
        fieldConfidence: { store: 0.9, purchaseDate: 0.9, total: 0.9, returnDeadline: 0.5 },
        warnings: [],
      },
      "m",
      "2026-10-25",
    );
    expect(out.store).toBe("ABC Electronics");
    expect(out.purchaseDate).toBeNull();
    expect(out.fieldConfidence.purchaseDate).toBe(0);
    expect(out.warnings.some((w) => w.includes("Purchase date"))).toBe(true);
    expect(out.currency).toBe("PKR");
    expect(out.subtotal).toBeNull();
    expect(out.paymentMethod).toBe("Card ••••1234");
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({ quantity: 1, category: "other", warrantyMonths: 12 });
    expect(out.confidence).toBe(1);
  });

  it("derives a return deadline only from a printed policy", () => {
    const out = normalizeReceipt(
      { purchaseDate: "2026-10-25", returnDeadline: null, returnPolicyDays: 14, fieldConfidence: {}, items: [] },
      "m",
      "2026-10-25",
    );
    expect(out.returnDeadline).toBe("2026-11-08");
    expect(out.fieldConfidence.returnDeadline).toBeLessThanOrEqual(0.7);
  });

  it("survives garbage input", () => {
    const out = normalizeReceipt("nonsense", "m", "2026-10-25");
    expect(out.total).toBeNull();
    expect(out.items).toEqual([]);
    expect(out.confidence).toBe(0);
  });
});

describe("normalizeDocument", () => {
  it("never invents an expiry date and masks ID numbers", () => {
    const out = normalizeDocument({ name: "Passport 1234567890123", category: "passports", summary: "ID 35202-1234567-1" }, "m");
    expect(out.expiryDate).toBeNull();
    expect(out.warnings).toContain("Expiry date could not be confidently detected.");
    expect(out.name).toBe("Passport ••••0123");
    expect(out.summary).not.toContain("1234567");
  });
});

describe("normalizeCapture", () => {
  it("only fills the payload matching the kind", () => {
    const out = normalizeCapture({ kind: "note", confidence: 0.8, summary: "x", receipt: { total: 1 }, document: null }, "m", "2026-10-25");
    expect(out.receipt).toBeNull();
    expect(out.kind).toBe("note");
  });
});

describe("dates", () => {
  it("handles quiet hours wrapping midnight", () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(6, 22, 7)).toBe(true);
    expect(inQuietHours(12, 22, 7)).toBe(false);
    expect(inQuietHours(12, null, null)).toBe(false);
  });
  it("reads local date and hour", () => {
    expect(localParts("Asia/Karachi", new Date("2026-10-25T20:30:00Z"))).toEqual({ date: "2026-10-26", hour: 1 });
  });
});

describe("reminderMessage", () => {
  it("localizes messages", () => {
    expect(reminderMessage("en", "warranty", "Laptop", 7).body).toBe("Your Laptop warranty ends in 7 days.");
    expect(reminderMessage("ur", "bill", "بجلی", 1).body).toContain("کل");
  });
});
