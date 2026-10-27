"use client";

import { httpsCallable } from "firebase/functions";
import { fb } from "@/lib/firebase/client";
import type { CaptureAnalysis, ReceiptExtraction } from "@/lib/types";

async function invoke<TRes>(name: string, data?: Record<string, unknown>): Promise<TRes> {
  const result = await httpsCallable<Record<string, unknown> | undefined, TRes>(fb().functions, name)(data);
  return result.data;
}

/** Reads a receipt image or PDF that the user already uploaded. Analysis happens only in Cloud Functions. */
export function extractReceipt(storagePath: string): Promise<ReceiptExtraction> {
  return invoke<ReceiptExtraction>("extractReceipt", { storagePath });
}

export function analyzeCapture(input: { storagePath?: string; text?: string }): Promise<CaptureAnalysis> {
  return invoke<CaptureAnalysis>("analyzeCapture", input);
}

export function exportMyData(): Promise<{ path: string }> {
  return invoke<{ path: string }>("exportMyData");
}

export function deleteMyAccount(): Promise<{ ok: boolean }> {
  return invoke<{ ok: boolean }>("deleteMyAccount");
}

export function deleteMyData(): Promise<{ ok: boolean }> {
  return invoke<{ ok: boolean }>("deleteMyData");
}
