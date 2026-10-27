"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onVaultDocumentDeleted = exports.onReceiptDeleted = exports.exportMyData = exports.deleteMyData = exports.deleteMyAccount = exports.dispatchReminders = exports.extractReceipt = exports.analyzeCapture = void 0;
const v2_1 = require("firebase-functions/v2");
(0, v2_1.setGlobalOptions)({ maxInstances: 20 });
var callables_1 = require("./ai/callables");
Object.defineProperty(exports, "analyzeCapture", { enumerable: true, get: function () { return callables_1.analyzeCapture; } });
Object.defineProperty(exports, "extractReceipt", { enumerable: true, get: function () { return callables_1.extractReceipt; } });
var reminders_1 = require("./reminders");
Object.defineProperty(exports, "dispatchReminders", { enumerable: true, get: function () { return reminders_1.dispatchReminders; } });
var account_1 = require("./account");
Object.defineProperty(exports, "deleteMyAccount", { enumerable: true, get: function () { return account_1.deleteMyAccount; } });
Object.defineProperty(exports, "deleteMyData", { enumerable: true, get: function () { return account_1.deleteMyData; } });
Object.defineProperty(exports, "exportMyData", { enumerable: true, get: function () { return account_1.exportMyData; } });
Object.defineProperty(exports, "onReceiptDeleted", { enumerable: true, get: function () { return account_1.onReceiptDeleted; } });
Object.defineProperty(exports, "onVaultDocumentDeleted", { enumerable: true, get: function () { return account_1.onVaultDocumentDeleted; } });
//# sourceMappingURL=index.js.map