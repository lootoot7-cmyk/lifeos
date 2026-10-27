"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messaging = exports.bucket = exports.auth = exports.db = void 0;
exports.writeAudit = writeAudit;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const storage_1 = require("firebase-admin/storage");
(0, app_1.initializeApp)();
exports.db = (0, firestore_1.getFirestore)();
exports.auth = (0, auth_1.getAuth)();
const bucket = () => (0, storage_1.getStorage)().bucket();
exports.bucket = bucket;
const messaging = () => (0, messaging_1.getMessaging)();
exports.messaging = messaging;
async function writeAudit(ownerId, action, targetType = null, targetId = null) {
    await exports.db.collection("auditLogs").add({
        ownerId,
        action,
        targetType,
        targetId,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=admin.js.map