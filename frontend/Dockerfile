FROM node:lts-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY next.config.* ./
COPY tailwind.config.* ./
COPY src ./src
COPY public ./public

ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm run build

# ─── Production image ─────────────────────────────────────────────────────────

FROM node:lts-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start"]
