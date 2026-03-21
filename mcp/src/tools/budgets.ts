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

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
]

export function registerBudgetTools(server: McpServer) {
	server.registerTool(
		"get_budgets",
		{
			description:
				"Get budget vs actual spending for a given month. " +
				"Shows how much is budgeted, spent, and remaining per category. " +
				"Defaults to the current month if not specified.",
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

				const budgets = await apiFetch<BudgetWithSpent[]>(`/budgets?month=${m}&year=${y}`)

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

				const lines = [`Budgets for ${MONTHS[m - 1]} ${y}:`]
				for (const b of budgets) {
					const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0
					const flags: string[] = []
					if (b.isCommitted) flags.push("COMMITTED")
					if (b.remaining < 0) flags.push("OVER BUDGET")
					else if (b.remaining === 0) flags.push("AT LIMIT")
					const status = flags.length ? ` [${flags.join(", ")}]` : ""

					lines.push(
						`- ${b.categoryId}: spent ${fmtAmount(b.spent)} / budget ${fmtAmount(b.amount)} (${pct}%) — ${b.remaining >= 0 ? fmtAmount(b.remaining) + " remaining" : fmtAmount(Math.abs(b.remaining)) + " over budget"}${status}`
					)
				}

				const committedUnpaid = budgets
					.filter((b) => b.isCommitted && b.spent < b.amount)
					.map((b) => ({
						categoryId: b.categoryId,
						unpaid: fmtAmount(b.amount - b.spent),
					}))

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
						note: "totalCommittedUnpaid is money that will definitely leave the account this month. Subtract it from available balance when assessing financial health.",
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
