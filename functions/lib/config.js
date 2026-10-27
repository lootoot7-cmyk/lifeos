"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OWNED_COLLECTIONS = exports.MAX_UPLOAD_BYTES = exports.AI_DAILY_LIMITS = exports.EMAIL_NOTIFICATIONS_ENABLED = exports.ENFORCE_APP_CHECK = exports.GEMINI_MODEL = exports.GEMINI_API_KEY = exports.REGION = void 0;
const params_1 = require("firebase-functions/params");
/** Must match NEXT_PUBLIC_FUNCTIONS_REGION in the web app. */
exports.REGION = "us-central1";
/** Set with: firebase functions:secrets:set GEMINI_API_KEY */
exports.GEMINI_API_KEY = (0, params_1.defineSecret)("GEMINI_API_KEY");
exports.GEMINI_MODEL = (0, params_1.defineString)("GEMINI_MODEL", {
    default: "gemini-3.8-flash",
    description: "Gemini model id used for vision/text extraction.",
});
exports.ENFORCE_APP_CHECK = (0, params_1.defineBoolean)("ENFORCE_APP_CHECK", {
    default: true,
    description: "Reject callable requests without a valid App Check token.",
});
exports.EMAIL_NOTIFICATIONS_ENABLED = (0, params_1.defineBoolean)("EMAIL_NOTIFICATIONS_ENABLED", {
    default: false,
    description: "Write reminder emails to the `mail` collection for the Firebase Trigger Email extension.",
});
exports.AI_DAILY_LIMITS = { free: 30, pro: 300, business: 1000 };
exports.MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
exports.OWNED_COLLECTIONS = [
    "documents",
    "reminders",
    "receipts",
    "purchases",
    "notifications",
    "auditLogs",
];
//# sourceMappingURL=config.js.map