import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";

/** Must match NEXT_PUBLIC_FUNCTIONS_REGION in the web app. */
export const REGION = "us-central1";

/** Set with: firebase functions:secrets:set GEMINI_API_KEY */
export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

export const GEMINI_MODEL = defineString("GEMINI_MODEL", {
  default: "gemini-3.8-flash",
  description: "Gemini model id used for vision/text extraction.",
});

export const ENFORCE_APP_CHECK = defineBoolean("ENFORCE_APP_CHECK", {
  default: true,
  description: "Reject callable requests without a valid App Check token.",
});

export const EMAIL_NOTIFICATIONS_ENABLED = defineBoolean("EMAIL_NOTIFICATIONS_ENABLED", {
  default: false,
  description: "Write reminder emails to the `mail` collection for the Firebase Trigger Email extension.",
});

export const AI_DAILY_LIMITS = { free: 30, pro: 300, business: 1000 } as const;

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const OWNED_COLLECTIONS = [
  "documents",
  "reminders",
  "receipts",
  "purchases",
  "notifications",
  "auditLogs",
] as const;
