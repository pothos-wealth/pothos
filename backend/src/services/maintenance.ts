import cron from "node-cron"
import { db } from "../db/index.js"
import { parsedTransactions, pendingMessages } from "../db/schema.js"
import { eq, or, inArray } from "drizzle-orm"

const BATCH_SIZE = 500

function deleteParsedTransactionsBatch(): number {
	let total = 0
	while (true) {
		const ids = db
			.select({ id: parsedTransactions.id })
			.from(parsedTransactions)
			.where(
				or(
					eq(parsedTransactions.status, "approved"),
					eq(parsedTransactions.status, "rejected")
				)
			)
			.limit(BATCH_SIZE)
			.all()
			.map((r) => r.id)

		if (ids.length === 0) break
		db.delete(parsedTransactions).where(inArray(parsedTransactions.id, ids)).run()
		total += ids.length
		if (ids.length < BATCH_SIZE) break
	}
	return total
}

function deletePendingMessagesBatch(): number {
	let total = 0
	while (true) {
		const ids = db
			.select({ id: pendingMessages.id })
			.from(pendingMessages)
			.where(
				or(eq(pendingMessages.status, "processed"), eq(pendingMessages.status, "failed"))
			)
			.limit(BATCH_SIZE)
			.all()
			.map((r) => r.id)

		if (ids.length === 0) break
		db.delete(pendingMessages).where(inArray(pendingMessages.id, ids)).run()
		total += ids.length
		if (ids.length < BATCH_SIZE) break
	}
	return total
}

export function runInboxCleanup(): void {
	try {
		const ptDeleted = deleteParsedTransactionsBatch()
		const pmDeleted = deletePendingMessagesBatch()
		console.info(
			`[maintenance] Inbox cleanup complete: ${ptDeleted} parsed_transactions, ${pmDeleted} pending_messages removed`
		)
	} catch (err) {
		console.error(
			"[maintenance] Inbox cleanup failed:",
			err instanceof Error ? err.message : String(err)
		)
	}
}

// Every day at 3 AM
const MAINTENANCE_CRON = process.env.MAINTENANCE_CRON ?? "0 3 * * *"

export function startMaintenance(): void {
	console.info(`[maintenance] Scheduling inbox cleanup on cron: ${MAINTENANCE_CRON}`)
	cron.schedule(MAINTENANCE_CRON, () => {
		console.info("[maintenance] Running scheduled inbox cleanup…")
		runInboxCleanup()
	})
}
