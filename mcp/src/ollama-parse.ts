#!/usr/bin/env node
/**
 * ollama-parse — local Ollama email parser for Pothos
 *
 * Fetches pending emails from the parse queue, runs each one through a local
 * Ollama model using the same prompt as the backend, and submits the result
 * back for inbox review (or dismisses non-transaction emails).
 *
 * Usage:
 *   npm run parse-queue           (from mcp/ directory)
 *   npx tsx src/ollama-parse.ts   (directly)
 *
 * Required env vars (add to mcp/.env):
 *   POTHOS_URL       — e.g. https://pothos.yourdomain.com
 *   POTHOS_API_KEY   — pth_... (generate in Pothos Settings → API Keys)
 *   OLLAMA_MODEL     — e.g. llama3.2, qwen2.5, mistral
 *
 * Optional:
 *   OLLAMA_URL       — default: http://localhost:11434
 */

import "dotenv/config"

// ── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.POTHOS_URL ?? "").replace(/\/$/, "")
const API_KEY = process.env.POTHOS_API_KEY ?? ""
const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "")
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? ""

if (!BASE_URL || !API_KEY) {
	console.error("Error: POTHOS_URL and POTHOS_API_KEY must be set in your .env file.")
	process.exit(1)
}

if (!OLLAMA_MODEL) {
	console.error("Error: OLLAMA_MODEL must be set (e.g. OLLAMA_MODEL=llama3.2).")
	process.exit(1)
}

// ── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
	const res = await fetch(`${BASE_URL}/api/v1${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
			...options.headers,
		},
	})
	if (!res.ok) {
		let msg = `Backend ${res.status}`
		try {
			const body = (await res.json()) as { error?: string }
			if (body?.error) msg = body.error
		} catch {
			// ignore
		}
		throw new Error(msg)
	}
	if (res.status === 204) return undefined as T
	return res.json() as Promise<T>
}

// ── Prompt (mirrors backend/src/services/parser.ts buildPrompt) ─────────────

function buildPrompt(
	rawContent: string,
	accounts: { id: string; name: string }[],
	categories: { id: string; name: string; type: string }[],
	currency: string
): string {
	return `You are a financial transaction parser. The user's currency is ${currency}.
User's bank accounts: ${JSON.stringify(accounts)}
Available categories: ${JSON.stringify(categories)}

Parse this bank notification email and return ONLY valid JSON (no markdown, no explanation):
{
  "type": "income" or "expense",
  "amount": <positive integer in minor units — multiply the amount by 100>,
  "date": <unix timestamp in seconds>,
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
- If this is not a bank transaction notification, return {"not_transaction": true}

Email:
${rawContent.slice(0, 10000)}`
}

// ── Ollama call ─────────────────────────────────────────────────────────────

interface OllamaResponse {
	message: { content: string }
}

async function callOllama(prompt: string): Promise<string> {
	const res = await fetch(`${OLLAMA_URL}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: OLLAMA_MODEL,
			messages: [{ role: "user", content: prompt }],
			stream: false,
			format: "json",
		}),
	})
	if (!res.ok) {
		throw new Error(`Ollama returned ${res.status} — is it running at ${OLLAMA_URL}?`)
	}
	const data = (await res.json()) as OllamaResponse
	return data.message.content
}

// ── Parse result schema (loose validation) ──────────────────────────────────

interface ParsedResult {
	type: "income" | "expense"
	amount: number
	date: number
	description: string
	accountId?: string | null
	categoryId?: string | null
	notes?: string | null
}

function validateResult(raw: unknown): ParsedResult | null {
	if (typeof raw !== "object" || raw === null) return null
	const obj = raw as Record<string, unknown>

	if (!("type" in obj) || (obj.type !== "income" && obj.type !== "expense")) return null
	if (typeof obj.amount !== "number" || !Number.isInteger(obj.amount) || obj.amount <= 0)
		return null
	if (typeof obj.date !== "number" || !Number.isInteger(obj.date)) return null
	if (typeof obj.description !== "string" || obj.description.trim() === "") return null

	return {
		type: obj.type,
		amount: obj.amount,
		date: obj.date,
		description: obj.description.slice(0, 60),
		accountId: typeof obj.accountId === "string" ? obj.accountId : null,
		categoryId: typeof obj.categoryId === "string" ? obj.categoryId : null,
		notes: typeof obj.notes === "string" ? obj.notes : null,
	}
}

// ── Main ────────────────────────────────────────────────────────────────────

interface PendingMessage {
	id: string
	rawContent: string
	subject: string | null
	createdAt: number
}

interface Account {
	id: string
	name: string
	type: string
}

interface Category {
	id: string
	name: string
	type: string
}

interface UserSettings {
	currency: string
}

async function main() {
	console.log(`Pothos Ollama Parser — model: ${OLLAMA_MODEL}`)
	console.log(`Backend: ${BASE_URL}`)
	console.log(`Ollama:  ${OLLAMA_URL}\n`)

	// Fetch context needed for the prompt
	const [accounts, categories, settings] = await Promise.all([
		apiFetch<Account[]>("/accounts?includeInactive=true"),
		apiFetch<Category[]>("/categories"),
		apiFetch<UserSettings>("/user/settings"),
	])

	const accountsForPrompt = accounts.map((a) => ({ id: a.id, name: a.name }))
	const categoriesForPrompt = categories.map((c) => ({ id: c.id, name: c.name, type: c.type }))
	const currency = settings.currency

	// Fetch pending emails
	const { data: pending } = await apiFetch<{ data: PendingMessage[]; pagination: unknown }>(
		"/parse-queue?status=pending"
	)

	if (pending.length === 0) {
		console.log("No pending emails to parse.")
		return
	}

	console.log(`Found ${pending.length} pending email${pending.length !== 1 ? "s" : ""}.\n`)

	let submitted = 0
	let dismissed = 0
	let failed = 0

	for (const msg of pending) {
		const subject = msg.subject ?? "(no subject)"
		process.stdout.write(`Processing: "${subject}" (${msg.id}) ... `)

		const prompt = buildPrompt(msg.rawContent, accountsForPrompt, categoriesForPrompt, currency)

		let responseText: string
		try {
			responseText = await callOllama(prompt)
		} catch (err) {
			console.log(
				`SKIPPED — Ollama error: ${err instanceof Error ? err.message : String(err)}`
			)
			failed++
			continue
		}

		// Extract JSON from response
		const jsonMatch = responseText.match(/\{[\s\S]*\}/)
		if (!jsonMatch) {
			console.log("SKIPPED — no JSON in response")
			failed++
			continue
		}

		let parsed: unknown
		try {
			parsed = JSON.parse(jsonMatch[0])
		} catch {
			console.log("SKIPPED — invalid JSON")
			failed++
			continue
		}

		// Not a transaction — dismiss it
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"not_transaction" in parsed &&
			(parsed as Record<string, unknown>).not_transaction === true
		) {
			try {
				await apiFetch(`/parse-queue/${msg.id}/dismiss`, { method: "POST" })
				console.log("dismissed (not a transaction)")
				dismissed++
			} catch (err) {
				console.log(
					`FAILED to dismiss — ${err instanceof Error ? err.message : String(err)}`
				)
				failed++
			}
			continue
		}

		// Validate the parsed result
		const result = validateResult(parsed)
		if (!result) {
			console.log("SKIPPED — result failed validation")
			failed++
			continue
		}

		// Submit for inbox review
		try {
			await apiFetch(`/parse-queue/${msg.id}/submit`, {
				method: "POST",
				body: JSON.stringify({
					type: result.type,
					amount: result.amount,
					date: result.date,
					description: result.description,
					accountId: result.accountId ?? null,
					categoryId: result.categoryId ?? null,
					notes: result.notes ?? null,
					bypassReview: false,
				}),
			})
			const display = (result.amount / 100).toFixed(2)
			console.log(`submitted — ${result.type} ${display} "${result.description}"`)
			submitted++
		} catch (err) {
			console.log(`FAILED to submit — ${err instanceof Error ? err.message : String(err)}`)
			failed++
		}
	}

	console.log(`\nDone. Submitted: ${submitted} | Dismissed: ${dismissed} | Failed: ${failed}`)
	if (submitted > 0) {
		console.log("Review submitted transactions in your Pothos inbox.")
	}
}

main().catch((err) => {
	console.error("Fatal:", err instanceof Error ? err.message : String(err))
	process.exit(1)
})
