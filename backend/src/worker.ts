import dotenv from "dotenv";
import { validateEncryptionKey } from "./services/crypto.js";
import { startPoller } from "./services/poller.js";

dotenv.config();

validateEncryptionKey();

console.info("[worker] Starting email poller worker...");
startPoller();

process.on("SIGTERM", () => {
    console.info("[worker] Received SIGTERM, shutting down...");
    process.exit(0);
});
