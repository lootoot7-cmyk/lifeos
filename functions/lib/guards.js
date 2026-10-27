"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUid = requireUid;
exports.requireRecentLogin = requireRecentLogin;
exports.loadProfile = loadProfile;
exports.requireAiEnabled = requireAiEnabled;
exports.consumeAiQuota = consumeAiQuota;
exports.loadOwnFile = loadOwnFile;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("./admin");
const config_1 = require("./config");
function requireUid(req) {
    if (!req.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "sign-in-required");
    return req.auth.uid;
}
/** Sensitive actions require a sign-in within the last few minutes. */
function requireRecentLogin(req, maxAgeSeconds = 300) {
    const authTime = Number(req.auth?.token?.auth_time ?? 0);
    if (Date.now() / 1000 - authTime > maxAgeSeconds) {
        throw new https_1.HttpsError("failed-precondition", "requires-recent-login");
    }
}
async function loadProfile(uid) {
    const snap = await admin_1.db.doc(`profiles/${uid}`).get();
    const p = snap.data() ?? {};
    return {
        language: p.language === "ur" ? "ur" : "en",
        timeZone: typeof p.timeZone === "string" ? p.timeZone : "UTC",
        aiAnalysisEnabled: p.aiAnalysisEnabled !== false,
    };
}
function requireAiEnabled(profile) {
    if (!profile.aiAnalysisEnabled)
        throw new https_1.HttpsError("failed-precondition", "ai-disabled");
}
/** Atomically counts today's AI requests against the user's plan limit. */
async function consumeAiQuota(uid) {
    const ref = admin_1.db.doc(`users/${uid}`);
    const day = new Date().toISOString().slice(0, 10);
    await admin_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data() ?? {};
        const plan = data.plan ?? "free";
        const limit = config_1.AI_DAILY_LIMITS[plan] ?? config_1.AI_DAILY_LIMITS.free;
        const usage = data.aiUsage?.day === day ? Number(data.aiUsage.count) : 0;
        if (usage >= limit)
            throw new https_1.HttpsError("resource-exhausted", "ai-quota-exceeded");
        tx.set(ref, {
            plan,
            aiUsage: { day, count: usage + 1 },
            ...(snap.exists ? {} : { createdAt: firestore_1.FieldValue.serverTimestamp() }),
        }, { merge: true });
    });
}
const ALLOWED_AREAS = ["receipts", "captures", "vault"];
/** Loads a file only if it lives in the caller's own storage area and is an allowed type/size. */
async function loadOwnFile(uid, path) {
    if (typeof path !== "string" || path.includes(".."))
        throw new https_1.HttpsError("invalid-argument", "invalid-path");
    const segments = path.split("/");
    if (segments.length < 4 || segments[0] !== "users" || segments[1] !== uid || !ALLOWED_AREAS.includes(segments[2])) {
        throw new https_1.HttpsError("permission-denied", "invalid-path");
    }
    const file = (0, admin_1.bucket)().file(path);
    const [exists] = await file.exists();
    if (!exists)
        throw new https_1.HttpsError("not-found", "file-not-found");
    const [meta] = await file.getMetadata();
    const size = Number(meta.size ?? 0);
    const contentType = String(meta.contentType ?? "");
    if (size > config_1.MAX_UPLOAD_BYTES)
        throw new https_1.HttpsError("invalid-argument", "file-too-large");
    if (!(contentType.startsWith("image/") || contentType === "application/pdf")) {
        throw new https_1.HttpsError("invalid-argument", "unsupported-file-type");
    }
    const [data] = await file.download();
    return { data, contentType };
}
//# sourceMappingURL=guards.js.map