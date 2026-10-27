"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { fb } from "@/lib/firebase/client";
import { buildReceiptRecords, type ReceiptDraft } from "@/lib/domain/receipts";
import type { ScheduleContext } from "@/lib/domain/reminders";
import { planVaultReminders } from "@/lib/domain/reminders";
import type {
  Attachment,
  IsoDate,
  ReceiptExtractionMeta,
  VaultCategory,
  VaultDocument,
} from "@/lib/types";

export interface VaultDocumentValues {
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
  source: VaultDocument["source"];
  receiptId: string | null;
}

function newId(collectionName: string): string {
  return doc(collection(fb().db, collectionName)).id;
}

function reminderRef() {
  return doc(collection(fb().db, "reminders"));
}

/** Saves a vault record and replaces its scheduled reminders in one atomic write. */
export async function saveVaultDocument(opts: {
  uid: string;
  id?: string | null;
  createdAt?: Timestamp | null;
  values: VaultDocumentValues;
  schedule: ScheduleContext;
}): Promise<string> {
  const { db } = fb();
  const documentRef = opts.id ? doc(db, "documents", opts.id) : doc(collection(db, "documents"));
  const documentId = documentRef.id;

  const staleReminders = await getDocs(query(collection(db, "reminders"), where("ownerId", "==", opts.uid)));

  const planned = planVaultReminders(
    {
      id: documentId,
      name: opts.values.name,
      category: opts.values.category,
      expiryDate: opts.values.expiryDate,
      renewalDate: opts.values.renewalDate,
      reminderOffsets: opts.values.reminderOffsets,
    },
    opts.schedule,
  );

  const batch = writeBatch(db);
  batch.set(documentRef, {
    ownerId: opts.uid,
    name: opts.values.name,
    category: opts.values.category,
    issueDate: opts.values.issueDate,
    expiryDate: opts.values.expiryDate,
    renewalDate: opts.values.renewalDate,
    notes: opts.values.notes,
    tags: opts.values.tags.slice(0, 20),
    attachments: opts.values.attachments.slice(0, 10),
    reminderOffsets: opts.values.reminderOffsets,
    important: opts.values.important,
    source: opts.values.source,
    receiptId: opts.values.receiptId,
    createdAt: opts.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  staleReminders.docs
    .filter((item) => {
      const data = item.data();
      return data.sourceType === "document" && data.sourceId === documentId && data.status === "scheduled";
    })
    .forEach((item) => batch.delete(item.ref));

  for (const reminder of planned) {
    batch.set(reminderRef(), {
      ownerId: opts.uid,
      title: reminder.title.slice(0, 300),
      kind: reminder.kind,
      sourceType: reminder.sourceType,
      sourceId: reminder.sourceId,
      dueDate: reminder.dueDate,
      offsetDays: reminder.offsetDays,
      remindAt: Timestamp.fromDate(reminder.remindAt),
      status: "scheduled",
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return documentId;
}

export async function deleteVaultDocument(id: string): Promise<void> {
  await deleteDoc(doc(fb().db, "documents", id));
}

export interface SavedReceiptSummary {
  receiptId: string;
  purchases: number;
  warranties: number;
  reminders: number;
}

/** Saves a reviewed receipt together with its purchases, warranty records and reminders. */
export async function saveReceipt(opts: {
  uid: string;
  draft: ReceiptDraft;
  file: Attachment | null;
  extraction: ReceiptExtractionMeta | null;
  schedule: ScheduleContext;
}): Promise<SavedReceiptSummary> {
  const { db } = fb();
  const records = buildReceiptRecords(opts.draft, {
    newId: () => newId("receipts"),
    file: opts.file,
    extraction: opts.extraction,
    schedule: opts.schedule,
  });

  const batch = writeBatch(db);
  batch.set(doc(db, "receipts", records.receiptId), {
    ...records.receipt,
    ownerId: opts.uid,
    createdAt: serverTimestamp(),
  });
  for (const purchase of records.purchases) {
    const { id, ...data } = purchase;
    batch.set(doc(db, "purchases", id), {
      ...data,
      ownerId: opts.uid,
      createdAt: serverTimestamp(),
    });
  }
  for (const warranty of records.warranties) {
    const { id, ...data } = warranty;
    batch.set(doc(db, "documents", id), {
      ...data,
      ownerId: opts.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  for (const reminder of records.reminders) {
    batch.set(reminderRef(), {
      ownerId: opts.uid,
      title: reminder.title.slice(0, 300),
      kind: reminder.kind,
      sourceType: reminder.sourceType,
      sourceId: reminder.sourceId,
      dueDate: reminder.dueDate,
      offsetDays: reminder.offsetDays,
      remindAt: Timestamp.fromDate(reminder.remindAt),
      status: "scheduled",
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();

  return {
    receiptId: records.receiptId,
    purchases: records.purchases.length,
    warranties: records.warranties.length,
    reminders: records.reminders.length,
  };
}

export async function deleteReceipt(id: string): Promise<void> {
  await deleteDoc(doc(fb().db, "receipts", id));
}

export async function setReminderStatus(id: string, status: "done" | "dismissed"): Promise<void> {
  await updateDoc(doc(fb().db, "reminders", id), { status });
}

export async function setNotificationRead(id: string, read: boolean): Promise<void> {
  await updateDoc(doc(fb().db, "notifications", id), { read });
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = writeBatch(fb().db);
  for (const id of ids) batch.update(doc(fb().db, "notifications", id), { read: true });
  await batch.commit();
}
