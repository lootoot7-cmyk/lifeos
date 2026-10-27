import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { bucket, db } from "./admin";
import { AI_DAILY_LIMITS, MAX_UPLOAD_BYTES } from "./config";

export function requireUid(req: CallableRequest): string {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "sign-in-required");
  return req.auth.uid;
}

/** Sensitive actions require a sign-in within the last few minutes. */
export function requireRecentLogin(req: CallableRequest, maxAgeSeconds = 300): void {
  const authTime = Number(req.auth?.token?.auth_time ?? 0);
  if (Date.now() / 1000 - authTime > maxAgeSeconds) {
    throw new HttpsError("failed-precondition", "requires-recent-login");
  }
}

export interface ProfileSnapshot {
  language: "en" | "ur";
  timeZone: string;
  aiAnalysisEnabled: boolean;
}

export async function loadProfile(uid: string): Promise<ProfileSnapshot> {
  const snap = await db.doc(`profiles/${uid}`).get();
  const p = snap.data() ?? {};
  return {
    language: p.language === "ur" ? "ur" : "en",
    timeZone: typeof p.timeZone === "string" ? p.timeZone : "UTC",
    aiAnalysisEnabled: p.aiAnalysisEnabled !== false,
  };
}

export function requireAiEnabled(profile: ProfileSnapshot): void {
  if (!profile.aiAnalysisEnabled) throw new HttpsError("failed-precondition", "ai-disabled");
}

/** Atomically counts today's AI requests against the user's plan limit. */
export async function consumeAiQuota(uid: string): Promise<void> {
  const ref = db.doc(`users/${uid}`);
  const day = new Date().toISOString().slice(0, 10);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const plan = (data.plan as keyof typeof AI_DAILY_LIMITS) ?? "free";
    const limit = AI_DAILY_LIMITS[plan] ?? AI_DAILY_LIMITS.free;
    const usage = data.aiUsage?.day === day ? Number(data.aiUsage.count) : 0;
    if (usage >= limit) throw new HttpsError("resource-exhausted", "ai-quota-exceeded");
    tx.set(
      ref,
      {
        plan,
        aiUsage: { day, count: usage + 1 },
        ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );
  });
}

const ALLOWED_AREAS = ["receipts", "captures", "vault"];

export interface LoadedFile {
  data: Buffer;
  contentType: string;
}

/** Loads a file only if it lives in the caller's own storage area and is an allowed type/size. */
export async function loadOwnFile(uid: string, path: unknown): Promise<LoadedFile> {
  if (typeof path !== "string" || path.includes("..")) throw new HttpsError("invalid-argument", "invalid-path");
  const segments = path.split("/");
  if (segments.length < 4 || segments[0] !== "users" || segments[1] !== uid || !ALLOWED_AREAS.includes(segments[2])) {
    throw new HttpsError("permission-denied", "invalid-path");
  }
  const file = bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "file-not-found");
  const [meta] = await file.getMetadata();
  const size = Number(meta.size ?? 0);
  const contentType = String(meta.contentType ?? "");
  if (size > MAX_UPLOAD_BYTES) throw new HttpsError("invalid-argument", "file-too-large");
  if (!(contentType.startsWith("image/") || contentType === "application/pdf")) {
    throw new HttpsError("invalid-argument", "unsupported-file-type");
  }
  const [data] = await file.download();
  return { data, contentType };
}
