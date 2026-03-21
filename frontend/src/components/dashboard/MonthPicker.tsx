"use client"

import { formatMonthYear } from "@/lib/utils"

interface MonthPickerProps {
	month: number
	year: number
	onChange: (month: number, year: number) => void
}

function getMonthOptions() {
	const now = new Date()
	const options = []
	for (let i = 0; i < 12; i++) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
		options.push({ month: d.getMonth() + 1, year: d.getFullYear() })
	}
	return options
}

export function MonthPicker({ month, year, onChange }: MonthPickerProps) {
	const options = getMonthOptions()

	return (
		<select
			value={`${year}-${month}`}
			onChange={(e) => {
				const [y, m] = e.target.value.split("-").map(Number)
				onChange(m, y)
			}}
			className="text-sm font-medium text-fg-muted bg-bg-2 border border-border pl-3 py-1.5 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
		>
			{options.map(({ month: m, year: y }) => (
				<option key={`${y}-${m}`} value={`${y}-${m}`}>
					{formatMonthYear(m, y)}
				</option>
			))}
		</select>
	)
}
