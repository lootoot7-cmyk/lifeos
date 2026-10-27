import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  dueBucket,
  isValidIsoDate,
  startOfWeek,
  todayIn,
  zonedTimeToUtc,
} from "@/lib/domain/dates";

describe("isValidIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidIsoDate("2026-10-25")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });
  it("rejects impossible or malformed dates", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
    expect(isValidIsoDate("25/10/2026")).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("clamps month addition to month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-25", 24)).toBe("2028-10-25");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-10-25", "2026-11-08")).toBe(14);
    expect(daysBetween("2026-10-25", "2026-10-20")).toBe(-5);
  });
  it("finds Monday as start of week", () => {
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
  });
});

describe("time zones", () => {
  it("returns the local calendar date in a zone", () => {
    const instant = new Date("2026-10-25T20:30:00Z");
    expect(todayIn("Asia/Karachi", instant)).toBe("2026-10-26");
    expect(todayIn("America/New_York", instant)).toBe("2026-10-25");
  });
  it("converts local wall time to UTC", () => {
    expect(zonedTimeToUtc("2026-10-25", 9, "Asia/Karachi").toISOString()).toBe("2026-10-25T04:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-01", 9, "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", 9, "America/New_York").toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });
});

describe("dueBucket", () => {
  const today = "2026-10-25";
  it.each([
    ["2026-10-24", "overdue"],
    ["2026-10-25", "today"],
    ["2026-11-01", "week"],
    ["2026-11-20", "month"],
    ["2027-01-01", "future"],
  ] as const)("%s -> %s", (due, bucket) => {
    expect(dueBucket(due, today)).toBe(bucket);
  });
});
