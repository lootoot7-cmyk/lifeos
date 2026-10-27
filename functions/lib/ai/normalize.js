"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeReceipt = normalizeReceipt;
exports.normalizeDocument = normalizeDocument;
exports.normalizeCapture = normalizeCapture;
const dates_1 = require("../dates");
const schemas_1 = require("./schemas");
const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
function str(v, max = 200) {
    if (typeof v !== "string")
        return null;
    const t = v.trim().slice(0, max);
    return t ? t : null;
}
function amount(v) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e12)
        return null;
    return Math.round(v * 100) / 100;
}
function conf(v) {
    return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
function date(v, field, warnings) {
    if (v == null)
        return null;
    if ((0, dates_1.isValidIsoDate)(v))
        return v;
    warnings.push(`${field} could not be read reliably and was left empty.`);
    return null;
}
function warningsFrom(v) {
    return Array.isArray(v) ? v.map((w) => str(w, 300)).filter((w) => !!w).slice(0, 10) : [];
}
const MASK_RE = /\b\d[\d -]{8,}\d\b/g;
const maskNumbers = (s) => s.replace(MASK_RE, (m) => `••••${m.replace(/\D/g, "").slice(-4)}`);
function normalizeReceipt(input, model, today) {
    const r = asObj(input);
    const warnings = warningsFrom(r.warnings);
    const fc = asObj(r.fieldConfidence);
    const purchaseDate = date(r.purchaseDate, "Purchase date", warnings);
    let returnDeadline = date(r.returnDeadline, "Return deadline", warnings);
    const policyDays = typeof r.returnPolicyDays === "number" && Number.isInteger(r.returnPolicyDays) ? r.returnPolicyDays : null;
    let returnConfidence = conf(fc.returnDeadline);
    if (!returnDeadline && purchaseDate && policyDays && policyDays > 0 && policyDays <= 365) {
        returnDeadline = (0, dates_1.addDays)(purchaseDate, policyDays);
        warnings.push(`Return deadline calculated from the printed ${policyDays}-day return policy.`);
        returnConfidence = Math.min(returnConfidence || 0.7, 0.7);
    }
    if (purchaseDate && (0, dates_1.daysBetween)(today, purchaseDate) > 1) {
        warnings.push("Purchase date is in the future. Please check it.");
    }
    const currencyRaw = str(r.currency, 3)?.toUpperCase() ?? null;
    const currency = currencyRaw && /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : null;
    const items = (Array.isArray(r.items) ? r.items : []).slice(0, 200).flatMap((raw) => {
        const it = asObj(raw);
        const name = str(it.name);
        if (!name)
            return [];
        const quantity = typeof it.quantity === "number" && it.quantity > 0 && it.quantity < 1e6 ? it.quantity : 1;
        const category = schemas_1.PURCHASE_CATEGORIES.includes(it.category) ? it.category : "other";
        const wm = it.warrantyMonths;
        const warrantyMonths = typeof wm === "number" && Number.isInteger(wm) && wm > 0 && wm <= 240 ? wm : null;
        return [{ name, quantity, unitPrice: amount(it.unitPrice), totalPrice: amount(it.totalPrice), category, warrantyMonths }];
    });
    const paymentMethod = str(r.paymentMethod, 100);
    return {
        store: str(r.store),
        purchaseDate,
        currency,
        subtotal: amount(r.subtotal),
        tax: amount(r.tax),
        total: amount(r.total),
        paymentMethod: paymentMethod ? maskNumbers(paymentMethod) : null,
        returnDeadline,
        items,
        confidence: conf(r.confidence),
        fieldConfidence: {
            store: conf(fc.store),
            purchaseDate: purchaseDate ? conf(fc.purchaseDate) : 0,
            total: conf(fc.total),
            returnDeadline: returnDeadline ? returnConfidence : 0,
        },
        warnings,
        model,
    };
}
function normalizeDocument(input, model) {
    const r = asObj(input);
    const warnings = warningsFrom(r.warnings);
    const fc = asObj(r.fieldConfidence);
    const category = schemas_1.VAULT_CATEGORIES.includes(r.category) ? r.category : null;
    const expiryDate = date(r.expiryDate, "Expiry date", warnings);
    const issueDate = date(r.issueDate, "Issue date", warnings);
    if (!expiryDate)
        warnings.push("Expiry date could not be confidently detected.");
    const name = str(r.name);
    return {
        name: name ? maskNumbers(name) : null,
        category,
        issueDate,
        expiryDate,
        renewalDate: date(r.renewalDate, "Renewal date", warnings),
        summary: maskNumbers(str(r.summary, 500) ?? ""),
        confidence: conf(r.confidence),
        fieldConfidence: {
            expiryDate: expiryDate ? conf(fc.expiryDate) : 0,
            issueDate: issueDate ? conf(fc.issueDate) : 0,
        },
        warnings,
        model,
    };
}
function normalizeCapture(input, model, today) {
    const r = asObj(input);
    const kinds = ["receipt", "document", "note", "unknown"];
    const kind = kinds.includes(r.kind) ? r.kind : "unknown";
    return {
        kind,
        confidence: conf(r.confidence),
        summary: maskNumbers(str(r.summary, 500) ?? ""),
        receipt: kind === "receipt" && r.receipt ? normalizeReceipt(r.receipt, model, today) : null,
        document: kind === "document" && r.document ? normalizeDocument(r.document, model) : null,
    };
}
//# sourceMappingURL=normalize.js.map