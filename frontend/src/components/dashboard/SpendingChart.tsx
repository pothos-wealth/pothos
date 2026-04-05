"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { Card } from "@/components/ui/Card"
import { useCurrencyFormatter } from "@/lib/utils"
import type { CategoryBreakdown } from "@/lib/types"

interface SpendingChartProps {
	data: CategoryBreakdown[]
}

interface CustomTooltipProps {
	active?: boolean
	payload?: Array<{ name: string; value: number }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
	const formatCurrency = useCurrencyFormatter()

	if (active && payload && payload.length) {
		return (
			<div
				style={{
					backgroundColor: "var(--color-bg-2)",
					border: "1px solid var(--color-border)",
					borderRadius: "12px",
					padding: "8px",
					fontSize: "12px",
				}}
			>
				<p style={{ color: "var(--color-fg)", margin: 0 }}>{payload[0].name}</p>
				<p style={{ color: "var(--color-fg)", margin: "4px 0 0 0" }}>
					{formatCurrency(payload[0].value)}
				</p>
			</div>
		)
	}
	return null
}

export function SpendingChart({ data }: SpendingChartProps) {
	const formatCurrency = useCurrencyFormatter()

	const chartData = [...data]
		.sort((a, b) => b.total - a.total)
		.map((d) => ({
			...d,
			name: d.categoryName,
		}))

	return (
		<Card className="h-full flex flex-col">
			<p className="text-sm font-semibold text-fg mb-4">Spending by Category</p>

			{data.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<p className="text-sm text-fg-muted">No spending data for this month</p>
				</div>
			) : (
				<>
					<div className="flex-1 min-h-[180px]">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={chartData}
									cx="50%"
									cy="50%"
									innerRadius={55}
									outerRadius={80}
									paddingAngle={3}
									dataKey="total"
									stroke="none"
									isAnimationActive={false}
								>
									{chartData.map((entry, index) => (
										<Cell
											key={`cell-${index}`}
											fill={entry.categoryColor ?? "#B5A882"}
										/>
									))}
								</Pie>
								<Tooltip content={<CustomTooltip />} />
							</PieChart>
						</ResponsiveContainer>
					</div>

					<div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4">
						{chartData.map((entry) => (
							<div
								key={entry.categoryName}
								className="flex items-center justify-between gap-2"
							>
								<div className="flex items-center gap-2 min-w-0">
									<span
										className="w-2 h-2 rounded-full shrink-0"
										style={{
											backgroundColor: entry.categoryColor ?? "#B5A882",
										}}
									/>
									<span className="text-xs text-fg-muted truncate">
										{entry.categoryName}
									</span>
								</div>
								<span className="text-xs font-medium text-fg shrink-0">
									{formatCurrency(entry.total)}
								</span>
							</div>
						))}
					</div>
				</>
			)}
		</Card>
	)
}
