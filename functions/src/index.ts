import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ maxInstances: 20 });

export { analyzeCapture, extractReceipt } from "./ai/callables";
export { dispatchReminders } from "./reminders";
export { deleteMyAccount, deleteMyData, exportMyData, onReceiptDeleted, onVaultDocumentDeleted } from "./account";
