import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiFetch, fmtAmount, PothosApiError } from "../client.js"

interface BudgetWithSpent {
	id: string
	categoryId: string
	amount: number
	spent: number
	remaining: number
	month: number
	year: number
	isCommitted: boolean
}

interface Category {
	id: string
	name: string
	icon: string | null
}

const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
]

export function registerBudgetTools(server: McpServer) {
	server.registerTool(
		"get_budgets",
		{
			description:
				"Get budget vs actual spending for a given month. Shows how much is budgeted, spent, " +
				"and remaining per category — including which budgets are committed (pre-allocated obligations " +
				"like rent or subscriptions). Committed remaining is NOT available to spend. " +
				"The structuredContent field contains totalCommittedUnpaid and totalFlexibleRemaining " +
				"for use in available-cash calculations. Defaults to the current month.",
			inputSchema: {
				month: z
					.number()
					.int()
					.min(1)
					.max(12)
					.optional()
					.describe("Month (1-12). Defaults to current month."),
				year: z
					.number()
					.int()
					.optional()
					.describe("Year (e.g. 2026). Defaults to current year."),
			},
		},
		async ({ month, year }) => {
			try {
				const now = new Date()
				const m = month ?? now.getMonth() + 1
				const y = year ?? now.getFullYear()

				const [budgets, categories] = await Promise.all([
					apiFetch<BudgetWithSpent[]>(`/budgets?month=${m}&year=${y}`),
					apiFetch<Category[]>("/categories"),
				])

				if (budgets.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No budgets set for ${MONTHS[m - 1]} ${y}.`,
							},
						],
					}
				}

				const categoryMap = Object.fromEntries(
					categories.map((c) => [c.id, { name: c.name, icon: c.icon }])
				)

				const lines = [`Budgets for ${MONTHS[m - 1]} ${y}:`]
				for (const b of budgets) {
					const cat = categoryMap[b.categoryId]
					const label = cat
						? cat.icon
							? `${cat.name} ${cat.icon}`
							: cat.name
						: b.categoryId

					const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0
					const flags: string[] = []
					if (b.isCommitted) flags.push("COMMITTED")
					if (b.remaining < 0) flags.push("OVER BUDGET")
					else if (b.remaining === 0) flags.push("AT LIMIT")
					const status = flags.length ? ` [${flags.join(", ")}]` : ""

					let remainingLabel: string
					if (b.remaining < 0) {
						remainingLabel = `${fmtAmount(Math.abs(b.remaining))} over budget`
					} else if (b.isCommitted && b.remaining > 0) {
						remainingLabel = `${fmtAmount(b.remaining)} remaining (pre-allocated — not available to spend)`
					} else {
						remainingLabel = `${fmtAmount(b.remaining)} remaining`
					}

					lines.push(
						`- ${label}: spent ${fmtAmount(b.spent)} / budget ${fmtAmount(b.amount)} (${pct}%) — ${remainingLabel}${status}`
					)
				}

				const committedUnpaid = budgets
					.filter((b) => b.isCommitted && b.spent < b.amount)
					.map((b) => {
						const cat = categoryMap[b.categoryId]
						return {
							category: cat ? cat.name : b.categoryId,
							unpaid: fmtAmount(b.amount - b.spent),
						}
					})

				const totalCommittedUnpaid = budgets
					.filter((b) => b.isCommitted && b.spent < b.amount)
					.reduce((s, b) => s + (b.amount - b.spent), 0)

				const totalFlexibleRemaining = budgets
					.filter((b) => !b.isCommitted && b.remaining > 0)
					.reduce((s, b) => s + b.remaining, 0)

				return {
					content: [{ type: "text" as const, text: lines.join("\n") }],
					structuredContent: {
						committedUnpaid,
						totalCommittedUnpaid: fmtAmount(totalCommittedUnpaid),
						totalFlexibleRemaining: fmtAmount(totalFlexibleRemaining),
						note: "totalCommittedUnpaid = money that will definitely leave the account this month. Subtract from account balance to get truly available cash. totalFlexibleRemaining = money the user could still spend but doesn't have to.",
					},
				}
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [{ type: "text" as const, text: `Failed to fetch budgets: ${msg}` }],
				}
			}
		}
	)
}
