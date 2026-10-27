import { GoogleGenAI, type Part } from "@google/genai";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config";
import { SYSTEM_INSTRUCTION } from "./schemas";

let client: GoogleGenAI | null = null;

function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "ai-not-configured");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export function modelName(): string {
  return GEMINI_MODEL.value();
}

/** Calls Gemini in JSON mode and returns the parsed object. Content is never logged. */
export async function generateJson(parts: Part[], schema: object, task: string): Promise<unknown> {
  const started = Date.now();
  try {
    const response = await ai().models.generateContent({
      model: modelName(),
      contents: [{ role: "user", parts: [...parts, { text: task }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        temperature: 0,
      },
    });
    const text = response.text;
    if (!text) throw new Error("empty response");
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error("gemini request failed", { ms: Date.now() - started, message: (err as Error).message });
    throw new HttpsError("unavailable", "ai-unavailable");
  }
}
