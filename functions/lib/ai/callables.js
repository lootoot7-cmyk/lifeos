"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCapture = exports.extractReceipt = void 0;
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
const dates_1 = require("../dates");
const guards_1 = require("../guards");
const gemini_1 = require("./gemini");
const normalize_1 = require("./normalize");
const schemas_1 = require("./schemas");
const callableOpts = {
    region: config_1.REGION,
    secrets: [config_1.GEMINI_API_KEY],
    enforceAppCheck: config_1.ENFORCE_APP_CHECK,
    memory: "512MiB",
    timeoutSeconds: 120,
};
const MAX_TEXT = 10_000;
exports.extractReceipt = (0, https_1.onCall)(callableOpts, async (req) => {
    const uid = (0, guards_1.requireUid)(req);
    const profile = await (0, guards_1.loadProfile)(uid);
    (0, guards_1.requireAiEnabled)(profile);
    const file = await (0, guards_1.loadOwnFile)(uid, req.data?.storagePath);
    await (0, guards_1.consumeAiQuota)(uid);
    const raw = await (0, gemini_1.generateJson)([{ inlineData: { mimeType: file.contentType, data: file.data.toString("base64") } }], schemas_1.receiptSchema, "Extract this purchase receipt.");
    return (0, normalize_1.normalizeReceipt)(raw, (0, gemini_1.modelName)(), (0, dates_1.localParts)(profile.timeZone, new Date()).date);
});
exports.analyzeCapture = (0, https_1.onCall)(callableOpts, async (req) => {
    const uid = (0, guards_1.requireUid)(req);
    const profile = await (0, guards_1.loadProfile)(uid);
    (0, guards_1.requireAiEnabled)(profile);
    const input = (req.data ?? {});
    const parts = [];
    if (input.storagePath != null) {
        const file = await (0, guards_1.loadOwnFile)(uid, input.storagePath);
        parts.push({ inlineData: { mimeType: file.contentType, data: file.data.toString("base64") } });
    }
    if (typeof input.text === "string" && input.text.trim()) {
        parts.push({ text: `User-provided text:\n"""\n${input.text.slice(0, MAX_TEXT)}\n"""` });
    }
    if (parts.length === 0)
        throw new https_1.HttpsError("invalid-argument", "empty-capture");
    await (0, guards_1.consumeAiQuota)(uid);
    const today = (0, dates_1.localParts)(profile.timeZone, new Date()).date;
    const raw = await (0, gemini_1.generateJson)(parts, schemas_1.captureSchema, `Today is ${today}. Classify this capture as a purchase receipt, an important document/bill/record, a plain note, or unknown, then extract the matching fields. Fill only the object that matches the kind; set the other to null.`);
    return (0, normalize_1.normalizeCapture)(raw, (0, gemini_1.modelName)(), today);
});
//# sourceMappingURL=callables.js.map