import type { FastifyInstance } from "fastify"
import { eq, sql, gt, and } from "drizzle-orm"
import * as fs from "fs"
import { db } from "../../db/index.js"
import { users, userSettings, accounts, transactions, sessions } from "../../db/schema.js"
import { authenticateAdmin } from "../../middleware/authenticateAdmin.js"
import { runInboxCleanup } from "../../services/maintenance.js"

export async function adminRoutes(app: FastifyInstance) {
	// ─── Settings ─────────────────────────────────────────────────────────────

	app.get("/admin/settings", { preHandler: authenticateAdmin }, async (_request, reply) => {
		const registrationCode = process.env.REGISTRATION_CODE?.trim() || null
		return reply.send({ registrationCode })
	})

	// ─── Stats ────────────────────────────────────────────────────────────────

	app.get("/admin/stats", { preHandler: authenticateAdmin }, async (_request, reply) => {
		const dbPath = process.env.DATABASE_URL ?? "./data/pothos.db"
		let dbSizeBytes = 0
		try {
			dbSizeBytes = fs.statSync(dbPath).size
		} catch (err) {
			app.log.warn(
				`Could not stat database file at ${dbPath}: ${err instanceof Error ? err.message : String(err)}`
			)
		}

		const userCount = db
			.select({ count: sql<number>`count(*)` })
			.from(users)
			.get()

		const txCount = db
			.select({ count: sql<number>`count(*)` })
			.from(transactions)
			.get()

		return reply.send({
			dbSizeBytes,
			totalUsers: userCount?.count ?? 0,
			totalTransactions: txCount?.count ?? 0,
		})
	})

	// ─── User List ────────────────────────────────────────────────────────────

	app.get("/admin/users", { preHandler: authenticateAdmin }, async (_request, reply) => {
		const allUsers = db
			.select({
				id: users.id,
				email: users.email,
				createdAt: users.createdAt,
				isSuperadmin: users.isSuperadmin,
				currency: userSettings.currency,
			})
			.from(users)
			.leftJoin(userSettings, eq(userSettings.userId, users.id))
			.all()

		const accountCounts = db
			.select({
				userId: accounts.userId,
				count: sql<number>`count(*)`,
			})
			.from(accounts)
			.groupBy(accounts.userId)
			.all()

		const txCounts = db
			.select({
				userId: transactions.userId,
				count: sql<number>`count(*)`,
			})
			.from(transactions)
			.groupBy(transactions.userId)
			.all()

		const now = Math.floor(Date.now() / 1000)
		const sessionCounts = db
			.select({
				userId: sessions.userId,
				count: sql<number>`count(*)`,
			})
			.from(sessions)
			.where(gt(sessions.expiresAt, now))
			.groupBy(sessions.userId)
			.all()

		const accountMap = new Map(accountCounts.map((r) => [r.userId, r.count]))
		const txMap = new Map(txCounts.map((r) => [r.userId, r.count]))
		const sessionMap = new Map(sessionCounts.map((r) => [r.userId, r.count]))

		const result = allUsers.map((u) => ({
			id: u.id,
			email: u.email,
			createdAt: u.createdAt,
			isSuperadmin: u.isSuperadmin,
			currency: u.currency ?? null,
			accountCount: accountMap.get(u.id) ?? 0,
			transactionCount: txMap.get(u.id) ?? 0,
			activeSessionCount: sessionMap.get(u.id) ?? 0,
		}))

		return reply.send(result)
	})

	// ─── Delete User ──────────────────────────────────────────────────────────

	app.delete("/admin/users/:id", { preHandler: authenticateAdmin }, async (request, reply) => {
		const { id } = request.params as { id: string }

		if (id === request.user.id) {
			return reply.status(403).send({ error: "Cannot delete your own account" })
		}

		const target = db
			.select({ isSuperadmin: users.isSuperadmin })
			.from(users)
			.where(eq(users.id, id))
			.get()
		if (!target) {
			return reply.status(404).send({ error: "User not found" })
		}
		if (target.isSuperadmin) {
			return reply.status(403).send({ error: "Cannot delete another superadmin" })
		}

		db.delete(users).where(eq(users.id, id)).run()

		return reply.status(204).send()
	})

	// ─── Get User Sessions ────────────────────────────────────────────────────

	app.get(
		"/admin/users/:id/sessions",
		{ preHandler: authenticateAdmin },
		async (request, reply) => {
			const { id } = request.params as { id: string }
			const now = Math.floor(Date.now() / 1000)

			const result = db
				.select()
				.from(sessions)
				.where(and(eq(sessions.userId, id), gt(sessions.expiresAt, now)))
				.all()

			return reply.send(result)
		}
	)

	// ─── Revoke All Sessions ──────────────────────────────────────────────────

	app.delete(
		"/admin/users/:id/sessions",
		{ preHandler: authenticateAdmin },
		async (request, reply) => {
			const { id } = request.params as { id: string }

			db.delete(sessions).where(eq(sessions.userId, id)).run()

			return reply.status(204).send()
		}
	)

	// ─── Revoke Single Session ────────────────────────────────────────────────

	app.delete(
		"/admin/users/:id/sessions/:sessionId",
		{ preHandler: authenticateAdmin },
		async (request, reply) => {
			const { id, sessionId } = request.params as { id: string; sessionId: string }

			const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get()
			if (!session) {
				return reply.status(404).send({ error: "Session not found" })
			}
			if (session.userId !== id) {
				return reply.status(400).send({ error: "Session does not belong to this user" })
			}

			db.delete(sessions).where(eq(sessions.id, sessionId)).run()

			return reply.status(204).send()
		}
	)

	// ─── POST /admin/maintenance/run ──────────────────────────────────────────

	app.post(
		"/admin/maintenance/run",
		{ preHandler: authenticateAdmin },
		async (_request, reply) => {
			runInboxCleanup()
			return reply.send({ ok: true })
		}
	)
}
