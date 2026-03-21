import { cn } from "@/lib/utils"

interface CardProps {
	children: React.ReactNode
	className?: string
}

export function Card({ children, className }: CardProps) {
	return (
		<div className={cn("bg-bg-2 border border-border rounded-2xl p-5", className)}>
			{children}
		</div>
	)
}
