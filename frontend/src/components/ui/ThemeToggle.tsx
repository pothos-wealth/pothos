'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    if (!mounted) {
        return <div className="h-7 w-14 rounded-full bg-bg-3 border border-border" />
    }

    const isDark = resolvedTheme === 'dark'

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="relative flex h-7 w-14 items-center rounded-full border border-border bg-bg-2 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <motion.div
                className="absolute flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm"
                animate={{ x: isDark ? '1.625rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
                {isDark ? (
                    <Moon size={11} strokeWidth={2.5} />
                ) : (
                    <Sun size={11} strokeWidth={2.5} />
                )}
            </motion.div>
        </button>
    )
}
