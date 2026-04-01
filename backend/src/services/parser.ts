import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { nanoid } from "nanoid"
import { db } from "../db/index.js"
import { pendingMessages, parsedTransactions } from "../db/schema.js"
import { eq } from "drizzle-orm"

const parsedResultSchema = z.object({
	type: z.enum(["income", "expense"]),
	amount: z.number().int().positive(),
	date: z.number().int(),
	description: z.string().min(1).max(200),
	accountId: z.string().nullable().optional(),
	categoryId: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
})

interface UserAccount {
	id: string
	name: string
}

interface UserCategory {
	id: string
	name: string
	type: string
}

interface LlmConfig {
	provider: string
	apiKey: string | null
	model: string
}

function buildPrompt(
	rawContent: string,
	userAccounts: UserAccount[],
	userCategories: UserCategory[],
	currency: string
): string {
	const todayUTC = new Date().toISOString().slice(0, 10)
	return `You are a financial transaction parser. The user's currency is ${currency}.
Today's date (UTC): ${todayUTC}
User's bank accounts: ${JSON.stringify(userAccounts)}
Available categories: ${JSON.stringify(userCategories)}

Parse this bank notification email and return ONLY valid JSON (no markdown, no explanation):
{
  "type": "income" or "expense",
  "amount": <positive integer in minor units — multiply the amount by 100>,
  "date": <unix timestamp in seconds — use midnight UTC (00:00:00 UTC) for the transaction date>,
  "description": "<merchant or ref, max 60 chars>",
  "accountId": "<id from accounts list or null>",
  "categoryId": "<id from categories list or null>",
  "notes": "<optional string or null>"
}

Rules:
- "debited"/"spent"/"withdrawal"/"debit" → "expense"
- "credited"/"received"/"credit" → "income"
- Match account by last 4 digits (e.g. "XX1234") against account names
- Return null for accountId/categoryId if unsure
- For the date: parse it from the email; if absent, use today (${todayUTC}). Always use midnight UTC (00:00:00 UTC) — e.g. ${todayUTC}T00:00:00Z
- If this is not a bank transaction notification, return {"not_transaction": true}

Email:
${rawContent.slice(0, 10000)}`
}

async function parseViaLlm(
	rawContent: string,
	userAccounts: UserAccount[],
	userCategories: UserCategory[],
	llmConfig: LlmConfig,
	currency: string
): Promise<z.infer<typeof parsedResultSchema> | null> {
	const prompt = buildPrompt(rawContent, userAccounts, userCategories, currency)
	let responseText = ""

	if (llmConfig.provider === "openai" && llmConfig.apiKey) {
		const client = new OpenAI({ apiKey: llmConfig.apiKey })
		const completion = await client.chat.completions.create({
			model: llmConfig.model,
			messages: [{ role: "user", content: prompt }],
			temperature: 0,
			max_tokens: 300,
		})
		responseText = completion.choices[0]?.message?.content ?? ""
	} else if (llmConfig.provider === "anthropic" && llmConfig.apiKey) {
		const client = new Anthropic({ apiKey: llmConfig.apiKey })
		const message = await client.messages.create({
			model: llmConfig.model,
			max_tokens: 300,
			messages: [{ role: "user", content: prompt }],
		})
		const block = message.content[0]
		responseText = block.type === "text" ? block.text : ""
	} else {
		return null // local provider or no key — skip LLM
	}

	// Extract JSON from response
	const jsonMatch = responseText.match(/\{[\s\S]*\}/)
	if (!jsonMatch) return null

	let parsed: unknown
	try {
		parsed = JSON.parse(jsonMatch[0])
	} catch {
		return null
	}

	// Check if LLM flagged as non-transaction
	if (typeof parsed === "object" && parsed !== null && "not_transaction" in parsed) {
		return null
	}

	const result = parsedResultSchema.safeParse(parsed)
	return result.success ? result.data : null
}

export async function parseEmail(
	pendingMessageId: string,
	rawContent: string,
	userId: string,
	userAccounts: UserAccount[],
	userCategories: UserCategory[],
	llmConfig: LlmConfig,
	currency: string
): Promise<boolean> {
	const now = Math.floor(Date.now() / 1000)

	let result: z.infer<typeof parsedResultSchema> | null = null

	const cloudLlmConfigured = llmConfig.provider !== "local" && !!llmConfig.apiKey

	if (cloudLlmConfigured) {
		try {
			result = await parseViaLlm(
				rawContent,
				userAccounts,
				userCategories,
				llmConfig,
				currency
			)
		} catch {
			// LLM call failed
		}

		if (!result) {
			// Cloud LLM was configured but failed — mark as failed
			db.update(pendingMessages)
				.set({ status: "failed", error: "LLM parse failed", updatedAt: now })
				.where(eq(pendingMessages.id, pendingMessageId))
				.run()
			return false
		}
	} else {
		// No cloud LLM — leave as "pending" for MCP/Ollama to process
		return false
	}

	// Create parsed_transaction for review
	db.insert(parsedTransactions)
		.values({
			id: nanoid(),
			userId,
			pendingMessageId,
			accountId: result.accountId ?? null,
			categoryId: result.categoryId ?? null,
			type: result.type,
			amount: result.amount,
			date: result.date,
			description: result.description,
			notes: result.notes ?? null,
			status: "pending_review",
			createdAt: now,
			updatedAt: now,
		})
		.run()

	// Mark pending_message as processed
	db.update(pendingMessages)
		.set({ status: "processed", updatedAt: now })
		.where(eq(pendingMessages.id, pendingMessageId))
		.run()

	return true
}
