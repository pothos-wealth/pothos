"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
	open: boolean
	onClose: () => void
	title: string
	children: React.ReactNode
	className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
	const dialogRef = useRef<HTMLDivElement>(null)
	const previousFocusRef = useRef<HTMLElement | null>(null)
	const onCloseRef = useRef(onClose)
	onCloseRef.current = onClose

	// Save and restore focus around modal lifecycle
	useEffect(() => {
		if (open) {
			previousFocusRef.current = document.activeElement as HTMLElement
		} else {
			previousFocusRef.current?.focus()
		}
	}, [open])

	// Focus first element on open + trap Tab + close on Escape
	useEffect(() => {
		if (!open) return

		const dialog = dialogRef.current
		if (!dialog) return

		const focusableSelectors =
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
		const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelectors))
		focusable[0]?.focus()

		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCloseRef.current()
				return
			}
			if (e.key === "Tab" && focusable.length > 0) {
				const first = focusable[0]
				const last = focusable[focusable.length - 1]
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault()
					last.focus()
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault()
					first.focus()
				}
			}
		}

		document.addEventListener("keydown", handleKey)
		return () => document.removeEventListener("keydown", handleKey)
	}, [open])

	useEffect(() => {
		if (open) {
			document.body.style.overflow = "hidden"
		} else {
			document.body.style.overflow = ""
		}
		return () => {
			document.body.style.overflow = ""
		}
	}, [open])

	if (!open) return null

	return (
		<div
			className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
		>
			<div
				ref={dialogRef}
				className={cn(
					"bg-bg-2 border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto",
					className
				)}
			>
				<div className="flex items-center justify-between mb-5">
					<h2 className="font-semibold text-fg text-base">{title}</h2>
					<button
						onClick={onClose}
						className="text-fg-muted hover:text-fg transition-colors duration-150 rounded-lg p-1 hover:bg-bg-3"
						aria-label="Close modal"
					>
						<X size={18} />
					</button>
				</div>
				{children}
			</div>
		</div>
	)
}
