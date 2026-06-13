import type { FastifyInstance, FastifyReply } from "fastify"
import { and, eq, isNull, or } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import { db } from "../../db/index.js"
import { accounts, categories, recurringTransactions } from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"

const recurringFieldsSchema = z.object({
	accountId: z.string().min(1, "Account is required"),
	toAccountId: z.string().nullable().optional(),
	categoryId: z.string().nullable().optional(),
	type: z.enum(["income", "expense", "transfer"]),
	amount: z.number().int().positive("Amount must be positive").max(1_000_000_000),
	description: z.string().min(1, "Description is required"),
	notes: z.string().nullable().optional(),
	repeatDay: z.number().int().min(1).max(31),
	startDate: z.number().int(),
	endDate: z.number().int().nullable().optional(),
	isActive: z.boolean().optional(),
})

const createRecurringSchema = recurringFieldsSchema
	.superRefine((data, ctx) => {
		if (data.endDate != null && data.endDate < data.startDate) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["endDate"],
				message: "End date must be on or after start date",
			})
		}

		if (data.type === "transfer") {
			if (!data.toAccountId) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["toAccountId"],
					message: "Destination account is required",
				})
			}
			if (data.toAccountId === data.accountId) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["toAccountId"],
					message: "Source and destination accounts must be different",
				})
			}
		}
	})

const updateRecurringSchema = recurringFieldsSchema.partial().superRefine((data, ctx) => {
	if (
		data.endDate != null &&
		data.startDate != null &&
		data.endDate < data.startDate
	) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["endDate"],
			message: "End date must be on or after start date",
		})
	}
})

function getOwnedAccount(accountId: string, userId: string) {
	return db
		.select()
		.from(accounts)
		.where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
		.get()
}

function validateCategory(categoryId: string | null | undefined, userId: string, type: string) {
	if (!categoryId) return true
	const category = db
		.select()
		.from(categories)
		.where(
			and(
				eq(categories.id, categoryId),
				or(eq(categories.userId, userId), isNull(categories.userId))
			)
		)
		.get()

	return !!category && (category.type === type || category.type === "neutral")
}

function normalizeTemplateInput(
	data: z.infer<typeof recurringFieldsSchema>,
	userId: string,
	reply: FastifyReply
) {
	const account = getOwnedAccount(data.accountId, userId)
	if (!account) {
		reply.status(404).send({ error: "Account not found" })
		return null
	}
	if (!account.isActive) {
		reply.status(409).send({ error: "Cannot use a closed account" })
		return null
	}

	if (data.type === "transfer") {
		if (!data.toAccountId) {
			reply.status(400).send({ error: "Destination account is required" })
			return null
		}
		const toAccount = getOwnedAccount(data.toAccountId, userId)
		if (!toAccount) {
			reply.status(404).send({ error: "Destination account not found" })
			return null
		}
		if (!toAccount.isActive) {
			reply.status(409).send({ error: "Cannot use a closed destination account" })
			return null
		}
		return {
			...data,
			toAccountId: data.toAccountId,
			categoryId: null,
			notes: data.notes ?? null,
			endDate: data.endDate ?? null,
			isActive: data.isActive ?? true,
		}
	}

	if (!validateCategory(data.categoryId, userId, data.type)) {
		reply.status(404).send({ error: "Category not found" })
		return null
	}

	return {
		...data,
		toAccountId: null,
		categoryId: data.categoryId ?? null,
		notes: data.notes ?? null,
		endDate: data.endDate ?? null,
		isActive: data.isActive ?? true,
	}
}

export async function recurringTransactionRoutes(app: FastifyInstance) {
	app.get("/recurring-transactions", { preHandler: authenticate }, async (request, reply) => {
		const rows = db
			.select()
			.from(recurringTransactions)
			.where(eq(recurringTransactions.userId, request.user.id))
			.all()

		return reply.send(rows)
	})

	app.post("/recurring-transactions", { preHandler: authenticate }, async (request, reply) => {
		const result = createRecurringSchema.safeParse(request.body)
		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const normalized = normalizeTemplateInput(result.data, request.user.id, reply)
		if (!normalized) return

		const now = Math.floor(Date.now() / 1000)
		const recurring = db
			.insert(recurringTransactions)
			.values({
				id: nanoid(),
				userId: request.user.id,
				...normalized,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get()

		return reply.status(201).send(recurring)
	})

	app.put("/recurring-transactions/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }
		const existing = db
			.select()
			.from(recurringTransactions)
			.where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, request.user.id)))
			.get()

		if (!existing) {
			return reply.status(404).send({ error: "Recurring transaction not found" })
		}

		const result = updateRecurringSchema.safeParse(request.body)
		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const merged = {
			accountId: result.data.accountId ?? existing.accountId,
			toAccountId:
				result.data.toAccountId !== undefined ? result.data.toAccountId : existing.toAccountId,
			categoryId:
				result.data.categoryId !== undefined ? result.data.categoryId : existing.categoryId,
			type: result.data.type ?? existing.type,
			amount: result.data.amount ?? existing.amount,
			description: result.data.description ?? existing.description,
			notes: result.data.notes !== undefined ? result.data.notes : existing.notes,
			repeatDay: result.data.repeatDay ?? existing.repeatDay,
			startDate: result.data.startDate ?? existing.startDate,
			endDate: result.data.endDate !== undefined ? result.data.endDate : existing.endDate,
			isActive: result.data.isActive ?? existing.isActive,
		}

		if (merged.endDate != null && merged.endDate < merged.startDate) {
			return reply.status(400).send({
				error: "Validation error",
				details: { fieldErrors: { endDate: ["End date must be on or after start date"] }, formErrors: [] },
			})
		}

		const normalized = normalizeTemplateInput(merged, request.user.id, reply)
		if (!normalized) return

		const updated = db
			.update(recurringTransactions)
			.set({
				...normalized,
				updatedAt: Math.floor(Date.now() / 1000),
			})
			.where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, request.user.id)))
			.returning()
			.get()

		return reply.send(updated)
	})

	app.post(
		"/recurring-transactions/:id/pause",
		{ preHandler: authenticate },
		async (request, reply) => {
			return setActive(request.params as { id: string }, request.user.id, false, reply)
		}
	)

	app.post(
		"/recurring-transactions/:id/resume",
		{ preHandler: authenticate },
		async (request, reply) => {
			return setActive(request.params as { id: string }, request.user.id, true, reply)
		}
	)

	app.delete(
		"/recurring-transactions/:id",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { id } = request.params as { id: string }
			const deleted = db
				.delete(recurringTransactions)
				.where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, request.user.id)))
				.returning({ id: recurringTransactions.id })
				.get()

			if (!deleted) {
				return reply.status(404).send({ error: "Recurring transaction not found" })
			}

			return reply.status(204).send()
		}
	)
}

function setActive(
	params: { id: string },
	userId: string,
	isActive: boolean,
	reply: FastifyReply
) {
	const updated = db
		.update(recurringTransactions)
		.set({ isActive, updatedAt: Math.floor(Date.now() / 1000) })
		.where(and(eq(recurringTransactions.id, params.id), eq(recurringTransactions.userId, userId)))
		.returning()
		.get()

	if (!updated) {
		return reply.status(404).send({ error: "Recurring transaction not found" })
	}

	return reply.send(updated)
}
