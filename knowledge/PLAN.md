# Pothos — Project Plan

## Overview

Pothos is a self-hostable, open-source budget and expense tracking app for individuals and families. It runs on a single t2.micro (1 vCPU, 1GB RAM) via Docker Compose.

## Progress

| Task                        | Status         |
| --------------------------- | -------------- |
| T1 — Repo scaffold          | ✅ Complete    |
| T2 — DB schema + migrations | ✅ Complete    |
| T3 — API scaffold           | ✅ Complete    |
| T4 — Auth system            | ✅ Complete    |
| T5 — Docker Compose         | ✅ Complete    |
| T6 — Shared types           | ✅ Complete    |
| T7 — User Settings & Me     | ✅ Complete    |
| T8 — Accounts               | ✅ Complete    |
| T9 — Categories             | ✅ Complete    |
| T10 — Transactions          | ✅ Complete    |
| T11 — Budgets               | ✅ Complete    |
| T12 — Reports               | 🔄 In progress |
| WS4 — Frontend              | ⬜ Not started |
| WS3 — Gmail Ingestion       | ⬜ Not started |
| WS5 — MCP Server            | ⬜ Not started |

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

### WS1 — Core Backend `✅ complete`

**Goal:** Establish the foundation every other workstream depends on. Repo structure, database, API scaffold, auth, Docker, and shared types.

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

### WS2 — Transactions & Budgets `🔄 in progress`

**Goal:** Manual transaction entry, account management, budget management, categories, transfer support. Backend is single source of truth for all math.

**Dependencies:** WS1 complete

**Key constraints:**

- All math server-side, never in the LLM
- Transfers excluded from all budget and report calculations
- Account balance always derived from `initial_balance` + transactions, never stored
- Closed account transactions included in reports
- Active accounts only in default account list unless `?includeInactive=true`
- Global default categories (null user_id) are never deletable or editable
- better-sqlite3 is synchronous — all transactions use `.run()` explicitly

#### Tasks

**T7 — User Settings & Me** `✅ complete`

- `GET /api/v1/user/me` — current user (no password hash)
- `GET /api/v1/user/settings` — user settings
- `PUT /api/v1/user/settings` — update currency

**T8 — Accounts** `✅ complete`

- Migration: add `is_active` column to `accounts` table (default true)
- `GET /api/v1/accounts` — list active accounts with derived balance
- `GET /api/v1/accounts?includeInactive=true` — include closed accounts
- `POST /api/v1/accounts` — create account
- `GET /api/v1/accounts/:id` — single account with derived balance
- `PUT /api/v1/accounts/:id` — update name/type
- `DELETE /api/v1/accounts/:id` — only allowed if zero transactions
- `POST /api/v1/accounts/:id/close` — only allowed if balance = 0, sets is_active = false
- `POST /api/v1/accounts/:id/reopen` — sets is_active = true

**T9 — Categories** `✅ complete`

- `GET /api/v1/categories` — returns global defaults (null user_id) + user's custom categories
- `POST /api/v1/categories` — create custom category with name, icon, color, type
- `PUT /api/v1/categories/:id` — update custom category only; global defaults return 403
- `DELETE /api/v1/categories/:id` — blocked if transactions reference it; global defaults return 403

**T10 — Transactions** `✅ complete`

- `GET /api/v1/transactions` — paginated list with filters: `accountId`, `categoryId`, `type`, `startDate`, `endDate`, `page`, `limit`
- `POST /api/v1/transactions` — create income/expense. Amount is always passed as positive — sign applied server-side based on type
- `GET /api/v1/transactions/:id` — single transaction
- `PUT /api/v1/transactions/:id` — update category, amount, date, description, notes. Transfer transactions cannot be edited
- `DELETE /api/v1/transactions/:id` — if transfer, deletes both sides atomically via `transferTransactionId`
- `POST /api/v1/transactions/transfer` — atomic transfer, creates debit (negative) on source and credit (positive) on destination, linked via `transferAccountId` and `transferTransactionId`
- Amounts stored as signed integers — income/credit positive, expense/debit negative
- Account balance derived as `initial_balance + SUM(amount)` — no extra logic needed

**T11 — Budgets** `✅ complete`

- `GET /api/v1/budgets?month=&year=` — list budgets with actual `spent` and `remaining` for the period. Defaults to current month. Auto-generates recurring budgets for months that haven't been explicitly set
- `POST /api/v1/budgets` — create or update (upsert on unique constraint of user, category, month, year). Defaults `isRecurring` to true
- `DELETE /api/v1/budgets/:id`
- `isRecurring = true` — budget auto-carries forward to future months by finding the most recent recurring entry per category and generating a new row when the month is first viewed
- Future months are supported — users can plan ahead

**T12 — Reports** `⬜ not started`

- `GET /api/v1/reports/overview?month=&year=` — total income, expenses, net. Defaults to current month
- `GET /api/v1/reports/categories?month=&year=` — expenses grouped by category for period
- `GET /api/v1/reports/trends?months=12` — monthly totals over N months, defaults to 12

---

### WS4 — Frontend `⬜ not started`

**Goal:** Next.js app with Tailwind + shadcn/ui. Dashboard, transaction list, manual entry, budget views, account management, settings.

> Tasks TBD — to be planned at start of WS4.

**Dependencies:** WS2 complete

---

### WS3 — Gmail Ingestion `⬜ not started`

**Goal:** IMAP connection, email polling with cursor per user, LLM adapter, pending queue, fallback chain (LLM → regex → pending).

> Tasks TBD — to be planned at start of WS3.

**Dependencies:** WS2 complete, WS4 complete

---

### WS5 — MCP Server `⬜ not started`

**Goal:** Thin tool-exposure layer. Calls backend for all logic. Includes `parse_pending` for local Ollama users.

> Tasks TBD — to be planned at start of WS5.

**Dependencies:** WS3 complete
