"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Lock, LockOpen, Wallet } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import { Skeleton } from "@/components/ui/Skeleton"
import { PageTransition } from "@/components/ui/PageTransition"
import { api } from "@/lib/api"
import { useCurrency } from "@/lib/currency-context"
import { useCurrencyFormatter } from "@/lib/utils"
import type { Account } from "@/lib/types"

const ACCOUNT_TYPES = ["Checking", "Savings", "Cash", "Credit Card", "Investment"]

interface AccountFormState {
	name: string
	type: string
	initialBalance: string
}

const defaultForm: AccountFormState = { name: "", type: "Checking", initialBalance: "0" }

export default function AccountsPage() {
	const router = useRouter()
	const { loading: currencyLoading } = useCurrency()
	const formatCurrency = useCurrencyFormatter()
	const [accounts, setAccounts] = useState<Account[]>([])
	const [loading, setLoading] = useState(true)
	const [modalOpen, setModalOpen] = useState(false)
	const [editing, setEditing] = useState<Account | null>(null)
	const [form, setForm] = useState<AccountFormState>(defaultForm)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState("")
	const [statusError, setStatusError] = useState("")
	const [pendingDelete, setPendingDelete] = useState<Account | null>(null)
	const [deleting, setDeleting] = useState(false)

	function load() {
		api.accounts
			.list()
			.then(setAccounts)
			.catch((err) => {
				if (err.message === "UNAUTHORIZED") router.push("/sign-in")
			})
			.finally(() => setLoading(false))
	}

	useEffect(() => {
		load()
	}, [])

	function openAdd() {
		setEditing(null)
		setForm(defaultForm)
		setError("")
		setModalOpen(true)
	}

	function openEdit(account: Account) {
		setEditing(account)
		setForm({
			name: account.name,
			type: account.type,
			initialBalance: String(account.initialBalance / 100),
		})
		setError("")
		setModalOpen(true)
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError("")
		if (!form.name.trim()) {
			setError("Account name is required.")
			return
		}
		setSubmitting(true)
		try {
			if (editing) {
				const updated = await api.accounts.update(editing.id, {
					name: form.name,
					type: form.type,
				})
				setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
			} else {
				const created = await api.accounts.create({
					name: form.name,
					type: form.type,
					initialBalance: Math.round(Number(form.initialBalance) * 100),
				})
				setAccounts((prev) => [...prev, created])
			}
			setModalOpen(false)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong")
		} finally {
			setSubmitting(false)
		}
	}

	async function handleDelete() {
		if (!pendingDelete) return
		setDeleting(true)
		try {
			await api.accounts.delete(pendingDelete.id)
			setAccounts((prev) => prev.filter((a) => a.id !== pendingDelete.id))
			setPendingDelete(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Delete failed")
		} finally {
			setDeleting(false)
		}
	}

	async function handleToggleStatus(account: Account) {
		setStatusError("")
		try {
			const updated = account.isActive
				? await api.accounts.close(account.id)
				: await api.accounts.reopen(account.id)
			setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to update account status"
			setStatusError(msg)
			setTimeout(() => setStatusError(""), 4000)
		}
	}

	const totalBalance = accounts.filter((a) => a.isActive).reduce((s, a) => s + a.balance, 0)

	if (loading || currencyLoading) {
		return (
			<PageTransition>
				<div className="px-4 py-6 md:px-6 max-w-4xl mx-auto">
					<div className="flex items-start justify-between mb-8">
						<div>
							<Skeleton className="h-8 w-36 mb-2" />
							<Skeleton className="h-4 w-48" />
						</div>
						<Skeleton className="h-10 w-32 rounded-xl" />
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{[...Array(4)].map((_, i) => (
							<Card key={i}>
								<div className="flex items-start justify-between mb-4">
									<div>
										<Skeleton className="h-4 w-32 mb-1.5" />
										<Skeleton className="h-3 w-20" />
									</div>
									<Skeleton className="h-7 w-24" />
								</div>
								<div className="flex gap-2 pt-3 border-t border-border">
									<Skeleton className="h-7 w-16 rounded-lg" />
									<Skeleton className="h-7 w-16 rounded-lg" />
									<Skeleton className="h-7 w-16 rounded-lg ml-auto" />
								</div>
							</Card>
						))}
					</div>
				</div>
			</PageTransition>
		)
	}

	return (
		<PageTransition>
			<div className="px-4 py-6 md:px-6 max-w-4xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-8">
					<div>
						<h1 className="text-2xl font-bold text-fg">Accounts</h1>
						<p className="text-sm text-fg-muted mt-0.5">
							Total balance:{" "}
							<span className="font-semibold text-fg">
								{formatCurrency(totalBalance)}
							</span>
						</p>
					</div>
					<button
						onClick={openAdd}
						className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150"
					>
						<Plus size={16} strokeWidth={2.5} />
						Add Account
					</button>
				</div>

				{statusError && (
					<div className="mb-4 bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
						{statusError}
					</div>
				)}

				{accounts.length === 0 ? (
					<Card className="flex flex-col items-center justify-center py-16 text-center">
						<Wallet size={36} className="text-fg-muted mb-3 opacity-50" />
						<p className="text-sm font-medium text-fg-muted">No accounts yet</p>
						<button
							onClick={openAdd}
							className="mt-4 text-sm font-semibold text-primary hover:underline"
						>
							Add your first account
						</button>
					</Card>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{accounts.map((account) => (
							<Card key={account.id} className={account.isActive ? "" : "opacity-60"}>
								<div className="flex items-start justify-between">
									<div>
										<div className="flex items-center gap-2">
											<p className="font-semibold text-fg truncate max-w-[160px]">
												{account.name}
											</p>
											{!account.isActive && (
												<span className="text-xs bg-bg-3 text-fg-muted px-2 py-0.5 rounded-full">
													Closed
												</span>
											)}
										</div>
										<p className="text-xs text-fg-muted mt-0.5">
											{account.type}
										</p>
									</div>
									<p className="text-xl font-bold text-fg">
										{formatCurrency(account.balance)}
									</p>
								</div>

								<div className="flex items-center gap-1 mt-4 pt-3 border-t border-border">
									<button
										onClick={() => openEdit(account)}
										className="flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg px-2.5 py-1.5 rounded-lg hover:bg-bg-3 transition-colors duration-150"
									>
										<Pencil size={13} />
										Edit
									</button>
									<button
										onClick={() => handleToggleStatus(account)}
										className="flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg px-2.5 py-1.5 rounded-lg hover:bg-bg-3 transition-colors duration-150"
									>
										{account.isActive ? (
											<Lock size={13} />
										) : (
											<LockOpen size={13} />
										)}
										{account.isActive ? "Close" : "Reopen"}
									</button>
									<button
										onClick={() => setPendingDelete(account)}
										className="flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-expense px-2.5 py-1.5 rounded-lg hover:bg-expense-light transition-colors duration-150 ml-auto"
									>
										<Trash2 size={13} />
										Delete
									</button>
								</div>
							</Card>
						))}
					</div>
				)}

				{/* Add / Edit Modal */}
				<Modal
					open={modalOpen}
					onClose={() => setModalOpen(false)}
					title={editing ? "Edit Account" : "Add Account"}
				>
					<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
						{error && (
							<div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
								{error}
							</div>
						)}

						<div className="flex flex-col gap-1.5">
							<label htmlFor="account-name" className="text-sm font-medium text-fg">
								Account Name
							</label>
							<input
								id="account-name"
								required
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								placeholder="e.g. HDFC Savings"
								className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="account-type" className="text-sm font-medium text-fg">
								Type
							</label>
							<select
								id="account-type"
								value={form.type}
								onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
								className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
							>
								{ACCOUNT_TYPES.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
						</div>

						{!editing && (
							<div className="flex flex-col gap-1.5">
								<label
									htmlFor="account-initial-balance"
									className="text-sm font-medium text-fg"
								>
									Initial Balance
								</label>
								<input
									id="account-initial-balance"
									type="number"
									min="0"
									step="0.01"
									required
									value={form.initialBalance}
									onChange={(e) =>
										setForm((f) => ({ ...f, initialBalance: e.target.value }))
									}
									placeholder="e.g. 5000.50"
									className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
								/>
							</div>
						)}

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
								{submitting ? "Saving…" : editing ? "Save Changes" : "Add Account"}
							</button>
						</div>
					</form>
				</Modal>

				<ConfirmModal
					open={pendingDelete !== null}
					onClose={() => setPendingDelete(null)}
					onConfirm={handleDelete}
					title="Delete Account"
					message={`Delete "${pendingDelete?.name}"? This cannot be undone.`}
					loading={deleting}
				/>
			</div>
		</PageTransition>
	)
}
