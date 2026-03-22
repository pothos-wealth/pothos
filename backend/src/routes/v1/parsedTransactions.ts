import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { nanoid } from "nanoid"
import { eq, and, desc, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
	parsedTransactions,
	pendingMessages,
	transactions,
	accounts,
	categories,
} from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"

const listQuerySchema = z.object({
	status: z.enum(["pending_review", "approved", "rejected"]).default("pending_review"),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
})

const updateSchema = z.object({
	type: z.enum(["income", "expense"]).optional(),
	amount: z.number().int().positive().optional(),
	date: z.number().int().optional(),
	description: z.string().min(1).optional(),
	accountId: z.string().nullable().optional(),
	categoryId: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
})

export async function parsedTransactionRoutes(app: FastifyInstance) {
	// ─── GET /parsed-transactions ─────────────────────────────────────────────

	app.get("/parsed-transactions", { preHandler: authenticate }, async (request, reply) => {
		const result = listQuerySchema.safeParse(request.query)
		if (!result.success) {
			return reply
				.status(400)
				.send({ error: "Validation error", details: result.error.flatten() })
		}

		const { status, page, limit } = result.data
		const offset = (page - 1) * limit

		const rows = db
			.select({
				id: parsedTransactions.id,
				userId: parsedTransactions.userId,
				pendingMessageId: parsedTransactions.pendingMessageId,
				accountId: parsedTransactions.accountId,
				categoryId: parsedTransactions.categoryId,
				type: parsedTransactions.type,
				amount: parsedTransactions.amount,
				date: parsedTransactions.date,
				description: parsedTransactions.description,
				notes: parsedTransactions.notes,
				status: parsedTransactions.status,
				createdAt: parsedTransactions.createdAt,
				updatedAt: parsedTransactions.updatedAt,
				accountName: accounts.name,
				categoryName: categories.name,
				emailSubject: pendingMessages.subject,
			})
			.from(parsedTransactions)
			.leftJoin(accounts, eq(parsedTransactions.accountId, accounts.id))
			.leftJoin(categories, eq(parsedTransactions.categoryId, categories.id))
			.leftJoin(pendingMessages, eq(parsedTransactions.pendingMessageId, pendingMessages.id))
			.where(
				and(
					eq(parsedTransactions.userId, request.user.id),
					eq(parsedTransactions.status, status)
				)
			)
			.orderBy(desc(parsedTransactions.createdAt))
			.limit(limit)
			.offset(offset)
			.all()

		const totalResult = db
			.select({ count: sql<number>`count(*)` })
			.from(parsedTransactions)
			.where(
				and(
					eq(parsedTransactions.userId, request.user.id),
					eq(parsedTransactions.status, status)
				)
			)
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

	// ─── PUT /parsed-transactions/:id ─────────────────────────────────────────

	app.put("/parsed-transactions/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const result = updateSchema.safeParse(request.body)
		if (!result.success) {
			return reply
				.status(400)
				.send({ error: "Validation error", details: result.error.flatten() })
		}

		const existing = db
			.select()
			.from(parsedTransactions)
			.where(
				and(eq(parsedTransactions.id, id), eq(parsedTransactions.userId, request.user.id))
			)
			.get()

		if (!existing) {
			return reply.status(404).send({ error: "Parsed transaction not found" })
		}

		if (existing.status !== "pending_review") {
			return reply.status(409).send({ error: "Can only edit pending_review transactions" })
		}

		const now = Math.floor(Date.now() / 1000)
		const { type, amount, date, description, accountId, categoryId, notes } = result.data

		const updated = db
			.update(parsedTransactions)
			.set({
				...(type !== undefined && { type }),
				...(amount !== undefined && { amount }),
				...(date !== undefined && { date }),
				...(description !== undefined && { description }),
				...(accountId !== undefined && { accountId }),
				...(categoryId !== undefined && { categoryId }),
				...(notes !== undefined && { notes }),
				updatedAt: now,
			})
			.where(eq(parsedTransactions.id, id))
			.returning()
			.get()

		return reply.send(updated)
	})

	// ─── POST /parsed-transactions/:id/approve ────────────────────────────────

	app.post(
		"/parsed-transactions/:id/approve",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { id } = request.params as { id: string }

			const pt = db
				.select()
				.from(parsedTransactions)
				.where(
					and(
						eq(parsedTransactions.id, id),
						eq(parsedTransactions.userId, request.user.id)
					)
				)
				.get()

			if (!pt) {
				return reply.status(404).send({ error: "Parsed transaction not found" })
			}

			if (pt.status !== "pending_review") {
				return reply
					.status(409)
					.send({ error: "Transaction has already been approved or rejected" })
			}

			if (!pt.accountId) {
				return reply
					.status(400)
					.send({ error: "An account must be selected before approving" })
			}

			// Verify account belongs to user and is active
			const account = db
				.select()
				.from(accounts)
				.where(and(eq(accounts.id, pt.accountId), eq(accounts.userId, request.user.id)))
				.get()

			if (!account) {
				return reply.status(404).send({ error: "Account not found" })
			}

			if (!account.isActive) {
				return reply
					.status(409)
					.send({ error: "Cannot add transactions to a closed account" })
			}

			const now = Math.floor(Date.now() / 1000)
			const txId = nanoid()

			// Apply sign: income positive, expense negative
			const signedAmount = pt.type === "income" ? pt.amount : -pt.amount

			// Create transaction, mark as approved, and update source email — all atomically
			const transaction = db.transaction((tx) => {
				const inserted = tx
					.insert(transactions)
					.values({
						id: txId,
						userId: request.user.id,
						accountId: pt.accountId!,
						categoryId: pt.categoryId ?? undefined,
						type: pt.type,
						amount: signedAmount,
						date: pt.date,
						description: pt.description,
						notes: pt.notes ?? undefined,
						createdAt: now,
						updatedAt: now,
					})
					.returning()
					.get()

				tx.update(parsedTransactions)
					.set({ status: "approved", updatedAt: now })
					.where(eq(parsedTransactions.id, id))
					.run()

				if (pt.pendingMessageId) {
					tx.update(pendingMessages)
						.set({ status: "processed", updatedAt: now })
						.where(
							and(
								eq(pendingMessages.id, pt.pendingMessageId),
								eq(pendingMessages.status, "pending")
							)
						)
						.run()
				}

				return inserted
			})

			return reply.status(201).send(transaction)
		}
	)

	// ─── POST /parsed-transactions/:id/reject ─────────────────────────────────

	app.post(
		"/parsed-transactions/:id/reject",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { id } = request.params as { id: string }

			const pt = db
				.select()
				.from(parsedTransactions)
				.where(
					and(
						eq(parsedTransactions.id, id),
						eq(parsedTransactions.userId, request.user.id)
					)
				)
				.get()

			if (!pt) {
				return reply.status(404).send({ error: "Parsed transaction not found" })
			}

			if (pt.status !== "pending_review") {
				return reply
					.status(409)
					.send({ error: "Transaction has already been approved or rejected" })
			}

			const now = Math.floor(Date.now() / 1000)

			db.transaction((tx) => {
				tx.update(parsedTransactions)
					.set({ status: "rejected", updatedAt: now })
					.where(eq(parsedTransactions.id, id))
					.run()

				if (pt.pendingMessageId) {
					tx.update(pendingMessages)
						.set({ status: "failed", error: "Rejected by user", updatedAt: now })
						.where(eq(pendingMessages.id, pt.pendingMessageId))
						.run()
				}
			})

			return reply.status(204).send()
		}
	)
}
