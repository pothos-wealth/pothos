'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Lock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageTransition } from '@/components/ui/PageTransition'
import { api } from '@/lib/api'
import type { User, UserSettings } from '@/lib/types'

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

        if (newPassword !== confirmPassword) {
            setPwError('New passwords do not match')
            return
        }
        if (newPassword.length < 8) {
            setPwError('Password must be at least 8 characters')
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
            <PageTransition><div className="p-6 max-w-2xl mx-auto">
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
        <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-fg">Settings</h1>
                <p className="text-sm text-fg-muted mt-0.5">Manage your account</p>
            </div>

            {/* Account info */}
            <Card className="mb-4">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">Account</p>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-primary font-bold text-base uppercase">
                            {user?.email?.[0] ?? '?'}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-fg">{user?.email}</p>
                            <p className="text-xs text-fg-muted">
                                Member since {user ? new Date(user.createdAt * 1000).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm font-medium text-fg-muted hover:text-expense px-3 py-1.5 rounded-xl hover:bg-expense-light transition-colors duration-150"
                    >
                        <LogOut size={15} />
                        Sign out
                    </button>
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

                <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
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
                        <label className="text-sm font-medium text-fg">Current Password</label>
                        <input
                            type="password"
                            required
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            className={inputCls}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-fg">New Password</label>
                        <input
                            type="password"
                            required
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className={inputCls}
                        />
                        <p className="text-xs text-fg-muted">Min 8 chars, uppercase, number, special character</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-fg">Confirm New Password</label>
                        <input
                            type="password"
                            required
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className={inputCls}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={pwSubmitting}
                        className="mt-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60"
                    >
                        {pwSubmitting ? 'Updating…' : 'Update Password'}
                    </button>
                </form>
            </Card>
        </div>
        </PageTransition>
    )
}
