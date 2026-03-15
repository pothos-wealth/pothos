import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
});

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
});

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
});

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
});

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
});

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
});

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
);

// ─── Pending Messages ─────────────────────────────────────────────────────────

export const pendingMessages = sqliteTable("pending_messages", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	rawContent: text("raw_content").notNull(),
	source: text("source", { enum: ["gmail"] }).notNull(),
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
});

// ─── Gmail Cursors ────────────────────────────────────────────────────────────

export const gmailCursors = sqliteTable("gmail_cursors", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: "cascade" }),
	lastUid: text("last_uid").notNull(),
	updatedAt: integer("updated_at")
		.notNull()
		.default(sql`(unixepoch())`),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type PendingMessage = typeof pendingMessages.$inferSelect;
export type NewPendingMessage = typeof pendingMessages.$inferInsert;

export type GmailCursor = typeof gmailCursors.$inferSelect;
export type NewGmailCursor = typeof gmailCursors.$inferInsert;
