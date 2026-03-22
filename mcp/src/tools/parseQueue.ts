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

interface PendingEmailsResponse {
	data: PendingMessage[]
	pagination: {
		page: number
		limit: number
		total: number
		totalPages: number
	}
}

function dateToUnix(dateStr: string): number {
	return Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 1000)
}

export function registerParseQueueTools(server: McpServer) {
	server.registerTool(
		"get_pending_emails",
		{
			description:
				"Fetch raw bank/payment emails waiting to be parsed into transactions. " +
				"Read each email and extract transaction details, then call submit_parsed_email " +
				"for each valid transaction or dismiss_email for non-transactions " +
				"(newsletters, promotions, shipping updates, password resets, etc.).",
			inputSchema: {
				limit: z
					.number()
					.int()
					.min(1)
					.max(50)
					.optional()
					.default(10)
					.describe("Max number of emails to return (default 10)"),
				page: z
					.number()
					.int()
					.min(1)
					.optional()
					.default(1)
					.describe("Page number for pagination (default 1)"),
			},
		},
		async ({ limit, page }) => {
			try {
				const response = await apiFetch<PendingEmailsResponse>(
					`/parse-queue?status=pending&limit=${limit}&page=${page}`
				)

				const { data: emails, pagination } = response

				if (emails.length === 0) {
					return {
						content: [{ type: "text" as const, text: "No pending emails." }],
					}
				}

				const remaining = Math.max(
					0,
					pagination.total - (page - 1) * limit - emails.length
				)

				const lines = [
					`${pagination.total} pending email${pagination.total !== 1 ? "s" : ""} (page ${page}/${pagination.totalPages}, showing ${emails.length}):`,
				]
				for (const msg of emails) {
					lines.push(`\n--- Email ID: ${msg.id} ---`)
					lines.push(`Subject: ${msg.subject ?? "(no subject)"}`)
					lines.push(`Received: ${fmtDate(msg.createdAt)}`)
					lines.push(`Body:\n${msg.rawContent}`)
				}
				if (remaining > 0) {
					lines.push(
						`\n${remaining} more email${remaining !== 1 ? "s" : ""} not shown. Call again with page=${page + 1} to get the next batch.`
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
				"Submit your parsed interpretation of a bank/payment email. " +
				"The result goes to the user's Pothos inbox for review — no transaction is created automatically. " +
				"Extract from the email: amount (positive decimal), type (income or expense), " +
				"date (YYYY-MM-DD — use today if not found), and a short description (merchant or reference). " +
				"Call get_accounts to pick the right account. Call get_categories to find a matching category ID — " +
				"leave categoryId blank if nothing fits rather than guessing. " +
				"Use dismiss_email instead if the email contains no transaction.",
			inputSchema: {
				messageId: z.string().describe("ID of the pending email (from get_pending_emails)"),
				type: z.enum(["income", "expense"]).describe("Transaction type"),
				amount: z
					.number()
					.positive()
					.describe("Transaction amount as a positive decimal (e.g. 45.50)"),
				date: z
					.string()
					.describe("Transaction date in YYYY-MM-DD format. Use today's date if not found in the email."),
				description: z
					.string()
					.min(1)
					.max(60)
					.describe("Merchant name or transaction reference (max 60 characters)"),
				accountId: z
					.string()
					.optional()
					.describe("Account ID to link the transaction to (from get_accounts). Recommended."),
				categoryId: z
					.string()
					.optional()
					.describe("Category ID (from get_categories). Leave blank if no category fits."),
				notes: z.string().optional().describe("Optional notes or context from the email"),
			},
		},
		async ({ messageId, type, amount, date, description, accountId, categoryId, notes }) => {
			try {
				const minorUnits = Math.round(amount * 100)
				const unixTs = dateToUnix(date)

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
				"Dismiss a pending email that contains no financial transaction — newsletters, promotions, " +
				"shipping notifications, password resets, receipts with no new charge, etc. " +
				"Dismissed emails are removed from the queue and will not reappear.",
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
