import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiFetch, fmtAmount, fmtDate, PothosApiError } from "../client.js"

interface Transaction {
	id: string
	type: "income" | "expense" | "transfer"
	amount: number
	date: number
	description: string
	accountId: string
	categoryId: string | null
}

interface TransactionList {
	data: Transaction[]
	total: number
	page: number
	totalPages: number
}

interface Account {
	id: string
	name: string
}

function dateToUnix(dateStr: string): number {
	return Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 1000)
}

export function registerTransactionTools(server: McpServer) {
	server.registerTool(
		"get_transactions",
		{
			description:
				"List transactions with optional filters. Returns paginated results with amounts, dates, and categories.",
			inputSchema: {
				accountId: z.string().optional().describe("Filter by account ID"),
				type: z
					.enum(["income", "expense", "transfer"])
					.optional()
					.describe("Filter by transaction type"),
				startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
				endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
				search: z
					.string()
					.optional()
					.describe("Search by transaction description (partial match)"),
				limit: z
					.number()
					.int()
					.min(1)
					.max(100)
					.optional()
					.default(20)
					.describe("Number of results to return (max 100)"),
				page: z.number().int().min(1).optional().default(1).describe("Page number"),
			},
		},
		async ({ accountId, type, startDate, endDate, search, limit, page }) => {
			try {
				const params = new URLSearchParams()
				if (accountId) params.set("accountId", accountId)
				if (type) params.set("type", type)
				if (startDate) params.set("startDate", String(dateToUnix(startDate)))
				if (endDate) params.set("endDate", String(dateToUnix(endDate)))
				if (search) params.set("search", search)
				params.set("limit", String(limit ?? 20))
				params.set("page", String(page ?? 1))

				const [result, accounts] = await Promise.all([
					apiFetch<TransactionList>(`/transactions?${params}`),
					apiFetch<Account[]>("/accounts?includeInactive=true"),
				])

				const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))

				if (result.data.length === 0) {
					return { content: [{ type: "text" as const, text: "No transactions found." }] }
				}

				const lines = [
					`Found ${result.total} transaction${result.total !== 1 ? "s" : ""} (page ${result.page} of ${result.totalPages}):`,
				]
				for (const t of result.data) {
					const account = accountMap[t.accountId] ?? t.accountId
					const sign = t.amount > 0 ? "+" : ""
					const parts = [
						fmtDate(t.date),
						t.description,
						`${t.type} ${sign}${fmtAmount(t.amount)}`,
						`[${account}]`,
					]
					if (t.categoryId) parts.push(`[category: ${t.categoryId}]`)
					lines.push(`- ${parts.join(" | ")}`)
				}

				return { content: [{ type: "text" as const, text: lines.join("\n") }] }
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [
						{ type: "text" as const, text: `Failed to fetch transactions: ${msg}` },
					],
				}
			}
		}
	)

	server.registerTool(
		"add_transaction",
		{
			description:
				"Create a new income or expense transaction. " +
				"Use get_accounts to find the right account ID. " +
				"Use get_categories to find a matching category ID — if nothing fits, omit categoryId rather than guessing.",
			inputSchema: {
				accountId: z.string().describe("ID of the account"),
				type: z.enum(["income", "expense"]).describe("Transaction type"),
				amount: z
					.number()
					.positive()
					.describe("Amount as a positive decimal (e.g. 45.50)"),
				date: z.string().describe("Transaction date (YYYY-MM-DD)"),
				description: z.string().min(1).describe("Merchant name or description"),
				categoryId: z.string().optional().describe("Category ID (optional)"),
				notes: z.string().optional().describe("Additional notes (optional)"),
			},
		},
		async ({ accountId, type, amount, date, description, categoryId, notes }) => {
			try {
				const tx = await apiFetch<Transaction>("/transactions", {
					method: "POST",
					body: JSON.stringify({
						accountId,
						type,
						amount: Math.round(amount * 100),
						date: dateToUnix(date),
						description,
						categoryId: categoryId ?? null,
						notes: notes ?? null,
					}),
				})

				return {
					content: [
						{
							type: "text" as const,
							text:
								`Transaction created: "${tx.description}" — ${tx.type} — ${fmtAmount(Math.abs(tx.amount))} on ${fmtDate(tx.date)}.\n` +
								`Transaction ID: ${tx.id}`,
						},
					],
				}
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [
						{ type: "text" as const, text: `Failed to create transaction: ${msg}` },
					],
				}
			}
		}
	)

	server.registerTool(
		"add_transfer",
		{
			description:
				"Transfer money between two accounts. Creates a linked pair of transactions. " +
				"Use get_accounts to find account IDs.",
			inputSchema: {
				fromAccountId: z.string().describe("ID of the source account"),
				toAccountId: z.string().describe("ID of the destination account"),
				amount: z
					.number()
					.positive()
					.describe("Amount to transfer as a positive decimal (e.g. 500.00)"),
				date: z.string().describe("Transfer date (YYYY-MM-DD)"),
				description: z.string().min(1).describe("Description or note for the transfer"),
			},
		},
		async ({ fromAccountId, toAccountId, amount, date, description }) => {
			try {
				const unixTs = dateToUnix(date)

				await apiFetch("/transactions/transfer", {
					method: "POST",
					body: JSON.stringify({
						fromAccountId,
						toAccountId,
						amount: Math.round(amount * 100),
						date: unixTs,
						description,
					}),
				})

				return {
					content: [
						{
							type: "text" as const,
							text: `Transfer of ${fmtAmount(Math.round(amount * 100))} on ${fmtDate(unixTs)} created successfully.`,
						},
					],
				}
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [{ type: "text" as const, text: `Failed to create transfer: ${msg}` }],
				}
			}
		}
	)
}
