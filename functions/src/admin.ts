import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

initializeApp();

export const db = getFirestore();
export const auth = getAuth();
export const bucket = () => getStorage().bucket();
export const messaging = () => getMessaging();

export async function writeAudit(
  ownerId: string,
  action: string,
  targetType: string | null = null,
  targetId: string | null = null,
): Promise<void> {
  await db.collection("auditLogs").add({
    ownerId,
    action,
    targetType,
    targetId,
    createdAt: FieldValue.serverTimestamp(),
  });
}
