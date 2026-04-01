import type { FastifyInstance } from "fastify"
import { eq, and, gte, lte, sql, ne } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../db/index.js"
import { transactions, categories, budgets } from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"
import { getMonthBounds } from "../../db/utils.js"

const monthQuerySchema = z.object({
	month: z.coerce.number().int().min(1).max(12).optional(),
	year: z.coerce.number().int().min(2000).optional(),
})

const trendsQuerySchema = z.object({
	months: z.coerce.number().int().min(1).max(24).default(12),
})

export async function reportRoutes(app: FastifyInstance) {
	// ─── Overview ─────────────────────────────────────────────────────────────
	// Total income, expenses, and net for a given month.
	// Transfers excluded.

	app.get("/reports/overview", { preHandler: authenticate }, async (request, reply) => {
		const result = monthQuerySchema.safeParse(request.query)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const now = new Date()
		const month = result.data.month ?? now.getUTCMonth() + 1
		const year = result.data.year ?? now.getUTCFullYear()
		const { start, end } = getMonthBounds(month, year)

		const baseConditions = and(
			eq(transactions.userId, request.user.id),
			ne(transactions.type, "transfer"),
			gte(transactions.date, start),
			lte(transactions.date, end)
		)

		const incomeResult = db
			.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
			.from(transactions)
			.where(and(baseConditions, eq(transactions.type, "income")))
			.get()

		const expenseResult = db
			.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
			.from(transactions)
			.where(and(baseConditions, eq(transactions.type, "expense")))
			.get()

		const income = incomeResult?.total ?? 0
		const expenses = expenseResult?.total ?? 0 // negative number
		const net = income + expenses // expenses is negative so this is correct

		// Committed = unspent budget remaining for the month
		const budgetRows = db
			.select({ amount: budgets.amount, categoryId: budgets.categoryId })
			.from(budgets)
			.where(
				and(
					eq(budgets.userId, request.user.id),
					eq(budgets.month, month),
					eq(budgets.year, year),
					eq(budgets.isCommitted, true)
				)
			)
			.all()

		const spendingRows = db
			.select({
				categoryId: transactions.categoryId,
				total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, request.user.id),
					eq(transactions.type, "expense"),
					gte(transactions.date, start),
					lte(transactions.date, end)
				)
			)
			.groupBy(transactions.categoryId)
			.all()

		const spendingMap = new Map(spendingRows.map((r) => [r.categoryId, Math.abs(r.total)]))

		const committed = budgetRows.reduce((sum, b) => {
			const spent = spendingMap.get(b.categoryId) ?? 0
			return sum + Math.max(0, b.amount - spent)
		}, 0)

		return reply.send({
			month,
			year,
			income,
			expenses: Math.abs(expenses), // return as positive for display
			net,
			committed,
		})
	})

	// ─── Category Breakdown ───────────────────────────────────────────────────
	// Expenses grouped by category for a given month.
	// Transfers excluded. Only expense transactions.

	app.get("/reports/categories", { preHandler: authenticate }, async (request, reply) => {
		const result = monthQuerySchema.safeParse(request.query)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const now = new Date()
		const month = result.data.month ?? now.getUTCMonth() + 1
		const year = result.data.year ?? now.getUTCFullYear()
		const { start, end } = getMonthBounds(month, year)

		const rows = db
			.select({
				categoryId: transactions.categoryId,
				categoryName: categories.name,
				categoryIcon: categories.icon,
				categoryColor: categories.color,
				total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
			})
			.from(transactions)
			.leftJoin(categories, eq(transactions.categoryId, categories.id))
			.where(
				and(
					eq(transactions.userId, request.user.id),
					eq(transactions.type, "expense"),
					gte(transactions.date, start),
					lte(transactions.date, end)
				)
			)
			.groupBy(transactions.categoryId)
			.all()

		const data = rows.map((row) => ({
			categoryId: row.categoryId,
			categoryName: row.categoryName ?? "Uncategorised",
			categoryIcon: row.categoryIcon ?? null,
			categoryColor: row.categoryColor ?? null,
			total: Math.abs(row.total), // return as positive for display
		}))

		return reply.send({ month, year, data })
	})

	// ─── Trends ───────────────────────────────────────────────────────────────
	// Monthly income, expenses, and net over the last N months.
	// Transfers excluded. Months with no transactions are included as zeroes.

	app.get("/reports/trends", { preHandler: authenticate }, async (request, reply) => {
		const result = trendsQuerySchema.safeParse(request.query)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const { months } = result.data

		// Build the list of months to cover, going backwards from current month
		const now = new Date()
		const periods: { month: number; year: number; start: number; end: number }[] = []

		for (let i = months - 1; i >= 0; i--) {
			const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
			const month = date.getUTCMonth() + 1
			const year = date.getUTCFullYear()
			const { start, end } = getMonthBounds(month, year)
			periods.push({ month, year, start, end })
		}

		const earliestStart = periods[0].start
		const latestEnd = periods[periods.length - 1].end

		// Fetch all relevant transactions in one query
		const rows = db
			.select({
				type: transactions.type,
				amount: transactions.amount,
				date: transactions.date,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, request.user.id),
					ne(transactions.type, "transfer"),
					gte(transactions.date, earliestStart),
					lte(transactions.date, latestEnd)
				)
			)
			.all()

		// Aggregate into periods
		const data = periods.map(({ month, year, start, end }) => {
			const periodRows = rows.filter((r) => r.date >= start && r.date <= end)

			const income = periodRows
				.filter((r) => r.type === "income")
				.reduce((sum, r) => sum + r.amount, 0)

			const expenses = periodRows
				.filter((r) => r.type === "expense")
				.reduce((sum, r) => sum + r.amount, 0) // negative

			const net = income + expenses

			return {
				month,
				year,
				income,
				expenses: Math.abs(expenses), // return as positive for display
				net,
			}
		})

		return reply.send({ months, data })
	})
}
