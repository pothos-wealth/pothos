import cron from "node-cron"
import { db } from "../db/index.js"
import { sql } from "drizzle-orm"

const BATCH_SIZE = 500

function deleteBatched(table: string, where: string): number {
	const stmt = db.$client.prepare(
		`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE ${where} LIMIT ${BATCH_SIZE})`
	)
	let total = 0
	while (true) {
		const result = stmt.run()
		total += result.changes
		if (result.changes < BATCH_SIZE) break
	}
	return total
}

export function runInboxCleanup(): void {
	try {
		const ptDeleted = deleteBatched("parsed_transactions", "status IN ('approved', 'rejected')")
		const pmDeleted = deleteBatched("pending_messages", "status IN ('processed', 'failed')")
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
