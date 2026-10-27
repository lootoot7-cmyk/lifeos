import { createHash } from "node:crypto";
import { FieldValue, type Query } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { auth, bucket, db, writeAudit } from "./admin";
import { ENFORCE_APP_CHECK, OWNED_COLLECTIONS, REGION } from "./config";
import { requireRecentLogin, requireUid } from "./guards";

const opts = { region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 300, memory: "512MiB" as const };

async function deleteQuery(query: Query): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await query.limit(400).get();
    if (snap.empty) return deleted;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }
}

function serialize(value: unknown): unknown {
  if (value && typeof value === "object") {
    if (typeof (value as { toDate?: unknown }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if (Array.isArray(value)) return value.map(serialize);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

/** Writes all of the caller's data to a private JSON file in their storage folder and returns its path. */
export const exportMyData = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    format: "lifeos-export-v1",
  };
  const profile = await db.doc(`profiles/${uid}`).get();
  out.profile = serialize(profile.data() ?? null);
  const account = await db.doc(`users/${uid}`).get();
  out.account = serialize(account.data() ?? null);
  for (const name of OWNED_COLLECTIONS) {
    const snap = await db.collection(name).where("ownerId", "==", uid).get();
    out[name] = snap.docs.map((d) => ({ id: d.id, ...(serialize(d.data()) as object) }));
  }
  const [files] = await bucket().getFiles({ prefix: `users/${uid}/` });
  out.files = files
    .filter((f) => !f.name.includes("/exports/"))
    .map((f) => ({ path: f.name, size: Number(f.metadata.size ?? 0), contentType: f.metadata.contentType ?? null }));

  const path = `users/${uid}/exports/lifeos-export-${Date.now()}.json`;
  await bucket()
    .file(path)
    .save(JSON.stringify(out, null, 2), { contentType: "application/json", resumable: false });
  await writeAudit(uid, "data_exported", "export", path);
  return { path };
});

/** Deletes everything the caller has stored but keeps the account itself open. */
export const deleteMyData = onCall(opts, async (req) => {
  const uid = requireUid(req);
  requireRecentLogin(req);

  for (const name of OWNED_COLLECTIONS) {
    // Audit history records only that actions happened, never their content.
    if (name === "auditLogs") continue;
    await deleteQuery(db.collection(name).where("ownerId", "==", uid));
  }
  for (const area of ["vault", "receipts", "captures", "avatar", "exports"]) {
    await bucket().deleteFiles({ prefix: `users/${uid}/${area}/` });
  }
  await writeAudit(uid, "data_deleted", "account", uid);
  logger.info("user data deleted");
  return { ok: true };
});

/** Permanently deletes the caller's account, Firestore data and files. */
export const deleteMyAccount = onCall(opts, async (req) => {
  const uid = requireUid(req);
  requireRecentLogin(req);

  for (const name of OWNED_COLLECTIONS) {
    await deleteQuery(db.collection(name).where("ownerId", "==", uid));
  }
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.doc(`profiles/${uid}`).delete();
  await bucket().deleteFiles({ prefix: `users/${uid}/` });

  // Keep a non-identifying record that a deletion happened.
  await db.collection("auditLogs").add({
    ownerId: "deleted",
    action: "account_deleted",
    targetType: "user",
    targetId: createHash("sha256").update(uid).digest("hex"),
    createdAt: FieldValue.serverTimestamp(),
  });
  await auth.deleteUser(uid);
  logger.info("account deleted");
  return { ok: true };
});

async function deleteFileIfOwned(ownerId: string, path: unknown, areas: string[]): Promise<void> {
  if (typeof path !== "string") return;
  const [root, owner, area] = path.split("/");
  if (root !== "users" || owner !== ownerId || !areas.includes(area)) return;
  await bucket()
    .file(path)
    .delete({ ignoreNotFound: true })
    .catch((e) => logger.warn("file delete failed", { message: (e as Error).message }));
}

export const onVaultDocumentDeleted = onDocumentDeleted({ document: "documents/{id}", region: REGION }, async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const ownerId = data.ownerId as string;
  const id = event.params.id;
  await deleteQuery(db.collection("reminders").where("ownerId", "==", ownerId).where("sourceId", "==", id));
  // Vault uploads belong to this record. Capture uploads are removed too, unless
  // a receipt still uses the same file (the capture flow can save both).
  for (const a of (data.attachments ?? []) as Array<{ path?: string }>) {
    if (typeof a.path !== "string") continue;
    const [root, owner, area] = a.path.split("/");
    if (root !== "users" || owner !== ownerId) continue;
    if (area === "vault") {
      await deleteFileIfOwned(ownerId, a.path, ["vault"]);
    } else if (area === "captures") {
      const shared = await db.collection("receipts").where("file.path", "==", a.path).limit(1).get();
      if (shared.empty) await deleteFileIfOwned(ownerId, a.path, ["captures"]);
    }
  }
  await writeAudit(ownerId, "document_deleted", "document", id);
});

export const onReceiptDeleted = onDocumentDeleted({ document: "receipts/{id}", region: REGION }, async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const ownerId = data.ownerId as string;
  const id = event.params.id;
  await deleteQuery(db.collection("reminders").where("ownerId", "==", ownerId).where("sourceId", "==", id));
  await deleteQuery(db.collection("purchases").where("ownerId", "==", ownerId).where("receiptId", "==", id));
  const stillReferenced = await db
    .collection("documents")
    .where("ownerId", "==", ownerId)
    .where("receiptId", "==", id)
    .limit(1)
    .get();
  if (stillReferenced.empty) {
    await deleteFileIfOwned(ownerId, data.file?.path, ["receipts", "captures"]);
  }
  await writeAudit(ownerId, "receipt_deleted", "receipt", id);
});
