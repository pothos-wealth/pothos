import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and, count } from "drizzle-orm";
import { db } from "../../db/index.js";
import { imapSettings, pendingMessages, parsedTransactions } from "../../db/schema.js";
import { authenticate } from "../../middleware/authenticate.js";
import { encrypt } from "../../services/crypto.js";
import { testConnection } from "../../services/imap.js";
import { pollUser } from "../../services/poller.js";

const upsertSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
    host: z.string().min(1, "IMAP host is required"),
    port: z.number().int().min(1).max(65535).default(993),
    mailbox: z.string().min(1).default("INBOX"),
    isActive: z.boolean().optional().default(true),
});

export async function emailRoutes(app: FastifyInstance) {
    // ─── GET /email/settings ──────────────────────────────────────────────────

    app.get("/email/settings", { preHandler: authenticate }, async (request, reply) => {
        const settings = db
            .select({
                id: imapSettings.id,
                userId: imapSettings.userId,
                email: imapSettings.email,
                host: imapSettings.host,
                port: imapSettings.port,
                mailbox: imapSettings.mailbox,
                isActive: imapSettings.isActive,
                lastPolledAt: imapSettings.lastPolledAt,
                createdAt: imapSettings.createdAt,
                updatedAt: imapSettings.updatedAt,
            })
            .from(imapSettings)
            .where(eq(imapSettings.userId, request.user.id))
            .get();

        if (!settings) {
            return reply.status(404).send({ error: "Email integration not configured" });
        }

        return reply.send(settings);
    });

    // ─── PUT /email/settings ──────────────────────────────────────────────────

    app.put("/email/settings", { preHandler: authenticate }, async (request, reply) => {
        const result = upsertSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: "Validation error", details: result.error.flatten() });
        }

        const { email, password, host, port, mailbox, isActive } = result.data;

        // Test connection before saving
        let latestUid: string | null = null;
        try {
            latestUid = await testConnection({ host, port, email, password, mailbox });
        } catch (err) {
            request.log.error({ err }, "IMAP connection test failed");
            const msg = err instanceof Error ? err.message : String(err);
            const isImapError = /auth|login|credential|connect|refused|timeout|certificate|tls|ssl/i.test(msg);
            return reply.status(400).send({
                error: isImapError ? `Connection failed: ${msg}` : "Connection failed. Please check your settings.",
            });
        }

        const encryptedPassword = encrypt(password);
        const now = Math.floor(Date.now() / 1000);

        const existing = db
            .select({ id: imapSettings.id })
            .from(imapSettings)
            .where(eq(imapSettings.userId, request.user.id))
            .get();

        if (existing) {
            const updated = db
                .update(imapSettings)
                .set({ email, password: encryptedPassword, host, port, mailbox, isActive, updatedAt: now })
                .where(eq(imapSettings.userId, request.user.id))
                .returning()
                .get();

            const { password: _pw, ...safe } = updated;
            return reply.send(safe);
        } else {
            const inserted = db
                .insert(imapSettings)
                .values({
                    id: nanoid(),
                    userId: request.user.id,
                    email,
                    password: encryptedPassword,
                    host,
                    port,
                    mailbox,
                    isActive,
                    lastUid: latestUid,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning()
                .get();

            const { password: _pw, ...safe } = inserted;
            return reply.status(201).send(safe);
        }
    });

    // ─── DELETE /email/settings ───────────────────────────────────────────────

    app.delete("/email/settings", { preHandler: authenticate }, async (request, reply) => {
        const existing = db
            .select({ id: imapSettings.id })
            .from(imapSettings)
            .where(eq(imapSettings.userId, request.user.id))
            .get();

        if (!existing) {
            return reply.status(404).send({ error: "Email integration not configured" });
        }

        db.delete(imapSettings).where(eq(imapSettings.userId, request.user.id)).run();
        return reply.status(204).send();
    });

    // ─── GET /email/status ────────────────────────────────────────────────────

    app.get("/email/status", { preHandler: authenticate }, async (request, reply) => {
        const settings = db
            .select()
            .from(imapSettings)
            .where(eq(imapSettings.userId, request.user.id))
            .get();

        const pendingCount =
            db
                .select({ count: count() })
                .from(pendingMessages)
                .where(
                    and(
                        eq(pendingMessages.userId, request.user.id),
                        eq(pendingMessages.status, "pending")
                    )
                )
                .get()?.count ?? 0;

        const pendingReviewCount =
            db
                .select({ count: count() })
                .from(parsedTransactions)
                .where(
                    and(
                        eq(parsedTransactions.userId, request.user.id),
                        eq(parsedTransactions.status, "pending_review")
                    )
                )
                .get()?.count ?? 0;

        return reply.send({
            isConfigured: !!settings,
            isActive: settings?.isActive ?? false,
            lastPolledAt: settings?.lastPolledAt ?? null,
            pendingCount,
            pendingReviewCount,
        });
    });

    // ─── POST /email/poll ─────────────────────────────────────────────────────

    app.post("/email/poll", { preHandler: authenticate }, async (request, reply) => {
        const settings = db
            .select({ id: imapSettings.id })
            .from(imapSettings)
            .where(and(eq(imapSettings.userId, request.user.id), eq(imapSettings.isActive, true)))
            .get();

        if (!settings) {
            return reply.status(400).send({ error: "Email integration not configured or disabled" });
        }

        const result = await pollUser(request.user.id);
        return reply.send(result);
    });
}
