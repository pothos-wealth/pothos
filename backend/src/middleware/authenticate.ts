import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { eq, and, gt } from "drizzle-orm";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
	const sessionId = request.cookies["session_id"];

	if (!sessionId) {
		return reply.status(401).send({ error: "Unauthorized" });
	}

	const now = Math.floor(Date.now() / 1000);

	const result = db
		.select({
			session: sessions,
			user: users,
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
		.get();

	if (!result) {
		return reply.status(401).send({ error: "Unauthorized" });
	}

	request.user = result.user;
	request.session = result.session;
}
