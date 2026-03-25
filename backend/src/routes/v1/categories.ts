import type { FastifyInstance } from "fastify"
import { eq, sql, and, or, isNull } from "drizzle-orm"
import { z } from "zod"
import { nanoid } from "nanoid"
import { db } from "../../db/index.js"
import { categories, transactions } from "../../db/schema.js"
import { authenticate } from "../../middleware/authenticate.js"

const hexColorSchema = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #ff0000)")
	.optional()

const createCategorySchema = z.object({
	name: z.string().min(1, "Category name is required"),
	icon: z.string().optional(),
	color: hexColorSchema,
	type: z.enum(["expense", "income", "neutral"]),
})

const updateCategorySchema = z.object({
	name: z.string().min(1, "Category name is required").optional(),
	icon: z.string().optional(),
	color: hexColorSchema,
	type: z.enum(["expense", "income", "neutral"]).optional(),
})

export async function categoryRoutes(app: FastifyInstance) {
	// ─── List Categories ──────────────────────────────────────────────────────

	app.get("/categories", { preHandler: authenticate }, async (request, reply) => {
		const rows = db
			.select()
			.from(categories)
			.where(or(isNull(categories.userId), eq(categories.userId, request.user.id)))
			.all()

		return reply.send(rows)
	})

	// ─── Create Category ──────────────────────────────────────────────────────

	app.post("/categories", { preHandler: authenticate }, async (request, reply) => {
		const result = createCategorySchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const now = Math.floor(Date.now() / 1000)
		const id = nanoid()

		const category = db
			.insert(categories)
			.values({
				id,
				userId: request.user.id,
				name: result.data.name,
				icon: result.data.icon ?? null,
				color: result.data.color ?? null,
				type: result.data.type,
				createdAt: now,
			})
			.returning()
			.get()

		return reply.status(201).send(category)
	})

	// ─── Update Category ──────────────────────────────────────────────────────

	app.put("/categories/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const result = updateCategorySchema.safeParse(request.body)

		if (!result.success) {
			return reply.status(400).send({
				error: "Validation error",
				details: result.error.flatten(),
			})
		}

		const category = db
			.select()
			.from(categories)
			.where(
				and(
					eq(categories.id, id),
					or(eq(categories.userId, request.user.id), isNull(categories.userId))
				)
			)
			.get()

		if (!category) {
			return reply.status(404).send({ error: "Category not found" })
		}

		// Block editing global default categories
		if (category.userId === null) {
			return reply.status(403).send({
				error: "Cannot edit global default categories",
			})
		}

		const updated = db
			.update(categories)
			.set({
				...(result.data.name && { name: result.data.name }),
				...(result.data.icon !== undefined && { icon: result.data.icon }),
				...(result.data.color !== undefined && { color: result.data.color }),
				...(result.data.type && { type: result.data.type }),
			})
			.where(eq(categories.id, id))
			.returning()
			.get()

		return reply.send(updated)
	})

	// ─── Delete Category ──────────────────────────────────────────────────────

	app.delete("/categories/:id", { preHandler: authenticate }, async (request, reply) => {
		const { id } = request.params as { id: string }

		const category = db
			.select()
			.from(categories)
			.where(
				and(
					eq(categories.id, id),
					or(eq(categories.userId, request.user.id), isNull(categories.userId))
				)
			)
			.get()

		if (!category) {
			return reply.status(404).send({ error: "Category not found" })
		}

		// Block deleting global default categories
		if (category.userId === null) {
			return reply.status(403).send({
				error: "Cannot delete global default categories",
			})
		}

		// Block deletion if any transactions reference this category
		const txCount = db
			.select({ count: sql<number>`count(*)` })
			.from(transactions)
			.where(eq(transactions.categoryId, id))
			.get()

		if (txCount && txCount.count > 0) {
			return reply.status(409).send({
				error: "Cannot delete category with existing transactions",
			})
		}

		db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, request.user.id))).run()

		return reply.status(204).send()
	})
}
