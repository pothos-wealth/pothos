import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { pendingMessages, imapSettings } from "../db/schema.js";
import { eq } from "drizzle-orm";

function htmlToText(html: string): string {
    const match = html.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
    if (!match) return html;

    const inner = match[1]
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/\s+/g, " ")
        .trim();

    return `<html>\n${inner}\n</html>`;
}

interface ImapConfig {
    host: string;
    port: number;
    email: string;
    password: string; // already decrypted
    mailbox: string;
}

function createClient(config: ImapConfig): ImapFlow {
    return new ImapFlow({
        host: config.host,
        port: config.port,
        secure: true,
        auth: {
            user: config.email,
            pass: config.password,
        },
        logger: false,
    });
}

export async function testConnection(config: Omit<ImapConfig, "mailbox">): Promise<void> {
    const client = createClient({ ...config, mailbox: "INBOX" });
    try {
        await client.connect();
    } finally {
        await client.logout().catch(() => {});
    }
}

export async function fetchNewEmails(
    userId: string,
    config: ImapConfig,
    lastUid: string | null
): Promise<{ fetched: number; newCursor: string | null }> {
    const client = createClient(config);
    let fetched = 0;
    let newCursor: string | null = null;

    try {
        await client.connect();
        await client.mailboxOpen(config.mailbox);

        // First run: last 90 days. Subsequent: from lastUid+1 onward.
        let searchCriteria: object;
        if (lastUid) {
            const nextUid = String(parseInt(lastUid, 10) + 1);
            searchCriteria = { uid: `${nextUid}:*` };
        } else {
            const since = new Date();
            since.setDate(since.getDate() - 90);
            searchCriteria = { since };
        }

        const now = Math.floor(Date.now() / 1000);

        for await (const message of client.fetch(searchCriteria, {
            uid: true,
            source: true,
            envelope: true,
        })) {
            const uid = String(message.uid);

            // Skip the lastUid itself (search is inclusive)
            if (lastUid && uid === lastUid) continue;

            try {
                if (!message.source) continue;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parsed = await (simpleParser as any)(message.source) as { subject?: string; text?: string; html?: string };
                const subject = parsed.subject ?? null;
                const rawContent = parsed.text
                    ? parsed.text
                    : parsed.html
                        ? htmlToText(parsed.html)
                        : "";

                if (!rawContent.trim()) continue;

                db.insert(pendingMessages)
                    .values({
                        id: nanoid(),
                        userId,
                        rawContent,
                        subject,
                        source: "imap",
                        status: "pending",
                        createdAt: now,
                        updatedAt: now,
                    })
                    .run();

                fetched++;
                newCursor = uid;
            } catch {
                // Skip unparseable individual messages
            }
        }

        // Update cursor on imap_settings
        if (newCursor) {
            db.update(imapSettings)
                .set({ lastUid: newCursor, updatedAt: now })
                .where(eq(imapSettings.userId, userId))
                .run();
        }
    } finally {
        await client.logout().catch(() => {});
    }

    return { fetched, newCursor };
}
