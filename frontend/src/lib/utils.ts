import { useCurrency } from "./currency-context"
import type { Category } from "./types"

export function getCategoryName(categoryId: string | null, categories: Category[]): string {
	if (!categoryId) return "Uncategorised"
	return categories.find((c) => c.id === categoryId)?.name ?? "Uncategorised"
}

// Hook to get a currency formatter that uses the current user's currency
export function useCurrencyFormatter() {
	const { currency } = useCurrency()
	return (amount: number) => formatCurrency(amount, currency)
}

// Returns just the currency symbol (e.g. "₹", "$", "€") for the current user's currency
export function useCurrencySymbol() {
	const { currency } = useCurrency()
	return (
		new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: 0 })
			.formatToParts(0)
			.find((p) => p.type === "currency")?.value ?? currency
	)
}

export function cn(...classes: (string | undefined | false | null)[]): string {
	return classes.filter(Boolean).join(" ")
}

// Amounts are stored as integers in the smallest unit (e.g., paise for INR, cents for USD)
// Divide by 100 to get the base unit, then format
export function formatCurrency(amount: number, currency = "INR"): string {
	try {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount / 100)
	} catch {
		// Fallback for invalid currency codes
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount / 100)
	}
}

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
]

export function formatMonthYear(month: number, year: number): string {
	return `${MONTH_NAMES[month - 1]} ${year}`
}

const MONTH_NAMES_SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
]

export function formatDate(timestamp: number): string {
	const date = new Date(timestamp * 1000)
	const now = new Date()
	const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
	const yesterdayUTC = todayUTC - 86400000
	const txDayUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

	if (txDayUTC === todayUTC) return "Today"
	if (txDayUTC === yesterdayUTC) return "Yesterday"
	return `${MONTH_NAMES_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`
}
