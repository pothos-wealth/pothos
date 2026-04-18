"use client"

import type { KeyboardEvent } from "react"
import { useEffect, useId, useRef, useState } from "react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { TransactionType } from "@/lib/types"

interface DescriptionAutocompleteInputProps {
	value: string
	onChange: (value: string) => void
	txType?: TransactionType
	placeholder?: string
	className?: string
	required?: boolean
	disabled?: boolean
}

const DEBOUNCE_MS = 300

export function DescriptionAutocompleteInput({
	value,
	onChange,
	txType,
	placeholder,
	className,
	required,
	disabled,
}: DescriptionAutocompleteInputProps) {
	const listboxId = useId()
	const requestIdRef = useRef(0)
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const [suggestions, setSuggestions] = useState<string[]>([])
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		const query = value.trim()
		if (!query || disabled) {
			setSuggestions([])
			setOpen(false)
			setActiveIndex(-1)
			setLoading(false)
			return
		}

		const requestId = ++requestIdRef.current
		const timeout = window.setTimeout(async () => {
			setLoading(true)
			try {
				const result = await api.transactions.descriptionSuggestions({
					q: query,
					type: txType,
					limit: 5,
				})

				if (requestId !== requestIdRef.current) return

				const filtered = result.suggestions.filter(
					(suggestion) => suggestion.toLowerCase() !== query.toLowerCase()
				)
				setSuggestions(filtered)
				setOpen(filtered.length > 0)
				setActiveIndex(filtered.length > 0 ? 0 : -1)
			} catch {
				if (requestId !== requestIdRef.current) return
				setSuggestions([])
				setOpen(false)
				setActiveIndex(-1)
			} finally {
				if (requestId === requestIdRef.current) {
					setLoading(false)
				}
			}
		}, DEBOUNCE_MS)

		return () => {
			window.clearTimeout(timeout)
		}
	}, [value, txType, disabled])

	function selectSuggestion(suggestion: string) {
		onChange(suggestion)
		setSuggestions([])
		setOpen(false)
		setActiveIndex(-1)
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (!open || suggestions.length === 0) {
			if (event.key === "Escape") {
				setOpen(false)
			}
			return
		}

		if (event.key === "ArrowDown") {
			event.preventDefault()
			setActiveIndex((current) => (current + 1) % suggestions.length)
			return
		}

		if (event.key === "ArrowUp") {
			event.preventDefault()
			setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
			return
		}

		if (event.key === "Enter" && activeIndex >= 0) {
			event.preventDefault()
			selectSuggestion(suggestions[activeIndex])
			return
		}

		if (event.key === "Escape") {
			event.preventDefault()
			setOpen(false)
			setActiveIndex(-1)
		}
	}

	return (
		<div className="relative">
			<input
				type="text"
				required={required}
				disabled={disabled}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onFocus={() => {
					if (suggestions.length > 0) {
						setOpen(true)
					}
				}}
				onBlur={() => {
					window.setTimeout(() => {
						setOpen(false)
						setActiveIndex(-1)
					}, 100)
				}}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				autoComplete="off"
				aria-autocomplete="list"
				aria-controls={listboxId}
				aria-expanded={open}
				className={className}
			/>

			{open && suggestions.length > 0 && (
				<div
					id={listboxId}
					role="listbox"
					className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-bg shadow-lg"
				>
					{suggestions.map((suggestion, index) => (
						<button
							key={`${suggestion}-${index}`}
							type="button"
							role="option"
							aria-selected={index === activeIndex}
							onMouseDown={(event) => {
								event.preventDefault()
								selectSuggestion(suggestion)
							}}
							className={cn(
								"flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-fg transition-colors",
								index === activeIndex ? "bg-bg-3" : "hover:bg-bg-2"
							)}
						>
							<span className="truncate">{suggestion}</span>
							{loading && index === 0 ? (
								<span className="ml-3 text-xs text-fg-muted">…</span>
							) : null}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
