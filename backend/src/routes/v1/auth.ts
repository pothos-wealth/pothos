import type { FastifyInstance } from "fastify"
import { z } from "zod"
import bcrypt from "bcrypt"
import { nanoid } from "nanoid"
import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { users, sessions, userSettings } from "../../db/schema.js"
import { sessionOnlyAuthenticate } from "../../middleware/sessionOnlyAuthenticate.js"

const SALT_ROUNDS = 12
const SESSION_TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS ?? "7", 10)
const RATE_LIMIT_REGISTER_MAX = parseInt(process.env.RATE_LIMIT_REGISTER_MAX ?? "5", 10)
const RATE_LIMIT_LOGIN_MAX = parseInt(process.env.RATE_LIMIT_LOGIN_MAX ?? "10", 10)
const REGISTRATION_CODE = process.env.REGISTRATION_CODE?.trim() ?? ""

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
	.regex(/[0-9]/, "Password must contain at least one number")
	.regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")

const registerSchema = z.object({
	email: z.string().email().toLowerCase(),
	password: passwordSchema,
	currency: z
		.string()
		.length(3, "Currency must be a valid ISO 4217 code")
		.toUpperCase()
		.default("INR"),
	inviteCode: z.string().optional(),
})

const loginSchema = z.object({
	email: z.string().email().toLowerCase(),
	password: z.string().min(1),
})

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: passwordSchema,
})

function createSessionCookie(sessionId: string, expiresAt: number) {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const,
		path: "/",
		expires: new Date(expiresAt * 1000),
	}
}

export async function authRoutes(app: FastifyInstance) {
	// ─── Registration Config ───────────────────────────────────────────────────

	app.get("/auth/config", async (_request, reply) => {
		return reply.send({ registrationRequiresCode: !!REGISTRATION_CODE })
	})

	// ─── Register ─────────────────────────────────────────────────────────────

	app.post(
		"/auth/register",
		{ config: { rateLimit: { max: RATE_LIMIT_REGISTER_MAX, timeWindow: "1 minute" } } },
		async (request, reply) => {
			const result = registerSchema.safeParse(request.body)

			if (!result.success) {
				return reply.status(400).send({
					error: "Validation error",
					details: result.error.flatten(),
				})
			}

			const { email, password, currency, inviteCode } = result.data

			if (REGISTRATION_CODE) {
				if (!inviteCode || inviteCode.trim() !== REGISTRATION_CODE) {
					return reply.status(403).send({ error: "Invalid invite code" })
				}
			}
			const now = Math.floor(Date.now() / 1000)

			// Check if email already exists
			const existing = db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.email, email))
				.get()

			if (existing) {
				return reply.status(409).send({ error: "Email already in use" })
			}

			const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
			const userId = nanoid()
			const settingsId = nanoid()
			const sessionId = nanoid()
			const expiresAt = now + SESSION_TTL_DAYS * 24 * 60 * 60

			// Create user, settings, and session in a transaction
			db.transaction((tx) => {
				tx.insert(users)
					.values({
						id: userId,
						email,
						passwordHash,
						createdAt: now,
						updatedAt: now,
					})
					.run()

				tx.insert(userSettings)
					.values({
						id: settingsId,
						userId,
						currency,
						createdAt: now,
						updatedAt: now,
					})
					.run()

				tx.insert(sessions)
					.values({
						id: sessionId,
						userId,
						expiresAt,
						createdAt: now,
					})
					.run()
			})

			return reply
				.status(201)
				.setCookie("session_id", sessionId, createSessionCookie(sessionId, expiresAt))
				.send({ message: "Account created successfully" })
		}
	)

	// ─── Login ────────────────────────────────────────────────────────────────

	app.post(
		"/auth/login",
		{ config: { rateLimit: { max: RATE_LIMIT_LOGIN_MAX, timeWindow: "1 minute" } } },
		async (request, reply) => {
			const result = loginSchema.safeParse(request.body)

			if (!result.success) {
				return reply.status(400).send({
					error: "Validation error",
					details: result.error.flatten(),
				})
			}

			const { email, password } = result.data
			const now = Math.floor(Date.now() / 1000)

			const user = db.select().from(users).where(eq(users.email, email)).get()

			// Use constant-time comparison to prevent timing attacks
			const passwordMatch = user
				? await bcrypt.compare(password, user.passwordHash)
				: await bcrypt.compare(password, "$2b$12$placeholderhashingtopreventimingtattack")

			if (!user || !passwordMatch) {
				return reply.status(401).send({ error: "Invalid email or password" })
			}

			const sessionId = nanoid()
			const expiresAt = now + SESSION_TTL_DAYS * 24 * 60 * 60

			db.insert(sessions)
				.values({
					id: sessionId,
					userId: user.id,
					expiresAt,
					createdAt: now,
				})
				.run()

			return reply
				.setCookie("session_id", sessionId, createSessionCookie(sessionId, expiresAt))
				.send({ message: "Logged in successfully" })
		}
	)

	// ─── Logout ───────────────────────────────────────────────────────────────

	app.post("/auth/logout", { preHandler: sessionOnlyAuthenticate }, async (request, reply) => {
		db.delete(sessions).where(eq(sessions.id, request.session!.id)).run()

		return reply
			.clearCookie("session_id", { path: "/" })
			.send({ message: "Logged out successfully" })
	})

	// ─── Change Password ──────────────────────────────────────────────────────

	app.post(
		"/auth/change-password",
		{ preHandler: sessionOnlyAuthenticate },
		async (request, reply) => {
			const result = changePasswordSchema.safeParse(request.body)

			if (!result.success) {
				return reply.status(400).send({
					error: "Validation error",
					details: result.error.flatten(),
				})
			}

			const { currentPassword, newPassword } = result.data
			const now = Math.floor(Date.now() / 1000)

			const user = db.select().from(users).where(eq(users.id, request.user.id)).get()

			if (!user) {
				return reply.status(404).send({ error: "User not found" })
			}

			const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash)

			if (!passwordMatch) {
				return reply.status(401).send({ error: "Current password is incorrect" })
			}

			const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)

			// Update password and invalidate all sessions in a transaction
			db.transaction((tx) => {
				tx.update(users)
					.set({ passwordHash: newPasswordHash, updatedAt: now })
					.where(eq(users.id, user.id))
					.run()

				tx.delete(sessions).where(eq(sessions.userId, user.id)).run()
			})

			return reply
				.setCookie("session_id", "", {
					path: "/",
					expires: new Date(0),
					httpOnly: true,
					sameSite: "strict",
				})
				.send({ message: "Password changed successfully" })
		}
	)
}
