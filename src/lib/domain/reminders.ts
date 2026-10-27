import { addDays, isValidIsoDate, zonedTimeToUtc } from "@/lib/domain/dates";
import type { IsoDate, ReminderKind, ReminderSource, VaultCategory } from "@/lib/types";

export interface PlannedReminder {
  title: string;
  kind: ReminderKind;
  sourceType: ReminderSource;
  sourceId: string | null;
  dueDate: IsoDate;
  offsetDays: number;
  remindAt: Date;
}

export interface ReminderTarget {
  title: string;
  kind: ReminderKind;
  sourceType: ReminderSource;
  sourceId: string | null;
  dueDate: IsoDate;
  offsets: number[];
}

export interface ScheduleContext {
  timeZone: string;
  reminderHour: number;
  now: Date;
}

export const RETURN_REMINDER_OFFSETS = [3, 1];

export function sanitizeOffsets(offsets: readonly number[]): number[] {
  const clean = offsets
    .map((o) => Math.round(Number(o)))
    .filter((o) => Number.isFinite(o) && o >= 0 && o <= 3650);
  return Array.from(new Set(clean)).sort((a, b) => b - a);
}

/** Expands a due date into one reminder per offset, plus the due day itself, skipping any already in the past. */
export function planReminders(target: ReminderTarget, ctx: ScheduleContext): PlannedReminder[] {
  if (!isValidIsoDate(target.dueDate)) return [];
  const offsets = sanitizeOffsets([...target.offsets, 0]);
  const planned: PlannedReminder[] = [];
  for (const offsetDays of offsets) {
    const day = addDays(target.dueDate, -offsetDays);
    const remindAt = zonedTimeToUtc(day, ctx.reminderHour, ctx.timeZone);
    if (remindAt.getTime() <= ctx.now.getTime()) continue;
    planned.push({
      title: target.title,
      kind: target.kind,
      sourceType: target.sourceType,
      sourceId: target.sourceId,
      dueDate: target.dueDate,
      offsetDays,
      remindAt,
    });
  }
  return planned;
}

export function expiryKindFor(category: VaultCategory): ReminderKind {
  if (category === "warranties") return "warranty";
  if (category === "bills") return "bill";
  if (category === "subscriptions" || category === "renewals") return "renewal";
  return "expiry";
}

export interface VaultReminderInput {
  id: string;
  name: string;
  category: VaultCategory;
  expiryDate: IsoDate | null;
  renewalDate: IsoDate | null;
  reminderOffsets: number[];
}

export function planVaultReminders(doc: VaultReminderInput, ctx: ScheduleContext): PlannedReminder[] {
  const result: PlannedReminder[] = [];
  if (doc.expiryDate) {
    result.push(
      ...planReminders(
        {
          title: doc.name,
          kind: expiryKindFor(doc.category),
          sourceType: "document",
          sourceId: doc.id,
          dueDate: doc.expiryDate,
          offsets: doc.reminderOffsets,
        },
        ctx,
      ),
    );
  }
  if (doc.renewalDate && doc.renewalDate !== doc.expiryDate) {
    result.push(
      ...planReminders(
        {
          title: doc.name,
          kind: "renewal",
          sourceType: "document",
          sourceId: doc.id,
          dueDate: doc.renewalDate,
          offsets: doc.reminderOffsets,
        },
        ctx,
      ),
    );
  }
  return result;
}
