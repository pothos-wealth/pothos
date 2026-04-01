"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
	Check,
	X,
	Pencil,
	ChevronLeft,
	ChevronRight,
	Inbox,
	TrendingDown,
	TrendingUp,
	ArrowLeftRight,
} from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import { Skeleton } from "@/components/ui/Skeleton"
import { PageTransition } from "@/components/ui/PageTransition"
import { api } from "@/lib/api"
import { useCurrencyFormatter, formatDate } from "@/lib/utils"
import { useInboxCount } from "@/lib/inbox-count-context"
import type {
	Account,
	Category,
	ParsedTransaction,
	ParsedTransactionList,
	PendingMessage,
} from "@/lib/types"

type InboxTab = "pending_review" | "unprocessed" | "approved" | "rejected"

interface EditForm {
	type: "income" | "expense" | "transfer"
	accountId: string
	toAccountId: string
	categoryId: string
	amount: string
	date: string
	description: string
	notes: string
}

interface ParseForm {
	type: "income" | "expense" | "transfer"
	accountId: string
	toAccountId: string
	categoryId: string
	amount: string
	date: string
	description: string
	notes: string
}

function todayISO() {
	const d = new Date()
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toUnix(dateStr: string) {
	return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000)
}

function fromUnix(ts: number) {
	return new Date(ts * 1000).toISOString().slice(0, 10)
}

const defaultEditForm = (pt: ParsedTransaction): EditForm => ({
	type: pt.type,
	accountId: pt.accountId ?? "",
	toAccountId: pt.toAccountId ?? "",
	categoryId: pt.categoryId ?? "",
	amount: (pt.amount / 100).toFixed(2),
	date: fromUnix(pt.date),
	description: pt.description,
	notes: pt.notes ?? "",
})

const defaultParseForm = (msg: PendingMessage): ParseForm => ({
	type: "expense",
	accountId: "",
	toAccountId: "",
	categoryId: "",
	amount: "",
	date: todayISO(),
	description: "",
	notes: "",
})

export default function InboxPage() {
	const router = useRouter()
	const fmt = useCurrencyFormatter()

	const [accounts, setAccounts] = useState<Account[]>([])
	const [categories, setCategories] = useState<Category[]>([])
	const [activeTab, setActiveTab] = useState<InboxTab>("pending_review")

	// Parsed transactions state
	const [parsedData, setParsedData] = useState<ParsedTransactionList | null>(null)
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const loadedTabs = useRef(new Set<InboxTab>())
	const [page, setPage] = useState(1)

	// Raw pending messages state
	const [rawMessages, setRawMessages] = useState<PendingMessage[]>([])

	// Tab counts
	const [reviewCount, setReviewCount] = useState(0)
	const [unprocessedCount, setUnprocessedCount] = useState(0)
	const { setInboxCount } = useInboxCount()

	// Edit modal (for pending_review items)
	const [editItem, setEditItem] = useState<ParsedTransaction | null>(null)
	const [editForm, setEditForm] = useState<EditForm | null>(null)
	const [editSubmitting, setEditSubmitting] = useState(false)
	const [editError, setEditError] = useState("")

	// Parse modal (for unprocessed raw emails)
	const [parseItem, setParseItem] = useState<PendingMessage | null>(null)
	const [parseForm, setParseForm] = useState<ParseForm | null>(null)
	const [parseSubmitting, setParseSubmitting] = useState(false)
	const [parseError, setParseError] = useState("")

	const [rejectItem, setRejectItem] = useState<ParsedTransaction | null>(null)
	const [dismissItem, setDismissItem] = useState<PendingMessage | null>(null)
	const [actionError, setActionError] = useState("")

	const fetchCounts = useCallback(async () => {
		try {
			const [ptResult, rawResult] = await Promise.all([
				api.parsedTransactions.list({ status: "pending_review", page: 1, limit: 1 }),
				api.parseQueue.list(),
			])
			setReviewCount(ptResult.pagination.total)
			setUnprocessedCount(rawResult.length)
			setInboxCount(ptResult.pagination.total + rawResult.length)
		} catch {}
	}, [setInboxCount])

	const fetchData = useCallback(async () => {
		const isFirstLoad = !loadedTabs.current.has(activeTab)
		if (isFirstLoad) {
			setLoading(true)
		} else {
			setRefreshing(true)
		}
		try {
			if (activeTab === "unprocessed") {
				const msgs = await api.parseQueue.list()
				setRawMessages(msgs)
				setUnprocessedCount(msgs.length)
			} else {
				const result = await api.parsedTransactions.list({
					status: activeTab,
					page,
					limit: 20,
				})
				setParsedData(result)
				if (activeTab === "pending_review") setReviewCount(result.pagination.total)
			}
			loadedTabs.current.add(activeTab)
		} catch (err) {
			if (err instanceof Error && err.message === "UNAUTHORIZED") router.push("/sign-in")
		} finally {
			setLoading(false)
			setRefreshing(false)
		}
	}, [activeTab, page, router])

	useEffect(() => {
		Promise.all([api.accounts.list(), api.categories.list()])
			.then(([accs, cats]) => {
				setAccounts(accs)
				setCategories(cats)
			})
			.catch((err) => {
				if (err instanceof Error && err.message === "UNAUTHORIZED") router.push("/sign-in")
			})
		fetchCounts()
	}, [router, fetchCounts])

	useEffect(() => {
		fetchData()
	}, [fetchData])

	async function handleApprove(pt: ParsedTransaction) {
		if (!pt.accountId) {
			setActionError("Select an account before approving")
			return
		}
		setActionError("")
		try {
			await api.parsedTransactions.approve(pt.id)
			fetchData()
			fetchCounts()
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "Failed to approve")
		}
	}

	async function handleReject(pt: ParsedTransaction) {
		try {
			await api.parsedTransactions.reject(pt.id)
			setRejectItem(null)
			fetchData()
			fetchCounts()
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "Failed to reject")
		}
	}

	async function handleEditSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!editItem || !editForm) return
		setEditSubmitting(true)
		setEditError("")
		try {
			await api.parsedTransactions.update(editItem.id, {
				type: editForm.type,
				amount: Math.round(parseFloat(editForm.amount) * 100),
				date: toUnix(editForm.date),
				description: editForm.description,
				accountId: editForm.accountId || null,
				toAccountId: editForm.type === "transfer" ? editForm.toAccountId || null : null,
				categoryId: editForm.type === "transfer" ? null : editForm.categoryId || null,
				notes: editForm.notes || null,
			})
			setEditItem(null)
			fetchData()
		} catch (err) {
			setEditError(err instanceof Error ? err.message : "Failed to save")
		} finally {
			setEditSubmitting(false)
		}
	}

	async function handleDismiss(msg: PendingMessage) {
		setDismissItem(msg)
	}

	async function confirmDismiss() {
		if (!dismissItem) return
		try {
			await api.parseQueue.dismiss(dismissItem.id)
			setDismissItem(null)
			fetchData()
			fetchCounts()
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "Failed to dismiss")
		}
	}

	async function handleParseSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!parseItem || !parseForm) return
		setParseSubmitting(true)
		setParseError("")
		try {
			await api.parseQueue.submit(parseItem.id, {
				type: parseForm.type,
				amount: Math.round(parseFloat(parseForm.amount) * 100),
				date: toUnix(parseForm.date),
				description: parseForm.description,
				accountId: parseForm.accountId || null,
				toAccountId: parseForm.type === "transfer" ? parseForm.toAccountId || null : null,
				categoryId: parseForm.type === "transfer" ? null : parseForm.categoryId || null,
				notes: parseForm.notes || null,
				bypassReview: true,
			})
			setParseItem(null)
			fetchData()
			fetchCounts()
		} catch (err) {
			setParseError(err instanceof Error ? err.message : "Failed to create transaction")
		} finally {
			setParseSubmitting(false)
		}
	}

	const tabs: { label: string; value: InboxTab; count?: number }[] = [
		{ label: "To Review", value: "pending_review", count: reviewCount },
		{ label: "Unprocessed", value: "unprocessed", count: unprocessedCount },
		{ label: "Approved", value: "approved" },
		{ label: "Rejected", value: "rejected" },
	]

	const inputCls =
		"bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"

	const isEmpty =
		!refreshing &&
		(activeTab === "unprocessed" ? rawMessages.length === 0 : parsedData?.data.length === 0)

	return (
		<PageTransition>
			<div className="px-4 py-6 md:px-6 max-w-3xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-bold text-fg">Inbox</h1>
					<p className="text-sm text-fg-muted mt-0.5">
						Review and parse your bank emails
					</p>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 mb-4 border-b border-border overflow-x-auto overflow-y-hidden">
					{tabs.map((tab) => (
						<button
							key={tab.value}
							onClick={() => {
								setActiveTab(tab.value)
								setPage(1)
							}}
							className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-150 -mb-px ${
								activeTab === tab.value
									? "border-primary text-primary"
									: "border-transparent text-fg-muted hover:text-fg"
							}`}
						>
							{tab.label}
							{tab.count != null && tab.count > 0 && (
								<span
									className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${
										activeTab === tab.value
											? "bg-primary text-white"
											: "bg-primary/15 text-primary"
									}`}
								>
									{tab.count > 99 ? "99+" : tab.count}
								</span>
							)}
						</button>
					))}
				</div>

				{refreshing && (
					<div className="h-0.5 w-full bg-primary/20 rounded-full mb-4 overflow-hidden">
						<div className="h-full bg-primary rounded-full animate-pulse w-1/2" />
					</div>
				)}

				{actionError && (
					<div className="mb-4 bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
						{actionError}
					</div>
				)}

				{loading ? (
					<div className="flex flex-col gap-3">
						{[...Array(4)].map((_, i) => (
							<Card key={i}>
								<Skeleton className="h-4 w-48 mb-2" />
								<Skeleton className="h-3 w-32 mb-3" />
								<Skeleton className="h-3 w-full" />
							</Card>
						))}
					</div>
				) : isEmpty ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<Inbox size={40} className="text-fg-muted mb-3 opacity-40" />
						<p className="text-sm font-medium text-fg-muted">
							{activeTab === "pending_review" && "No items pending review"}
							{activeTab === "unprocessed" && "No unprocessed emails"}
							{activeTab === "approved" && "No approved transactions"}
							{activeTab === "rejected" && "No rejected items"}
						</p>
						{(activeTab === "pending_review" || activeTab === "unprocessed") && (
							<p className="text-xs text-fg-muted mt-1">
								Connect an email account in Settings to start importing
							</p>
						)}
					</div>
				) : activeTab === "unprocessed" ? (
					// ─── Unprocessed raw emails ────────────────────────────────────
					<div className="flex flex-col gap-3">
						{rawMessages.map((msg) => (
							<div
								key={msg.id}
								className="flex flex-col gap-2 cursor-pointer bg-bg-2 border border-border rounded-2xl p-5 hover:border-primary transition-colors duration-150"
								onClick={() => {
									setParseItem(msg)
									setParseForm(defaultParseForm(msg))
									setParseError("")
								}}
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<p className="text-sm font-semibold text-fg truncate">
											{msg.subject ?? "(No subject)"}
										</p>
										<p className="text-xs text-fg-muted mt-0.5">
											{formatDate(msg.createdAt)}
										</p>
										<p className="text-xs text-fg-muted mt-1.5 line-clamp-2 leading-relaxed">
											{msg.rawContent.slice(0, 160)}
										</p>
									</div>
									<button
										onClick={(e) => {
											e.stopPropagation()
											handleDismiss(msg)
										}}
										className="p-1.5 rounded-lg text-fg-muted hover:text-expense hover:bg-expense-light transition-colors shrink-0"
										title="Dismiss"
									>
										<X size={15} />
									</button>
								</div>
								<p className="text-xs text-primary font-medium">Tap to parse →</p>
							</div>
						))}
					</div>
				) : (
					// ─── Parsed transactions ───────────────────────────────────────
					<div className="flex flex-col gap-3">
						{parsedData?.data.map((pt) => (
							<Card key={pt.id} className="flex flex-col gap-2">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 flex-wrap">
											<span
												className={`text-base font-semibold ${pt.type === "income" ? "text-income" : "text-expense"}`}
											>
												{pt.type === "income" ? "+" : "-"}
												{fmt(pt.amount)}
											</span>
											<span
												className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
													pt.type === "income"
														? "bg-income-light text-income"
														: "bg-expense-light text-expense"
												}`}
											>
												{pt.type}
											</span>
										</div>
										<p className="text-sm font-medium text-fg mt-0.5 truncate">
											{pt.description}
										</p>
										<div className="flex items-center gap-2 mt-1 flex-wrap">
											<span className="text-xs text-fg-muted">
												{formatDate(pt.date)}
											</span>
											{pt.accountName ? (
												<span className="text-xs text-fg-muted">
													· {pt.accountName}
												</span>
											) : (
												<span className="text-xs text-expense">
													· No account selected
												</span>
											)}
											{pt.categoryName && (
												<span className="text-xs text-fg-muted">
													· {pt.categoryName}
												</span>
											)}
										</div>
										{pt.emailSubject && (
											<p className="text-xs text-fg-muted mt-1 italic truncate">
												"{pt.emailSubject}"
											</p>
										)}
									</div>

									{activeTab === "pending_review" && (
										<div className="flex items-center gap-1.5 shrink-0">
											<button
												onClick={() => {
													setEditItem(pt)
													setEditForm(defaultEditForm(pt))
													setEditError("")
												}}
												className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-3 transition-colors"
												title="Edit"
											>
												<Pencil size={15} />
											</button>
											<button
												onClick={() => handleApprove(pt)}
												disabled={!pt.accountId}
												className="p-1.5 rounded-lg text-income hover:bg-income-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
												title={
													pt.accountId
														? "Approve"
														: "Select an account first"
												}
											>
												<Check size={15} />
											</button>
											<button
												onClick={() => setRejectItem(pt)}
												className="p-1.5 rounded-lg text-expense hover:bg-expense-light transition-colors"
												title="Reject"
											>
												<X size={15} />
											</button>
										</div>
									)}
								</div>
								{activeTab === "pending_review" && !pt.accountId && (
									<p className="text-xs text-expense bg-expense-light rounded-lg px-2 py-1">
										Edit to select an account before approving
									</p>
								)}
							</Card>
						))}

						{/* Pagination */}
						{parsedData && parsedData.pagination.totalPages > 1 && (
							<div className="flex items-center justify-between pt-2">
								<button
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={page === 1}
									className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-xl bg-bg-2 border border-border hover:bg-bg-3 disabled:opacity-40"
								>
									<ChevronLeft size={14} /> Prev
								</button>
								<span className="text-xs text-fg-muted">
									Page {parsedData.pagination.page} of{" "}
									{parsedData.pagination.totalPages}
								</span>
								<button
									onClick={() =>
										setPage((p) =>
											Math.min(parsedData.pagination.totalPages, p + 1)
										)
									}
									disabled={page === parsedData.pagination.totalPages}
									className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-xl bg-bg-2 border border-border hover:bg-bg-3 disabled:opacity-40"
								>
									Next <ChevronRight size={14} />
								</button>
							</div>
						)}
					</div>
				)}

				{/* ── Parse Modal (Unprocessed) ─────────────────────────────────────── */}
				{parseItem && parseForm && (
					<Modal
						open={!!parseItem}
						title="Parse Email"
						onClose={() => setParseItem(null)}
					>
						<div className="flex flex-col gap-4">
							{/* Email reader */}
							<div className="rounded-xl bg-bg-3 border border-border overflow-hidden">
								<div className="px-4 py-3 border-b border-border">
									<p className="text-sm font-semibold text-fg leading-snug">
										{parseItem.subject ?? "(No subject)"}
									</p>
									<p className="text-xs text-fg-muted mt-0.5">
										{formatDate(parseItem.createdAt)}
									</p>
								</div>
								<div className="px-4 py-3 max-h-44 overflow-y-auto">
									<p className="text-xs text-fg-muted whitespace-pre-wrap leading-relaxed font-mono">
										{parseItem.rawContent.slice(0, 5000)}
										{parseItem.rawContent.length > 5000 && "\n\n[truncated…]"}
									</p>
								</div>
							</div>

							{/* Transaction form */}
							<form onSubmit={handleParseSubmit} className="flex flex-col gap-3">
								{parseError && (
									<div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
										{parseError}
									</div>
								)}

								{/* Type toggle */}
								<div className="flex rounded-xl overflow-hidden border border-border">
									<button
										type="button"
										onClick={() =>
											setParseForm({ ...parseForm, type: "expense" })
										}
										className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-150 ${
											parseForm.type === "expense"
												? "bg-expense text-white"
												: "text-fg-muted hover:bg-bg-3"
										}`}
									>
										<TrendingDown size={15} /> Expense
									</button>
									<button
										type="button"
										onClick={() =>
											setParseForm({ ...parseForm, type: "income" })
										}
										className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-150 ${
											parseForm.type === "income"
												? "bg-income text-white"
												: "text-fg-muted hover:bg-bg-3"
										}`}
									>
										<TrendingUp size={15} /> Income
									</button>
									<button
										type="button"
										onClick={() =>
											setParseForm({ ...parseForm, type: "transfer" })
										}
										className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-150 ${
											parseForm.type === "transfer"
												? "bg-primary text-white"
												: "text-fg-muted hover:bg-bg-3"
										}`}
									>
										<ArrowLeftRight size={15} /> Transfer
									</button>
								</div>

								{/* Amount + Date */}
								<div className="flex gap-2">
									<div className="flex flex-col gap-1.5 flex-1">
										<label className="text-sm font-medium text-fg">
											Amount
										</label>
										<input
											type="number"
											min="0.01"
											step="0.01"
											required
											autoFocus
											value={parseForm.amount}
											onChange={(e) =>
												setParseForm({
													...parseForm,
													amount: e.target.value,
												})
											}
											placeholder="0.00"
											className={`${inputCls} w-full`}
										/>
									</div>
									<div className="flex flex-col gap-1.5 w-36">
										<label className="text-sm font-medium text-fg">Date</label>
										<input
											type="date"
											required
											value={parseForm.date}
											onChange={(e) =>
												setParseForm({ ...parseForm, date: e.target.value })
											}
											className={`${inputCls} w-full`}
										/>
									</div>
								</div>

								{/* Description */}
								<div className="flex flex-col gap-1.5">
									<label className="text-sm font-medium text-fg">
										Description
									</label>
									<input
										type="text"
										required
										value={parseForm.description}
										onChange={(e) =>
											setParseForm({
												...parseForm,
												description: e.target.value,
											})
										}
										placeholder="Merchant or reference"
										className={`${inputCls} w-full`}
									/>
								</div>

								{/* Account + To Account / Category */}
								<div className="flex gap-2">
									<div className="flex flex-col gap-1.5 flex-1">
										<label className="text-sm font-medium text-fg">
											{parseForm.type === "transfer"
												? "From Account"
												: "Account"}{" "}
											<span className="text-expense">*</span>
										</label>
										<select
											required
											value={parseForm.accountId}
											onChange={(e) =>
												setParseForm({
													...parseForm,
													accountId: e.target.value,
												})
											}
											className={`${inputCls} w-full`}
										>
											<option value="">Select account</option>
											{accounts
												.filter((a) => a.isActive)
												.map((a) => (
													<option key={a.id} value={a.id}>
														{a.name}
													</option>
												))}
										</select>
									</div>
									{parseForm.type === "transfer" ? (
										<div className="flex flex-col gap-1.5 flex-1">
											<label className="text-sm font-medium text-fg">
												To Account <span className="text-expense">*</span>
											</label>
											<select
												required
												value={parseForm.toAccountId}
												onChange={(e) =>
													setParseForm({
														...parseForm,
														toAccountId: e.target.value,
													})
												}
												className={`${inputCls} w-full`}
											>
												<option value="">Select account</option>
												{accounts
													.filter(
														(a) =>
															a.isActive &&
															a.id !== parseForm.accountId
													)
													.map((a) => (
														<option key={a.id} value={a.id}>
															{a.name}
														</option>
													))}
											</select>
										</div>
									) : (
										<div className="flex flex-col gap-1.5 flex-1">
											<label className="text-sm font-medium text-fg">
												Category
											</label>
											<select
												value={parseForm.categoryId}
												onChange={(e) =>
													setParseForm({
														...parseForm,
														categoryId: e.target.value,
													})
												}
												className={`${inputCls} w-full`}
											>
												<option value="">None</option>
												{categories
													.filter(
														(c) =>
															c.type === parseForm.type ||
															c.type === "neutral"
													)
													.map((c) => (
														<option key={c.id} value={c.id}>
															{c.icon ? `${c.icon} ` : ""}
															{c.name}
														</option>
													))}
											</select>
										</div>
									)}
								</div>

								{/* Notes */}
								<div className="flex flex-col gap-1.5">
									<label className="text-sm font-medium text-fg">
										Notes{" "}
										<span className="text-fg-muted font-normal">
											(optional)
										</span>
									</label>
									<input
										type="text"
										value={parseForm.notes}
										onChange={(e) =>
											setParseForm({ ...parseForm, notes: e.target.value })
										}
										placeholder="Any extra details"
										className={`${inputCls} w-full`}
									/>
								</div>

								{/* Actions */}
								<div className="flex items-center gap-3 mt-1">
									<button
										type="button"
										onClick={() => {
											setParseItem(null)
											handleDismiss(parseItem)
										}}
										className="text-sm text-fg-muted hover:text-expense transition-colors"
									>
										Not a transaction
									</button>
									<button
										type="submit"
										disabled={parseSubmitting}
										className="ml-auto bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60"
									>
										{parseSubmitting ? "Saving…" : "Save Transaction"}
									</button>
								</div>
							</form>
						</div>
					</Modal>
				)}

				{/* ── Edit Modal ────────────────────────────────────────────────────── */}
				{editItem && editForm && (
					<Modal
						open={!!editItem}
						title="Edit Transaction"
						onClose={() => setEditItem(null)}
					>
						<form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
							{editError && (
								<div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
									{editError}
								</div>
							)}

							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-fg">Type</label>
								<select
									value={editForm.type}
									onChange={(e) =>
										setEditForm({
											...editForm,
											type: e.target.value as
												| "income"
												| "expense"
												| "transfer",
										})
									}
									className={`${inputCls} w-full`}
								>
									<option value="expense">Expense</option>
									<option value="income">Income</option>
									<option value="transfer">Transfer</option>
								</select>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-fg">
									{editForm.type === "transfer" ? "From Account" : "Account"}{" "}
									<span className="text-expense">*</span>
								</label>
								<select
									value={editForm.accountId}
									onChange={(e) =>
										setEditForm({ ...editForm, accountId: e.target.value })
									}
									className={`${inputCls} w-full`}
									required
								>
									<option value="">Select account</option>
									{accounts
										.filter((a) => a.isActive)
										.map((a) => (
											<option key={a.id} value={a.id}>
												{a.name}
											</option>
										))}
								</select>
							</div>

							{editForm.type === "transfer" && (
								<div className="flex flex-col gap-1.5">
									<label className="text-sm font-medium text-fg">
										To Account <span className="text-expense">*</span>
									</label>
									<select
										value={editForm.toAccountId}
										onChange={(e) =>
											setEditForm({
												...editForm,
												toAccountId: e.target.value,
											})
										}
										className={`${inputCls} w-full`}
										required
									>
										<option value="">Select account</option>
										{accounts
											.filter(
												(a) => a.isActive && a.id !== editForm.accountId
											)
											.map((a) => (
												<option key={a.id} value={a.id}>
													{a.name}
												</option>
											))}
									</select>
								</div>
							)}

							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-fg">Amount</label>
								<input
									type="number"
									min="0.01"
									step="0.01"
									required
									value={editForm.amount}
									onChange={(e) =>
										setEditForm({ ...editForm, amount: e.target.value })
									}
									className={`${inputCls} w-full`}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-fg">Date</label>
								<input
									type="date"
									required
									value={editForm.date}
									onChange={(e) =>
										setEditForm({ ...editForm, date: e.target.value })
									}
									className={`${inputCls} w-full`}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-fg">Description</label>
								<input
									type="text"
									required
									value={editForm.description}
									onChange={(e) =>
										setEditForm({ ...editForm, description: e.target.value })
									}
									className={`${inputCls} w-full`}
								/>
							</div>

							{editForm.type !== "transfer" && (
								<div className="flex flex-col gap-1.5">
									<label className="text-sm font-medium text-fg">Category</label>
									<select
										value={editForm.categoryId}
										onChange={(e) =>
											setEditForm({ ...editForm, categoryId: e.target.value })
										}
										className={`${inputCls} w-full`}
									>
										<option value="">No category</option>
										{categories
											.filter(
												(c) =>
													c.type === editForm.type || c.type === "neutral"
											)
											.map((c) => (
												<option key={c.id} value={c.id}>
													{c.icon ? `${c.icon} ` : ""}
													{c.name}
												</option>
											))}
									</select>
								</div>
							)}

							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-fg">Notes</label>
								<input
									type="text"
									value={editForm.notes}
									onChange={(e) =>
										setEditForm({ ...editForm, notes: e.target.value })
									}
									placeholder="Optional"
									className={`${inputCls} w-full`}
								/>
							</div>

							<div className="flex gap-2 mt-1">
								<button
									type="button"
									onClick={() => setEditItem(null)}
									className="flex-1 bg-bg-3 text-fg font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-border transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={editSubmitting}
									className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-60"
								>
									{editSubmitting ? "Saving…" : "Save"}
								</button>
							</div>
						</form>
					</Modal>
				)}

				{/* ── Reject Confirm ────────────────────────────────────────────────── */}
				{rejectItem && (
					<ConfirmModal
						open={!!rejectItem}
						title="Reject Transaction"
						message={`Reject "${rejectItem.description}"? This will mark it as rejected.`}
						confirmLabel="Reject"
						onConfirm={() => handleReject(rejectItem)}
						onClose={() => setRejectItem(null)}
					/>
				)}

				{/* ── Dismiss Confirm ───────────────────────────────────────────────── */}
				{dismissItem && (
					<ConfirmModal
						open={!!dismissItem}
						title="Dismiss Email"
						message={`Dismiss "${dismissItem.subject ?? "this email"}"? This email is not a transaction and will be removed from the queue.`}
						confirmLabel="Dismiss"
						onConfirm={confirmDismiss}
						onClose={() => setDismissItem(null)}
					/>
				)}
			</div>
		</PageTransition>
	)
}
