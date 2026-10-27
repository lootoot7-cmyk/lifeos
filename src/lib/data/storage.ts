"use client";

import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { fb } from "@/lib/firebase/client";
import type { Attachment } from "@/lib/types";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export type UploadArea = "vault" | "receipts" | "captures" | "avatar";

/** Throws error codes that `errorKey` understands. */
export function validateFile(file: File): void {
  if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
    throw new Error("unsupported-file-type");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("file-too-large");
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(-80) || "file";
}

export async function uploadFile(
  uid: string,
  area: UploadArea,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Attachment> {
  validateFile(file);
  const { storage } = fb();
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const path = `users/${uid}/${area}/${id}-${safeName(file.name)}`;
  const objectRef = ref(storage, path);
  const task = uploadBytesResumable(objectRef, file, { contentType: file.type, cacheControl: "private,max-age=0" });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (!onProgress || snapshot.totalBytes === 0) return;
        onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      },
      reject,
      () => resolve(),
    );
  });

  return { path, name: file.name, contentType: file.type, size: file.size };
}

export async function fileUrl(path: string): Promise<string> {
  return getDownloadURL(ref(fb().storage, path));
}

export async function deleteFile(path: string): Promise<void> {
  await deleteObject(ref(fb().storage, path)).catch(() => undefined);
}
