"use client";

import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { fb, firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/client";

let analytics: Promise<Analytics | null> | null = null;

function instance(): Promise<Analytics | null> {
  if (!analytics) {
    analytics =
      isFirebaseConfigured && firebaseConfig.measurementId
        ? isSupported()
            .then((ok) => (ok ? getAnalytics(fb().app) : null))
            .catch(() => null)
        : Promise.resolve(null);
  }
  return analytics;
}

export type AnalyticsEvent =
  | "capture_analyzed"
  | "receipt_saved"
  | "document_saved"
  | "search_used"
  | "reminder_completed"
  | "data_exported";

/** Privacy-friendly analytics: event names and coarse counts only, never user content. */
export function track(event: AnalyticsEvent, params?: Record<string, string | number | boolean>): void {
  void instance().then((a) => {
    if (a) logEvent(a, event, params);
  });
}
