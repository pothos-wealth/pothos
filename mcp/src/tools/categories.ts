import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { apiFetch, PothosApiError } from "../client.js"

interface Category {
	id: string
	name: string
	icon: string | null
	type: "expense" | "income" | "neutral"
}

export function registerCategoryTools(server: McpServer) {
	server.registerTool(
		"get_categories",
		{
			description:
				"List all categories (global defaults and custom ones), grouped by expense/income/neutral. " +
				"Each entry includes the category ID needed for add_transaction and submit_parsed_email. " +
				"Also use this to decode category IDs returned in budget and transaction responses.",
		},
		async () => {
			try {
				const categories = await apiFetch<Category[]>("/categories")

				const grouped: Record<string, string[]> = { expense: [], income: [], neutral: [] }
				for (const c of categories) {
					grouped[c.type].push(
						c.icon ? `${c.name} ${c.icon} (id: ${c.id})` : `${c.name} (id: ${c.id})`
					)
				}

				const lines: string[] = []
				if (grouped.expense.length) {
					lines.push("Expense categories:")
					grouped.expense.forEach((c) => lines.push(`  ${c}`))
				}
				if (grouped.income.length) {
					lines.push("Income categories:")
					grouped.income.forEach((c) => lines.push(`  ${c}`))
				}
				if (grouped.neutral.length) {
					lines.push("Neutral categories:")
					grouped.neutral.forEach((c) => lines.push(`  ${c}`))
				}

				return { content: [{ type: "text" as const, text: lines.join("\n") }] }
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [
						{ type: "text" as const, text: `Failed to fetch categories: ${msg}` },
					],
				}
			}
		}
	)
}
