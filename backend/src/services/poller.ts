import cron from "node-cron";
import { db } from "../db/index.js";
import { imapSettings, llmSettings, accounts, categories, pendingMessages } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { fetchNewEmails } from "./imap.js";
import { parseEmail } from "./parser.js";
import { decrypt } from "./crypto.js";

const POLL_INTERVAL = parseInt(process.env.IMAP_POLL_INTERVAL_MINUTES ?? "15", 10);

// Track consecutive auth failures per user
const authFailures: Record<string, number> = {};
const MAX_AUTH_FAILURES = 3;

export async function pollUser(userId: string): Promise<{ fetched: number; parsed: number }> {
    const settings = db
        .select()
        .from(imapSettings)
        .where(and(eq(imapSettings.userId, userId), eq(imapSettings.isActive, true)))
        .get();

    if (!settings) return { fetched: 0, parsed: 0 };

    const llm = db.select().from(llmSettings).where(eq(llmSettings.userId, userId)).get();

    let password: string;
    try {
        password = decrypt(settings.password);
    } catch {
        console.error(`[poller] Failed to decrypt password for user ${userId}`);
        return { fetched: 0, parsed: 0 };
    }

    const config = {
        host: settings.host,
        port: settings.port,
        email: settings.email,
        password,
        mailbox: settings.mailbox,
    };

    let fetched = 0;
    try {
        const result = await fetchNewEmails(userId, config, settings.lastUid ?? null);
        fetched = result.fetched;
        authFailures[userId] = 0; // reset on success
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[poller] IMAP error for user ${userId}: ${msg}`);

        authFailures[userId] = (authFailures[userId] ?? 0) + 1;
        if (authFailures[userId] >= MAX_AUTH_FAILURES) {
            const now = Math.floor(Date.now() / 1000);
            db.update(imapSettings)
                .set({ isActive: false, updatedAt: now })
                .where(eq(imapSettings.userId, userId))
                .run();
            console.warn(
                `[poller] Disabled IMAP for user ${userId} after ${MAX_AUTH_FAILURES} consecutive failures`
            );
        }
        return { fetched: 0, parsed: 0 };
    }

    // Update lastPolledAt
    const now = Math.floor(Date.now() / 1000);
    db.update(imapSettings)
        .set({ lastPolledAt: now, updatedAt: now })
        .where(eq(imapSettings.userId, userId))
        .run();

    if (fetched === 0) return { fetched: 0, parsed: 0 };

    // Parse all newly pending messages for this user
    const pending = db
        .select()
        .from(pendingMessages)
        .where(and(eq(pendingMessages.userId, userId), eq(pendingMessages.status, "pending")))
        .all();

    const userAccounts = db
        .select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
        .all();

    const userCategories = db
        .select({ id: categories.id, name: categories.name, type: categories.type })
        .from(categories)
        .where(eq(categories.userId, userId))
        .all();

    const llmConfig = {
        provider: llm?.provider ?? "openai",
        apiKey: llm?.apiKey
            ? (() => {
                  try {
                      return decrypt(llm.apiKey!);
                  } catch {
                      return null;
                  }
              })()
            : null,
        model: llm?.model ?? "gpt-4o-mini",
    };

    let parsed = 0;
    for (const msg of pending) {
        try {
            const didParse = await parseEmail(msg.id, msg.rawContent, userId, userAccounts, userCategories, llmConfig);
            if (didParse) parsed++;
        } catch (err) {
            console.error(
                `[poller] Parse error for message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    return { fetched, parsed };
}

export async function pollAllUsers(): Promise<void> {
    const activeSettings = db
        .select({ userId: imapSettings.userId })
        .from(imapSettings)
        .where(eq(imapSettings.isActive, true))
        .all();

    for (const { userId } of activeSettings) {
        try {
            const result = await pollUser(userId);
            if (result.fetched > 0) {
                console.info(
                    `[poller] User ${userId}: fetched=${result.fetched} parsed=${result.parsed}`
                );
            }
        } catch (err) {
            console.error(
                `[poller] Unexpected error for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }
}

export function startPoller(): void {
    const schedule = `*/${POLL_INTERVAL} * * * *`;
    console.info(`[poller] Starting email poller (every ${POLL_INTERVAL} minutes)`);
    cron.schedule(schedule, () => {
        pollAllUsers().catch((err) => {
            console.error("[poller] Poll error:", err);
        });
    });
}
