import type { FastifyRequest, FastifyReply } from "fastify"
import { db } from "../db/index.js"
import { sessions, users, apiKeys } from "../db/schema.js"
import { eq, and, gt } from "drizzle-orm"
import { createHash } from "crypto"

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
	const now = Math.floor(Date.now() / 1000)

	// 1. Try session cookie first
	const sessionId = request.cookies["session_id"]
	if (sessionId) {
		const result = db
			.select({ session: sessions, user: users })
			.from(sessions)
			.innerJoin(users, eq(sessions.userId, users.id))
			.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
			.get()

		if (result) {
			request.user = result.user
			request.session = result.session
			return
		}
	}

	// 2. Try Authorization: Bearer header
	const authHeader = request.headers.authorization
	if (authHeader?.startsWith("Bearer ")) {
		const rawKey = authHeader.slice(7)

		// Validate format before hitting the DB: pth_ + 64 hex chars
		if (/^pth_[0-9a-f]{64}$/.test(rawKey)) {
			const keyHash = createHash("sha256").update(rawKey).digest("hex")

			const result = db
				.select({ apiKey: apiKeys, user: users })
				.from(apiKeys)
				.innerJoin(users, eq(apiKeys.userId, users.id))
				.where(eq(apiKeys.keyHash, keyHash))
				.get()

			if (result) {
				request.user = result.user
				request.session = undefined

				// Update last_used_at without blocking the response
				setImmediate(() => {
					db.update(apiKeys)
						.set({ lastUsedAt: now })
						.where(eq(apiKeys.id, result.apiKey.id))
						.run()
				})
				return
			}
		}
	}

	return reply.status(401).send({ error: "Unauthorized" })
}
