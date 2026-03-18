import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const TransactionType = z.enum(["income", "expense", "transfer"]);
export const CategoryType = z.enum(["expense", "income", "neutral"]);
export const PendingMessageStatus = z.enum(["pending", "processed", "failed"]);
export const PendingMessageSource = z.enum(["gmail"]);

export type TransactionType = z.infer<typeof TransactionType>;
export type CategoryType = z.infer<typeof CategoryType>;
export type PendingMessageStatus = z.infer<typeof PendingMessageStatus>;
export type PendingMessageSource = z.infer<typeof PendingMessageSource>;

// ─── User ─────────────────────────────────────────────────────────────────────

export const UserSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	isSuperadmin: z.boolean(),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});

export type UserSchema = z.infer<typeof UserSchema>;

// ─── Admin ────────────────────────────────────────────────────────────────────

export const AdminUserSchema = z.object({
	id: z.string(),
	email: z.string(),
	createdAt: z.number().int(),
	isSuperadmin: z.boolean(),
	currency: z.string().nullable(),
	accountCount: z.number().int(),
	transactionCount: z.number().int(),
	activeSessionCount: z.number().int(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminStatsSchema = z.object({
	dbSizeBytes: z.number().int(),
	totalUsers: z.number().int(),
	totalTransactions: z.number().int(),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

// ─── User Settings ────────────────────────────────────────────────────────────

export const UserSettingsSchema = z.object({
	id: z.string(),
	userId: z.string(),
	currency: z.string().length(3),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});

export type UserSettingsSchema = z.infer<typeof UserSettingsSchema>;

// ─── Session ──────────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
	id: z.string(),
	userId: z.string(),
	expiresAt: z.number().int(),
	createdAt: z.number().int(),
});

export type SessionSchema = z.infer<typeof SessionSchema>;

// ─── Account ──────────────────────────────────────────────────────────────────

export const AccountSchema = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string().min(1),
	type: z.string().min(1),
	initialBalance: z.number().int().default(0),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});

export type AccountSchema = z.infer<typeof AccountSchema>;

// ─── Category ─────────────────────────────────────────────────────────────────

export const CategorySchema = z.object({
	id: z.string(),
	userId: z.string().nullable(),
	name: z.string().min(1),
	icon: z.string().nullable(),
	color: z.string().nullable(),
	type: CategoryType,
	createdAt: z.number().int(),
});

export type CategorySchema = z.infer<typeof CategorySchema>;

// ─── Transaction ──────────────────────────────────────────────────────────────

export const TransactionSchema = z.object({
	id: z.string(),
	userId: z.string(),
	accountId: z.string(),
	categoryId: z.string().nullable(),
	transferId: z.string().nullable(),
	type: TransactionType,
	amount: z.number().int().positive().max(1_000_000_000),
	date: z.number().int(),
	description: z.string().min(1),
	notes: z.string().nullable(),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});

export type TransactionSchema = z.infer<typeof TransactionSchema>;

// ─── Budget ───────────────────────────────────────────────────────────────────

export const BudgetSchema = z.object({
	id: z.string(),
	userId: z.string(),
	categoryId: z.string(),
	amount: z.number().int().positive().max(1_000_000_000),
	month: z.number().int().min(1).max(12),
	year: z.number().int().min(2000).max(2100),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});

export type BudgetSchema = z.infer<typeof BudgetSchema>;

// ─── Pending Message ──────────────────────────────────────────────────────────

export const PendingMessageSchema = z.object({
	id: z.string(),
	userId: z.string(),
	rawContent: z.string(),
	source: PendingMessageSource,
	status: PendingMessageStatus,
	error: z.string().nullable(),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});

export type PendingMessageSchema = z.infer<typeof PendingMessageSchema>;

// ─── API Request Schemas ──────────────────────────────────────────────────────

export const CreateAccountSchema = z.object({
	name: z.string().min(1, "Account name is required"),
	type: z.string().min(1, "Account type is required"),
	initialBalance: z.number().int().default(0),
});

export const CreateTransactionSchema = z.object({
	accountId: z.string(),
	categoryId: z.string().nullable().optional(),
	type: TransactionType,
	amount: z.number().int().positive("Amount must be positive").max(1_000_000_000),
	date: z.number().int(),
	description: z.string().min(1, "Description is required"),
	notes: z.string().optional(),
});

export const CreateTransferSchema = z.object({
	fromAccountId: z.string(),
	toAccountId: z.string(),
	amount: z.number().int().positive("Amount must be positive").max(1_000_000_000),
	date: z.number().int(),
	description: z.string().min(1, "Description is required"),
	notes: z.string().optional(),
});

export const CreateBudgetSchema = z.object({
	categoryId: z.string(),
	amount: z.number().int().positive("Amount must be positive").max(1_000_000_000),
	month: z.number().int().min(1).max(12),
	year: z.number().int().min(2000).max(2100),
});

export const CreateCategorySchema = z.object({
	name: z.string().min(1, "Category name is required"),
	icon: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #ff0000)")
		.optional(),
	type: CategoryType,
});

export const UpdateUserSettingsSchema = z.object({
	currency: z.string().length(3, "Currency must be a valid ISO 4217 code"),
});

// ─── API Response Schemas ─────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
	error: z.string(),
	details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginationSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;
