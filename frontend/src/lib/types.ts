export interface Account {
	id: string
	name: string
	type: string
	balance: number
	initialBalance: number
	isActive: boolean
}

export interface Overview {
	month: number
	year: number
	income: number
	expenses: number
	net: number
	committed: number
}

export interface CategoryBreakdown {
	categoryId: string | null
	categoryName: string
	categoryColor: string | null
	categoryIcon: string | null
	total: number
}

export interface CategoryReport {
	month: number
	year: number
	data: CategoryBreakdown[]
}

export interface Category {
	id: string
	userId: string | null
	name: string
	icon: string | null
	color: string | null
	type: "expense" | "income" | "neutral"
}

export interface BudgetWithSpent {
	id: string
	categoryId: string
	amount: number
	month: number
	year: number
	isRecurring: boolean
	isCommitted: boolean
	spent: number
	remaining: number
}

export interface Transaction {
	id: string
	accountId: string
	categoryId: string | null
	type: "income" | "expense" | "transfer"
	amount: number
	date: number
	description: string
	notes: string | null
}

export interface TransactionList {
	data: Transaction[]
	pagination: {
		page: number
		limit: number
		total: number
		totalPages: number
	}
}

export interface TrendPoint {
	month: number
	year: number
	income: number
	expenses: number
	net: number
}

export interface TrendsReport {
	months: number
	data: TrendPoint[]
}

export interface User {
	id: string
	email: string
	isSuperadmin: boolean
	createdAt: number
	updatedAt: number
}

export interface AdminUser {
	id: string
	email: string
	createdAt: number
	isSuperadmin: boolean
	currency: string | null
	accountCount: number
	transactionCount: number
	activeSessionCount: number
}

export interface AdminSession {
	id: string
	userId: string
	expiresAt: number
	createdAt: number
}

export interface AdminStats {
	dbSizeBytes: number
	totalUsers: number
	totalTransactions: number
}

export interface AdminSettings {
	registrationCode: string | null
}

export interface UserSettings {
	id: string
	userId: string
	currency: string
	createdAt: number
	updatedAt: number
}

export interface ImapSettings {
	id: string
	userId: string
	email: string
	host: string
	port: number
	mailbox: string
	isActive: boolean
	lastPolledAt: number | null
	createdAt: number
	updatedAt: number
}

export interface EmailStatus {
	isConfigured: boolean
	isActive: boolean
	lastPolledAt: number | null
	pendingCount: number
	pendingReviewCount: number
}

export interface PendingMessage {
	id: string
	userId: string
	rawContent: string
	subject: string | null
	source: "imap"
	status: "pending" | "processed" | "failed"
	error: string | null
	createdAt: number
	updatedAt: number
}

export interface LlmSettings {
	id: string
	userId: string
	provider: "openai" | "anthropic" | "local"
	apiKey: string | null
	model: string
	createdAt: number
	updatedAt: number
}

export interface ApiKey {
	id: string
	name: string
	lastUsedAt: number | null
	createdAt: number
}

export interface ParsedTransaction {
	id: string
	userId: string
	pendingMessageId: string | null
	accountId: string | null
	toAccountId: string | null
	categoryId: string | null
	type: "income" | "expense" | "transfer"
	amount: number
	date: number
	description: string
	notes: string | null
	status: "pending_review" | "approved" | "rejected"
	accountName: string | null
	categoryName: string | null
	emailSubject: string | null
	createdAt: number
	updatedAt: number
}

export interface ParsedTransactionList {
	data: ParsedTransaction[]
	pagination: {
		page: number
		limit: number
		total: number
		totalPages: number
	}
}
