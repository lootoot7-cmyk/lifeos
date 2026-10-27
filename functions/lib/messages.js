"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderMessage = reminderMessage;
exports.linkFor = linkFor;
function when(lang, days) {
    if (lang === "ur") {
        if (days <= 0)
            return "آج";
        if (days === 1)
            return "کل";
        return `${days} دن میں`;
    }
    if (days <= 0)
        return "today";
    if (days === 1)
        return "tomorrow";
    return `in ${days} days`;
}
const TEMPLATES = {
    en: {
        expiry: (n, w) => ({ title: "Expiry reminder", body: `${n} expires ${w}.` }),
        renewal: (n, w) => ({ title: "Renewal reminder", body: `${n} is due for renewal ${w}.` }),
        warranty: (n, w) => ({ title: "Warranty reminder", body: `Your ${n} warranty ends ${w}.` }),
        return: (n, w) => ({ title: "Return window", body: `Your return window at ${n} ends ${w}.` }),
        bill: (n, w) => ({ title: "Bill due", body: `${n} is due ${w}.` }),
        custom: (n, w) => ({ title: "Reminder", body: `${n} is due ${w}.` }),
    },
    ur: {
        expiry: (n, w) => ({ title: "میعاد کی یاد دہانی", body: `${n} کی میعاد ${w} ختم ہو رہی ہے۔` }),
        renewal: (n, w) => ({ title: "تجدید کی یاد دہانی", body: `${n} کی تجدید ${w} ہونی ہے۔` }),
        warranty: (n, w) => ({ title: "وارنٹی کی یاد دہانی", body: `${n} کی وارنٹی ${w} ختم ہو رہی ہے۔` }),
        return: (n, w) => ({ title: "واپسی کی مدت", body: `${n} پر واپسی کی مدت ${w} ختم ہو رہی ہے۔` }),
        bill: (n, w) => ({ title: "بل کی ادائیگی", body: `${n} کی ادائیگی ${w} ہے۔` }),
        custom: (n, w) => ({ title: "یاد دہانی", body: `${n} ${w}۔` }),
    },
};
function reminderMessage(lang, kind, name, daysLeft) {
    const tpl = TEMPLATES[lang][kind] ?? TEMPLATES[lang].custom;
    return tpl(name, when(lang, daysLeft));
}
function linkFor(sourceType, sourceId) {
    if (!sourceId)
        return "/alerts/";
    if (sourceType === "document")
        return `/vault/view/?id=${encodeURIComponent(sourceId)}`;
    if (sourceType === "receipt")
        return `/receipts/view/?id=${encodeURIComponent(sourceId)}`;
    return "/alerts/";
}
//# sourceMappingURL=messages.js.map