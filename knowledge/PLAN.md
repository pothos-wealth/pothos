# Pothos — Project Plan

## Overview

Pothos is a self-hostable, open-source budget and expense tracking app for individuals and families. It runs on a single t2.micro (1 vCPU, 1GB RAM) via Docker Compose.

## Progress

| Task                         | Status         |
| ---------------------------- | -------------- |
| T1 — Repo scaffold           | ✅ Complete    |
| T2 — DB schema + migrations  | ✅ Complete    |
| T3 — API scaffold            | 🔄 In progress |
| T4 — Auth system             | ⬜ Not started |
| T5 — Docker Compose          | ⬜ Not started |
| T6 — Shared types            | ⬜ Not started |
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
- Each folder is its own Node project
- Root `docker-compose.yml` placeholder
- Root `.gitignore`, `README.md`, `.env.example`
- ESLint v9 flat config, Prettier, EditorConfig
- `.vscode/settings.json` for format-on-save

**T2 — DB schema + migrations** `✅ complete`

- Drizzle ORM with better-sqlite3 driver
- Schema: `users`, `user_settings`, `sessions`, `accounts`, `categories`, `transactions`, `budgets`, `pending_messages`, `gmail_cursors`
- Enums: `transaction_type`, `category_type`, `pending_message_status`, `pending_message_source`
- First migration + seed script with default categories

**T3 — API scaffold** `🔄 in progress`

- Fastify setup, versioned routes under `/api/v1`
- Global error handler, Zod validation, health check
- dotenv + Pino logging

**T4 — Auth system** `⬜ not started`

- `POST /api/v1/auth/register` — create user + user_settings row
- `POST /api/v1/auth/login` — validate, create session, HttpOnly cookie
- `POST /api/v1/auth/logout` — destroy session
- `POST /api/v1/auth/change-password` — change password, invalidate all sessions
- `authenticate` middleware
- **This is the gate. All other workstreams unblock here.**

**T5 — Docker Compose** `⬜ not started`

- Production `Dockerfile` for backend and frontend
- `docker-compose.yml` with `api` and `web` services
- SQLite mounted as named volume

**T6 — Shared types** `⬜ not started`

- Zod schemas + TypeScript types in `backend/src/types/`
- Entities: `User`, `UserSettings`, `Session`, `Transaction`, `Budget`, `Category`, `Account`, `PendingMessage`

---

### WS2 — Transactions & Budgets

**Goal:** Manual transaction entry, account management, budget management, categories, transfer support. Backend is single source of truth for all math.

> Tasks TBD — to be planned after WS1 ships.

**Dependencies:** WS1 (T4 minimum)

**Key constraints:**

- Transfers create two linked transaction records via `transfer_id`
- Transfers excluded from budget and spending reports
- Account balance derived from `initial_balance` + transactions, never stored directly
- Single currency per user, stored in `user_settings`

---

### WS3 — Gmail Ingestion

**Goal:** IMAP connection, email polling with cursor per user, LLM adapter, pending queue, fallback chain (LLM → regex → pending).

> Tasks TBD — to be planned after WS1 ships.

**Dependencies:** WS1 (T4 minimum), WS2 (transaction shape)

---

### WS4 — Frontend

**Goal:** Next.js app. Dashboard, transaction list, manual entry, budget views, account management, Gmail setup.

> Tasks TBD — to be planned after WS1 ships.

**Dependencies:** WS1 (T4 minimum)

---

### WS5 — MCP Server

**Goal:** Thin tool-exposure layer. Calls backend for all logic. Includes `parse_pending` for local Ollama users.

> Tasks TBD — to be planned after WS1 ships.

**Dependencies:** WS1 (T4 minimum)
