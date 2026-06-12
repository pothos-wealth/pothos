"use client"

import { useEffect, useState } from "react"
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import { Modal } from "@/components/ui/Modal"
import { DescriptionAutocompleteInput } from "@/components/ui/DescriptionAutocompleteInput"
import { api } from "@/lib/api"
import {
	calendarDateToInputValue,
	cn,
	formatCalendarDate,
	getCategoryName,
	inputValueToCalendarDate,
	todayInputValue,
	useCurrencyFormatter,
} from "@/lib/utils"
import type {
	Account,
	Category,
	RecurringTransaction,
	RecurringTransactionInput,
	TransactionType,
} from "@/lib/types"

interface RecurringTransactionsPanelProps {
	accounts: Account[]
	categories: Category[]
	inputClassName: string
}

interface RecurringForm {
	type: TransactionType
	accountId: string
	toAccountId: string
	categoryId: string
	amount: string
	description: string
	notes: string
	repeatDay: string
	startDate: string
	endDate: string
	isActive: boolean
}

function defaultForm(accounts: Account[]): RecurringForm {
	const firstAccount = accounts[0]?.id ?? ""
	const today = new Date()
	return {
		type: "expense",
		accountId: firstAccount,
		toAccountId: accounts.find((a) => a.id !== firstAccount)?.id ?? "",
		categoryId: "",
		amount: "",
		description: "",
		notes: "",
		repeatDay: String(today.getDate()),
		startDate: todayInputValue(),
		endDate: "",
		isActive: true,
	}
}

function formFromTemplate(template: RecurringTransaction): RecurringForm {
	return {
		type: template.type,
		accountId: template.accountId,
		toAccountId: template.toAccountId ?? "",
		categoryId: template.categoryId ?? "",
		amount: (template.amount / 100).toFixed(2),
		description: template.description,
		notes: template.notes ?? "",
		repeatDay: String(template.repeatDay),
		startDate: calendarDateToInputValue(template.startDate),
		endDate: template.endDate ? calendarDateToInputValue(template.endDate) : "",
		isActive: template.isActive,
	}
}

function toPayload(form: RecurringForm): RecurringTransactionInput {
	return {
		type: form.type,
		accountId: form.accountId,
		toAccountId: form.type === "transfer" ? form.toAccountId : null,
		categoryId: form.type === "transfer" ? null : form.categoryId || null,
		amount: Math.round(Number(form.amount) * 100),
		description: form.description.trim(),
		notes: form.notes.trim() || null,
		repeatDay: Number(form.repeatDay),
		startDate: inputValueToCalendarDate(form.startDate),
		endDate: form.endDate ? inputValueToCalendarDate(form.endDate) : null,
		isActive: form.isActive,
	}
}

export function RecurringTransactionsPanel({
	accounts,
	categories,
	inputClassName,
}: RecurringTransactionsPanelProps) {
	const formatCurrency = useCurrencyFormatter()
	const activeAccounts = accounts.filter((a) => a.isActive)
	const [items, setItems] = useState<RecurringTransaction[]>([])
	const [loading, setLoading] = useState(false)
	const [modalOpen, setModalOpen] = useState(false)
	const [editing, setEditing] = useState<RecurringTransaction | null>(null)
	const [form, setForm] = useState<RecurringForm>(() => defaultForm(activeAccounts))
	const [error, setError] = useState("")
	const [panelError, setPanelError] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const [pendingDelete, setPendingDelete] = useState<RecurringTransaction | null>(null)

	function accountName(id: string | null) {
		if (!id) return "Unknown"
		return accounts.find((a) => a.id === id)?.name ?? "Unknown"
	}

	async function load() {
		setLoading(true)
		setPanelError("")
		try {
			const result = await api.recurringTransactions.list()
			setItems(result)
		} catch (err) {
			setPanelError(err instanceof Error ? err.message : "Failed to load recurring transactions")
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		load()
	}, [])

	function openCreate() {
		setEditing(null)
		setForm(defaultForm(activeAccounts))
		setError("")
		setModalOpen(true)
	}

	function openEdit(item: RecurringTransaction) {
		setEditing(item)
		setForm(formFromTemplate(item))
		setError("")
		setModalOpen(true)
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault()
		setError("")
		if (!form.accountId) {
			setError("Please select an account.")
			return
		}
		if (form.type === "transfer" && !form.toAccountId) {
			setError("Please select a destination account.")
			return
		}
		if (!form.amount || Number(form.amount) <= 0) {
			setError("Please enter a valid amount.")
			return
		}
		if (!form.description.trim()) {
			setError("Description is required.")
			return
		}
		setSubmitting(true)
		try {
			const payload = toPayload(form)
			if (editing) {
				await api.recurringTransactions.update(editing.id, payload)
			} else {
				await api.recurringTransactions.create(payload)
			}
			setModalOpen(false)
			await load()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong")
		} finally {
			setSubmitting(false)
		}
	}

	async function toggleActive(item: RecurringTransaction) {
		try {
			if (item.isActive) {
				await api.recurringTransactions.pause(item.id)
			} else {
				await api.recurringTransactions.resume(item.id)
			}
			await load()
		} catch (err) {
			setPanelError(err instanceof Error ? err.message : "Failed to update recurring transaction")
		}
	}

	async function confirmDelete() {
		if (!pendingDelete) return
		try {
			await api.recurringTransactions.delete(pendingDelete.id)
			setPendingDelete(null)
			await load()
		} catch (err) {
			setPendingDelete(null)
			setPanelError(err instanceof Error ? err.message : "Failed to delete recurring transaction")
		}
	}

	return (
		<div className="mb-6">
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<CalendarClock size={17} className="text-primary" />
					<h2 className="text-base font-semibold text-fg">Recurring</h2>
				</div>
				<button
					type="button"
					onClick={openCreate}
					className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-fg hover:bg-bg-3 transition-colors"
				>
					<Plus size={15} />
					Add
				</button>
			</div>

			{panelError && (
				<div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm mb-2">
					{panelError}
				</div>
			)}

			{loading ? (
				<Card className="text-sm text-fg-muted">Loading recurring transactions...</Card>
			) : items.length === 0 ? (
				<Card className="flex items-center justify-between gap-3">
					<p className="text-sm text-fg-muted">No recurring transactions yet</p>
					<button
						type="button"
						onClick={openCreate}
						className="text-sm font-semibold text-primary hover:underline"
					>
						Create one
					</button>
				</Card>
			) : (
				<div className="grid gap-2 md:grid-cols-2">
					{items.map((item) => (
						<Card key={item.id} className="flex items-center gap-3 p-4">
							<span
								className={cn(
									"h-2.5 w-2.5 rounded-full shrink-0",
									item.isActive ? "bg-primary" : "bg-fg-muted"
								)}
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-semibold text-fg">
									{item.description}
								</p>
								<p className="text-xs text-fg-muted">
									{item.type === "transfer"
										? `${accountName(item.accountId)} to ${accountName(item.toAccountId)}`
										: `${getCategoryName(item.categoryId, categories)} · ${accountName(item.accountId)}`}
								</p>
								<p className="text-xs text-fg-muted">
									Day {item.repeatDay} · Starts {formatCalendarDate(item.startDate)}
									{item.endDate ? ` · Ends ${formatCalendarDate(item.endDate)}` : ""}
								</p>
							</div>
							<div className="text-right shrink-0">
								<p className="text-sm font-semibold text-fg">
									{formatCurrency(item.amount)}
								</p>
								<div className="mt-1 flex justify-end gap-1">
									<button
										type="button"
										onClick={() => toggleActive(item)}
										className="rounded-lg p-1.5 text-fg-muted hover:bg-bg-3 hover:text-fg"
										aria-label={item.isActive ? "Pause recurring transaction" : "Resume recurring transaction"}
									>
										{item.isActive ? <Pause size={14} /> : <Play size={14} />}
									</button>
									<button
										type="button"
										onClick={() => openEdit(item)}
										className="rounded-lg p-1.5 text-fg-muted hover:bg-bg-3 hover:text-fg"
										aria-label="Edit recurring transaction"
									>
										<Pencil size={14} />
									</button>
									<button
										type="button"
										onClick={() => setPendingDelete(item)}
										className="rounded-lg p-1.5 text-fg-muted hover:bg-expense-light hover:text-expense"
										aria-label="Delete recurring transaction"
									>
										<Trash2 size={14} />
									</button>
								</div>
							</div>
						</Card>
					))}
				</div>
			)}

			<Modal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				title={editing ? "Edit Recurring" : "Add Recurring"}
			>
				<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
					{error && (
						<div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
							{error}
						</div>
					)}

					<div className="flex gap-1 bg-bg border border-border rounded-xl p-1">
						{(["expense", "income", "transfer"] as TransactionType[]).map((type) => (
							<button
								key={type}
								type="button"
								onClick={() =>
									setForm((current) => ({
										...current,
										type,
										categoryId: type === "transfer" ? "" : current.categoryId,
									}))
								}
								className={cn(
									"flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
									form.type === type
										? "bg-bg-2 text-fg shadow-sm"
										: "text-fg-muted hover:text-fg"
								)}
							>
								{type.charAt(0).toUpperCase() + type.slice(1)}
							</button>
						))}
					</div>

					<select
						required
						value={form.accountId}
						onChange={(event) =>
							setForm((current) => ({ ...current, accountId: event.target.value }))
						}
						className={inputClassName}
					>
						<option value="">{form.type === "transfer" ? "From account" : "Account"}</option>
						{activeAccounts.map((account) => (
							<option key={account.id} value={account.id}>
								{account.name}
							</option>
						))}
					</select>

					{form.type === "transfer" ? (
						<select
							required
							value={form.toAccountId}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									toAccountId: event.target.value,
								}))
							}
							className={inputClassName}
						>
							<option value="">To account</option>
							{activeAccounts
								.filter((account) => account.id !== form.accountId)
								.map((account) => (
									<option key={account.id} value={account.id}>
										{account.name}
									</option>
								))}
						</select>
					) : (
						<select
							value={form.categoryId}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									categoryId: event.target.value,
								}))
							}
							className={inputClassName}
						>
							<option value="">No category</option>
							{categories
								.filter((category) => category.type === form.type || category.type === "neutral")
								.map((category) => (
									<option key={category.id} value={category.id}>
										{category.name}
									</option>
								))}
						</select>
					)}

					<input
						type="number"
						min="0.01"
						step="0.01"
						required
						placeholder="Amount"
						value={form.amount}
						onChange={(event) =>
							setForm((current) => ({ ...current, amount: event.target.value }))
						}
						className={inputClassName}
					/>

					<DescriptionAutocompleteInput
						required
						placeholder="Description"
						value={form.description}
						onChange={(description) =>
							setForm((current) => ({ ...current, description }))
						}
						txType={form.type}
						className={inputClassName}
					/>

					<div className="grid grid-cols-2 gap-3">
						<input
							type="number"
							min="1"
							max="31"
							required
							placeholder="Day of month"
							value={form.repeatDay}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									repeatDay: event.target.value,
								}))
							}
							className={inputClassName}
						/>
						<select
							value={form.isActive ? "active" : "paused"}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									isActive: event.target.value === "active",
								}))
							}
							className={inputClassName}
						>
							<option value="active">Active</option>
							<option value="paused">Paused</option>
						</select>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<input
							type="date"
							required
							value={form.startDate}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									startDate: event.target.value,
								}))
							}
							className={inputClassName}
						/>
						<input
							type="date"
							min={form.startDate}
							value={form.endDate}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									endDate: event.target.value,
								}))
							}
							className={inputClassName}
						/>
					</div>

					<input
						placeholder="Notes (optional)"
						value={form.notes}
						onChange={(event) =>
							setForm((current) => ({ ...current, notes: event.target.value }))
						}
						className={inputClassName}
					/>

					<div className="flex gap-2 mt-1">
						<button
							type="button"
							onClick={() => setModalOpen(false)}
							className="flex-1 border border-border text-fg font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-bg-3 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={submitting}
							className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-60"
						>
							{submitting ? "Saving..." : "Save"}
						</button>
					</div>
				</form>
			</Modal>

			<ConfirmModal
				open={pendingDelete !== null}
				onClose={() => setPendingDelete(null)}
				onConfirm={confirmDelete}
				title="Delete Recurring Transaction"
				message={`Delete "${pendingDelete?.description ?? "this recurring transaction"}"? Already generated transactions will remain.`}
			/>
		</div>
	)
}
