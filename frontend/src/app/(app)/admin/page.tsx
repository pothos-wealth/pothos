'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/dashboard/StatCard'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { PageTransition } from '@/components/ui/PageTransition'
import { PothosLottie } from '@/components/ui/PothosLottie'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminStats, AdminUser, AdminSession, User } from '@/lib/types'

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function AdminPage() {
    const router = useRouter()
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [actionError, setActionError] = useState<string | null>(null)

    // Sessions modal
    const [sessionsModalOpen, setSessionsModalOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
    const [sessions, setSessions] = useState<AdminSession[]>([])
    const [sessionsLoading, setSessionsLoading] = useState(false)
    const [sessionError, setSessionError] = useState<string | null>(null)
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
    const [revokeAllPending, setRevokeAllPending] = useState(false)

    // Delete confirm
    const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUser | null>(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        Promise.all([api.user.me(), api.admin.stats(), api.admin.users()])
            .then(([me, s, u]) => { setCurrentUser(me); setStats(s); setUsers(u) })
            .catch((err) => {
                if (err.message === 'UNAUTHORIZED') router.push('/sign-in')
                else if (err.message === 'Forbidden') router.push('/dashboard')
            })
            .finally(() => setLoading(false))
    }, [router])

    function openSessions(user: AdminUser) {
        setSelectedUser(user)
        setSessions([])
        setSessionsModalOpen(true)
        setSessionsLoading(true)
        setSessionError(null)
        api.admin.getSessions(user.id)
            .then(setSessions)
            .catch(() => setSessions([]))
            .finally(() => setSessionsLoading(false))
    }

    function closeSessions() {
        setSessionsModalOpen(false)
        setSelectedUser(null)
        setSessions([])
        setSessionError(null)
    }

    async function revokeSession(sessionId: string) {
        if (!selectedUser) return
        setSessionError(null)
        setRevokingSessionId(sessionId)
        try {
            await api.admin.deleteSession(selectedUser.id, sessionId)
            setSessions((prev) => prev.filter((s) => s.id !== sessionId))
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === selectedUser.id
                        ? { ...u, activeSessionCount: Math.max(0, u.activeSessionCount - 1) }
                        : u
                )
            )
        } catch (err) {
            setSessionError(err instanceof Error ? err.message : 'Failed to revoke session')
        } finally {
            setRevokingSessionId(null)
        }
    }

    async function revokeAllSessions() {
        if (!selectedUser) return
        setSessionError(null)
        try {
            await api.admin.deleteAllSessions(selectedUser.id)
            setSessions([])
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === selectedUser.id ? { ...u, activeSessionCount: 0 } : u
                )
            )
            closeSessions()
        } catch (err) {
            setSessionError(err instanceof Error ? err.message : 'Failed to revoke all sessions')
        }
    }

    async function deleteUser() {
        if (!pendingDeleteUser) return
        setDeleting(true)
        setActionError(null)
        try {
            await api.admin.deleteUser(pendingDeleteUser.id)
            setUsers((prev) => prev.filter((u) => u.id !== pendingDeleteUser.id))
            setPendingDeleteUser(null)
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Failed to delete user')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <PageTransition>
                <div className="flex items-center justify-center h-full">
                    <PothosLottie size={80} />
                </div>
            </PageTransition>
        )
    }

    return (
        <PageTransition>
            <div className="px-4 py-6 md:px-6 max-w-5xl mx-auto flex flex-col h-full">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-fg">Admin</h1>
                    <p className="text-sm text-fg-muted mt-0.5">System overview</p>
                </div>

                {actionError && (
                    <p className="text-sm text-expense mb-4">{actionError}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <StatCard title="Database Size" value={formatBytes(stats?.dbSizeBytes ?? 0)} />
                    <StatCard title="Total Users" value={String(stats?.totalUsers ?? 0)} />
                    <StatCard title="Total Transactions" value={String(stats?.totalTransactions ?? 0)} />
                </div>

                {/* Users */}
                <Card className="overflow-hidden p-0 flex flex-col min-h-0 flex-1">
                    <div className="px-5 py-4 border-b border-border shrink-0">
                        <p className="text-sm font-semibold text-fg">Users</p>
                    </div>
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted">Email</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted">Joined</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted">Currency</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold text-fg-muted">Accounts</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold text-fg-muted">Transactions</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold text-fg-muted">Sessions</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-bg-3 transition-colors duration-100">
                                        <td className="px-5 py-3 text-fg font-medium">
                                            {u.email}
                                            {u.isSuperadmin && (
                                                <span className="ml-2 text-xs bg-accent-light text-primary font-semibold px-1.5 py-0.5 rounded-md">
                                                    admin
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-fg-muted">{formatDate(u.createdAt)}</td>
                                        <td className="px-5 py-3 text-fg-muted">{u.currency ?? '—'}</td>
                                        <td className="px-5 py-3 text-fg text-right">{u.accountCount}</td>
                                        <td className="px-5 py-3 text-fg text-right">{u.transactionCount}</td>
                                        <td className="px-5 py-3 text-fg text-right">{u.activeSessionCount}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openSessions(u)}
                                                    className="text-xs text-fg-muted border border-border rounded-lg px-2.5 py-1 hover:bg-bg-3 transition-colors duration-150"
                                                >
                                                    Sessions
                                                </button>
                                                <button
                                                    onClick={() => setPendingDeleteUser(u)}
                                                    disabled={u.isSuperadmin || u.id === currentUser?.id}
                                                    className="text-xs border border-border rounded-lg px-2.5 py-1 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-expense hover:bg-bg-3 disabled:hover:bg-transparent"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Sessions Modal */}
            <Modal
                open={sessionsModalOpen}
                onClose={closeSessions}
                title={`Active Sessions for ${selectedUser?.email ?? ''}`}
                className="max-w-lg"
            >
                {sessionError && (
                    <p className="text-sm text-expense mb-4">{sessionError}</p>
                )}
                {sessionsLoading ? (
                    <div className="flex justify-center py-8">
                        <PothosLottie size={48} />
                    </div>
                ) : sessions.length === 0 ? (
                    <p className="text-sm text-fg-muted text-center py-6">No active sessions</p>
                ) : (
                    <>
                        <div className="divide-y divide-border mb-4">
                            {sessions.map((s) => (
                                <div key={s.id} className="py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs text-fg-muted">Created: {formatDate(s.createdAt)}</p>
                                        <p className="text-xs text-fg-muted">Expires: {formatDate(s.expiresAt)}</p>
                                    </div>
                                    <button
                                        onClick={() => revokeSession(s.id)}
                                        disabled={revokingSessionId === s.id}
                                        className="text-xs text-expense border border-expense/30 rounded-lg px-2.5 py-1 hover:bg-expense/10 transition-colors duration-150 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Revoke
                                    </button>
                                </div>
                            ))}
                        </div>
                        {sessions.length > 1 && (
                            <button
                                onClick={() => setRevokeAllPending(true)}
                                className="w-full border border-expense/30 text-expense font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-expense/10 transition-colors duration-150"
                            >
                                Revoke All Sessions
                            </button>
                        )}
                    </>
                )}
            </Modal>

            {/* Revoke All Confirm Modal */}
            <ConfirmModal
                open={revokeAllPending}
                onClose={() => setRevokeAllPending(false)}
                onConfirm={async () => { setRevokeAllPending(false); await revokeAllSessions() }}
                title="Revoke All Sessions"
                message={`This will immediately log ${selectedUser?.email ?? 'this user'} out of all devices.`}
                confirmLabel="Revoke All"
            />

            {/* Delete Confirm Modal */}
            <ConfirmModal
                open={!!pendingDeleteUser}
                onClose={() => setPendingDeleteUser(null)}
                onConfirm={deleteUser}
                title="Delete User"
                message={`This will permanently delete all data for ${pendingDeleteUser?.email ?? ''} including accounts, transactions, and budgets. This cannot be undone.`}
                confirmLabel="Delete User"
                loading={deleting}
            />
        </PageTransition>
    )
}
