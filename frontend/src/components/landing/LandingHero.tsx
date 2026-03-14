'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.18, delayChildren: 0.25 },
    },
}

const item = {
    hidden: { opacity: 0, y: 24 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
    },
}

export function LandingHero() {
    const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

    useEffect(() => {
        fetch('/api/v1/user/me', { credentials: 'include' })
            .then((r) => setLoggedIn(r.ok))
            .catch(() => setLoggedIn(false))
    }, [])

    return (
        <section className="relative flex-1 flex items-center justify-center overflow-hidden">
            {/* Ambient background blobs */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full opacity-40 blur-[120px] animate-blob"
                    style={{ background: 'var(--color-accent-light)' }}
                />
                <div
                    className="absolute -bottom-32 -right-16 w-[420px] h-[420px] rounded-full opacity-30 blur-[100px] animate-blob-delayed"
                    style={{ background: 'var(--color-accent)' }}
                />
            </div>

            {/* Content */}
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center"
            >
                {/* Heading */}
                <motion.h1
                    variants={item}
                    className="text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold text-fg leading-tight tracking-tight mb-5"
                >
                    Say hi to{' '}
                    <span className="text-primary">Pothos.</span>
                </motion.h1>

                {/* Description */}
                <motion.p
                    variants={item}
                    className="text-sm md:text-base text-fg-muted max-w-lg leading-relaxed mb-6"
                >
                    A simple budgeting app that helps you grow your money plant.
                    <br />
                    Track expenses, plan budgets, and understand your money — without the overwhelm.
                </motion.p>

                {/* Badges */}
                <motion.div
                    variants={item}
                    className="flex items-center gap-2 text-xs font-medium text-fg-muted mb-10"
                >
                    <span>Open-source</span>
                    <span className="w-px h-3 bg-border" />
                    <span>Self-hostable</span>
                </motion.div>

                {/* CTAs */}
                <motion.div
                    variants={item}
                    className="flex flex-col sm:flex-row items-center gap-3"
                >
                    {loggedIn ? (
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary-hover active:scale-[0.98] transition-all duration-200 shadow-sm"
                        >
                            Go to Dashboard
                            <ArrowRight size={15} strokeWidth={2.5} />
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/sign-up"
                                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary-hover active:scale-[0.98] transition-all duration-200 shadow-sm"
                            >
                                Get started
                                <ArrowRight size={15} strokeWidth={2.5} />
                            </Link>
                            <Link
                                href="/sign-in"
                                className="inline-flex items-center px-8 py-3.5 rounded-full border border-border text-fg font-semibold text-sm hover:bg-bg-2 active:scale-[0.98] transition-all duration-200"
                            >
                                Sign in
                            </Link>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </section>
    )
}
