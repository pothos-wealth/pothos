'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navItems } from '@/lib/nav'

export function BottomNav() {
    const pathname = usePathname()

    return (
        <nav className="fixed bottom-0 inset-x-0 md:hidden bg-bg-2 border-t border-border z-40">
            <div className="flex items-center justify-around px-2 py-2">
                {navItems.map(({ label, href, icon: Icon }) => {
                    const isActive = pathname === href
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                                isActive ? 'text-primary' : 'text-fg-muted'
                            }`}
                        >
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            {label}
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
