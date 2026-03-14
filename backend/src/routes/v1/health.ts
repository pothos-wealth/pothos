import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";

export async function healthRoutes(app: FastifyInstance) {
	app.get("/health", async (_request, reply) => {
		try {
			// Verify database connectivity
			db.prepare("SELECT 1").get();

			return reply.code(200).send({
				status: "ok",
				timestamp: Math.floor(Date.now() / 1000),
				database: "connected",
			});
		} catch (error) {
			app.log.error(error);
			return reply.code(503).send({
				status: "error",
				timestamp: Math.floor(Date.now() / 1000),
				database: "disconnected",
				message: "Database connection failed",
			});
		}
	});
}
