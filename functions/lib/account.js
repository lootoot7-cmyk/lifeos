"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReceiptDeleted = exports.onVaultDocumentDeleted = exports.deleteMyAccount = exports.deleteMyData = exports.exportMyData = void 0;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
const admin_1 = require("./admin");
const config_1 = require("./config");
const guards_1 = require("./guards");
const opts = { region: config_1.REGION, enforceAppCheck: config_1.ENFORCE_APP_CHECK, timeoutSeconds: 300, memory: "512MiB" };
async function deleteQuery(query) {
    let deleted = 0;
    for (;;) {
        const snap = await query.limit(400).get();
        if (snap.empty)
            return deleted;
        const batch = admin_1.db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += snap.size;
    }
}
function serialize(value) {
    if (value && typeof value === "object") {
        if (typeof value.toDate === "function") {
            return value.toDate().toISOString();
        }
        if (Array.isArray(value))
            return value.map(serialize);
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
    }
    return value;
}
/** Writes all of the caller's data to a private JSON file in their storage folder and returns its path. */
exports.exportMyData = (0, https_1.onCall)(opts, async (req) => {
    const uid = (0, guards_1.requireUid)(req);
    const out = {
        exportedAt: new Date().toISOString(),
        format: "lifeos-export-v1",
    };
    const profile = await admin_1.db.doc(`profiles/${uid}`).get();
    out.profile = serialize(profile.data() ?? null);
    const account = await admin_1.db.doc(`users/${uid}`).get();
    out.account = serialize(account.data() ?? null);
    for (const name of config_1.OWNED_COLLECTIONS) {
        const snap = await admin_1.db.collection(name).where("ownerId", "==", uid).get();
        out[name] = snap.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
    }
    const [files] = await (0, admin_1.bucket)().getFiles({ prefix: `users/${uid}/` });
    out.files = files
        .filter((f) => !f.name.includes("/exports/"))
        .map((f) => ({ path: f.name, size: Number(f.metadata.size ?? 0), contentType: f.metadata.contentType ?? null }));
    const path = `users/${uid}/exports/lifeos-export-${Date.now()}.json`;
    await (0, admin_1.bucket)()
        .file(path)
        .save(JSON.stringify(out, null, 2), { contentType: "application/json", resumable: false });
    await (0, admin_1.writeAudit)(uid, "data_exported", "export", path);
    return { path };
});
/** Deletes everything the caller has stored but keeps the account itself open. */
exports.deleteMyData = (0, https_1.onCall)(opts, async (req) => {
    const uid = (0, guards_1.requireUid)(req);
    (0, guards_1.requireRecentLogin)(req);
    for (const name of config_1.OWNED_COLLECTIONS) {
        // Audit history records only that actions happened, never their content.
        if (name === "auditLogs")
            continue;
        await deleteQuery(admin_1.db.collection(name).where("ownerId", "==", uid));
    }
    for (const area of ["vault", "receipts", "captures", "avatar", "exports"]) {
        await (0, admin_1.bucket)().deleteFiles({ prefix: `users/${uid}/${area}/` });
    }
    await (0, admin_1.writeAudit)(uid, "data_deleted", "account", uid);
    firebase_functions_1.logger.info("user data deleted");
    return { ok: true };
});
/** Permanently deletes the caller's account, Firestore data and files. */
exports.deleteMyAccount = (0, https_1.onCall)(opts, async (req) => {
    const uid = (0, guards_1.requireUid)(req);
    (0, guards_1.requireRecentLogin)(req);
    for (const name of config_1.OWNED_COLLECTIONS) {
        await deleteQuery(admin_1.db.collection(name).where("ownerId", "==", uid));
    }
    await admin_1.db.recursiveDelete(admin_1.db.doc(`users/${uid}`));
    await admin_1.db.doc(`profiles/${uid}`).delete();
    await (0, admin_1.bucket)().deleteFiles({ prefix: `users/${uid}/` });
    // Keep a non-identifying record that a deletion happened.
    await admin_1.db.collection("auditLogs").add({
        ownerId: "deleted",
        action: "account_deleted",
        targetType: "user",
        targetId: (0, node_crypto_1.createHash)("sha256").update(uid).digest("hex"),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await admin_1.auth.deleteUser(uid);
    firebase_functions_1.logger.info("account deleted");
    return { ok: true };
});
async function deleteFileIfOwned(ownerId, path, areas) {
    if (typeof path !== "string")
        return;
    const [root, owner, area] = path.split("/");
    if (root !== "users" || owner !== ownerId || !areas.includes(area))
        return;
    await (0, admin_1.bucket)()
        .file(path)
        .delete({ ignoreNotFound: true })
        .catch((e) => firebase_functions_1.logger.warn("file delete failed", { message: e.message }));
}
exports.onVaultDocumentDeleted = (0, firestore_2.onDocumentDeleted)({ document: "documents/{id}", region: config_1.REGION }, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const ownerId = data.ownerId;
    const id = event.params.id;
    await deleteQuery(admin_1.db.collection("reminders").where("ownerId", "==", ownerId).where("sourceId", "==", id));
    // Only vault uploads are owned by this record; receipt files are shared with the receipt.
    for (const a of (data.attachments ?? [])) {
        await deleteFileIfOwned(ownerId, a.path, ["vault"]);
    }
    await (0, admin_1.writeAudit)(ownerId, "document_deleted", "document", id);
});
exports.onReceiptDeleted = (0, firestore_2.onDocumentDeleted)({ document: "receipts/{id}", region: config_1.REGION }, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const ownerId = data.ownerId;
    const id = event.params.id;
    await deleteQuery(admin_1.db.collection("reminders").where("ownerId", "==", ownerId).where("sourceId", "==", id));
    await deleteQuery(admin_1.db.collection("purchases").where("ownerId", "==", ownerId).where("receiptId", "==", id));
    const stillReferenced = await admin_1.db
        .collection("documents")
        .where("ownerId", "==", ownerId)
        .where("receiptId", "==", id)
        .limit(1)
        .get();
    if (stillReferenced.empty) {
        await deleteFileIfOwned(ownerId, data.file?.path, ["receipts", "captures"]);
    }
    await (0, admin_1.writeAudit)(ownerId, "receipt_deleted", "receipt", id);
});
//# sourceMappingURL=account.js.map