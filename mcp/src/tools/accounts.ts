import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { apiFetch, fmtAmount, PothosApiError } from "../client.js"

interface Account {
	id: string
	name: string
	type: string
	balance: number
	isActive: boolean
}

export function registerAccountTools(server: McpServer) {
	server.registerTool(
		"get_accounts",
		{
			description:
				"Get all accounts with their current balances and a net worth total. " +
				"Active accounts are listed first. Closed accounts are shown separately — " +
				"do not use them for new transactions or transfers.",
		},
		async () => {
			try {
				const accounts = await apiFetch<Account[]>("/accounts?includeInactive=true")

				const active = accounts.filter((a) => a.isActive)
				const closed = accounts.filter((a) => !a.isActive)
				const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0)

				const lines: string[] = []

				if (active.length === 0) {
					lines.push("No active accounts.")
				} else {
					lines.push("Active accounts:")
					for (const a of active) {
						lines.push(`  - ${a.name} (${a.type}): ${fmtAmount(a.balance)} [id: ${a.id}]`)
					}
				}

				if (closed.length > 0) {
					lines.push("\nClosed accounts (included in net worth, not usable for transactions):")
					for (const a of closed) {
						lines.push(`  - ${a.name} (${a.type}): ${fmtAmount(a.balance)} [id: ${a.id}]`)
					}
				}

				lines.push(`\nNet worth: ${fmtAmount(netWorth)}`)

				return { content: [{ type: "text" as const, text: lines.join("\n") }] }
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [{ type: "text" as const, text: `Failed to fetch accounts: ${msg}` }],
				}
			}
		}
	)
}
