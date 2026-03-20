'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Lock, Eye, EyeOff, Mail, Bot } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageTransition } from '@/components/ui/PageTransition'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { api } from '@/lib/api'
import { useInboxCount } from '@/lib/inbox-count-context'
import type { User, UserSettings, ImapSettings, EmailStatus, LlmSettings } from '@/lib/types'

const PASSWORD_RULES = [
    { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'One special character', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
]

const LLM_MODELS: Record<string, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-20241022',
    local: 'llama3.2',
}

export default function SettingsPage() {
    const router = useRouter()
    const { setInboxCount } = useInboxCount()
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

    // Email / IMAP integration
    const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null)
    const [emailSettings, setEmailSettings] = useState<ImapSettings | null>(null)
    const [emailProvider, setEmailProvider] = useState('gmail')
    const [emailAddress, setEmailAddress] = useState('')
    const [emailPassword, setEmailPassword] = useState('')
    const [emailHost, setEmailHost] = useState('imap.gmail.com')
    const [emailPort, setEmailPort] = useState(993)
    const [emailMailbox, setEmailMailbox] = useState('INBOX')
    const [emailSubmitting, setEmailSubmitting] = useState(false)
    const [emailError, setEmailError] = useState('')
    const [emailSuccess, setEmailSuccess] = useState('')
    const [pollingNow, setPollingNow] = useState(false)

    // LLM settings
    const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null)
    const [llmProvider, setLlmProvider] = useState<'openai' | 'anthropic' | 'local'>('openai')
    const [llmApiKey, setLlmApiKey] = useState('')
    const [llmModel, setLlmModel] = useState('gpt-4o-mini')
    const [llmSubmitting, setLlmSubmitting] = useState(false)
    const [llmEditing, setLlmEditing] = useState(false)
    const [llmError, setLlmError] = useState('')
    const [llmSuccess, setLlmSuccess] = useState('')

    useEffect(() => {
        Promise.all([
            api.user.me(),
            api.user.settings(),
            api.email.getStatus().catch(() => null),
            api.email.getSettings().catch(() => null),
            api.llm.getSettings().catch(() => null),
        ])
            .then(([u, s, gStatus, gSettings, lSettings]) => {
                setUser(u)
                setSettings(s)
                if (gStatus) setEmailStatus(gStatus)
                if (gSettings) setEmailSettings(gSettings)
                if (lSettings) {
                    setLlmSettings(lSettings)
                    setLlmProvider(lSettings.provider)
                    setLlmModel(lSettings.model)
                }
            })
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

    const IMAP_PROVIDERS: Record<string, { host: string; port: number; hint: string }> = {
        gmail:   { host: 'imap.gmail.com',          port: 993, hint: 'Requires 2-Step Verification to be enabled. Then generate an App Password at myaccount.google.com/apppasswords' },
        outlook: { host: 'outlook.office365.com',   port: 993, hint: 'Use your Microsoft account password or App password' },
        yahoo:   { host: 'imap.mail.yahoo.com',     port: 993, hint: 'Use an App Password (Account Security → Generate app password)' },
        icloud:  { host: 'imap.mail.me.com',        port: 993, hint: 'Use an App-Specific Password (appleid.apple.com → Sign-In and Security)' },
        custom:  { host: '',                         port: 993, hint: 'Enter your IMAP server details manually' },
    }

    function handleProviderChange(provider: string) {
        setEmailProvider(provider)
        const preset = IMAP_PROVIDERS[provider]
        if (preset) {
            setEmailHost(preset.host)
            setEmailPort(preset.port)
        }
    }

    async function handleEmailSave(e: React.FormEvent) {
        e.preventDefault()
        setEmailError('')
        setEmailSuccess('')
        setEmailSubmitting(true)
        try {
            const saved = await api.email.saveSettings({
                email: emailAddress,
                password: emailPassword,
                host: emailHost,
                port: emailPort,
                mailbox: emailMailbox,
            })
            setEmailSettings(saved)
            setEmailAddress('')
            setEmailPassword('')
            setEmailSuccess('Email account connected successfully')
            const status = await api.email.getStatus()
            setEmailStatus(status)
        } catch (err) {
            setEmailError(err instanceof Error ? err.message : 'Failed to connect')
        } finally {
            setEmailSubmitting(false)
        }
    }

    async function handleEmailDisconnect() {
        try {
            await api.email.deleteSettings()
            setEmailSettings(null)
            setEmailStatus((prev) => prev ? { ...prev, isConfigured: false, isActive: false } : null)
            setEmailSuccess('Email account disconnected')
        } catch (err) {
            setEmailError(err instanceof Error ? err.message : 'Failed to disconnect')
        }
    }

    async function handleEmailPoll() {
        setPollingNow(true)
        try {
            const result = await api.email.poll()
            setEmailSuccess(`Poll complete: ${result.fetched} fetched, ${result.parsed} parsed`)
            const status = await api.email.getStatus()
            setEmailStatus(status)
            if (emailSettings) {
                setEmailSettings({ ...emailSettings, lastPolledAt: status.lastPolledAt })
            }
            setInboxCount(status.pendingReviewCount)
        } catch (err) {
            setEmailError(err instanceof Error ? err.message : 'Poll failed')
        } finally {
            setPollingNow(false)
        }
    }

    async function handleLlmSave(e: React.FormEvent) {
        e.preventDefault()
        setLlmError('')
        setLlmSuccess('')
        setLlmSubmitting(true)
        try {
            const saved = await api.llm.saveSettings({
                provider: llmProvider,
                apiKey: llmProvider === 'local' ? null : (llmApiKey || undefined),
                model: llmProvider === 'local' ? 'local' : llmModel,
            })
            setLlmSettings(saved)
            setLlmApiKey('')
            setLlmSuccess('LLM settings saved')
        } catch (err) {
            setLlmError(err instanceof Error ? err.message : 'Failed to save LLM settings')
        } finally {
            setLlmSubmitting(false)
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

            {/* Email Integration */}
            <Card className="mb-4">
                <div className="flex items-center gap-2 mb-4">
                    <Mail size={15} className="text-fg-muted" />
                    <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">Email Integration</p>
                </div>

                {emailError && (
                    <div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm mb-3">
                        {emailError}
                    </div>
                )}
                {emailSuccess && (
                    <div className="bg-accent-light border border-primary text-primary rounded-xl px-4 py-3 text-sm mb-3">
                        {emailSuccess}
                    </div>
                )}

                {emailSettings ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-fg">{emailSettings.email}</p>
                                <p className="text-xs text-fg-muted mt-0.5">{emailSettings.host} · {emailSettings.mailbox}</p>
                                <p className="text-xs text-fg-muted mt-0.5">
                                    {emailSettings.lastPolledAt
                                        ? `Last polled ${new Date(emailSettings.lastPolledAt * 1000).toLocaleString()}`
                                        : 'Never polled'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleEmailPoll}
                                    disabled={pollingNow || !emailSettings.isActive}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-bg-3 text-fg hover:bg-border transition-colors disabled:opacity-50"
                                >
                                    {pollingNow ? 'Polling…' : 'Poll Now'}
                                </button>
                                <button
                                    onClick={handleEmailDisconnect}
                                    className="text-xs px-3 py-1.5 rounded-lg text-expense hover:bg-expense-light transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <span className={`w-2 h-2 rounded-full ${emailSettings.isActive ? 'bg-income' : 'bg-fg-muted'}`} />
                            <span className="text-xs text-fg-muted">{emailSettings.isActive ? 'Active' : 'Disabled'}</span>
                            {emailStatus && (
                                <span className="ml-auto text-xs text-fg-muted">{emailStatus.pendingCount} pending in queue</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleEmailSave} className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-fg">Provider</label>
                            <select
                                value={emailProvider}
                                onChange={(e) => handleProviderChange(e.target.value)}
                                className={`${inputCls} w-full`}
                            >
                                <option value="gmail">Gmail</option>
                                <option value="outlook">Outlook / Hotmail</option>
                                <option value="yahoo">Yahoo Mail</option>
                                <option value="icloud">iCloud Mail</option>
                                <option value="custom">Custom / Self-hosted</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-fg">Email Address</label>
                            <input
                                type="email"
                                required
                                value={emailAddress}
                                onChange={(e) => setEmailAddress(e.target.value)}
                                placeholder="you@example.com"
                                className={`${inputCls} w-full`}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-fg">Password</label>
                            <input
                                type="password"
                                required
                                value={emailPassword}
                                onChange={(e) => setEmailPassword(e.target.value)}
                                placeholder="App password or account password"
                                className={`${inputCls} w-full`}
                            />
                            {IMAP_PROVIDERS[emailProvider]?.hint && (
                                <p className="text-xs text-fg-muted">{IMAP_PROVIDERS[emailProvider].hint}</p>
                            )}
                        </div>

                        {emailProvider === 'custom' && (
                            <div className="flex gap-2">
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-sm font-medium text-fg">IMAP Host</label>
                                    <input
                                        type="text"
                                        required
                                        value={emailHost}
                                        onChange={(e) => setEmailHost(e.target.value)}
                                        placeholder="imap.example.com"
                                        className={`${inputCls} w-full`}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5 w-24">
                                    <label className="text-sm font-medium text-fg">Port</label>
                                    <input
                                        type="number"
                                        required
                                        value={emailPort}
                                        onChange={(e) => setEmailPort(Number(e.target.value))}
                                        className={`${inputCls} w-full`}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-fg">Mailbox</label>
                            <input
                                type="text"
                                required
                                value={emailMailbox}
                                onChange={(e) => setEmailMailbox(e.target.value)}
                                placeholder="INBOX"
                                className={`${inputCls} w-full`}
                            />
                            <p className="text-xs text-fg-muted">The folder to watch for bank notifications. Usually INBOX.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={emailSubmitting}
                            className="bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60"
                        >
                            {emailSubmitting ? 'Connecting…' : 'Connect Email'}
                        </button>
                    </form>
                )}
            </Card>

            {/* LLM Settings */}
            <Card className="mb-4">
                <div className="flex items-center gap-2 mb-4">
                    <Bot size={15} className="text-fg-muted" />
                    <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">LLM Settings</p>
                </div>

                {llmError && (
                    <div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm mb-3">
                        {llmError}
                    </div>
                )}
                {llmSuccess && (
                    <div className="bg-accent-light border border-primary text-primary rounded-xl px-4 py-3 text-sm mb-3">
                        {llmSuccess}
                    </div>
                )}

                {llmSettings && !llmEditing ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-fg capitalize">
                                    {llmSettings.provider === 'local' ? 'Local (via MCP)' : llmSettings.provider === 'openai' ? 'OpenAI' : 'Anthropic'}
                                </p>
                                {llmSettings.provider !== 'local' && (
                                    <p className="text-xs text-fg-muted mt-0.5">
                                        {llmSettings.model}
                                        {llmSettings.apiKey && ` · Key: ${llmSettings.apiKey}`}
                                    </p>
                                )}
                                {llmSettings.provider === 'local' && (
                                    <p className="text-xs text-fg-muted mt-0.5">Emails parsed via MCP / Ollama</p>
                                )}
                            </div>
                            <button
                                onClick={() => setLlmEditing(true)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-bg-3 text-fg hover:bg-border transition-colors"
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={async (e) => { await handleLlmSave(e); setLlmEditing(false) }} className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-fg">Provider</label>
                            <select
                                value={llmProvider}
                                onChange={(e) => {
                                    const p = e.target.value as typeof llmProvider
                                    setLlmProvider(p)
                                    setLlmModel(LLM_MODELS[p] ?? '')
                                }}
                                className={`${inputCls} w-full`}
                            >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="local">Local (via MCP)</option>
                            </select>
                        </div>

                        {llmProvider !== 'local' && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-fg">API Key</label>
                                <input
                                    type="password"
                                    value={llmApiKey}
                                    onChange={(e) => setLlmApiKey(e.target.value)}
                                    placeholder={llmSettings?.apiKey ?? 'Paste your API key'}
                                    className={`${inputCls} w-full`}
                                />
                                {llmSettings?.apiKey && !llmApiKey && (
                                    <p className="text-xs text-fg-muted">Leave blank to keep existing key ({llmSettings.apiKey})</p>
                                )}
                            </div>
                        )}

                        {llmProvider !== 'local' && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-fg">Model</label>
                                <input
                                    type="text"
                                    required
                                    value={llmModel}
                                    onChange={(e) => setLlmModel(e.target.value)}
                                    placeholder={LLM_MODELS[llmProvider]}
                                    className={`${inputCls} w-full`}
                                />
                            </div>
                        )}

                        {llmProvider === 'local' && (
                            <p className="text-xs text-fg-muted bg-bg-3 rounded-xl px-3 py-2">
                                Local LLM uses the MCP server with Ollama. Emails will be available in the parse queue for local processing.
                            </p>
                        )}

                        <div className="flex gap-2">
                            {llmSettings && (
                                <button
                                    type="button"
                                    onClick={() => { setLlmEditing(false); setLlmError(''); setLlmSuccess('') }}
                                    className="flex-1 border border-border text-fg font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-bg-3"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={llmSubmitting}
                                className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60"
                            >
                                {llmSubmitting ? 'Saving…' : 'Save LLM Settings'}
                            </button>
                        </div>
                    </form>
                )}
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
