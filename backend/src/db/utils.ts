/**
 * Returns Unix timestamps for the start (inclusive) and end (inclusive) of a calendar month.
 */
export function getMonthBounds(month: number, year: number): { start: number; end: number } {
	const start = Math.floor(Date.UTC(year, month - 1, 1) / 1000)
	const end = Math.floor(Date.UTC(year, month, 1) / 1000) - 1
	return { start, end }
}
