import type { FastifyInstance } from "fastify"
import { eq, and, sql, inArray } from "drizzle-orm"
import { z } from "zod"
import { nanoid } from "nanoid"
import { db } from "../../db/index.js"
import { accounts, transactions } from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"

const createAccountSchema = z.object({
	name: z.string().min(1, "Account name is required"),
	type: z.string().min(1, "Account type is required"),
	initialBalance: z.number().int().min(-1_000_000_000).max(1_000_000_000).default(0),
})

const updateAccountSchema = z.object({
	name: z.string().min(1, "Account name is required").optional(),
	type: z.string().min(1, "Account type is required").optional(),
})

// ─── Balance Helper ───────────────────────────────────────────────────────────

function getAccountBalance(accountId: string, initialBalance: number): number {
	const result = db
		.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
		.from(transactions)
		.where(eq(transactions.accountId, accountId))
		.get()

	return initialBalance + (result?.total ?? 0)
}

export async function accountRoutes(app: FastifyInstance) {
	// ─── List Accounts ────────────────────────────────────────────────────────

	app.get("/accounts", { preHandler: authenticate }, async (request, reply) => {
		const query = request.query as { includeInactive?: string }
		const includeInactive = query.includeInactive === "true"

		const rows = db
			.select()
			.from(accounts)
			.where(
				includeInactive
					? eq(accounts.userId, request.user.id)
					: and(eq(accounts.userId, request.user.id), eq(accounts.isActive, true))
			)
			.all()

		const accountIds = rows.map((a) => a.id)
		const balanceMap = new Map<string, number>()

		if (accountIds.length > 0) {
			const balances = db
				.select({
					accountId: transactions.accountId,
					total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
				})
				.from(transactions)
				.where(inArray(transactions.accountId, accountIds))
				.groupBy(transactions.accountId)
				.all()

			for (const b of balances) {
				balanceMap.set(b.accountId, b.total)
			}
		}

		const result = rows.map((account) => ({
			...account,
			balance: account.initialBalance + (balanceMap.get(account.id) ?? 0),
		}))

		return reply.send(result)
	})

	// ─── Create Account ───────────────────────────────────────────────────────

	app.post("/accounts", { preHandler: authenticate }, async (request, reply) => {
		const result = createAccountSchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const now = Math.floor(Date.now() / 1000)
		const id = nanoid()

		const account = db
			.insert(accounts)
			.values({
				id,
				userId: request.user.id,
				name: result.data.name,
				type: result.data.type,
				initialBalance: result.data.initialBalance,
				isActive: true,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get()

		return reply.status(201).send({
			...account,
			balance: account.initialBalance,
		})
	})

	// ─── Get Account ──────────────────────────────────────────────────────────

	app.get("/accounts/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const account = db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, id), eq(accounts.userId, request.user.id)))
			.get()

		if (!account) {
			return reply.status(404).send({ error: "Account not found" })
		}

		return reply.send({
			...account,
			balance: getAccountBalance(account.id, account.initialBalance),
		})
	})

	// ─── Update Account ───────────────────────────────────────────────────────

	app.put("/accounts/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const result = updateAccountSchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const account = db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, id), eq(accounts.userId, request.user.id)))
			.get()

		if (!account) {
			return reply.status(404).send({ error: "Account not found" })
		}

		const now = Math.floor(Date.now() / 1000)

		const updated = db
			.update(accounts)
			.set({
				...(result.data.name !== undefined && { name: result.data.name }),
				...(result.data.type !== undefined && { type: result.data.type }),
				updatedAt: now,
			})
			.where(eq(accounts.id, id))
			.returning()
			.get()

		return reply.send({
			...updated,
			balance: getAccountBalance(id, updated!.initialBalance),
		})
	})

	// ─── Delete Account ───────────────────────────────────────────────────────

	app.delete("/accounts/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const account = db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, id), eq(accounts.userId, request.user.id)))
			.get()

		if (!account) {
			return reply.status(404).send({ error: "Account not found" })
		}

		// Block deletion if any transactions exist
		const txCount = db
			.select({ count: sql<number>`count(*)` })
			.from(transactions)
			.where(eq(transactions.accountId, id))
			.get()

		if (txCount && txCount.count > 0) {
			return reply.status(409).send({
				error: "Cannot delete account with existing transactions. Close it instead.",
			})
		}

		db.delete(accounts).where(eq(accounts.id, id)).run()

		return reply.status(204).send()
	})

	// ─── Close Account ────────────────────────────────────────────────────────

	app.post("/accounts/:id/close", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const account = db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, id), eq(accounts.userId, request.user.id)))
			.get()

		if (!account) {
			return reply.status(404).send({ error: "Account not found" })
		}

		if (!account.isActive) {
			return reply.status(409).send({ error: "Account is already closed" })
		}

		const balance = getAccountBalance(id, account.initialBalance)

		if (balance !== 0) {
			return reply.status(409).send({
				error: "Cannot close account with non-zero balance",
			})
		}

		const now = Math.floor(Date.now() / 1000)

		const updated = db
			.update(accounts)
			.set({ isActive: false, updatedAt: now })
			.where(eq(accounts.id, id))
			.returning()
			.get()

		return reply.send({
			...updated,
			balance: getAccountBalance(id, updated!.initialBalance),
		})
	})

	// ─── Reopen Account ───────────────────────────────────────────────────────

	app.post("/accounts/:id/reopen", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const account = db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, id), eq(accounts.userId, request.user.id)))
			.get()

		if (!account) {
			return reply.status(404).send({ error: "Account not found" })
		}

		if (account.isActive) {
			return reply.status(409).send({ error: "Account is already active" })
		}

		const now = Math.floor(Date.now() / 1000)

		const updated = db
			.update(accounts)
			.set({ isActive: true, updatedAt: now })
			.where(eq(accounts.id, id))
			.returning()
			.get()

		return reply.send({
			...updated,
			balance: getAccountBalance(id, updated!.initialBalance),
		})
	})
}
