import { Card } from "@/components/ui/Card"
import { useState } from "react"
import { HelpCircle } from "lucide-react"

interface StatCardProps {
	title: string
	value: string
	trend?: string
	positive?: boolean
	trendTooltip?: string
}

export function StatCard({ title, value, trend, positive, trendTooltip }: StatCardProps) {
	const [showTooltip, setShowTooltip] = useState(false)

	return (
		<Card>
			<p className="text-xs font-medium text-fg-muted mb-1">{title}</p>
			<p className="text-lg sm:text-2xl font-bold text-fg truncate">{value}</p>
			{trend && (
				<div className="flex items-center gap-1 mt-1 relative">
					<p
						className={`text-xs font-medium ${positive ? "text-primary" : "text-expense"}`}
					>
						{trend}
					</p>
					{trendTooltip && (
						<>
							<button
								onMouseEnter={() => setShowTooltip(true)}
								onMouseLeave={() => setShowTooltip(false)}
								className="text-fg-muted hover:text-fg cursor-help transition-colors"
								aria-label="Trend explanation"
							>
								<HelpCircle size={14} />
							</button>
							{showTooltip && (
								<div className="absolute bottom-full left-0 mb-2 bg-bg-2 border border-border rounded-lg p-2 text-xs text-fg whitespace-nowrap z-10 shadow-lg">
									{trendTooltip}
								</div>
							)}
						</>
					)}
				</div>
			)}
		</Card>
	)
}
