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
                "Closed accounts are included and marked [closed].",
        },
        async () => {
            try {
                const accounts = await apiFetch<Account[]>("/accounts?includeInactive=true")
                const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0)

                const lines = accounts.map(
                    (a) =>
                        `- ${a.name} (${a.type}): ${fmtAmount(a.balance)}${a.isActive ? "" : " [closed]"} [id: ${a.id}]`
                )
                lines.push(`\nNet worth: ${fmtAmount(netWorth)}`)
                lines.push(`(${accounts.length} account${accounts.length !== 1 ? "s" : ""} total)`)

                return { content: [{ type: "text" as const, text: lines.join("\n") }] }
            } catch (err) {
                const msg = err instanceof PothosApiError ? err.message : String(err)
                return { content: [{ type: "text" as const, text: `Failed to fetch accounts: ${msg}` }] }
            }
        }
    )
}
