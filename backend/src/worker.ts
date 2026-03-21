import "./env.js";
import { validateEncryptionKey } from "./services/crypto.js";
import { startPoller } from "./services/poller.js";
import { startMaintenance } from "./services/maintenance.js";

validateEncryptionKey();

console.info("[worker] Starting email poller worker...");
startPoller();

console.info("[worker] Starting maintenance scheduler...");
startMaintenance();

process.on("SIGTERM", () => {
    console.info("[worker] Received SIGTERM, shutting down...");
    process.exit(0);
});
