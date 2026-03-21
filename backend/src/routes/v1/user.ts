import type { FastifyInstance } from "fastify"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../db/index.js"
import { users, userSettings } from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"

const updateSettingsSchema = z.object({
	currency: z.string().length(3, "Currency must be a valid ISO 4217 code").toUpperCase(),
})

export async function userRoutes(app: FastifyInstance) {
	// ─── Get Current User ─────────────────────────────────────────────────────

	app.get("/user/me", { preHandler: authenticate }, async (request, reply) => {
		const user = db
			.select({
				id: users.id,
				email: users.email,
				isSuperadmin: users.isSuperadmin,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
			})
			.from(users)
			.where(eq(users.id, request.user.id))
			.get()

		if (!user) {
			return reply.status(404).send({ error: "User not found" })
		}

		return reply.send(user)
	})

	// ─── Get User Settings ────────────────────────────────────────────────────

	app.get("/user/settings", { preHandler: authenticate }, async (request, reply) => {
		const settings = db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, request.user.id))
			.get()

		if (!settings) {
			return reply.status(404).send({ error: "Settings not found" })
		}

		return reply.send(settings)
	})

	// ─── Update User Settings ─────────────────────────────────────────────────

	app.put("/user/settings", { preHandler: authenticate }, async (request, reply) => {
		const result = updateSettingsSchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		// Currency is immutable - set at registration, cannot be changed
		const existing = db
			.select({ currency: userSettings.currency })
			.from(userSettings)
			.where(eq(userSettings.userId, request.user.id))
			.get()

		if (existing && result.data.currency !== existing.currency) {
			return reply.status(400).send({
				error: "Currency cannot be changed after account creation",
			})
		}

		const now = Math.floor(Date.now() / 1000)

		const updated = db
			.update(userSettings)
			.set({
				currency: result.data.currency,
				updatedAt: now,
			})
			.where(eq(userSettings.userId, request.user.id))
			.returning()
			.get()

		if (!updated) {
			return reply.status(404).send({ error: "Settings not found" })
		}

		return reply.send(updated)
	})
}
