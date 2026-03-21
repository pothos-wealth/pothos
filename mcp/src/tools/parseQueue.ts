import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiFetch, fmtAmount, fmtDate, PothosApiError } from "../client.js"

interface PendingMessage {
	id: string
	rawContent: string
	subject: string | null
	status: "pending" | "processed" | "failed"
	createdAt: number
}

export function registerParseQueueTools(server: McpServer) {
	server.registerTool(
		"get_pending_emails",
		{
			description:
				"Fetch raw emails waiting to be parsed into transactions. " +
				"Returns the email content for you to interpret and extract transaction details from. " +
				"After parsing, call submit_parsed_email with the result for each email.",
			inputSchema: {
				limit: z
					.number()
					.int()
					.min(1)
					.max(50)
					.optional()
					.default(10)
					.describe("Max number of emails to return (default 10)"),
			},
		},
		async ({ limit }) => {
			try {
				const pending = await apiFetch<PendingMessage[]>("/parse-queue?status=pending")

				if (pending.length === 0) {
					return {
						content: [{ type: "text" as const, text: "No pending emails." }],
					}
				}

				const batch = pending.slice(0, limit ?? 10)
				const remaining = pending.length - batch.length

				const lines = [
					`${pending.length} pending email${pending.length !== 1 ? "s" : ""} (showing ${batch.length}):`,
				]
				for (const msg of batch) {
					lines.push(`\n--- Email ID: ${msg.id} ---`)
					lines.push(`Subject: ${msg.subject ?? "(no subject)"}`)
					lines.push(`Received: ${fmtDate(msg.createdAt)}`)
					lines.push(`Body:\n${msg.rawContent}`)
				}
				if (remaining > 0) {
					lines.push(
						`\n${remaining} more email${remaining !== 1 ? "s" : ""} not shown. Call again to get the next batch.`
					)
				}

				return { content: [{ type: "text" as const, text: lines.join("\n") }] }
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [
						{ type: "text" as const, text: `Failed to fetch pending emails: ${msg}` },
					],
				}
			}
		}
	)

	server.registerTool(
		"submit_parsed_email",
		{
			description:
				"Submit your parsed interpretation of a pending email. " +
				"The result goes to your Pothos inbox for review before any transaction is created. " +
				"Call get_accounts and get_categories first so you can supply accountId and categoryId. " +
				"Use dismiss_email if the email is not a financial transaction.",
			inputSchema: {
				messageId: z.string().describe("ID of the pending email (from get_pending_emails)"),
				type: z.enum(["income", "expense"]).describe("Transaction type"),
				amount: z
					.number()
					.positive()
					.describe("Transaction amount as a positive decimal (e.g. 45.50)"),
				date: z.string().describe("Transaction date (YYYY-MM-DD)"),
				description: z
					.string()
					.min(1)
					.max(60)
					.describe("Merchant name or transaction reference"),
				accountId: z
					.string()
					.optional()
					.describe("Account ID to associate with the transaction (from get_accounts)"),
				categoryId: z
					.string()
					.optional()
					.describe(
						"Category ID to associate with the transaction (from get_categories)"
					),
				notes: z.string().optional().describe("Optional notes"),
			},
		},
		async ({ messageId, type, amount, date, description, accountId, categoryId, notes }) => {
			try {
				const minorUnits = Math.round(amount * 100)
				const unixTs = Math.floor(new Date(date).getTime() / 1000)

				await apiFetch(`/parse-queue/${messageId}/submit`, {
					method: "POST",
					body: JSON.stringify({
						type,
						amount: minorUnits,
						date: unixTs,
						description,
						accountId: accountId ?? null,
						categoryId: categoryId ?? null,
						notes: notes ?? null,
						bypassReview: false,
					}),
				})

				return {
					content: [
						{
							type: "text" as const,
							text:
								`Submitted: ${type} of ${fmtAmount(minorUnits)} on ${fmtDate(unixTs)} — "${description}".\n` +
								`Review and approve it in your Pothos inbox.`,
						},
					],
				}
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [
						{ type: "text" as const, text: `Failed to submit parsed email: ${msg}` },
					],
				}
			}
		}
	)

	server.registerTool(
		"dismiss_email",
		{
			description:
				"Dismiss a pending email that is not a financial transaction (e.g. newsletters, promotions). " +
				"It will no longer appear in the pending queue.",
			inputSchema: {
				messageId: z.string().describe("ID of the pending email to dismiss"),
			},
		},
		async ({ messageId }) => {
			try {
				await apiFetch(`/parse-queue/${messageId}/dismiss`, { method: "POST" })
				return {
					content: [{ type: "text" as const, text: "Email dismissed." }],
				}
			} catch (err) {
				const msg = err instanceof PothosApiError ? err.message : String(err)
				return {
					content: [{ type: "text" as const, text: `Failed to dismiss email: ${msg}` }],
				}
			}
		}
	)
}
