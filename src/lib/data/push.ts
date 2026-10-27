"use client";

import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { fb, VAPID_KEY } from "@/lib/firebase/client";

export type PushOutcome = "granted" | "blocked" | "unsupported";

function platform(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}

export async function pushSupported(): Promise<boolean> {
  if (!VAPID_KEY) return false;
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  return isSupported().catch(() => false);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/** Asks for notification permission, registers the device and stores its token for the signed-in user. */
export async function enablePush(uid: string): Promise<PushOutcome> {
  if (!(await pushSupported())) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "blocked";

  const registration = await registerServiceWorker();
  const messaging = getMessaging(fb().app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration ?? undefined,
  });
  if (!token) return "unsupported";

  await setDoc(doc(fb().db, "users", uid, "fcmTokens", token), {
    token,
    platform: platform(),
    updatedAt: serverTimestamp(),
  });
  return "granted";
}

export function browserPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Foreground push messages arrive here; returns an unsubscribe function. */
export async function listenForMessages(handler: (title: string, body: string) => void): Promise<() => void> {
  if (!(await pushSupported())) return () => undefined;
  const messaging = getMessaging(fb().app);
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "LifeOS";
    const body = payload.notification?.body ?? "";
    handler(title, body);
  });
}
