import Fastify from "fastify";
import cookie from "@fastify/cookie";
import dotenv from "dotenv";
import type { FastifyError } from "fastify";
import { healthRoutes } from "./routes/v1/health.js";
import { authRoutes } from "./routes/v1/auth.js";
import { userRoutes } from "./routes/v1/user.js";
import { accountRoutes } from "./routes/v1/accounts.js";
import { categoryRoutes } from "./routes/v1/categories.js";
import { transactionRoutes } from "./routes/v1/transactions.js";

dotenv.config();

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";

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
});

// ─── Plugins ──────────────────────────────────────────────────────────────────

await app.register(cookie, {
	secret: process.env.SESSION_SECRET ?? "fallback-secret-change-me",
});

// ─── Routes ───────────────────────────────────────────────────────────────────

await app.register(healthRoutes, { prefix: "/api/v1" });
await app.register(authRoutes, { prefix: "/api/v1" });
await app.register(userRoutes, { prefix: "/api/v1" });
await app.register(accountRoutes, { prefix: "/api/v1" });
await app.register(categoryRoutes, { prefix: "/api/v1" });
await app.register(transactionRoutes, { prefix: "/api/v1" });

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
} catch (err) {
	app.log.error(err);
	process.exit(1);
}
