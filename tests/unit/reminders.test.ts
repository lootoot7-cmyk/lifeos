import { describe, expect, it } from "vitest";
import { planReminders, planVaultReminders, sanitizeOffsets } from "@/lib/domain/reminders";

const ctx = { timeZone: "Asia/Karachi", reminderHour: 9, now: new Date("2026-10-25T06:00:00Z") };

describe("sanitizeOffsets", () => {
  it("dedupes, drops invalid values and sorts descending", () => {
    expect(sanitizeOffsets([7, 30, 7, -1, 99999, Number.NaN, 2.6])).toEqual([30, 7, 3]);
  });
});

describe("planReminders", () => {
  it("creates one reminder per future offset plus the due day", () => {
    const plan = planReminders(
      { title: "Passport", kind: "expiry", sourceType: "document", sourceId: "d1", dueDate: "2027-06-18", offsets: [90, 60, 30, 7] },
      ctx,
    );
    expect(plan.map((r) => r.offsetDays)).toEqual([90, 60, 30, 7, 0]);
    expect(plan[0].remindAt.toISOString()).toBe("2027-03-20T04:00:00.000Z");
  });

  it("skips reminders whose time has already passed", () => {
    const plan = planReminders(
      { title: "Bill", kind: "bill", sourceType: "document", sourceId: "d2", dueDate: "2026-11-01", offsets: [30, 7] },
      ctx,
    );
    // 2026-10-25 09:00 PKT (04:00Z) is before now (06:00Z), so offset 7 is skipped.
    expect(plan.map((r) => r.offsetDays)).toEqual([0]);
  });

  it("ignores invalid due dates", () => {
    expect(
      planReminders({ title: "x", kind: "custom", sourceType: "manual", sourceId: null, dueDate: "2026-13-01", offsets: [1] }, ctx),
    ).toEqual([]);
  });
});

describe("planVaultReminders", () => {
  it("plans expiry and renewal dates with category-specific kinds", () => {
    const plan = planVaultReminders(
      {
        id: "w1",
        name: "Laptop",
        category: "warranties",
        expiryDate: "2027-06-18",
        renewalDate: "2027-07-01",
        reminderOffsets: [7],
      },
      ctx,
    );
    expect(plan.filter((r) => r.kind === "warranty")).toHaveLength(2);
    expect(plan.filter((r) => r.kind === "renewal")).toHaveLength(2);
  });
});
