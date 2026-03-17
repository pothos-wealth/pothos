import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import dotenv from "dotenv";
import type { FastifyError, FastifyRequest } from "fastify";
import { healthRoutes } from "./routes/v1/health.js";
import { authRoutes } from "./routes/v1/auth.js";
import { userRoutes } from "./routes/v1/user.js";
import { accountRoutes } from "./routes/v1/accounts.js";
import { categoryRoutes } from "./routes/v1/categories.js";
import { transactionRoutes } from "./routes/v1/transactions.js";
import { budgetRoutes } from "./routes/v1/budgets.js";
import { reportRoutes } from "./routes/v1/reports.js";
import { db } from "./db/index.js";
import { sessions } from "./db/schema.js";
import { lt } from "drizzle-orm";

dotenv.config();

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";

const RATE_LIMIT_GLOBAL_MAX = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX ?? "100", 10);

const app = Fastify({
	logger: {
		level: NODE_ENV === "development" ? "info" : "warn",
		transport:
			NODE_ENV === "development"
				? {
						target: "pino-pretty",
						options: {
							translateTime: "HH:MM:ss Z",
							ignore: "pid,hostname",
						},
					}
				: undefined,
	},
	bodyLimit: 1048576, // 1 MB
});

// ─── Plugins ──────────────────────────────────────────────────────────────────

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
	throw new Error("SESSION_SECRET environment variable is required");
}

await app.register(cookie, {
	secret: sessionSecret,
});

// Global rate limit — permissive for normal usage
await app.register(rateLimit, {
	max: RATE_LIMIT_GLOBAL_MAX,
	timeWindow: "1 minute",
	cache: 10000,
	keyGenerator: (request: FastifyRequest) => request.ip || "unknown",
});

// ─── Routes ───────────────────────────────────────────────────────────────────

await app.register(healthRoutes, { prefix: "/api/v1" });
await app.register(authRoutes, { prefix: "/api/v1" });
await app.register(userRoutes, { prefix: "/api/v1" });
await app.register(accountRoutes, { prefix: "/api/v1" });
await app.register(categoryRoutes, { prefix: "/api/v1" });
await app.register(transactionRoutes, { prefix: "/api/v1" });
await app.register(budgetRoutes, { prefix: "/api/v1" });
await app.register(reportRoutes, { prefix: "/api/v1" });

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.setErrorHandler((error: FastifyError, _request, reply) => {
	app.log.error(error);

	// Handle Zod validation errors from Fastify
	if (error.validation) {
		return reply.status(400).send({
			error: "Validation error",
			details: error.validation,
		});
	}

	const statusCode = error.statusCode ?? 500;
	const message =
		statusCode === 500 && NODE_ENV === "production" ? "Internal server error" : error.message;

	return reply.status(statusCode).send({ error: message });
});

// ─── Start ────────────────────────────────────────────────────────────────────

try {
	await app.listen({ port: PORT, host: "0.0.0.0" });
	app.log.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);

	// Clean up expired sessions once per hour
	setInterval(() => {
		const now = Math.floor(Date.now() / 1000);
		db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
	}, 60 * 60 * 1000);
} catch (err) {
	app.log.error(err);
	process.exit(1);
}
