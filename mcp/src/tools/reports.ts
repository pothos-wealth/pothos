import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiFetch, fmtAmount, PothosApiError } from "../client.js"

interface Overview {
    income: number
    expenses: number
    net: number
    committed: number
}

interface CategoryBreakdown {
    categoryId: string
    categoryName: string
    categoryIcon: string | null
    total: number
}

interface TrendPoint {
    month: number
    year: number
    income: number
    expenses: number
    net: number
}

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export function registerReportTools(server: McpServer) {
    server.registerTool(
        "get_spending_overview",
        {
            description:
                "Get total income, expenses, net, and committed budget for a given month. " +
                "Committed = unspent budget remaining (money set aside but not yet spent). " +
                "Use this to assess true available funds. Defaults to the current month.",
            inputSchema: {
                month: z.number().int().min(1).max(12).optional().describe("Month (1-12)"),
                year: z.number().int().optional().describe("Year (e.g. 2026)"),
            },
        },
        async ({ month, year }) => {
            try {
                const now = new Date()
                const m = month ?? now.getMonth() + 1
                const y = year ?? now.getFullYear()

                const overview = await apiFetch<Overview>(`/reports/overview?month=${m}&year=${y}`)
                const monthName = new Date(y, m - 1).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                })

                const netSign = overview.net >= 0 ? "+" : ""
                const text =
                    `${monthName} Overview:\n` +
                    `  Income:    ${fmtAmount(overview.income)}\n` +
                    `  Expenses:  ${fmtAmount(Math.abs(overview.expenses))}\n` +
                    `  Net:       ${netSign}${fmtAmount(overview.net)}\n` +
                    `  Committed: ${fmtAmount(overview.committed)} (budgeted but not yet spent this month)`

                return { content: [{ type: "text" as const, text }] }
            } catch (err) {
                const msg = err instanceof PothosApiError ? err.message : String(err)
                return {
                    content: [{ type: "text" as const, text: `Failed to fetch overview: ${msg}` }],
                }
            }
        }
    )

    server.registerTool(
        "get_category_breakdown",
        {
            description:
                "Get expense breakdown by category for a given month, with percentages. " +
                "Defaults to the current month.",
            inputSchema: {
                month: z.number().int().min(1).max(12).optional().describe("Month (1-12)"),
                year: z.number().int().optional().describe("Year (e.g. 2026)"),
            },
        },
        async ({ month, year }) => {
            try {
                const now = new Date()
                const m = month ?? now.getMonth() + 1
                const y = year ?? now.getFullYear()

                const breakdown = await apiFetch<CategoryBreakdown[]>(
                    `/reports/categories?month=${m}&year=${y}`
                )
                const monthName = new Date(y, m - 1).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                })

                if (breakdown.length === 0) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `No expense data for ${monthName}.`,
                            },
                        ],
                    }
                }

                const totalExpenses = breakdown.reduce((sum, c) => sum + Math.abs(c.total), 0)
                const lines = [`${monthName} — Expenses by Category:`]
                for (const c of breakdown) {
                    const icon = c.categoryIcon ? ` ${c.categoryIcon}` : ""
                    const abs = Math.abs(c.total)
                    const pct = totalExpenses > 0 ? ((abs / totalExpenses) * 100).toFixed(1) : "0.0"
                    lines.push(`  ${c.categoryName}${icon}: ${fmtAmount(abs)} (${pct}%)`)
                }
                lines.push(`  Total expenses: ${fmtAmount(totalExpenses)}`)

                return { content: [{ type: "text" as const, text: lines.join("\n") }] }
            } catch (err) {
                const msg = err instanceof PothosApiError ? err.message : String(err)
                return {
                    content: [
                        { type: "text" as const, text: `Failed to fetch category breakdown: ${msg}` },
                    ],
                }
            }
        }
    )

    server.registerTool(
        "get_spending_trends",
        {
            description:
                "Get monthly income, expenses, and net over the last N months. Useful for spotting trends.",
            inputSchema: {
                months: z
                    .number()
                    .int()
                    .min(1)
                    .max(24)
                    .optional()
                    .default(6)
                    .describe("Number of months to look back (1-24, default 6)"),
            },
        },
        async ({ months }) => {
            try {
                const n = months ?? 6
                const trends = await apiFetch<TrendPoint[]>(`/reports/trends?months=${n}`)

                const lines = [`Spending trends (last ${n} months):`]
                for (const t of trends) {
                    const netSign = t.net >= 0 ? "+" : ""
                    lines.push(
                        `  ${MONTHS[t.month - 1]} ${t.year}: income ${fmtAmount(t.income)} | expenses ${fmtAmount(Math.abs(t.expenses))} | net ${netSign}${fmtAmount(t.net)}`
                    )
                }

                return { content: [{ type: "text" as const, text: lines.join("\n") }] }
            } catch (err) {
                const msg = err instanceof PothosApiError ? err.message : String(err)
                return {
                    content: [{ type: "text" as const, text: `Failed to fetch trends: ${msg}` }],
                }
            }
        }
    )
}
