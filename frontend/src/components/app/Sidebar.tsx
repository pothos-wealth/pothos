'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PlantIcon } from '@/components/ui/PlantIcon'
import { navItems } from '@/lib/nav'
import { api } from '@/lib/api'
import { useInboxCount } from '@/lib/inbox-count-context'
import type { User } from '@/lib/types'

interface NavItemProps {
    label: string
    href: string
    icon: React.ElementType
    isActive: boolean
    badge?: number
}

function NavItem({ label, href, icon: Icon, isActive, badge }: NavItemProps) {
    return (
        <Link
            href={href}
            onClick={isActive ? (e) => e.preventDefault() : undefined}
            className={`px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-colors duration-150 ${
                isActive
                    ? 'bg-accent-light text-primary font-semibold'
                    : 'text-fg-muted hover:bg-bg-3 hover:text-fg'
            }`}
        >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            <span className="flex-1">{label}</span>
            {badge != null && badge > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                </span>
            )}
        </Link>
    )
}

export function Sidebar() {
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)
    const { inboxCount } = useInboxCount()

    useEffect(() => {
        api.user.me().then(setUser).catch(() => {})
    }, [])

    return (
        <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r border-border bg-bg-2">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 border-b border-border px-4 py-4">
                <PlantIcon size={22} className="text-primary" />
                <span className="text-base font-bold text-fg">Pothos</span>
            </Link>

            {/* Nav */}
            <nav className="flex-1 flex flex-col p-3 gap-1">
                {navItems.map((item) => (
                    <NavItem
                        key={item.href}
                        label={item.label}
                        href={item.href}
                        icon={item.icon}
                        isActive={pathname === item.href}
                        badge={item.href === '/inbox' ? inboxCount : undefined}
                    />
                ))}
                {user?.isSuperadmin && (
                    <NavItem
                        label="Admin"
                        href="/admin"
                        icon={ShieldCheck}
                        isActive={pathname.startsWith('/admin')}
                    />
                )}
            </nav>

            {/* Bottom */}
            <div className="border-t border-border p-3 flex justify-between items-center">
                <NavItem
                    label="Settings"
                    href="/settings"
                    icon={Settings}
                    isActive={pathname === '/settings'}
                />
                <ThemeToggle />
            </div>
        </aside>
    )
}
