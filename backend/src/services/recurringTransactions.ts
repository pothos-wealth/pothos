import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "../db/index.js"
import {
	accounts,
	recurringTransactionRuns,
	recurringTransactions,
	transactions,
	type RecurringTransaction,
} from "../db/schema.js"

export interface RecurringGenerationResult {
	created: number
	skipped: number
}

function calendarDateToParts(timestamp: number): { year: number; month: number; day: number } {
	const date = new Date(timestamp * 1000)
	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
	}
}

function calendarDateFromParts(year: number, month: number, day: number): number {
	return Math.floor(Date.UTC(year, month - 1, day) / 1000)
}

function lastDayOfMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function occurrenceMonthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`
}

export function getMonthlyOccurrenceDate(
	year: number,
	month: number,
	repeatDay: number
): number {
	return calendarDateFromParts(year, month, Math.min(repeatDay, lastDayOfMonth(year, month)))
}

function nextMonth(year: number, month: number): { year: number; month: number } {
	if (month === 12) return { year: year + 1, month: 1 }
	return { year, month: month + 1 }
}

function dueOccurrencesForTemplate(
	template: RecurringTransaction,
	currentDate: number
): { occurrenceMonth: string; occurrenceDate: number }[] {
	const start = calendarDateToParts(template.startDate)
	const current = calendarDateToParts(currentDate)
	const due: { occurrenceMonth: string; occurrenceDate: number }[] = []

	let year = start.year
	let month = start.month
	while (year < current.year || (year === current.year && month <= current.month)) {
		const occurrenceDate = getMonthlyOccurrenceDate(year, month, template.repeatDay)
		if (
			occurrenceDate >= template.startDate &&
			occurrenceDate <= currentDate &&
			(template.endDate == null || occurrenceDate <= template.endDate)
		) {
			due.push({ occurrenceMonth: occurrenceMonthKey(year, month), occurrenceDate })
		}
		const next = nextMonth(year, month)
		year = next.year
		month = next.month
	}

	return due
}

function validateGenerationAccounts(template: RecurringTransaction): boolean {
	const fromAccount = db
		.select({ id: accounts.id, isActive: accounts.isActive })
		.from(accounts)
		.where(and(eq(accounts.id, template.accountId), eq(accounts.userId, template.userId)))
		.get()

	if (!fromAccount?.isActive) return false

	if (template.type === "transfer") {
		if (!template.toAccountId || template.toAccountId === template.accountId) return false
		const toAccount = db
			.select({ id: accounts.id, isActive: accounts.isActive })
			.from(accounts)
			.where(and(eq(accounts.id, template.toAccountId), eq(accounts.userId, template.userId)))
			.get()
		return toAccount?.isActive === true
	}

	return true
}

function generateOccurrence(
	template: RecurringTransaction,
	occurrenceMonth: string,
	occurrenceDate: number
): boolean {
	return db.transaction((tx) => {
		const existing = tx
			.select({ id: recurringTransactionRuns.id })
			.from(recurringTransactionRuns)
			.where(
				and(
					eq(recurringTransactionRuns.recurringTransactionId, template.id),
					eq(recurringTransactionRuns.occurrenceMonth, occurrenceMonth)
				)
			)
			.get()

		if (existing) return false
		if (!validateGenerationAccounts(template)) return false

		const now = Math.floor(Date.now() / 1000)
		const primaryId = nanoid()
		let pairedId: string | null = null

		if (template.type === "transfer") {
			pairedId = nanoid()
			tx.insert(transactions)
				.values({
					id: primaryId,
					userId: template.userId,
					accountId: template.accountId,
					categoryId: null,
					transferAccountId: template.toAccountId,
					transferTransactionId: pairedId,
					recurringTransactionId: template.id,
					type: "transfer",
					amount: -template.amount,
					date: occurrenceDate,
					description: template.description,
					notes: template.notes,
					createdAt: now,
					updatedAt: now,
				})
				.run()

			tx.insert(transactions)
				.values({
					id: pairedId,
					userId: template.userId,
					accountId: template.toAccountId!,
					categoryId: null,
					transferAccountId: template.accountId,
					transferTransactionId: primaryId,
					recurringTransactionId: template.id,
					type: "transfer",
					amount: template.amount,
					date: occurrenceDate,
					description: template.description,
					notes: template.notes,
					createdAt: now,
					updatedAt: now,
				})
				.run()
		} else {
			tx.insert(transactions)
				.values({
					id: primaryId,
					userId: template.userId,
					accountId: template.accountId,
					categoryId: template.categoryId,
					type: template.type,
					amount: template.type === "income" ? template.amount : -template.amount,
					date: occurrenceDate,
					description: template.description,
					notes: template.notes,
					recurringTransactionId: template.id,
					createdAt: now,
					updatedAt: now,
				})
				.run()
		}

		tx.insert(recurringTransactionRuns)
			.values({
				id: nanoid(),
				recurringTransactionId: template.id,
				occurrenceMonth,
				transactionId: primaryId,
				transferTransactionId: pairedId,
				createdAt: now,
			})
			.run()

		return true
	})
}

export function generateDueRecurringTransactions(currentDate?: number): RecurringGenerationResult {
	const today =
		currentDate ??
		Math.floor(
			Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) /
				1000
		)

	const templates = db
		.select()
		.from(recurringTransactions)
		.where(eq(recurringTransactions.isActive, true))
		.all()

	let created = 0
	let skipped = 0

	for (const template of templates) {
		for (const occurrence of dueOccurrencesForTemplate(template, today)) {
			try {
				if (generateOccurrence(template, occurrence.occurrenceMonth, occurrence.occurrenceDate)) {
					created += 1
				} else {
					skipped += 1
				}
			} catch (err) {
				skipped += 1
				console.error(
					`[recurring] Failed to generate ${template.id} for ${occurrence.occurrenceMonth}:`,
					err instanceof Error ? err.message : String(err)
				)
			}
		}
	}

	return { created, skipped }
}
