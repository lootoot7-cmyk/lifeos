import type { Part } from "@google/genai";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { ENFORCE_APP_CHECK, GEMINI_API_KEY, REGION } from "../config";
import { localParts } from "../dates";
import { consumeAiQuota, loadOwnFile, loadProfile, requireAiEnabled, requireUid } from "../guards";
import { generateJson, modelName } from "./gemini";
import { normalizeCapture, normalizeReceipt } from "./normalize";
import { captureSchema, receiptSchema } from "./schemas";

const callableOpts = {
  region: REGION,
  secrets: [GEMINI_API_KEY],
  enforceAppCheck: ENFORCE_APP_CHECK,
  memory: "512MiB" as const,
  timeoutSeconds: 120,
};

const MAX_TEXT = 10_000;

export const extractReceipt = onCall(callableOpts, async (req) => {
  const uid = requireUid(req);
  const profile = await loadProfile(uid);
  requireAiEnabled(profile);
  const file = await loadOwnFile(uid, (req.data as { storagePath?: unknown })?.storagePath);
  await consumeAiQuota(uid);

  const raw = await generateJson(
    [{ inlineData: { mimeType: file.contentType, data: file.data.toString("base64") } }],
    receiptSchema,
    "Extract this purchase receipt.",
  );
  return normalizeReceipt(raw, modelName(), localParts(profile.timeZone, new Date()).date);
});

export const analyzeCapture = onCall(callableOpts, async (req) => {
  const uid = requireUid(req);
  const profile = await loadProfile(uid);
  requireAiEnabled(profile);

  const input = (req.data ?? {}) as { storagePath?: unknown; text?: unknown };
  const parts: Part[] = [];
  if (input.storagePath != null) {
    const file = await loadOwnFile(uid, input.storagePath);
    parts.push({ inlineData: { mimeType: file.contentType, data: file.data.toString("base64") } });
  }
  if (typeof input.text === "string" && input.text.trim()) {
    parts.push({ text: `User-provided text:\n"""\n${input.text.slice(0, MAX_TEXT)}\n"""` });
  }
  if (parts.length === 0) throw new HttpsError("invalid-argument", "empty-capture");
  await consumeAiQuota(uid);

  const today = localParts(profile.timeZone, new Date()).date;
  const raw = await generateJson(
    parts,
    captureSchema,
    `Today is ${today}. Classify this capture as a purchase receipt, an important document/bill/record, a plain note, or unknown, then extract the matching fields. Fill only the object that matches the kind; set the other to null.`,
  );
  return normalizeCapture(raw, modelName(), today);
});
