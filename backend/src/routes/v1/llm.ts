import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { llmSettings } from "../../db/schema.js";
import { authenticate } from "../../middleware/authenticate.js";
import { encrypt, decrypt } from "../../services/crypto.js";

const upsertSchema = z.object({
    provider: z.enum(["openai", "anthropic", "local"]),
    apiKey: z.string().nullable().optional(),
    model: z.string().min(1, "Model is required"),
});

function maskApiKey(encrypted: string | null): string | null {
    if (!encrypted) return null;
    try {
        const plain = decrypt(encrypted);
        if (plain.length <= 4) return "••••";
        return "••••" + plain.slice(-4);
    } catch {
        return "••••";
    }
}

export async function llmRoutes(app: FastifyInstance) {
    // ─── GET /llm/settings ────────────────────────────────────────────────────

    app.get("/llm/settings", { preHandler: authenticate }, async (request, reply) => {
        const settings = db
            .select()
            .from(llmSettings)
            .where(eq(llmSettings.userId, request.user.id))
            .get();

        if (!settings) {
            return reply.status(404).send({ error: "LLM settings not configured" });
        }

        return reply.send({
            id: settings.id,
            userId: settings.userId,
            provider: settings.provider,
            apiKey: maskApiKey(settings.apiKey ?? null),
            model: settings.model,
            createdAt: settings.createdAt,
            updatedAt: settings.updatedAt,
        });
    });

    // ─── PUT /llm/settings ────────────────────────────────────────────────────

    app.put("/llm/settings", { preHandler: authenticate }, async (request, reply) => {
        const result = upsertSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: "Validation error", details: result.error.flatten() });
        }

        const { provider, apiKey, model } = result.data;
        const now = Math.floor(Date.now() / 1000);

        const existing = db
            .select({ id: llmSettings.id })
            .from(llmSettings)
            .where(eq(llmSettings.userId, request.user.id))
            .get();

        if (existing) {
            // Only update apiKey if explicitly provided; undefined means "keep existing"
            const updateFields: Partial<typeof llmSettings.$inferInsert> = { provider, model, updatedAt: now };
            if (apiKey !== undefined) {
                updateFields.apiKey = apiKey ? encrypt(apiKey) : null;
            }

            const updated = db
                .update(llmSettings)
                .set(updateFields)
                .where(eq(llmSettings.userId, request.user.id))
                .returning()
                .get();

            return reply.send({
                ...updated,
                apiKey: maskApiKey(updated.apiKey ?? null),
            });
        } else {
            const inserted = db
                .insert(llmSettings)
                .values({
                    id: nanoid(),
                    userId: request.user.id,
                    provider,
                    apiKey: apiKey ? encrypt(apiKey) : null,
                    model,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning()
                .get();

            return reply.status(201).send({
                ...inserted,
                apiKey: maskApiKey(inserted.apiKey ?? null),
            });
        }
    });
}
