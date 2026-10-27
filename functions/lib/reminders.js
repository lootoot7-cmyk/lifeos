"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchReminders = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin_1 = require("./admin");
const config_1 = require("./config");
const dates_1 = require("./dates");
const messages_1 = require("./messages");
async function loadPrefs(uid) {
    const p = (await admin_1.db.doc(`profiles/${uid}`).get()).data() ?? {};
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
async function sendPush(uid, title, body, link) {
    const tokensSnap = await admin_1.db.collection(`users/${uid}/fcmTokens`).get();
    const tokens = tokensSnap.docs.map((d) => d.id);
    if (tokens.length === 0)
        return;
    const res = await (0, admin_1.messaging)().sendEachForMulticast({
        tokens,
        notification: { title, body },
        webpush: { fcmOptions: { link } },
        data: { link },
    });
    const stale = res.responses
        .map((r, i) => ({ r, token: tokens[i] }))
        .filter(({ r }) => ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(r.error?.code ?? ""));
    await Promise.all(stale.map(({ token }) => admin_1.db.doc(`users/${uid}/fcmTokens/${token}`).delete()));
}
async function deliver(doc, prefs, now) {
    const r = doc.data();
    const local = (0, dates_1.localParts)(prefs.timeZone, now);
    if ((0, dates_1.inQuietHours)(local.hour, prefs.quietStart, prefs.quietEnd)) {
        const hoursToWait = ((prefs.quietEnd - local.hour + 24) % 24) || 1;
        await doc.ref.update({ remindAt: firestore_1.Timestamp.fromMillis(now.getTime() + hoursToWait * 3_600_000) });
        return;
    }
    const daysLeft = (0, dates_1.daysBetween)(local.date, r.dueDate);
    const { title, body } = (0, messages_1.reminderMessage)(prefs.language, r.kind, r.title, daysLeft);
    const link = (0, messages_1.linkFor)(r.sourceType, r.sourceId);
    const writes = [];
    if (prefs.inApp) {
        writes.push(admin_1.db.collection("notifications").add({
            ownerId: r.ownerId,
            title,
            body,
            kind: r.kind,
            link,
            read: false,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        }));
    }
    if (prefs.push) {
        writes.push(sendPush(r.ownerId, title, body, link).catch((e) => firebase_functions_1.logger.warn("push failed", { uid: r.ownerId, code: e?.code })));
    }
    if (prefs.emailOn && prefs.email && config_1.EMAIL_NOTIFICATIONS_ENABLED.value()) {
        writes.push(admin_1.db.collection("mail").add({ to: prefs.email, message: { subject: title, text: body } }));
    }
    await Promise.all(writes);
    await doc.ref.update({ status: "sent" });
}
exports.dispatchReminders = (0, scheduler_1.onSchedule)({ schedule: "every 15 minutes", region: config_1.REGION, timeoutSeconds: 540 }, async () => {
    const now = new Date();
    const prefsCache = new Map();
    let processed = 0;
    for (let page = 0; page < 10; page++) {
        const snap = await admin_1.db
            .collection("reminders")
            .where("status", "==", "scheduled")
            .where("remindAt", "<=", firestore_1.Timestamp.fromDate(now))
            .orderBy("remindAt")
            .limit(200)
            .get();
        if (snap.empty)
            break;
        for (const doc of snap.docs) {
            const uid = doc.get("ownerId");
            try {
                if (!prefsCache.has(uid))
                    prefsCache.set(uid, await loadPrefs(uid));
                await deliver(doc, prefsCache.get(uid), now);
            }
            catch (e) {
                firebase_functions_1.logger.error("reminder delivery failed", { reminderId: doc.id, message: e.message });
                await doc.ref.update({ status: "dismissed" }).catch(() => undefined);
            }
            processed++;
        }
        if (snap.size < 200)
            break;
    }
    firebase_functions_1.logger.info("reminders dispatched", { processed });
});
//# sourceMappingURL=reminders.js.map