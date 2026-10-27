import { FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, messaging } from "./admin";
import { EMAIL_NOTIFICATIONS_ENABLED, REGION } from "./config";
import { daysBetween, inQuietHours, localParts } from "./dates";
import { linkFor, reminderMessage, type Lang, type ReminderKind } from "./messages";

interface Prefs {
  language: Lang;
  timeZone: string;
  email: string | null;
  push: boolean;
  emailOn: boolean;
  inApp: boolean;
  quietStart: number | null;
  quietEnd: number | null;
}

async function loadPrefs(uid: string): Promise<Prefs> {
  const p = (await db.doc(`profiles/${uid}`).get()).data() ?? {};
  const n = p.notificationPrefs ?? {};
  return {
    language: p.language === "ur" ? "ur" : "en",
    timeZone: typeof p.timeZone === "string" ? p.timeZone : "UTC",
    email: typeof p.email === "string" ? p.email : null,
    push: n.push !== false,
    emailOn: n.email === true,
    inApp: n.inApp !== false,
    quietStart: typeof n.quietStart === "number" ? n.quietStart : null,
    quietEnd: typeof n.quietEnd === "number" ? n.quietEnd : null,
  };
}

async function sendPush(uid: string, title: string, body: string, link: string): Promise<void> {
  const tokensSnap = await db.collection(`users/${uid}/fcmTokens`).get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  if (tokens.length === 0) return;
  const res = await messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: { fcmOptions: { link } },
    data: { link },
  });
  const stale = res.responses
    .map((r, i) => ({ r, token: tokens[i] }))
    .filter(({ r }) =>
      ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(r.error?.code ?? ""),
    );
  await Promise.all(stale.map(({ token }) => db.doc(`users/${uid}/fcmTokens/${token}`).delete()));
}

async function deliver(doc: DocumentSnapshot, prefs: Prefs, now: Date): Promise<void> {
  const r = doc.data()!;
  const local = localParts(prefs.timeZone, now);

  if (inQuietHours(local.hour, prefs.quietStart, prefs.quietEnd)) {
    const hoursToWait = (((prefs.quietEnd as number) - local.hour + 24) % 24) || 1;
    await doc.ref.update({ remindAt: Timestamp.fromMillis(now.getTime() + hoursToWait * 3_600_000) });
    return;
  }

  const daysLeft = daysBetween(local.date, r.dueDate);
  const { title, body } = reminderMessage(prefs.language, r.kind as ReminderKind, r.title, daysLeft);
  const link = linkFor(r.sourceType, r.sourceId);

  const writes: Promise<unknown>[] = [];
  if (prefs.inApp) {
    writes.push(
      db.collection("notifications").add({
        ownerId: r.ownerId,
        title,
        body,
        kind: r.kind,
        link,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      }),
    );
  }
  if (prefs.push) {
    writes.push(sendPush(r.ownerId, title, body, link).catch((e) => logger.warn("push failed", { uid: r.ownerId, code: e?.code })));
  }
  if (prefs.emailOn && prefs.email && EMAIL_NOTIFICATIONS_ENABLED.value()) {
    writes.push(db.collection("mail").add({ to: prefs.email, message: { subject: title, text: body } }));
  }
  await Promise.all(writes);
  await doc.ref.update({ status: "sent" });
}

export const dispatchReminders = onSchedule(
  { schedule: "every 15 minutes", region: REGION, timeoutSeconds: 540 },
  async () => {
    const now = new Date();
    const prefsCache = new Map<string, Prefs>();
    let processed = 0;

    for (let page = 0; page < 10; page++) {
      const snap = await db
        .collection("reminders")
        .where("status", "==", "scheduled")
        .where("remindAt", "<=", Timestamp.fromDate(now))
        .orderBy("remindAt")
        .limit(200)
        .get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const uid = doc.get("ownerId") as string;
        try {
          if (!prefsCache.has(uid)) prefsCache.set(uid, await loadPrefs(uid));
          await deliver(doc, prefsCache.get(uid)!, now);
        } catch (e) {
          logger.error("reminder delivery failed", { reminderId: doc.id, message: (e as Error).message });
          await doc.ref.update({ status: "dismissed" }).catch(() => undefined);
        }
        processed++;
      }
      if (snap.size < 200) break;
    }
    logger.info("reminders dispatched", { processed });
  },
);
