'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { navItems } from '@/lib/nav'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

export function BottomNav() {
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        api.user.me().then(setUser).catch(() => {})
    }, [])

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
                {user?.isSuperadmin && (
                    <Link
                        href="/admin"
                        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                            pathname.startsWith('/admin') ? 'text-primary' : 'text-fg-muted'
                        }`}
                    >
                        <ShieldCheck size={20} strokeWidth={pathname.startsWith('/admin') ? 2.5 : 2} />
                        Admin
                    </Link>
                )}
            </div>
        </nav>
    )
}
