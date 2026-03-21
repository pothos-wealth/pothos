import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { nanoid } from "nanoid"
import { eq, and } from "drizzle-orm"
import { db } from "../../db/index.js"
import { pendingMessages, parsedTransactions, transactions, accounts } from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"

const submitSchema = z.object({
	type: z.enum(["income", "expense"]),
	amount: z.number().int().positive("Amount must be positive"),
	date: z.number().int(),
	description: z.string().min(1, "Description is required").max(200),
	accountId: z.string().nullable().optional(),
	categoryId: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	bypassReview: z.boolean().optional().default(false),
})

export async function parseQueueRoutes(app: FastifyInstance) {
	// ─── GET /parse-queue ─────────────────────────────────────────────────────
	// Returns raw pending emails for local LLM processing (MCP WS5 path)

	app.get("/parse-queue", { preHandler: authenticate }, async (request, reply) => {
		const { status = "pending" } = request.query as { status?: string }

		const validStatuses = ["pending", "processed", "failed"]
		if (!validStatuses.includes(status)) {
			return reply.status(400).send({ error: "Invalid status filter" })
		}

		const rows = db
			.select()
			.from(pendingMessages)
			.where(
				and(
					eq(pendingMessages.userId, request.user.id),
					eq(pendingMessages.status, status as "pending" | "processed" | "failed")
				)
			)
			.all()

		return reply.send(rows)
	})

	// ─── POST /parse-queue/:id/submit ─────────────────────────────────────────
	// Submit a locally parsed result — creates a parsed_transaction for review

	app.post("/parse-queue/:id/submit", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const result = submitSchema.safeParse(request.body)
		if (!result.success) {
			return reply
				.status(400)
				.send({ error: "Validation error", details: result.error.flatten() })
		}

		const msg = db
			.select()
			.from(pendingMessages)
			.where(and(eq(pendingMessages.id, id), eq(pendingMessages.userId, request.user.id)))
			.get()

		if (!msg) {
			return reply.status(404).send({ error: "Pending message not found" })
		}

		if (msg.status === "processed") {
			return reply.status(409).send({ error: "Message has already been processed" })
		}

		const { type, amount, date, description, accountId, categoryId, notes, bypassReview } =
			result.data
		const now = Math.floor(Date.now() / 1000)

		if (bypassReview) {
			// Manual parse: user has already verified the data, create transaction directly
			if (!accountId) {
				return reply.status(400).send({ error: "An account must be selected" })
			}

			const account = db
				.select()
				.from(accounts)
				.where(and(eq(accounts.id, accountId), eq(accounts.userId, request.user.id)))
				.get()

			if (!account) {
				return reply.status(404).send({ error: "Account not found" })
			}

			if (!account.isActive) {
				return reply
					.status(409)
					.send({ error: "Cannot add transactions to a closed account" })
			}

			const signedAmount = type === "income" ? amount : -amount

			const transaction = db
				.insert(transactions)
				.values({
					id: nanoid(),
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

			db.update(pendingMessages)
				.set({ status: "processed", updatedAt: now })
				.where(eq(pendingMessages.id, id))
				.run()

			return reply.status(201).send(transaction)
		}

		// Automated parse (e.g. MCP): send to review queue
		const pt = db
			.insert(parsedTransactions)
			.values({
				id: nanoid(),
				userId: request.user.id,
				pendingMessageId: id,
				accountId: accountId ?? null,
				categoryId: categoryId ?? null,
				type,
				amount,
				date,
				description,
				notes: notes ?? null,
				status: "pending_review",
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get()

		db.update(pendingMessages)
			.set({ status: "processed", updatedAt: now })
			.where(eq(pendingMessages.id, id))
			.run()

		return reply.status(201).send(pt)
	})

	// ─── POST /parse-queue/:id/dismiss ────────────────────────────────────────
	// Dismiss a raw email — marks it as failed (won't show in unprocessed queue)

	app.post("/parse-queue/:id/dismiss", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const msg = db
			.select()
			.from(pendingMessages)
			.where(and(eq(pendingMessages.id, id), eq(pendingMessages.userId, request.user.id)))
			.get()

		if (!msg) {
			return reply.status(404).send({ error: "Pending message not found" })
		}

		const now = Math.floor(Date.now() / 1000)
		db.update(pendingMessages)
			.set({ status: "failed", error: "Dismissed by user", updatedAt: now })
			.where(eq(pendingMessages.id, id))
			.run()

		return reply.status(204).send()
	})
}
