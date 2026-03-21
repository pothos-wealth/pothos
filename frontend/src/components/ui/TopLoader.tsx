"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

export function TopLoader() {
	const pathname = usePathname()
	const [width, setWidth] = useState(0)
	const [visible, setVisible] = useState(false)
	const prevPathname = useRef(pathname)
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			const target = (e.target as HTMLElement).closest("a")
			if (!target) return
			const href = target.getAttribute("href")
			if (
				!href ||
				href.startsWith("#") ||
				href.startsWith("http") ||
				href.startsWith("mailto")
			)
				return
			// Same page — don't trigger
			if (href === pathname) return

			if (hideTimer.current) clearTimeout(hideTimer.current)
			if (completeTimer.current) clearTimeout(completeTimer.current)
			setVisible(true)
			setWidth(40)
		}

		document.addEventListener("click", handleClick)
		return () => document.removeEventListener("click", handleClick)
	}, [pathname])

	useEffect(() => {
		if (pathname === prevPathname.current) return
		prevPathname.current = pathname

		// Navigation complete — race to 100% then hide
		setWidth(100)
		completeTimer.current = setTimeout(() => {
			setVisible(false)
			setWidth(0)
		}, 400)

		return () => {
			if (completeTimer.current) clearTimeout(completeTimer.current)
		}
	}, [pathname])

	if (!visible) return null

	return (
		<div
			className="fixed top-0 left-0 z-[9999] h-0.5 bg-primary transition-all duration-300 ease-out"
			style={{ width: `${width}%` }}
		/>
	)
}
