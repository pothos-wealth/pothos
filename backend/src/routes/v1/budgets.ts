import type { FastifyInstance } from "fastify"
import { eq, and, or, isNull, lt, desc, sql, inArray } from "drizzle-orm"
import { z } from "zod"
import { nanoid } from "nanoid"
import { db } from "../../db/index.js"
import { budgets, transactions, categories } from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"
import { getMonthBounds } from "../../db/utils.js"

const createBudgetSchema = z.object({
	categoryId: z.string().min(1, "Category is required"),
	amount: z.number().int().positive("Amount must be positive").max(1_000_000_000),
	month: z.number().int().min(1).max(12),
	year: z.number().int().min(2000).max(2100),
	isRecurring: z.boolean().default(true),
	isCommitted: z.boolean().default(false),
})

const listQuerySchema = z.object({
	month: z.coerce.number().int().min(1).max(12).optional(),
	year: z.coerce.number().int().min(2000).optional(),
})

export async function budgetRoutes(app: FastifyInstance) {
	// ─── List Budgets ─────────────────────────────────────────────────────────

	app.get("/budgets", { preHandler: authenticate }, async (request, reply) => {
		const result = listQuerySchema.safeParse(request.query)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const now = new Date()
		const month = result.data.month ?? now.getMonth() + 1
		const year = result.data.year ?? now.getFullYear()
		const { start, end } = getMonthBounds(month, year)

		const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

		let rows = db
			.select()
			.from(budgets)
			.where(
				and(
					eq(budgets.userId, request.user.id),
					eq(budgets.month, month),
					eq(budgets.year, year)
				)
			)
			.all()

		// Auto-generate recurring budgets for the current month on first view
		if (isCurrentMonth) {
			const allExpenseCategories = db
				.select({ id: categories.id })
				.from(categories)
				.where(
					and(
						eq(categories.type, "expense"),
						or(isNull(categories.userId), eq(categories.userId, request.user.id))
					)
				)
				.all()

			const budgetedIds = new Set(rows.map((r) => r.categoryId))
			const unbudgeted = allExpenseCategories.filter((c) => !budgetedIds.has(c.id))

			if (unbudgeted.length > 0) {
				const nowTs = Math.floor(Date.now() / 1000)

				const toInsert = unbudgeted.flatMap((cat) => {
					const source = db
						.select()
						.from(budgets)
						.where(
							and(
								eq(budgets.userId, request.user.id),
								eq(budgets.categoryId, cat.id),
								eq(budgets.isRecurring, true),
								or(
									lt(budgets.year, year),
									and(eq(budgets.year, year), lt(budgets.month, month))
								)
							)
						)
						.orderBy(desc(budgets.year), desc(budgets.month))
						.limit(1)
						.get()

					if (!source) return []
					return [
						{
							id: nanoid(),
							userId: request.user.id,
							categoryId: cat.id,
							amount: source.amount,
							month,
							year,
							isRecurring: true as const,
							isCommitted: source.isCommitted,
							createdAt: nowTs,
							updatedAt: nowTs,
						},
					]
				})

				if (toInsert.length > 0) {
					db.transaction((tx) => {
						for (const values of toInsert) {
							tx.insert(budgets).values(values).onConflictDoNothing().run()
						}
					})
				}

				// Re-fetch to include newly inserted rows
				rows = db
					.select()
					.from(budgets)
					.where(
						and(
							eq(budgets.userId, request.user.id),
							eq(budgets.month, month),
							eq(budgets.year, year)
						)
					)
					.all()
			}
		}

		// Calculate actual spending per category for the period in a single query
		const categoryIds = rows.map((b) => b.categoryId)
		const spendingMap = new Map<string, number>()

		if (categoryIds.length > 0) {
			const spending = db
				.select({
					categoryId: transactions.categoryId,
					total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
				})
				.from(transactions)
				.where(
					and(
						eq(transactions.userId, request.user.id),
						inArray(transactions.categoryId, categoryIds),
						eq(transactions.type, "expense"),
						sql`${transactions.date} >= ${start}`,
						sql`${transactions.date} <= ${end}`
					)
				)
				.groupBy(transactions.categoryId)
				.all()

			for (const s of spending) {
				if (s.categoryId) {
					// Spending is stored as negative — convert to positive for display
					spendingMap.set(s.categoryId, Math.abs(s.total))
				}
			}
		}

		const budgetsWithSpending = rows.map((budget) => {
			const spent = spendingMap.get(budget.categoryId) ?? 0
			return {
				...budget,
				spent,
				remaining: budget.amount - spent,
			}
		})

		return reply.send(budgetsWithSpending)
	})

	// ─── Create or Update Budget (Upsert) ─────────────────────────────────────

	app.post("/budgets", { preHandler: authenticate }, async (request, reply) => {
		const result = createBudgetSchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const { categoryId, amount, month, year, isRecurring, isCommitted } = result.data

		// Verify category exists and belongs to user or is a global default
		const category = db
			.select()
			.from(categories)
			.where(
				and(
					eq(categories.id, categoryId),
					or(eq(categories.userId, request.user.id), isNull(categories.userId))
				)
			)
			.get()

		if (!category) {
			return reply.status(404).send({ error: "Category not found" })
		}

		const now = Math.floor(Date.now() / 1000)

		// Check if budget already exists for this category/month/year
		const existing = db
			.select()
			.from(budgets)
			.where(
				and(
					eq(budgets.userId, request.user.id),
					eq(budgets.categoryId, categoryId),
					eq(budgets.month, month),
					eq(budgets.year, year)
				)
			)
			.get()

		if (existing) {
			// Update existing budget
			const updated = db
				.update(budgets)
				.set({ amount, isRecurring, isCommitted, updatedAt: now })
				.where(eq(budgets.id, existing.id))
				.returning()
				.get()

			return reply.status(200).send(updated)
		}

		// Create new budget
		const budget = db
			.insert(budgets)
			.values({
				id: nanoid(),
				userId: request.user.id,
				categoryId,
				amount,
				month,
				year,
				isRecurring,
				isCommitted,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get()

		return reply.status(201).send(budget)
	})

	// ─── Delete Budget ────────────────────────────────────────────────────────

	app.delete("/budgets/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const budget = db
			.select()
			.from(budgets)
			.where(and(eq(budgets.id, id), eq(budgets.userId, request.user.id)))
			.get()

		if (!budget) {
			return reply.status(404).send({ error: "Budget not found" })
		}

		db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, request.user.id))).run()

		return reply.status(204).send()
	})
}
