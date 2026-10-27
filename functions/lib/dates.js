"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidIsoDate = isValidIsoDate;
exports.addDays = addDays;
exports.daysBetween = daysBetween;
exports.localParts = localParts;
exports.inQuietHours = inQuietHours;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function isValidIsoDate(value) {
    if (typeof value !== "string")
        return false;
    const m = ISO_RE.exec(value);
    if (!m)
        return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}
function addDays(date, days) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function daysBetween(from, to) {
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    return Math.round((b - a) / 86_400_000);
}
function localParts(timeZone, now) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
    });
    const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
/** True when `hour` falls inside quiet hours that may wrap past midnight (e.g. 22 -> 7). */
function inQuietHours(hour, start, end) {
    if (start == null || end == null || start === end)
        return false;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
//# sourceMappingURL=dates.js.map