import { sql } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
	isSuperadmin: integer("is_superadmin", { mode: "boolean" }).notNull().default(false),
})

// ─── User Settings ────────────────────────────────────────────────────────────

export const userSettings = sqliteTable("user_settings", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: "cascade" }),
	currency: text("currency").notNull().default("INR"),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expiresAt: integer("expires_at").notNull(),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeys = sqliteTable("api_keys", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	keyHash: text("key_hash").notNull().unique(),
	name: text("name").notNull(),
	lastUsedAt: integer("last_used_at"),
	createdAt: integer("created_at").notNull(),
})

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const accounts = sqliteTable("accounts", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	type: text("type").notNull(),
	initialBalance: integer("initial_balance").notNull().default(0),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = sqliteTable("categories", {
	id: text("id").primaryKey(),
	userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	icon: text("icon"),
	color: text("color"),
	type: text("type", { enum: ["expense", "income", "neutral"] }).notNull(),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = sqliteTable("transactions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accountId: text("account_id")
		.notNull()
		.references(() => accounts.id, { onDelete: "cascade" }),
	categoryId: text("category_id").references(() => categories.id, {
		onDelete: "set null",
	}),
	transferAccountId: text("transfer_account_id").references(() => accounts.id, {
		onDelete: "set null",
	}),
	transferTransactionId: text("transfer_transaction_id"),
	type: text("type", { enum: ["income", "expense", "transfer"] }).notNull(),
	amount: integer("amount").notNull(),
	date: integer("date").notNull(),
	description: text("description").notNull(),
	notes: text("notes"),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── Budgets ──────────────────────────────────────────────────────────────────

export const budgets = sqliteTable(
	"budgets",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		categoryId: text("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),
		amount: integer("amount").notNull(),
		month: integer("month").notNull(),
		year: integer("year").notNull(),
		isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(true),
		isCommitted: integer("is_committed", { mode: "boolean" }).notNull().default(false),
		createdAt: integer("created_at")
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at")
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => ({
		uniqueUserCategoryMonth: uniqueIndex("budgets_user_category_month_idx").on(
			table.userId,
			table.categoryId,
			table.month,
			table.year
		),
	})
)

// ─── Pending Messages ─────────────────────────────────────────────────────────

export const pendingMessages = sqliteTable("pending_messages", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	rawContent: text("raw_content").notNull(),
	subject: text("subject"),
	source: text("source", { enum: ["imap"] }).notNull(),
	status: text("status", { enum: ["pending", "processed", "failed"] })
		.notNull()
		.default("pending"),
	error: text("error"),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── IMAP Settings ────────────────────────────────────────────────────────────

export const imapSettings = sqliteTable("imap_settings", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: "cascade" }),
	email: text("email").notNull(),
	password: text("password").notNull(), // AES-256-GCM encrypted: "iv:authTag:ciphertext"
	host: text("host").notNull(),
	port: integer("port").notNull().default(993),
	mailbox: text("mailbox").notNull().default("INBOX"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	lastPolledAt: integer("last_polled_at"),
	lastUid: text("last_uid"), // cursor: last processed UID, null on first run
	consecutiveAuthFailures: integer("consecutive_auth_failures").notNull().default(0),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── LLM Settings ─────────────────────────────────────────────────────────────

export const llmSettings = sqliteTable("llm_settings", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: "cascade" }),
	provider: text("provider", { enum: ["openai", "anthropic", "local"] })
		.notNull()
		.default("openai"),
	apiKey: text("api_key"), // AES-256-GCM encrypted, nullable for "local"
	model: text("model").notNull().default("gpt-4o-mini"),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── Parsed Transactions ──────────────────────────────────────────────────────

export const parsedTransactions = sqliteTable("parsed_transactions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	pendingMessageId: text("pending_message_id").references(() => pendingMessages.id, {
		onDelete: "set null",
	}),
	accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
	toAccountId: text("to_account_id").references(() => accounts.id, { onDelete: "set null" }),
	categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
	type: text("type", { enum: ["income", "expense", "transfer"] }).notNull(),
	amount: integer("amount").notNull(), // always positive, minor units
	date: integer("date").notNull(),
	description: text("description").notNull(),
	notes: text("notes"),
	status: text("status", { enum: ["pending_review", "approved", "rejected"] })
		.notNull()
		.default("pending_review"),
	createdAt: integer("created_at")
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type UserSettings = typeof userSettings.$inferSelect
export type NewUserSettings = typeof userSettings.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert

export type Budget = typeof budgets.$inferSelect
export type NewBudget = typeof budgets.$inferInsert

export type PendingMessage = typeof pendingMessages.$inferSelect
export type NewPendingMessage = typeof pendingMessages.$inferInsert

export type ImapSettings = typeof imapSettings.$inferSelect
export type NewImapSettings = typeof imapSettings.$inferInsert

export type LlmSettings = typeof llmSettings.$inferSelect
export type NewLlmSettings = typeof llmSettings.$inferInsert

export type ParsedTransaction = typeof parsedTransactions.$inferSelect
export type NewParsedTransaction = typeof parsedTransactions.$inferInsert
