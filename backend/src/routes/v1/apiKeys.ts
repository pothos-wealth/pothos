import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { nanoid } from "nanoid"
import { randomBytes, createHash } from "crypto"
import { eq, and } from "drizzle-orm"
import { db } from "../../db/index.js"
import { apiKeys } from "../../db/schema.js"
import { sessionOnlyAuthenticate } from "../../middleware/sessionOnlyAuthenticate.js"

const createApiKeySchema = z.object({
	name: z.string().min(1, "Name is required").max(64, "Name must be 64 characters or fewer"),
})

export async function apiKeyRoutes(app: FastifyInstance) {
	// GET /api-keys — list user's keys (never returns the hash)
	app.get("/api-keys", { preHandler: sessionOnlyAuthenticate }, async (request, reply) => {
		const rows = db
			.select({
				id: apiKeys.id,
				name: apiKeys.name,
				lastUsedAt: apiKeys.lastUsedAt,
				createdAt: apiKeys.createdAt,
			})
			.from(apiKeys)
			.where(eq(apiKeys.userId, request.user.id))
			.all()

		return reply.send(rows)
	})

	// POST /api-keys — generate a new key, returns raw key once only
	app.post("/api-keys", { preHandler: sessionOnlyAuthenticate }, async (request, reply) => {
		const result = createApiKeySchema.safeParse(request.body)
		if (!result.success) {
			return reply
				.status(400)
				.send({ error: "Validation error", details: result.error.flatten() })
		}

		const rawKey = "pth_" + randomBytes(32).toString("hex")
		const keyHash = createHash("sha256").update(rawKey).digest("hex")
		const now = Math.floor(Date.now() / 1000)
		const id = nanoid()

		db.insert(apiKeys)
			.values({
				id,
				userId: request.user.id,
				keyHash,
				name: result.data.name,
				createdAt: now,
			})
			.run()

		return reply.status(201).send({
			id,
			name: result.data.name,
			key: rawKey,
			createdAt: now,
		})
	})

	// DELETE /api-keys/:id — revoke a key
	app.delete("/api-keys/:id", { preHandler: sessionOnlyAuthenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const key = db
			.select()
			.from(apiKeys)
			.where(and(eq(apiKeys.id, id), eq(apiKeys.userId, request.user.id)))
			.get()

		if (!key) {
			return reply.status(404).send({ error: "API key not found" })
		}

		db.delete(apiKeys).where(eq(apiKeys.id, id)).run()
		return reply.status(204).send()
	})
}
