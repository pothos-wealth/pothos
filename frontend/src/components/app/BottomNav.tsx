"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoreHorizontal, Settings, Tag, ShieldCheck, X, Inbox } from "lucide-react"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { navItems } from "@/lib/nav"
import { api } from "@/lib/api"
import { useInboxCount } from "@/lib/inbox-count-context"
import type { User } from "@/lib/types"

// First 4 items only — Categories and Inbox move into the More sheet
const mainNavItems = navItems.slice(0, 4)

export function BottomNav() {
	const pathname = usePathname()
	const [user, setUser] = useState<User | null>(null)
	const [moreOpen, setMoreOpen] = useState(false)
	const { inboxCount: pendingCount } = useInboxCount()

	useEffect(() => {
		api.user
			.me()
			.then(setUser)
			.catch(() => {})
	}, [])

	const isMoreActive =
		pathname === "/categories" ||
		pathname === "/settings" ||
		pathname.startsWith("/admin") ||
		pathname === "/inbox"

	return (
		<>
			<nav className="fixed bottom-0 inset-x-0 md:hidden bg-bg-2 border-t border-border z-40">
				<div className="grid grid-cols-5 px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
					{mainNavItems.map(({ label, href, icon: Icon }) => {
						const isActive = pathname === href
						return (
							<Link
								key={href}
								href={href}
								onClick={isActive ? (e) => e.preventDefault() : undefined}
								className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
									isActive ? "text-primary" : "text-fg-muted"
								}`}
							>
								<Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
								{label}
							</Link>
						)
					})}
					<button
						onClick={() => setMoreOpen(true)}
						className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
							isMoreActive ? "text-primary" : "text-fg-muted"
						}`}
					>
						<div className="relative">
							<MoreHorizontal size={20} strokeWidth={isMoreActive ? 2.5 : 2} />
							{pendingCount > 0 && (
								<span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
									<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
								</span>
							)}
						</div>
						More
					</button>
				</div>
			</nav>

			{/* More sheet */}
			{moreOpen && (
				<>
					<div
						className="fixed inset-0 z-50 bg-black/40 md:hidden"
						onClick={() => setMoreOpen(false)}
					/>
					<div className="fixed bottom-0 inset-x-0 z-50 bg-bg-2 border-t border-border rounded-t-2xl md:hidden">
						<div className="flex items-center justify-between px-5 py-4 border-b border-border">
							<span className="text-sm font-semibold text-fg">More</span>
							<button
								onClick={() => setMoreOpen(false)}
								className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-3 transition-colors duration-150"
								aria-label="Close menu"
							>
								<X size={18} />
							</button>
						</div>
						<div className="px-4 py-3 flex flex-col gap-1 pb-8">
							<Link
								href="/inbox"
								onClick={() => setMoreOpen(false)}
								className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
									pathname === "/inbox"
										? "bg-accent-light text-primary"
										: "text-fg hover:bg-bg-3"
								}`}
							>
								<div className="relative">
									<Inbox
										size={18}
										strokeWidth={pathname === "/inbox" ? 2.5 : 2}
									/>
									{pendingCount > 0 && (
										<span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
									)}
								</div>
								<span className="flex-1">Inbox</span>
								{pendingCount > 0 && (
									<span className="bg-primary text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
										{pendingCount > 99 ? "99+" : pendingCount}
									</span>
								)}
							</Link>
							<Link
								href="/categories"
								onClick={() => setMoreOpen(false)}
								className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
									pathname === "/categories"
										? "bg-accent-light text-primary"
										: "text-fg hover:bg-bg-3"
								}`}
							>
								<Tag size={18} strokeWidth={pathname === "/categories" ? 2.5 : 2} />
								Categories
							</Link>
							<Link
								href="/settings"
								onClick={() => setMoreOpen(false)}
								className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
									pathname === "/settings"
										? "bg-accent-light text-primary"
										: "text-fg hover:bg-bg-3"
								}`}
							>
								<Settings
									size={18}
									strokeWidth={pathname === "/settings" ? 2.5 : 2}
								/>
								Settings
							</Link>
							{user?.isSuperadmin && (
								<Link
									href="/admin"
									onClick={() => setMoreOpen(false)}
									className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
										pathname.startsWith("/admin")
											? "bg-accent-light text-primary"
											: "text-fg hover:bg-bg-3"
									}`}
								>
									<ShieldCheck
										size={18}
										strokeWidth={pathname.startsWith("/admin") ? 2.5 : 2}
									/>
									Admin
								</Link>
							)}
							<div className="flex items-center justify-between px-3 py-3">
								<span className="text-sm font-medium text-fg">Theme</span>
								<ThemeToggle />
							</div>
						</div>
					</div>
				</>
			)}
		</>
	)
}
