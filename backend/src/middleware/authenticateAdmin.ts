import type { FastifyRequest, FastifyReply } from "fastify"
import { authenticate } from "./authenticate.js"

export async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply) {
	await authenticate(request, reply)
	if (reply.sent) return // authenticate already replied 401
	if (!request.user.isSuperadmin) {
		return reply.status(403).send({ error: "Forbidden" })
	}
}
