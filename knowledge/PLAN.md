# Pothos — Project Plan

## Overview

Pothos is a self-hostable, open-source budget and expense tracking app for individuals and families. It runs on a single t2.micro (1 vCPU, 1GB RAM) via Docker Compose.

## Progress

| Task                         | Status         |
| ---------------------------- | -------------- |
| T1 — Repo scaffold           | ✅ Complete    |
| T2 — DB schema + migrations  | ✅ Complete    |
| T3 — API scaffold            | ✅ Complete    |
| T4 — Auth system             | ✅ Complete    |
| T5 — Docker Compose          | ✅ Complete    |
| T6 — Shared types            | ✅ Complete    |
| WS2 — Transactions & Budgets | ⬜ Not started |
| WS3 — Gmail Ingestion        | ⬜ Not started |
| WS4 — Frontend               | ⬜ Not started |
| WS5 — MCP Server             | ⬜ Not started |

## V1 Feature Scope

| Feature                              | v1  | Later |
| ------------------------------------ | --- | ----- |
| Manual transaction entry             | ✅  |       |
| Gmail email parsing                  | ✅  |       |
| Categories (default + custom)        | ✅  |       |
| Multiple accounts (free-form type)   | ✅  |       |
| Account initial balance              | ✅  |       |
| Transfers between accounts           | ✅  |       |
| Monthly budget per category          | ✅  |       |
| Budget vs actual tracking            | ✅  |       |
| Dashboard (spending overview)        | ✅  |       |
| Category breakdown charts            | ✅  |       |
| Income vs expenses                   | ✅  |       |
| Spending trends over time            | ✅  |       |
| MCP server (balances + transactions) | ✅  |       |
| Single currency (user-switchable)    | ✅  |       |
| Subcategories                        |     | ✅    |
| Recurring transactions               |     | ✅    |
| Budget rollover                      |     | ✅    |
| Budget alerts                        |     | ✅    |
| Credit card (inverse balance)        |     | ✅    |
| CSV import/export                    |     | ✅    |
| Attachments/receipts                 |     | ✅    |
| Multi-user / family                  |     | ✅    |
| Bank sync (Plaid)                    |     | ✅    |
| Notifications/email summaries        |     | ✅    |
| Savings goals                        |     | ✅    |

## Repo Structure

```
pothos/
├── backend/            ← Fastify API, SQLite, auth, Gmail ingestion, LLM adapter
├── frontend/           ← Next.js, Tailwind, shadcn/ui
├── mcp/                ← MCP server, Ollama integration, parse_pending tool
├── docs/               ← Architecture decisions, schema, conventions
├── nginx/              ← Nginx config for production
├── scripts/            ← Utility scripts (SSL init, etc.)
└── docker-compose.yml
```

## Workstreams

### WS1 — Core Backend

**Goal:** Establish the foundation every other workstream depends on. Repo structure, database, API scaffold, auth, Docker, and shared types.

#### Task flow

```
T1 (monorepo scaffold)
    ├── T2 (DB schema)      ← parallel
    └── T3 (API scaffold)   ← parallel
            ↓
        T4 (auth system)    ← sequential, needs T2 + T3
            ├── T5 (Docker Compose)   ← parallel
            └── T6 (shared types)     ← parallel
```

WS2, WS3, WS4, WS5 all unblock after T4 ships.

#### Tasks

**T1 — Repo scaffold** `✅ complete`

- Root folder structure with `backend/`, `frontend/`, `mcp/`
- Each folder is its own Node project with `package.json` and `tsconfig.json`
- Root `docker-compose.yml` placeholder
- Root `.gitignore`, `README.md`, `.env.example`
- ESLint v9 flat config, Prettier, EditorConfig
- `.vscode/settings.json` for format-on-save

**T2 — DB schema + migrations** `✅ complete`

- Drizzle ORM with better-sqlite3 driver
- Schema: `users`, `user_settings`, `sessions`, `accounts`, `categories`, `transactions`, `budgets`, `pending_messages`, `gmail_cursors`
- Enums: `transaction_type`, `category_type`, `pending_message_status`, `pending_message_source`
- First migration + seed script with default categories
- Auto-creates `data/` directory if it doesn't exist

**T3 — API scaffold** `✅ complete`

- Fastify v5 setup with `@fastify/cookie`
- Versioned routes under `/api/v1`
- Global error handler with Zod validation support
- dotenv + Pino logging with pino-pretty in development
- Health check endpoint: `GET /api/v1/health`

**T4 — Auth system** `✅ complete`

- `POST /api/v1/auth/register` — create user + user_settings row, set session cookie
- `POST /api/v1/auth/login` — validate credentials, create session, set HttpOnly cookie
- `POST /api/v1/auth/logout` — destroy current session, clear cookie
- `POST /api/v1/auth/change-password` — change password, invalidate all sessions
- `authenticate` preHandler middleware for protected routes
- Timing attack prevention via constant-time bcrypt comparison
- Transactions are synchronous (better-sqlite3 limitation)

**T5 — Docker Compose** `✅ complete`

- Production `Dockerfile` for backend (multi-stage, tsc build)
- Production `Dockerfile` for frontend (multi-stage, Next.js build)
- `docker-compose.yml` with `backend`, `frontend`, `nginx`, `certbot` services
- SQLite mounted as named volume at `/app/data`
- Nginx reverse proxy: `/api/*` → backend, `/*` → frontend
- Let's Encrypt SSL via Certbot with auto-renewal
- `scripts/init-ssl.sh` for first-time SSL bootstrap
- `.dockerignore` for lean images

**T6 — Shared types** `✅ complete`

- Zod schemas + TypeScript types in `backend/src/types/index.ts`
- Entities: `User`, `UserSettings`, `Session`, `Transaction`, `Budget`, `Category`, `Account`, `PendingMessage`
- Request schemas: `CreateAccount`, `CreateTransaction`, `CreateTransfer`, `CreateBudget`, `CreateCategory`, `UpdateUserSettings`
- Response schemas: `ApiError`, `Pagination`
- Fastify request augmentation in `backend/src/types/fastify.d.ts`

---

### WS2 — Transactions & Budgets

**Goal:** Manual transaction entry, account management, budget management, categories, transfer support. Backend is single source of truth for all math.

> Tasks TBD — to be planned at start of WS2.

**Dependencies:** WS1 complete

**Key constraints:**

- Transfers create two linked transaction records via `transfer_id`
- Transfers excluded from budget and spending reports
- Account balance derived from `initial_balance` + transactions, never stored directly
- Single currency per user, stored in `user_settings`

---

### WS3 — Gmail Ingestion

**Goal:** IMAP connection, email polling with cursor per user, LLM adapter, pending queue, fallback chain (LLM → regex → pending).

> Tasks TBD — to be planned at start of WS3.

**Dependencies:** WS1 complete, WS2 (transaction shape)

---

### WS4 — Frontend

**Goal:** Next.js app with Tailwind + shadcn/ui. Dashboard, transaction list, manual entry, budget views, account management, Gmail setup.

> Tasks TBD — to be planned at start of WS4.

**Dependencies:** WS1 complete

---

### WS5 — MCP Server

**Goal:** Thin tool-exposure layer. Calls backend for all logic. Includes `parse_pending` for local Ollama users.

> Tasks TBD — to be planned at start of WS5.

**Dependencies:** WS1 complete
