'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Target, Lock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { MonthPicker } from '@/components/dashboard/MonthPicker'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageTransition } from '@/components/ui/PageTransition'
import { api } from '@/lib/api'
import { useCurrency } from '@/lib/currency-context'
import { useCurrencyFormatter } from '@/lib/utils'
import type { BudgetWithSpent, Category, Account } from '@/lib/types'

interface BudgetForm {
    categoryId: string
    amount: string
    isRecurring: boolean
    isCommitted: boolean
}

export default function BudgetsPage() {
    const router = useRouter()
    const { loading: currencyLoading } = useCurrency()
    const formatCurrency = useCurrencyFormatter()
    const [month, setMonth] = useState(() => new Date().getMonth() + 1)
    const [year, setYear] = useState(() => new Date().getFullYear())
    const [budgets, setBudgets] = useState<BudgetWithSpent[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState<BudgetWithSpent | null>(null)
    const [form, setForm] = useState<BudgetForm>({ categoryId: '', amount: '', isRecurring: true, isCommitted: false })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [pendingDelete, setPendingDelete] = useState<BudgetWithSpent | null>(null)
    const [deleting, setDeleting] = useState(false)

    const expenseCategories = categories.filter((c) => c.type === 'expense')

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([api.budgets.list(month, year), api.categories.list(), api.accounts.list()])
            .then(([b, c, a]) => { setBudgets(b); setCategories(c); setAccounts(a) })
            .catch((err) => {
                if (err.message === 'UNAUTHORIZED') router.push('/sign-in')
            })
            .finally(() => setLoading(false))
    }, [month, year, router])

    useEffect(() => { load() }, [load])

    function openAdd(categoryId?: string) {
        setEditing(null)
        setForm({
            categoryId: categoryId ?? (expenseCategories[0]?.id ?? ''),
            amount: '',
            isRecurring: true,
            isCommitted: false,
        })
        setError('')
        setModalOpen(true)
    }

    function openEdit(budget: BudgetWithSpent) {
        setEditing(budget)
        setForm({ categoryId: budget.categoryId, amount: String(budget.amount / 100), isRecurring: budget.isRecurring, isCommitted: budget.isCommitted })
        setError('')
        setModalOpen(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (!form.amount || Number(form.amount) <= 0) {
            setError('Please enter a valid budget amount.')
            return
        }
        setSubmitting(true)
        try {
            await api.budgets.upsert({
                categoryId: form.categoryId,
                amount: Math.round(Number(form.amount) * 100),
                month,
                year,
                isRecurring: form.isRecurring,
                isCommitted: form.isCommitted,
            })
            setModalOpen(false)
            load()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleDelete() {
        if (!pendingDelete) return
        setDeleting(true)
        try {
            await api.budgets.delete(pendingDelete.id)
            setBudgets((prev) => prev.filter((b) => b.id !== pendingDelete.id))
            setPendingDelete(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed')
        } finally {
            setDeleting(false)
        }
    }

    function getCategoryName(id: string) {
        return categories.find((c) => c.id === id)?.name ?? 'Unknown'
    }

    function getCategoryColor(id: string) {
        return categories.find((c) => c.id === id)?.color ?? null
    }

    // Categories without a budget this month
    const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId))
    const unbudgetedCategories = expenseCategories.filter((c) => !budgetedCategoryIds.has(c.id))

    // Free to spend summary
    const totalBalance = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0)
    const totalCommitted = budgets.filter((b) => b.isCommitted).reduce((sum, b) => sum + b.amount, 0)
    const freeToSpend = totalBalance - totalCommitted

    if (loading || currencyLoading) {
        return (
            <PageTransition><div className="px-4 py-6 md:px-6 max-w-4xl mx-auto">
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <Skeleton className="h-8 w-28 mb-2" />
                        <Skeleton className="h-4 w-52" />
                    </div>
                    <Skeleton className="h-9 w-36 rounded-xl" />
                </div>
                <div className="flex flex-col gap-3">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="w-2.5 h-2.5 rounded-full" />
                                    <Skeleton className="h-4 w-28" />
                                </div>
                                <div className="flex gap-1">
                                    <Skeleton className="h-7 w-7 rounded-lg" />
                                    <Skeleton className="h-7 w-7 rounded-lg" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-full rounded-full mb-2" />
                            <div className="flex justify-between">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </Card>
                    ))}
                </div>
            </div></PageTransition>
        )
    }

    return (
        <PageTransition>
        <div className="px-4 py-6 md:px-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-fg">Budgets</h1>
                    <p className="text-sm text-fg-muted mt-0.5">Monthly spending limits</p>
                </div>
                <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
            </div>

            {/* Free to Spend summary */}
            {accounts.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-bg-2 border border-border rounded-xl px-4 py-3">
                        <p className="text-xs text-fg-muted mb-1">Total Balance</p>
                        <p className="text-sm font-semibold text-fg">{formatCurrency(totalBalance)}</p>
                    </div>
                    <div className="bg-bg-2 border border-border rounded-xl px-4 py-3">
                        <p className="text-xs text-fg-muted mb-1">Committed</p>
                        <p className="text-sm font-semibold text-fg">{formatCurrency(totalCommitted)}</p>
                    </div>
                    <div className={`border rounded-xl px-4 py-3 ${freeToSpend < 0 ? 'bg-expense-light border-expense' : 'bg-income-light border-income'}`}>
                        <p className="text-xs text-fg-muted mb-1">Free to Spend</p>
                        <p className={`text-sm font-semibold ${freeToSpend < 0 ? 'text-expense' : 'text-income'}`}>
                            {formatCurrency(freeToSpend)}
                        </p>
                    </div>
                </div>
            )}

            {/* Add budget button */}
            {expenseCategories.length > 0 && (
                <button
                    onClick={() => openAdd()}
                    className="flex items-center gap-2 mb-6 text-sm font-semibold text-primary hover:underline"
                >
                    <Plus size={15} strokeWidth={2.5} />
                    Set a budget
                </button>
            )}

            {/* Budgets list */}
            {budgets.length === 0 && unbudgetedCategories.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-16 text-center">
                    <Target size={36} className="text-fg-muted mb-3 opacity-50" />
                    <p className="text-sm text-fg-muted">No expense categories yet</p>
                    <a href="/categories" className="mt-3 text-sm font-semibold text-primary hover:underline">
                        Add categories first
                    </a>
                </Card>
            ) : (
                <div className="flex flex-col gap-4">
                    {budgets.length > 0 && (
                        <div className="flex flex-col gap-3">
                            {budgets.map((budget) => {
                                const pct = budget.amount > 0 ? Math.min((budget.spent / budget.amount) * 100, 100) : 0
                                const over = budget.spent > budget.amount
                                const color = getCategoryColor(budget.categoryId)
                                return (
                                    <Card key={budget.id}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: color ?? 'var(--color-primary)' }}
                                                />
                                                <p className="font-medium text-fg text-sm">
                                                    {getCategoryName(budget.categoryId)}
                                                </p>
                                                {budget.isCommitted && (
                                                    <Lock size={11} className="text-fg-muted shrink-0" />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openEdit(budget)}
                                                    className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-3 transition-colors duration-150"
                                                    aria-label="Edit budget"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    onClick={() => setPendingDelete(budget)}
                                                    className="p-1.5 rounded-lg text-fg-muted hover:text-expense hover:bg-expense-light transition-colors duration-150"
                                                    aria-label="Delete budget"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-2 bg-bg-3 rounded-full overflow-hidden mb-2">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: over ? 'var(--color-expense)' : (color ?? 'var(--color-primary)'),
                                                }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-fg-muted">
                                            <span>
                                                {formatCurrency(budget.spent)} spent
                                            </span>
                                            <span className={over ? 'text-expense font-medium' : ''}>
                                                {over
                                                    ? `${formatCurrency(Math.abs(budget.remaining))} over`
                                                    : `${formatCurrency(budget.remaining)} left`}
                                                {' '}/ {formatCurrency(budget.amount)}
                                            </span>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    {/* Unbudgeted categories */}
                    {unbudgetedCategories.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">
                                No budget set
                            </p>
                            <div className="flex flex-col gap-2">
                                {unbudgetedCategories.map((cat) => (
                                    <div
                                        key={cat.id}
                                        className="flex items-center justify-between bg-bg-2 border border-border rounded-xl px-4 py-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: cat.color ?? 'var(--color-border)' }}
                                            />
                                            <span className="text-sm text-fg-muted">{cat.name}</span>
                                        </div>
                                        <button
                                            onClick={() => openAdd(cat.id)}
                                            className="text-xs font-semibold text-primary hover:underline"
                                        >
                                            Set budget
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editing ? 'Edit Budget' : 'Set Budget'}
            >
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                    {error && (
                        <div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="budget-category" className="text-sm font-medium text-fg">Category</label>
                        <select
                            id="budget-category"
                            value={form.categoryId}
                            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                            disabled={!!editing}
                            className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {expenseCategories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="budget-amount" className="text-sm font-medium text-fg">Budget Amount</label>
                        <input
                            id="budget-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            value={form.amount}
                            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                            placeholder="e.g. 5000.50"
                            className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
                        />
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={form.isRecurring}
                            onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
                            className="w-4 h-4 rounded accent-primary"
                        />
                        <span className="text-sm text-fg">Repeat every month</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={form.isCommitted}
                            onChange={(e) => setForm((f) => ({ ...f, isCommitted: e.target.checked }))}
                            className="w-4 h-4 rounded accent-primary"
                        />
                        <span className="text-sm text-fg">Committed expense</span>
                    </label>

                    <div className="flex gap-2 mt-1">
                        <button
                            type="button"
                            onClick={() => setModalOpen(false)}
                            className="flex-1 border border-border text-fg font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-bg-3 transition-colors duration-150"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Saving…' : 'Save Budget'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                title="Remove Budget"
                message="Remove this budget? The category will appear in the unbudgeted section."
                confirmLabel="Remove"
                loading={deleting}
            />
        </div>
        </PageTransition>
    )
}
