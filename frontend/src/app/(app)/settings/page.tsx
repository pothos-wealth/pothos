'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Lock, Eye, EyeOff } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageTransition } from '@/components/ui/PageTransition'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { api } from '@/lib/api'
import type { User, UserSettings } from '@/lib/types'

const PASSWORD_RULES = [
    { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'One special character', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
]

export default function SettingsPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [settings, setSettings] = useState<UserSettings | null>(null)
    const [loading, setLoading] = useState(true)

    // Change password form
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [pwSubmitting, setPwSubmitting] = useState(false)
    const [pwError, setPwError] = useState('')
    const [pwSuccess, setPwSuccess] = useState('')
    const [showCurrentPw, setShowCurrentPw] = useState(false)
    const [showNewPw, setShowNewPw] = useState(false)
    const [showConfirmPw, setShowConfirmPw] = useState(false)

    useEffect(() => {
        Promise.all([api.user.me(), api.user.settings()])
            .then(([u, s]) => { setUser(u); setSettings(s) })
            .catch((err) => {
                if (err.message === 'UNAUTHORIZED') router.push('/sign-in')
            })
            .finally(() => setLoading(false))
    }, [router])

    async function handleLogout() {
        try {
            await api.auth.logout()
        } finally {
            router.push('/')
        }
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        setPwError('')
        setPwSuccess('')

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPwError('All password fields are required.')
            return
        }
        if (newPassword !== confirmPassword) {
            setPwError('New passwords do not match')
            return
        }
        const failedRule = PASSWORD_RULES.find((r) => !r.test(newPassword))
        if (failedRule) {
            setPwError(failedRule.label)
            return
        }

        setPwSubmitting(true)
        try {
            await api.auth.changePassword(currentPassword, newPassword)
            setPwSuccess('Password changed successfully. Please sign in again.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setTimeout(() => router.push('/sign-in'), 2000)
        } catch (err) {
            setPwError(err instanceof Error ? err.message : 'Failed to change password')
        } finally {
            setPwSubmitting(false)
        }
    }

    const inputCls = 'bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow'

    if (loading) {
        return (
            <PageTransition><div className="px-4 py-6 md:px-6 max-w-2xl mx-auto">
                <div className="mb-8">
                    <Skeleton className="h-8 w-28 mb-2" />
                    <Skeleton className="h-4 w-44" />
                </div>
                <Card className="mb-4">
                    <Skeleton className="h-3 w-16 mb-4" />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div>
                                <Skeleton className="h-4 w-40 mb-1.5" />
                                <Skeleton className="h-3 w-28" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-24 rounded-xl" />
                    </div>
                </Card>
                <Card>
                    <Skeleton className="h-3 w-32 mb-5" />
                    <div className="flex flex-col gap-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i}>
                                <Skeleton className="h-3 w-32 mb-1.5" />
                                <Skeleton className="h-10 w-full rounded-xl" />
                            </div>
                        ))}
                        <Skeleton className="h-10 w-full rounded-xl mt-1" />
                    </div>
                </Card>
            </div></PageTransition>
        )
    }

    return (
        <PageTransition>
        <div className="px-4 py-6 md:px-6 max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-fg">Settings</h1>
                <p className="text-sm text-fg-muted mt-0.5">Manage your account</p>
            </div>

            {/* Account info */}
            <Card className="mb-4">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">Account</p>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-primary font-bold text-base uppercase shrink-0">
                            {user?.email?.[0] ?? '?'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-fg truncate">{user?.email}</p>
                            <p className="text-xs text-fg-muted">
                                Member since {user ? new Date(user.createdAt * 1000).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm font-medium text-fg-muted hover:text-expense px-3 py-1.5 rounded-xl hover:bg-expense-light transition-colors duration-150 whitespace-nowrap"
                    >
                        <LogOut size={15} />
                        Sign out
                    </button>
                </div>
            </Card>

            {/* Appearance — visible on mobile since sidebar theme toggle is hidden */}
            <Card className="mb-4 md:hidden">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">Appearance</p>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-fg">Theme</span>
                    <ThemeToggle />
                </div>
            </Card>

            {/* Currency */}
            <Card className="mb-4">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">Currency</p>
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-fg">Your Currency</label>
                    <div className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg-muted opacity-60">
                        {settings?.currency || 'INR'}
                    </div>
                    <p className="text-xs text-fg-muted">Currency is set during account creation and cannot be changed</p>
                </div>
            </Card>

            {/* Change password */}
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <Lock size={15} className="text-fg-muted" />
                    <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">Change Password</p>
                </div>

                <form onSubmit={handleChangePassword} noValidate className="flex flex-col gap-3">
                    {pwError && (
                        <div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
                            {pwError}
                        </div>
                    )}
                    {pwSuccess && (
                        <div className="bg-accent-light border border-primary text-primary rounded-xl px-4 py-3 text-sm">
                            {pwSuccess}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="current-password" className="text-sm font-medium text-fg">Current Password</label>
                        <div className="relative">
                            <input
                                id="current-password"
                                type={showCurrentPw ? 'text' : 'password'}
                                required
                                autoComplete="current-password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="••••••••"
                                className={`${inputCls} pr-10 w-full`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPw((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors"
                                aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                            >
                                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="new-password" className="text-sm font-medium text-fg">New Password</label>
                        <div className="relative">
                            <input
                                id="new-password"
                                type={showNewPw ? 'text' : 'password'}
                                required
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className={`${inputCls} pr-10 w-full`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPw((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors"
                                aria-label={showNewPw ? 'Hide password' : 'Show password'}
                            >
                                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="text-xs text-fg-muted">Min 8 chars, uppercase, number, special character</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="confirm-password" className="text-sm font-medium text-fg">Confirm New Password</label>
                        <div className="relative">
                            <input
                                id="confirm-password"
                                type={showConfirmPw ? 'text' : 'password'}
                                required
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className={`${inputCls} pr-10 w-full`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPw((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors"
                                aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                            >
                                {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={pwSubmitting}
                        className="mt-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {pwSubmitting ? 'Updating…' : 'Update Password'}
                    </button>
                </form>
            </Card>
        </div>
        </PageTransition>
    )
}
