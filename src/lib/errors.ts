import type { MessageKey } from "@/lib/i18n";

const AUTH_CODES: Record<string, MessageKey> = {
  "auth/invalid-credential": "auth.err.invalidCredential",
  "auth/wrong-password": "auth.err.invalidCredential",
  "auth/user-not-found": "auth.err.invalidCredential",
  "auth/invalid-login-credentials": "auth.err.invalidCredential",
  "auth/email-already-in-use": "auth.err.emailInUse",
  "auth/weak-password": "auth.err.weakPassword",
  "auth/invalid-email": "auth.err.invalidEmail",
  "auth/too-many-requests": "auth.err.tooMany",
  "auth/popup-closed-by-user": "auth.err.popupClosed",
  "auth/cancelled-popup-request": "auth.err.popupClosed",
  "auth/popup-blocked": "auth.err.popupClosed",
  "auth/invalid-phone-number": "auth.err.invalidPhone",
  "auth/missing-phone-number": "auth.err.invalidPhone",
  "auth/invalid-verification-code": "auth.err.invalidCode",
  "auth/invalid-verification-id": "auth.err.invalidCode",
  "auth/code-expired": "auth.err.invalidCode",
  "auth/network-request-failed": "auth.err.network",
  "auth/operation-not-allowed": "auth.err.notEnabled",
  "auth/unauthorized-domain": "auth.err.notEnabled",
  "auth/requires-recent-login": "errors.recentLogin",
};

const MESSAGE_KEYS: Record<string, MessageKey> = {
  "ai-disabled": "errors.aiDisabled",
  "ai-quota-exceeded": "errors.aiQuota",
  "ai-unavailable": "errors.aiUnavailable",
  "ai-not-configured": "errors.aiNotConfigured",
  "requires-recent-login": "errors.recentLogin",
  "file-too-large": "errors.fileTooLarge",
  "unsupported-file-type": "errors.fileType",
};

function codeOf(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

/** Maps any thrown SDK error to a user-facing translation key. Never shows raw SDK text. */
export function errorKey(error: unknown): MessageKey {
  const code = codeOf(error) ?? "";
  const message = messageOf(error);

  if (AUTH_CODES[code]) return AUTH_CODES[code];
  if (MESSAGE_KEYS[message]) return MESSAGE_KEYS[message];
  if (MESSAGE_KEYS[message.replace(/^.*?:\s*/, "")]) {
    return MESSAGE_KEYS[message.replace(/^.*?:\s*/, "")];
  }

  if (code === "firebase-not-configured") return "setup.title";
  if (code === "permission-denied" || code === "storage/unauthorized" || code === "unauthenticated") {
    return "errors.permission";
  }
  if (code === "not-found" || code === "storage/object-not-found") return "errors.notFound";
  if (
    code === "unavailable" ||
    code === "deadline-exceeded" ||
    code === "storage/retry-limit-exceeded" ||
    code === "storage/network-request-failed"
  ) {
    return "errors.offline";
  }
  if (code.startsWith("auth/")) return "errors.generic";
  return "errors.generic";
}

/** Short technical detail for the "report a problem" text the user can copy. Not shown in normal UI. */
export function errorDetail(error: unknown): string {
  const code = codeOf(error);
  const message = messageOf(error);
  const parts = [code, message].filter(Boolean);
  return parts.length ? parts.join(" — ") : String(error);
}
