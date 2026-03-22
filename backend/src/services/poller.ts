import cron from "node-cron"
import pLimit from "p-limit"
import { db } from "../db/index.js"
import {
	imapSettings,
	llmSettings,
	accounts,
	categories,
	pendingMessages,
	userSettings,
} from "../db/schema.js"
import { eq, and, or, isNull, sql } from "drizzle-orm"
import { fetchNewEmails } from "./imap.js"
import { parseEmail } from "./parser.js"
import { decrypt } from "./crypto.js"

const POLL_CRON = process.env.IMAP_POLL_CRON ?? "*/15 * * * *"
const MAX_AUTH_FAILURES = 3
const POLL_CONCURRENCY = parseInt(process.env.IMAP_POLL_CONCURRENCY ?? "10", 10)

export async function pollUser(userId: string): Promise<{ fetched: number; parsed: number }> {
	const settings = db
		.select()
		.from(imapSettings)
		.where(and(eq(imapSettings.userId, userId), eq(imapSettings.isActive, true)))
		.get()

	if (!settings) return { fetched: 0, parsed: 0 }

	const llm = db.select().from(llmSettings).where(eq(llmSettings.userId, userId)).get()

	let password: string
	try {
		password = decrypt(settings.password)
	} catch {
		console.error(`[poller] Failed to decrypt password for user ${userId}`)
		return { fetched: 0, parsed: 0 }
	}

	const config = {
		host: settings.host,
		port: settings.port,
		email: settings.email,
		password,
		mailbox: settings.mailbox,
	}

	let fetched = 0
	try {
		const result = await fetchNewEmails(userId, config, settings.lastUid ?? null)
		fetched = result.fetched

		// Reset consecutive failures and update lastPolledAt on success
		const now = Math.floor(Date.now() / 1000)
		db.update(imapSettings)
			.set({ lastPolledAt: now, consecutiveAuthFailures: 0, updatedAt: now })
			.where(eq(imapSettings.userId, userId))
			.run()
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.error(`[poller] IMAP error for user ${userId}: ${msg}`)

		const now = Math.floor(Date.now() / 1000)
		db.update(imapSettings)
			.set({ consecutiveAuthFailures: sql`consecutive_auth_failures + 1`, updatedAt: now })
			.where(eq(imapSettings.userId, userId))
			.run()

		const refreshed = db
			.select({ failures: imapSettings.consecutiveAuthFailures })
			.from(imapSettings)
			.where(eq(imapSettings.userId, userId))
			.get()

		if ((refreshed?.failures ?? 0) >= MAX_AUTH_FAILURES) {
			db.update(imapSettings)
				.set({ isActive: false, updatedAt: now })
				.where(eq(imapSettings.userId, userId))
				.run()
			console.warn(
				`[poller] Disabled IMAP for user ${userId} after ${MAX_AUTH_FAILURES} consecutive failures`
			)
		}

		return { fetched: 0, parsed: 0 }
	}

	if (fetched === 0) return { fetched: 0, parsed: 0 }

	// Parse all newly pending messages for this user
	const pending = db
		.select()
		.from(pendingMessages)
		.where(and(eq(pendingMessages.userId, userId), eq(pendingMessages.status, "pending")))
		.all()

	const userAccounts = db
		.select({ id: accounts.id, name: accounts.name })
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
		.all()

	const userCategories = db
		.select({ id: categories.id, name: categories.name, type: categories.type })
		.from(categories)
		.where(or(isNull(categories.userId), eq(categories.userId, userId)))
		.all()

	const userCurrencyRow = db
		.select({ currency: userSettings.currency })
		.from(userSettings)
		.where(eq(userSettings.userId, userId))
		.get()
	const currency = userCurrencyRow?.currency ?? "INR"

	const llmConfig = {
		provider: llm?.provider ?? "openai",
		apiKey: llm?.apiKey
			? (() => {
					try {
						return decrypt(llm.apiKey!)
					} catch {
						return null
					}
				})()
			: null,
		model: llm?.model ?? "gpt-4o-mini",
	}

	let parsed = 0
	for (const msg of pending) {
		try {
			const didParse = await parseEmail(
				msg.id,
				msg.rawContent,
				userId,
				userAccounts,
				userCategories,
				llmConfig,
				currency
			)
			if (didParse) parsed++
		} catch (err) {
			console.error(
				`[poller] Parse error for message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`
			)
		}
	}

	return { fetched, parsed }
}

export async function pollAllUsers(): Promise<void> {
	const activeSettings = db
		.select({ userId: imapSettings.userId })
		.from(imapSettings)
		.where(eq(imapSettings.isActive, true))
		.all()

	const limit = pLimit(POLL_CONCURRENCY)

	await Promise.all(
		activeSettings.map(({ userId }) =>
			limit(async () => {
				try {
					const result = await pollUser(userId)
					if (result.fetched > 0) {
						console.info(
							`[poller] User ${userId}: fetched=${result.fetched} parsed=${result.parsed}`
						)
					}
				} catch (err) {
					console.error(
						`[poller] Unexpected error for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
					)
				}
			})
		)
	)
}

export function startPoller(): void {
	console.info(`[poller] Starting email poller (cron: ${POLL_CRON})`)
	cron.schedule(POLL_CRON, () => {
		pollAllUsers().catch((err) => {
			console.error("[poller] Poll error:", err)
		})
	})
}
