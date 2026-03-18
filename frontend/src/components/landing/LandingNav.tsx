'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PlantIcon } from '@/components/ui/PlantIcon'

export function LandingNav() {
    const [user, setUser] = useState<{ email: string } | null | 'loading'>('loading')

    useEffect(() => {
        fetch('/api/v1/user/me', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => setUser(data ?? null))
            .catch(() => setUser(null))
    }, [])

    return (
        <motion.nav
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed top-0 inset-x-0 z-50 backdrop-blur-md border-b border-border bg-[rgba(250,248,243,0.85)] dark:bg-[rgba(17,23,16,0.85)]"
        >
            <div className="mx-auto max-w-6xl px-6 py-3.5 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-1.5">
                    <PlantIcon size={22} className="text-primary" />
                    <span className="font-bold text-fg tracking-tight">Pothos</span>
                </Link>

                {/* Right */}
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    {user === 'loading' ? null : user ? (
                        <Link href="/settings" className="w-8 h-8 rounded-full bg-accent-light text-primary font-semibold text-sm flex items-center justify-center uppercase hover:bg-accent transition-colors duration-200">
                            {user.email[0]}
                        </Link>
                    ) : (
                        <Link
                            href="/sign-in"
                            className="text-sm font-semibold text-fg-muted hover:text-fg transition-colors duration-200"
                        >
                            Sign in
                        </Link>
                    )}
                </div>
            </div>
        </motion.nav>
    )
}
