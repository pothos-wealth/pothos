import type { User, Session } from "../db/schema.js"

declare module "fastify" {
	interface FastifyRequest {
		user: User
		session: Session | undefined
	}
}
