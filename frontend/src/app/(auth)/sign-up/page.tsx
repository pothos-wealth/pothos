'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PasswordRule {
    label: string
    test: (pw: string) => boolean
}

const PASSWORD_RULES: PasswordRule[] = [
    { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
    { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
    { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

const CURRENCIES = [
    { code: 'INR', name: '₹ Indian Rupee' },
    { code: 'USD', name: '$ US Dollar' },
    { code: 'EUR', name: '€ Euro' },
    { code: 'GBP', name: '£ British Pound' },
    { code: 'JPY', name: '¥ Japanese Yen' },
    { code: 'AUD', name: '$ Australian Dollar' },
    { code: 'CAD', name: '$ Canadian Dollar' },
]

export default function SignUpPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [currency, setCurrency] = useState('INR')
    const [inviteCode, setInviteCode] = useState('')
    const [requiresCode, setRequiresCode] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showRules, setShowRules] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        api.auth.config()
            .then((cfg) => setRequiresCode(cfg.registrationRequiresCode))
            .catch((err) => console.error('[auth/config] failed:', err))
    }, [])

    const allRulesPassed = PASSWORD_RULES.every((r) => r.test(password))

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (!email) {
            setError('Email is required.')
            return
        }

        if (!allRulesPassed) {
            setError('Password does not meet the requirements below.')
            setShowRules(true)
            return
        }

        if (requiresCode && !inviteCode.trim()) {
            setError('An invite code is required to create an account.')
            return
        }

        setLoading(true)
        try {
            await api.auth.register(email, password, currency, requiresCode ? inviteCode.trim() : undefined)
            router.push('/dashboard')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-sm">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-fg">Create an account</h1>
                <p className="text-sm text-fg-muted mt-1">Start tracking your finances with Pothos</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                {error && (
                    <div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-sm font-medium text-fg">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
                        placeholder="you@example.com"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="currency" className="text-sm font-medium text-fg">
                        Currency
                    </label>
                    <select
                        id="currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
                    >
                        {CURRENCIES.map((curr) => (
                            <option key={curr.code} value={curr.code}>
                                {curr.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-fg-muted">This cannot be changed later</p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className="text-sm font-medium text-fg">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value)
                                setShowRules(true)
                            }}
                            onFocus={() => setShowRules(true)}
                            className="bg-bg-2 border border-border rounded-xl px-3 py-2.5 pr-10 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow w-full"
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {showRules && (
                        <ul className="flex flex-col gap-1.5 mt-1">
                            {PASSWORD_RULES.map((rule) => {
                                const passed = rule.test(password)
                                return (
                                    <li key={rule.label} className={cn('flex items-center gap-2 text-xs', passed ? 'text-primary' : 'text-fg-muted')}>
                                        {passed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                        {rule.label}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                {requiresCode && (
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="inviteCode" className="text-sm font-medium text-fg">
                            Invite Code
                        </label>
                        <input
                            id="inviteCode"
                            type="text"
                            required
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            className="bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
                            placeholder="Enter your invite code"
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading ? 'Creating account…' : 'Create account'}
                </button>
            </form>

            <p className="text-center text-sm text-fg-muted mt-6">
                Already have an account?{' '}
                <Link href="/sign-in" className="font-semibold text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    )
}
