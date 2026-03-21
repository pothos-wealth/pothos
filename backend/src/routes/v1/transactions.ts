import type { FastifyInstance } from "fastify"
import { eq, and, gte, lte, desc, sql, like } from "drizzle-orm"
import { z } from "zod"
import { nanoid } from "nanoid"
import { db } from "../../db/index.js"
import { transactions, accounts } from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"

const createTransactionSchema = z.object({
	accountId: z.string().min(1, "Account is required"),
	categoryId: z.string().nullable().optional(),
	type: z.enum(["income", "expense"]),
	amount: z.number().int().positive("Amount must be positive").max(1_000_000_000),
	date: z.number().int(),
	description: z.string().min(1, "Description is required"),
	notes: z.string().optional(),
})

const createTransferSchema = z.object({
	fromAccountId: z.string().min(1, "Source account is required"),
	toAccountId: z.string().min(1, "Destination account is required"),
	amount: z.number().int().positive("Amount must be positive").max(1_000_000_000),
	date: z.number().int(),
	description: z.string().min(1, "Description is required"),
	notes: z.string().optional(),
})

const updateTransactionSchema = z.object({
	categoryId: z.string().nullable().optional(),
	amount: z.number().int().positive("Amount must be positive").optional(),
	date: z.number().int().optional(),
	description: z.string().min(1, "Description is required").optional(),
	notes: z.string().nullable().optional(),
})

const listQuerySchema = z.object({
	accountId: z.string().optional(),
	categoryId: z.string().optional(),
	type: z.enum(["income", "expense", "transfer"]).optional(),
	startDate: z.coerce.number().int().optional(),
	endDate: z.coerce.number().int().optional(),
	search: z.string().max(100).optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function transactionRoutes(app: FastifyInstance) {
	// ─── List Transactions ────────────────────────────────────────────────────

	app.get("/transactions", { preHandler: authenticate }, async (request, reply) => {
		const result = listQuerySchema.safeParse(request.query)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const { accountId, categoryId, type, startDate, endDate, search, page, limit } = result.data
		const offset = (page - 1) * limit

		const conditions = [eq(transactions.userId, request.user.id)]

		if (accountId) conditions.push(eq(transactions.accountId, accountId))
		if (categoryId) conditions.push(eq(transactions.categoryId, categoryId))
		if (type) conditions.push(eq(transactions.type, type))
		if (startDate) conditions.push(gte(transactions.date, startDate))
		if (endDate) conditions.push(lte(transactions.date, endDate))
		if (search) conditions.push(like(transactions.description, `%${search.trim()}%`))

		const rows = db
			.select()
			.from(transactions)
			.where(and(...conditions))
			.orderBy(desc(transactions.date))
			.limit(limit)
			.offset(offset)
			.all()

		const totalResult = db
			.select({ count: sql<number>`count(*)` })
			.from(transactions)
			.where(and(...conditions))
			.get()

		const total = totalResult?.count ?? 0

		return reply.send({
			data: rows,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		})
	})

	// ─── Create Transaction ───────────────────────────────────────────────────

	app.post("/transactions", { preHandler: authenticate }, async (request, reply) => {
		const result = createTransactionSchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const { accountId, categoryId, type, amount, date, description, notes } = result.data

		// Verify account belongs to user
		const account = db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, accountId), eq(accounts.userId, request.user.id)))
			.get()

		if (!account) {
			return reply.status(404).send({ error: "Account not found" })
		}

		if (!account.isActive) {
			return reply.status(409).send({ error: "Cannot add transactions to a closed account" })
		}

		const now = Math.floor(Date.now() / 1000)
		const id = nanoid()

		// Income is positive, expense is negative
		const signedAmount = type === "income" ? amount : -amount

		const transaction = db
			.insert(transactions)
			.values({
				id,
				userId: request.user.id,
				accountId,
				categoryId: categoryId ?? null,
				type,
				amount: signedAmount,
				date,
				description,
				notes: notes ?? null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get()

		return reply.status(201).send(transaction)
	})

	// ─── Create Transfer ──────────────────────────────────────────────────────

	app.post("/transactions/transfer", { preHandler: authenticate }, async (request, reply) => {
		const result = createTransferSchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const { fromAccountId, toAccountId, amount, date, description, notes } = result.data

		if (fromAccountId === toAccountId) {
			return reply.status(400).send({
				error: "Source and destination accounts must be different",
			})
		}

		// Verify both accounts belong to user
		const fromAccount = db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, fromAccountId), eq(accounts.userId, request.user.id)))
			.get()

		if (!fromAccount) {
			return reply.status(404).send({ error: "Source account not found" })
		}

		if (!fromAccount.isActive) {
			return reply.status(409).send({ error: "Cannot transfer from a closed account" })
		}

		const toAccount = db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, toAccountId), eq(accounts.userId, request.user.id)))
			.get()

		if (!toAccount) {
			return reply.status(404).send({ error: "Destination account not found" })
		}

		if (!toAccount.isActive) {
			return reply.status(409).send({ error: "Cannot transfer to a closed account" })
		}

		const now = Math.floor(Date.now() / 1000)
		const debitId = nanoid()
		const creditId = nanoid()

		// Create both transfer transactions atomically
		db.transaction((tx) => {
			// Debit side — negative amount on source account
			tx.insert(transactions)
				.values({
					id: debitId,
					userId: request.user.id,
					accountId: fromAccountId,
					categoryId: null,
					transferAccountId: toAccountId,
					transferTransactionId: creditId,
					type: "transfer",
					amount: -amount,
					date,
					description,
					notes: notes ?? null,
					createdAt: now,
					updatedAt: now,
				})
				.run()

			// Credit side — positive amount on destination account
			tx.insert(transactions)
				.values({
					id: creditId,
					userId: request.user.id,
					accountId: toAccountId,
					categoryId: null,
					transferAccountId: fromAccountId,
					transferTransactionId: debitId,
					type: "transfer",
					amount: amount,
					date,
					description,
					notes: notes ?? null,
					createdAt: now,
					updatedAt: now,
				})
				.run()
		})

		const debit = db
			.select()
			.from(transactions)
			.where(and(eq(transactions.id, debitId), eq(transactions.userId, request.user.id)))
			.get()

		const credit = db
			.select()
			.from(transactions)
			.where(and(eq(transactions.id, creditId), eq(transactions.userId, request.user.id)))
			.get()

		return reply.status(201).send({ debit, credit })
	})

	// ─── Get Transaction ──────────────────────────────────────────────────────

	app.get("/transactions/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const transaction = db
			.select()
			.from(transactions)
			.where(and(eq(transactions.id, id), eq(transactions.userId, request.user.id)))
			.get()

		if (!transaction) {
			return reply.status(404).send({ error: "Transaction not found" })
		}

		return reply.send(transaction)
	})

	// ─── Update Transaction ───────────────────────────────────────────────────

	app.put("/transactions/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const result = updateTransactionSchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const transaction = db
			.select()
			.from(transactions)
			.where(and(eq(transactions.id, id), eq(transactions.userId, request.user.id)))
			.get()

		if (!transaction) {
			return reply.status(404).send({ error: "Transaction not found" })
		}

		// Block editing transfer transactions
		if (transaction.type === "transfer") {
			return reply.status(409).send({
				error: "Transfer transactions cannot be edited. Delete and recreate instead.",
			})
		}

		const now = Math.floor(Date.now() / 1000)

		// Re-apply sign if amount is being updated
		let signedAmount: number | undefined
		if (result.data.amount !== undefined) {
			signedAmount = transaction.type === "income" ? result.data.amount : -result.data.amount
		}

		const updated = db
			.update(transactions)
			.set({
				...(result.data.categoryId !== undefined && {
					categoryId: result.data.categoryId,
				}),
				...(signedAmount !== undefined && { amount: signedAmount }),
				...(result.data.date !== undefined && { date: result.data.date }),
				...(result.data.description !== undefined && {
					description: result.data.description,
				}),
				...(result.data.notes !== undefined && { notes: result.data.notes }),
				updatedAt: now,
			})
			.where(eq(transactions.id, id))
			.returning()
			.get()

		return reply.send(updated)
	})

	// ─── Delete Transaction ───────────────────────────────────────────────────

	app.delete("/transactions/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const transaction = db
			.select()
			.from(transactions)
			.where(and(eq(transactions.id, id), eq(transactions.userId, request.user.id)))
			.get()

		if (!transaction) {
			return reply.status(404).send({ error: "Transaction not found" })
		}

		if (transaction.type === "transfer" && transaction.transferTransactionId) {
			// Delete both sides of the transfer atomically
			db.transaction((tx) => {
				tx.delete(transactions)
					.where(and(eq(transactions.id, id), eq(transactions.userId, request.user.id)))
					.run()

				tx.delete(transactions)
					.where(
						and(
							eq(transactions.id, transaction.transferTransactionId!),
							eq(transactions.userId, request.user.id)
						)
					)
					.run()
			})
		} else {
			db.delete(transactions).where(eq(transactions.id, id)).run()
		}

		return reply.status(204).send()
	})
}
