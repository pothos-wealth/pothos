"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ArrowLeftRight, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import { Skeleton } from "@/components/ui/Skeleton"
import { PageTransition } from "@/components/ui/PageTransition"
import { api } from "@/lib/api"
import { useCurrency } from "@/lib/currency-context"
import { cn, useCurrencyFormatter, formatDate, getCategoryName } from "@/lib/utils"
import type { Account, Category, Transaction, TransactionList } from "@/lib/types"

type TxTab = "transaction" | "transfer"

interface TxForm {
	type: "income" | "expense"
	accountId: string
	categoryId: string
	amount: string
	date: string
	description: string
	notes: string
}

interface TransferForm {
	fromAccountId: string
	toAccountId: string
	amount: string
	date: string
	description: string
}

function localDateISO(d: Date): string {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, "0")
	const day = String(d.getDate()).padStart(2, "0")
	return `${y}-${m}-${day}`
}

function todayISO() {
	return localDateISO(new Date())
}

function firstOfMonthISO() {
	const d = new Date()
	return localDateISO(new Date(d.getFullYear(), d.getMonth(), 1))
}

function toUnix(dateStr: string) {
	// No timezone suffix → parsed as local midnight, not UTC midnight
	return Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 1000)
}

function fromUnix(ts: number) {
	return localDateISO(new Date(ts * 1000))
}

export default function TransactionsPage() {
	const router = useRouter()
	const { loading: currencyLoading } = useCurrency()
	const formatCurrency = useCurrencyFormatter()
	const [list, setList] = useState<TransactionList | null>(null)
	const [accounts, setAccounts] = useState<Account[]>([])
	const [categories, setCategories] = useState<Category[]>([])
	const [loading, setLoading] = useState(true)
	const [page, setPage] = useState(1)

	// Filters
	const [filterAccount, setFilterAccount] = useState("")
	const [filterCategory, setFilterCategory] = useState("")
	const [filterType, setFilterType] = useState("")
	const [filterStart, setFilterStart] = useState(firstOfMonthISO)
	const [filterEnd, setFilterEnd] = useState(todayISO)
	const [searchInput, setSearchInput] = useState("")
	const [filterSearch, setFilterSearch] = useState("")
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Add modal
	const [addOpen, setAddOpen] = useState(false)
	const [addTab, setAddTab] = useState<TxTab>("transaction")
	const [txForm, setTxForm] = useState<TxForm>({
		type: "expense",
		accountId: "",
		categoryId: "",
		amount: "",
		date: todayISO(),
		description: "",
		notes: "",
	})
	const [transferForm, setTransferForm] = useState<TransferForm>({
		fromAccountId: "",
		toAccountId: "",
		amount: "",
		date: todayISO(),
		description: "",
	})

	// Edit modal
	const [editTx, setEditTx] = useState<Transaction | null>(null)
	const [editForm, setEditForm] = useState<Partial<TxForm>>({})
	const [editTransferForm, setEditTransferForm] = useState<{
		amount: string
		date: string
		description: string
		notes: string
	}>({ amount: "", date: "", description: "", notes: "" })

	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState("")
	const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)
	const [deleting, setDeleting] = useState(false)

	const activeAccounts = accounts.filter((a) => a.isActive)

	const load = useCallback(() => {
		setLoading(true)
		const params: Record<string, string | number> = { page, limit: 20 }
		if (filterAccount) params.accountId = filterAccount
		if (filterCategory) params.categoryId = filterCategory
		if (filterType) params.type = filterType
		if (filterStart) params.startDate = toUnix(filterStart)
		if (filterEnd) params.endDate = toUnix(filterEnd) + 86399
		if (filterSearch) params.search = filterSearch

		Promise.all([api.transactions.list(params), api.accounts.list(), api.categories.list()])
			.then(([txs, accs, cats]) => {
				setList(txs)
				setAccounts(accs)
				setCategories(cats)
			})
			.catch((err) => {
				if (err.message === "UNAUTHORIZED") router.push("/sign-in")
			})
			.finally(() => setLoading(false))
	}, [
		page,
		filterAccount,
		filterCategory,
		filterType,
		filterStart,
		filterEnd,
		filterSearch,
		router,
	])

	useEffect(() => {
		load()
	}, [load])

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			setFilterSearch(searchInput.trim())
			setPage(1)
		}, 300)
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [searchInput])

	function openAdd() {
		const firstAccount = activeAccounts[0]?.id ?? ""
		setTxForm({
			type: "expense",
			accountId: firstAccount,
			categoryId: "",
			amount: "",
			date: todayISO(),
			description: "",
			notes: "",
		})
		setTransferForm({
			fromAccountId: firstAccount,
			toAccountId: activeAccounts[1]?.id ?? "",
			amount: "",
			date: todayISO(),
			description: "",
		})
		setAddTab("transaction")
		setError("")
		setAddOpen(true)
	}

	function openEdit(tx: Transaction) {
		setEditTx(tx)
		if (tx.type === "transfer") {
			setEditTransferForm({
				amount: (Math.abs(tx.amount) / 100).toFixed(2),
				date: fromUnix(tx.date),
				description: tx.description,
				notes: tx.notes ?? "",
			})
		} else {
			setEditForm({
				categoryId: tx.categoryId ?? "",
				amount: (Math.abs(tx.amount) / 100).toFixed(2),
				date: fromUnix(tx.date),
				description: tx.description,
				notes: tx.notes ?? "",
			})
		}
		setError("")
	}

	async function handleAddSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError("")
		if (addTab === "transaction") {
			if (!txForm.accountId) {
				setError("Please select an account.")
				return
			}
			if (!txForm.amount || Number(txForm.amount) <= 0) {
				setError("Please enter a valid amount.")
				return
			}
			if (!txForm.description.trim()) {
				setError("Description is required.")
				return
			}
		} else {
			if (!transferForm.fromAccountId || !transferForm.toAccountId) {
				setError("Please select both accounts.")
				return
			}
			if (!transferForm.amount || Number(transferForm.amount) <= 0) {
				setError("Please enter a valid amount.")
				return
			}
			if (!transferForm.description.trim()) {
				setError("Description is required.")
				return
			}
		}
		setSubmitting(true)
		try {
			if (addTab === "transaction") {
				await api.transactions.create({
					accountId: txForm.accountId,
					categoryId: txForm.categoryId || undefined,
					type: txForm.type,
					amount: Math.round(Number(txForm.amount) * 100),
					date: toUnix(txForm.date),
					description: txForm.description,
					notes: txForm.notes || undefined,
				})
			} else {
				await api.transactions.createTransfer({
					fromAccountId: transferForm.fromAccountId,
					toAccountId: transferForm.toAccountId,
					amount: Math.round(Number(transferForm.amount) * 100),
					date: toUnix(transferForm.date),
					description: transferForm.description,
				})
			}
			setAddOpen(false)
			load()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong")
		} finally {
			setSubmitting(false)
		}
	}

	async function handleEditSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!editTx) return
		setError("")
		setSubmitting(true)
		try {
			if (editTx.type === "transfer") {
				await api.transactions.updateTransfer(editTx.id, {
					amount: editTransferForm.amount
						? Math.round(Number(editTransferForm.amount) * 100)
						: undefined,
					date: editTransferForm.date ? toUnix(editTransferForm.date) : undefined,
					description: editTransferForm.description || undefined,
					notes: editTransferForm.notes || null,
				})
			} else {
				await api.transactions.update(editTx.id, {
					categoryId: editForm.categoryId || undefined,
					amount: editForm.amount ? Math.round(Number(editForm.amount) * 100) : undefined,
					date: editForm.date ? toUnix(editForm.date) : undefined,
					description: editForm.description,
					notes: editForm.notes || undefined,
				})
			}
			setEditTx(null)
			load()
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
			await api.transactions.delete(pendingDelete.id)
			setPendingDelete(null)
			load()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Delete failed")
		} finally {
			setDeleting(false)
		}
	}

	function getAccountName(id: string) {
		return accounts.find((a) => a.id === id)?.name ?? "Unknown"
	}

	const inputCls =
		"bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"

	return (
		<PageTransition>
			<div className="px-4 py-6 md:px-6 max-w-5xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-bold text-fg">Transactions</h1>
					<button
						onClick={openAdd}
						className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150"
					>
						<Plus size={16} strokeWidth={2.5} />
						Add
					</button>
				</div>

				{/* Filters */}
				<div className="flex flex-col gap-3 mb-6">
					<div className="relative">
						<Search
							size={15}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"
						/>
						<input
							type="text"
							placeholder="Search by description…"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							className={cn(inputCls, "w-full pl-8")}
						/>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
						<select
							value={filterAccount}
							onChange={(e) => {
								setFilterAccount(e.target.value)
								setPage(1)
							}}
							className={inputCls}
						>
							<option value="">All accounts</option>
							{accounts.map((a) => (
								<option key={a.id} value={a.id}>
									{a.name}
								</option>
							))}
						</select>
						<select
							value={filterCategory}
							onChange={(e) => {
								setFilterCategory(e.target.value)
								setPage(1)
							}}
							className={inputCls}
						>
							<option value="">All categories</option>
							{categories.map((c) => (
								<option key={c.id} value={c.id}>
									{c.icon ? `${c.icon} ` : ""}
									{c.name}
								</option>
							))}
						</select>
						<select
							value={filterType}
							onChange={(e) => {
								setFilterType(e.target.value)
								setPage(1)
							}}
							className={inputCls}
						>
							<option value="">All types</option>
							<option value="income">Income</option>
							<option value="expense">Expense</option>
							<option value="transfer">Transfer</option>
						</select>
						<input
							type="date"
							value={filterStart}
							onChange={(e) => {
								setFilterStart(e.target.value)
								setPage(1)
							}}
							className={inputCls}
						/>
						<input
							type="date"
							value={filterEnd}
							onChange={(e) => {
								setFilterEnd(e.target.value)
								setPage(1)
							}}
							className={inputCls}
						/>
					</div>
				</div>

				{/* List */}
				{loading || currencyLoading ? (
					<Card className="p-0 overflow-hidden">
						<div className="divide-y divide-border">
							{[...Array(8)].map((_, i) => (
								<div key={i} className="flex items-center gap-4 px-5 py-3.5">
									<Skeleton className="w-2 h-2 rounded-full shrink-0" />
									<div className="flex-1">
										<Skeleton className="h-3 w-48 mb-1.5" />
										<Skeleton className="h-2.5 w-32" />
									</div>
									<div className="text-right">
										<Skeleton className="h-3 w-20 mb-1.5 ml-auto" />
										<Skeleton className="h-2.5 w-14 ml-auto" />
									</div>
								</div>
							))}
						</div>
					</Card>
				) : !list || list.data.length === 0 ? (
					<Card className="flex flex-col items-center justify-center py-16 text-center">
						<ArrowLeftRight size={36} className="text-fg-muted mb-3 opacity-50" />
						<p className="text-sm text-fg-muted">No transactions found</p>
						<button
							onClick={openAdd}
							className="mt-4 text-sm font-semibold text-primary hover:underline"
						>
							Add one
						</button>
					</Card>
				) : (
					<Card className="p-0 overflow-hidden">
						<div className="divide-y divide-border">
							{list.data.map((tx) => {
								const isTransfer = tx.type === "transfer"
								const isIncome = tx.amount > 0
								return (
									<div
										key={tx.id}
										onClick={() => openEdit(tx)}
										className={cn(
											"flex items-center gap-4 px-5 py-3.5 group",
											!isTransfer &&
												"cursor-pointer hover:bg-bg-3 transition-colors duration-100"
										)}
									>
										<span
											className={cn(
												"w-2 h-2 rounded-full shrink-0",
												isTransfer
													? "bg-fg-muted"
													: isIncome
														? "bg-primary"
														: "bg-expense"
											)}
										/>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-fg truncate">
												{tx.description}
											</p>
											<p className="text-xs text-fg-muted">
												{isTransfer
													? "Transfer"
													: getCategoryName(tx.categoryId, categories)}
												{" · "}
												{getAccountName(tx.accountId)}
											</p>
										</div>
										<div className="text-right shrink-0">
											<p
												className={cn(
													"text-sm font-semibold",
													isTransfer
														? "text-fg-muted"
														: isIncome
															? "text-primary"
															: "text-fg"
												)}
											>
												{isIncome ? "+" : "-"}
												{formatCurrency(Math.abs(tx.amount))}
											</p>
											<p className="text-xs text-fg-muted">
												{formatDate(tx.date)}
											</p>
										</div>
										<button
											onClick={(e) => {
												e.stopPropagation()
												setPendingDelete(tx)
											}}
											className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg text-fg-muted hover:text-expense hover:bg-expense-light transition-all duration-150 shrink-0"
											aria-label="Delete transaction"
										>
											<Trash2 size={14} />
										</button>
									</div>
								)
							})}
						</div>
					</Card>
				)}

				{/* Pagination */}
				{list && list.pagination.totalPages > 1 && (
					<div className="flex items-center justify-between mt-4">
						<p className="text-xs text-fg-muted">
							Page {list.pagination.page} of {list.pagination.totalPages} ·{" "}
							{list.pagination.total} transactions
						</p>
						<div className="flex gap-2">
							<button
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page === 1}
								className="p-2 rounded-xl border border-border text-fg-muted hover:text-fg hover:bg-bg-2 disabled:opacity-40 transition-colors duration-150"
							>
								<ChevronLeft size={16} />
							</button>
							<button
								onClick={() =>
									setPage((p) => Math.min(list.pagination.totalPages, p + 1))
								}
								disabled={page === list.pagination.totalPages}
								className="p-2 rounded-xl border border-border text-fg-muted hover:text-fg hover:bg-bg-2 disabled:opacity-40 transition-colors duration-150"
							>
								<ChevronRight size={16} />
							</button>
						</div>
					</div>
				)}

				{/* Add Modal */}
				<Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Transaction">
					{/* Tabs */}
					<div className="flex gap-1 bg-bg border border-border rounded-xl p-1 mb-4">
						{(["transaction", "transfer"] as TxTab[]).map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setAddTab(t)}
								className={cn(
									"flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150",
									addTab === t
										? "bg-bg-2 text-fg shadow-sm"
										: "text-fg-muted hover:text-fg"
								)}
							>
								{t.charAt(0).toUpperCase() + t.slice(1)}
							</button>
						))}
					</div>

					<form onSubmit={handleAddSubmit} noValidate className="flex flex-col gap-3">
						{error && (
							<div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
								{error}
							</div>
						)}

						{addTab === "transaction" ? (
							<>
								{/* Type toggle */}
								<div className="flex gap-1 bg-bg border border-border rounded-xl p-1">
									{(["expense", "income"] as const).map((t) => (
										<button
											key={t}
											type="button"
											onClick={() => setTxForm((f) => ({ ...f, type: t }))}
											className={cn(
												"flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150",
												txForm.type === t
													? t === "expense"
														? "bg-expense-light text-expense"
														: "bg-accent-light text-primary"
													: "text-fg-muted hover:text-fg"
											)}
										>
											{t.charAt(0).toUpperCase() + t.slice(1)}
										</button>
									))}
								</div>

								<select
									value={txForm.accountId}
									onChange={(e) =>
										setTxForm((f) => ({ ...f, accountId: e.target.value }))
									}
									required
									className={inputCls}
								>
									<option value="">Select account</option>
									{activeAccounts.map((a) => (
										<option key={a.id} value={a.id}>
											{a.name}
										</option>
									))}
								</select>
								<select
									value={txForm.categoryId}
									onChange={(e) =>
										setTxForm((f) => ({ ...f, categoryId: e.target.value }))
									}
									className={inputCls}
								>
									<option value="">No category</option>
									{categories
										.filter(
											(c) => c.type === txForm.type || c.type === "neutral"
										)
										.map((c) => (
											<option key={c.id} value={c.id}>
												{c.name}
											</option>
										))}
								</select>
								<input
									type="number"
									min="0.01"
									step="0.01"
									required
									placeholder="Amount"
									value={txForm.amount}
									onChange={(e) =>
										setTxForm((f) => ({ ...f, amount: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									type="date"
									required
									value={txForm.date}
									onChange={(e) =>
										setTxForm((f) => ({ ...f, date: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									required
									placeholder="Description"
									value={txForm.description}
									onChange={(e) =>
										setTxForm((f) => ({ ...f, description: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									placeholder="Notes (optional)"
									value={txForm.notes}
									onChange={(e) =>
										setTxForm((f) => ({ ...f, notes: e.target.value }))
									}
									className={inputCls}
								/>
							</>
						) : (
							<>
								<select
									value={transferForm.fromAccountId}
									onChange={(e) =>
										setTransferForm((f) => ({
											...f,
											fromAccountId: e.target.value,
										}))
									}
									required
									className={inputCls}
								>
									<option value="">From account</option>
									{activeAccounts.map((a) => (
										<option key={a.id} value={a.id}>
											{a.name}
										</option>
									))}
								</select>
								<select
									value={transferForm.toAccountId}
									onChange={(e) =>
										setTransferForm((f) => ({
											...f,
											toAccountId: e.target.value,
										}))
									}
									required
									className={inputCls}
								>
									<option value="">To account</option>
									{activeAccounts.map((a) => (
										<option key={a.id} value={a.id}>
											{a.name}
										</option>
									))}
								</select>
								<input
									type="number"
									min="0.01"
									step="0.01"
									required
									placeholder="Amount"
									value={transferForm.amount}
									onChange={(e) =>
										setTransferForm((f) => ({ ...f, amount: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									type="date"
									required
									value={transferForm.date}
									onChange={(e) =>
										setTransferForm((f) => ({ ...f, date: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									required
									placeholder="Description"
									value={transferForm.description}
									onChange={(e) =>
										setTransferForm((f) => ({
											...f,
											description: e.target.value,
										}))
									}
									className={inputCls}
								/>
							</>
						)}

						<div className="flex gap-2 mt-1">
							<button
								type="button"
								onClick={() => setAddOpen(false)}
								className="flex-1 border border-border text-fg font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-bg-3 transition-colors duration-150"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={submitting}
								className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
							>
								{submitting ? "Saving…" : "Add"}
							</button>
						</div>
					</form>
				</Modal>

				{/* Edit Modal */}
				<Modal open={!!editTx} onClose={() => setEditTx(null)} title="Edit Transaction">
					<form onSubmit={handleEditSubmit} noValidate className="flex flex-col gap-3">
						{error && (
							<div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
								{error}
							</div>
						)}
						{editTx?.type === "transfer" ? (
							<>
								<div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2.5">
									<ArrowLeftRight size={14} className="text-fg-muted shrink-0" />
									<span className="text-sm text-fg-muted">
										Transfer · {getAccountName(editTx.accountId)} →{" "}
										{getAccountName(editTx.transferAccountId ?? "")}
									</span>
								</div>
								<input
									type="number"
									min="0.01"
									step="0.01"
									required
									placeholder="Amount"
									value={editTransferForm.amount}
									onChange={(e) =>
										setEditTransferForm((f) => ({
											...f,
											amount: e.target.value,
										}))
									}
									className={inputCls}
								/>
								<input
									type="date"
									required
									value={editTransferForm.date}
									onChange={(e) =>
										setEditTransferForm((f) => ({ ...f, date: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									required
									placeholder="Description"
									value={editTransferForm.description}
									onChange={(e) =>
										setEditTransferForm((f) => ({
											...f,
											description: e.target.value,
										}))
									}
									className={inputCls}
								/>
								<input
									placeholder="Notes (optional)"
									value={editTransferForm.notes}
									onChange={(e) =>
										setEditTransferForm((f) => ({
											...f,
											notes: e.target.value,
										}))
									}
									className={inputCls}
								/>
							</>
						) : (
							<>
								<div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2.5">
									<span
										className={cn(
											"w-2 h-2 rounded-full shrink-0",
											editTx && editTx.amount > 0
												? "bg-primary"
												: "bg-expense"
										)}
									/>
									<span className="text-sm text-fg-muted">
										{editTx && editTx.amount > 0 ? "Income" : "Expense"} ·{" "}
										{getAccountName(editTx?.accountId ?? "")}
									</span>
								</div>
								<select
									value={editForm.categoryId ?? ""}
									onChange={(e) =>
										setEditForm((f) => ({ ...f, categoryId: e.target.value }))
									}
									className={inputCls}
								>
									<option value="">No category</option>
									{categories
										.filter(
											(c) => c.type === editTx?.type || c.type === "neutral"
										)
										.map((c) => (
											<option key={c.id} value={c.id}>
												{c.name}
											</option>
										))}
								</select>
								<input
									type="number"
									min="0.01"
									step="0.01"
									required
									placeholder="Amount"
									value={editForm.amount ?? ""}
									onChange={(e) =>
										setEditForm((f) => ({ ...f, amount: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									type="date"
									required
									value={editForm.date ?? ""}
									onChange={(e) =>
										setEditForm((f) => ({ ...f, date: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									required
									placeholder="Description"
									value={editForm.description ?? ""}
									onChange={(e) =>
										setEditForm((f) => ({ ...f, description: e.target.value }))
									}
									className={inputCls}
								/>
								<input
									placeholder="Notes (optional)"
									value={editForm.notes ?? ""}
									onChange={(e) =>
										setEditForm((f) => ({ ...f, notes: e.target.value }))
									}
									className={inputCls}
								/>
							</>
						)}

						<div className="flex gap-2 mt-1">
							<button
								type="button"
								onClick={() => setEditTx(null)}
								className="flex-1 border border-border text-fg font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-bg-3 transition-colors duration-150"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={submitting}
								className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
							>
								{submitting ? "Saving…" : "Save Changes"}
							</button>
						</div>
					</form>
				</Modal>

				<ConfirmModal
					open={pendingDelete !== null}
					onClose={() => setPendingDelete(null)}
					onConfirm={handleDelete}
					title="Delete Transaction"
					message="Delete this transaction? This cannot be undone."
					loading={deleting}
				/>
			</div>
		</PageTransition>
	)
}
