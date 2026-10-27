"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelName = modelName;
exports.generateJson = generateJson;
const genai_1 = require("@google/genai");
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const config_1 = require("../config");
const schemas_1 = require("./schemas");
let client = null;
function ai() {
    if (!client) {
        const apiKey = config_1.GEMINI_API_KEY.value();
        if (!apiKey) {
            throw new https_1.HttpsError("failed-precondition", "ai-not-configured");
        }
        client = new genai_1.GoogleGenAI({ apiKey });
    }
    return client;
}
function modelName() {
    return config_1.GEMINI_MODEL.value();
}
/** Calls Gemini in JSON mode and returns the parsed object. Content is never logged. */
async function generateJson(parts, schema, task) {
    const started = Date.now();
    try {
        const response = await ai().models.generateContent({
            model: modelName(),
            contents: [{ role: "user", parts: [...parts, { text: task }] }],
            config: {
                systemInstruction: schemas_1.SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseJsonSchema: schema,
                temperature: 0,
            },
        });
        const text = response.text;
        if (!text)
            throw new Error("empty response");
        return JSON.parse(text);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        firebase_functions_1.logger.error("gemini request failed", { ms: Date.now() - started, message: err.message });
        throw new https_1.HttpsError("unavailable", "ai-unavailable");
    }
}
//# sourceMappingURL=gemini.js.map