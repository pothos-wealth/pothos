'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PlantIcon } from '@/components/ui/PlantIcon'
import { navItems } from '@/lib/nav'

interface NavItemProps {
    label: string
    href: string
    icon: React.ElementType
    isActive: boolean
}

function NavItem({ label, href, icon: Icon, isActive }: NavItemProps) {
    return (
        <Link
            href={href}
            className={`px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-colors duration-150 ${
                isActive
                    ? 'bg-accent-light text-primary font-semibold'
                    : 'text-fg-muted hover:bg-bg-3 hover:text-fg'
            }`}
        >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            {label}
        </Link>
    )
}

export function Sidebar() {
    const pathname = usePathname()

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
                    />
                ))}
            </nav>

            {/* Bottom */}
            <div className="border-t border-border p-3 flex justify-between items-center">
                <Link
                    href="/settings"
                    className={`px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-colors duration-150 ${
                        pathname === '/settings'
                            ? 'bg-accent-light text-primary font-semibold'
                            : 'text-fg-muted hover:bg-bg-3 hover:text-fg'
                    }`}
                >
                    <Settings size={18} strokeWidth={pathname === '/settings' ? 2.5 : 2} />
                    Settings
                </Link>
                <ThemeToggle />
            </div>
        </aside>
    )
}
