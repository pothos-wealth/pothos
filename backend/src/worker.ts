import dotenv from "dotenv";
import { validateEncryptionKey } from "./services/crypto.js";
import { startPoller } from "./services/poller.js";
import { startMaintenance } from "./services/maintenance.js";

dotenv.config();

validateEncryptionKey();

console.info("[worker] Starting email poller worker...");
startPoller();

console.info("[worker] Starting maintenance scheduler...");
startMaintenance();

process.on("SIGTERM", () => {
    console.info("[worker] Received SIGTERM, shutting down...");
    process.exit(0);
});
