'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Lock, Tag } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageTransition } from '@/components/ui/PageTransition'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

type TabType = 'expense' | 'income' | 'neutral'

interface CategoryForm {
    name: string
    icon: string
    color: string
    type: TabType
}

const defaultForm: CategoryForm = { name: '', icon: '', color: '#4CAF50', type: 'expense' }

const TYPE_LABELS: Record<TabType, string> = { expense: 'Expense', income: 'Income', neutral: 'Neutral' }

export default function CategoriesPage() {
    const router = useRouter()
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<TabType>('expense')
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)
    const [form, setForm] = useState<CategoryForm>(defaultForm)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
    const [deleting, setDeleting] = useState(false)

    function load() {
        api.categories.list()
            .then(setCategories)
            .catch((err) => {
                if (err.message === 'UNAUTHORIZED') router.push('/sign-in')
            })
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    function openAdd() {
        setEditing(null)
        setForm({ ...defaultForm, type: tab })
        setError('')
        setModalOpen(true)
    }

    function openEdit(cat: Category) {
        setEditing(cat)
        setForm({
            name: cat.name,
            icon: cat.icon ?? '',
            color: cat.color ?? '#4CAF50',
            type: cat.type,
        })
        setError('')
        setModalOpen(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setSubmitting(true)
        try {
            const payload = {
                name: form.name,
                type: form.type,
                icon: form.icon || undefined,
                color: form.color || undefined,
            }
            if (editing) {
                const updated = await api.categories.update(editing.id, payload)
                setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
            } else {
                const created = await api.categories.create(payload)
                setCategories((prev) => [...prev, created])
            }
            setModalOpen(false)
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
            await api.categories.delete(pendingDelete.id)
            setCategories((prev) => prev.filter((c) => c.id !== pendingDelete.id))
            setPendingDelete(null)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Delete failed')
        } finally {
            setDeleting(false)
        }
    }

    const filtered = categories.filter((c) => c.type === tab)
    const isGlobal = (cat: Category) => cat.id && !categories.find((c) => c.id === cat.id && (c as any).userId)

    if (loading) {
        return (
            <PageTransition><div className="p-6 max-w-4xl mx-auto">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <Skeleton className="h-8 w-36 mb-2" />
                        <Skeleton className="h-4 w-44" />
                    </div>
                    <Skeleton className="h-10 w-36 rounded-xl" />
                </div>
                <Skeleton className="h-9 w-64 rounded-xl mb-6" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 bg-bg-2 border border-border rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-8 h-8 rounded-full" />
                                <Skeleton className="h-4 w-28" />
                            </div>
                            <div className="flex gap-1">
                                <Skeleton className="h-7 w-7 rounded-lg" />
                                <Skeleton className="h-7 w-7 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div></PageTransition>
        )
    }

    return (
        <PageTransition>
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-fg">Categories</h1>
                    <p className="text-sm text-fg-muted mt-0.5">Organise your transactions</p>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150"
                >
                    <Plus size={16} strokeWidth={2.5} />
                    Add Category
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-bg-2 border border-border rounded-xl p-1 w-fit mb-6">
                {(['expense', 'income', 'neutral'] as TabType[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150',
                            tab === t ? 'bg-bg-3 text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
                        )}
                    >
                        {TYPE_LABELS[t]}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-16 text-center">
                    <Tag size={36} className="text-fg-muted mb-3 opacity-50" />
                    <p className="text-sm text-fg-muted">No {TYPE_LABELS[tab].toLowerCase()} categories yet</p>
                    <button onClick={openAdd} className="mt-4 text-sm font-semibold text-primary hover:underline">
                        Add one
                    </button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filtered.map((cat) => {
                        const isSystem = cat.id && !(cat as any).userId !== undefined ? (cat as any).userId === null : false
                        return (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between gap-3 bg-bg-2 border border-border rounded-xl px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
                                        style={{ backgroundColor: cat.color ? `${cat.color}22` : 'var(--color-accent-light)' }}
                                    >
                                        {cat.icon ?? '📁'}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-fg">{cat.name}</p>
                                        {isSystem && (
                                            <span className="text-xs text-fg-muted flex items-center gap-1">
                                                <Lock size={10} />
                                                System
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {!isSystem && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openEdit(cat)}
                                            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-3 transition-colors duration-150"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => setPendingDelete(cat)}
                                            className="p-1.5 rounded-lg text-fg-muted hover:text-expense hover:bg-expense-light transition-colors duration-150"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editing ? 'Edit Category' : 'Add Category'}
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && (
                        <div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-fg">Name</label>
                        <input
                            required
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Groceries"
                            className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-fg">Type</label>
                        <select
                            value={form.type}
                            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TabType }))}
                            className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
                        >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                            <option value="neutral">Neutral</option>
                        </select>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-sm font-medium text-fg">Icon (emoji)</label>
                            <input
                                value={form.icon}
                                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                                placeholder="🛒"
                                className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-fg">Color</label>
                            <input
                                type="color"
                                value={form.color}
                                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                                className="h-[42px] w-16 bg-bg border border-border rounded-xl px-1.5 py-1 cursor-pointer"
                            />
                        </div>
                    </div>

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
                            className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60"
                        >
                            {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Category'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                title="Delete Category"
                message={`Delete "${pendingDelete?.name}"? This cannot be undone.`}
                loading={deleting}
            />
        </div>
        </PageTransition>
    )
}
