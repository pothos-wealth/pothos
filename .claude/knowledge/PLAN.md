# Pothos — Project Plan

## Overview

Pothos is a self-hostable, open-source budget and expense tracking app for individuals and families. It runs on a single t2.micro (1 vCPU, 1GB RAM) via Docker Compose.

## Current Status

**Deployed to production** — Live at [pothos.bryanronad.com](https://pothos.bryanronad.com) on AWS Lightsail via Docker Compose with Nginx + Let's Encrypt SSL.

All pages are built and fully integrated with the backend. Users can sign up, manage accounts, enter transactions with decimal precision, set budgets, and view reports. Currency is selected at signup and displayed correctly throughout the app.

**Next:** MCP server (WS5) — IMAP email ingestion (WS3) is now complete. Email poller extracted into a dedicated `worker` service (fault isolation from the API process).

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
| T12 — Reports               | ✅ Complete    |
| WS4 — Frontend              | ✅ Complete    |
| Deployment — Production     | ✅ Complete    |
| WS3 — Email Ingestion       | ✅ Complete    |
| Worker extraction           | ✅ Complete    |
| WS5 — MCP Server            | ⬜ Not started |

## V1 Feature Scope

| Feature                              | v1  | Later |
| ------------------------------------ | --- | ----- |
| Manual transaction entry             | ✅  |       |
| IMAP email parsing (any provider)    | ✅  |       |
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
| Single currency (immutable, set at signup) | ✅  |       |
| Decimal amounts (0.01 precision)     | ✅  |       |
| Multi-currency display formatting    | ✅  |       |
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
├── backend/            ← Fastify API, SQLite, auth, IMAP email ingestion, LLM adapter
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
- Schema: `users`, `user_settings`, `sessions`, `accounts`, `categories`, `transactions`, `budgets`, `pending_messages`, `imap_settings`, `llm_settings`, `parsed_transactions`
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
- Let's Encrypt SSL via Certbot with auto-renewal (every 12h)
- `scripts/setup.sh` for first-time deployment (interactive setup + SSL bootstrap)
- `scripts/deploy.sh` for code updates (git pull + rebuild + restart)
- `.dockerignore` for lean images

**T6 — Shared types** `✅ complete`

- Zod schemas + TypeScript types in `backend/src/types/index.ts`
- Entities: `User`, `UserSettings`, `Session`, `Transaction`, `Budget`, `Category`, `Account`, `PendingMessage`
- Request schemas: `CreateAccount`, `CreateTransaction`, `CreateTransfer`, `CreateBudget`, `CreateCategory`, `UpdateUserSettings`
- Response schemas: `ApiError`, `Pagination`
- Fastify request augmentation in `backend/src/types/fastify.d.ts`

---

### WS2 — Transactions & Budgets `✅ complete`

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

- `GET /api/v1/budgets?month=&year=` — list budgets with actual `spent` and `remaining` for the period. Defaults to current month. Auto-generates recurring budgets for the current month on first view (past/future months not seeded automatically)
- `POST /api/v1/budgets` — create or update (upsert on unique constraint of user, category, month, year). Defaults `isRecurring` to true
- `DELETE /api/v1/budgets/:id`
- `isRecurring = true` — budget auto-carries forward to future months by finding the most recent recurring entry per category and generating a new row when the month is first viewed
- Future months are supported — users can plan ahead

**T12 — Reports** `✅ complete`

- `GET /api/v1/reports/overview?month=&year=` — total income, expenses, and net for a given month. Defaults to current month. Transfers excluded
- `GET /api/v1/reports/categories?month=&year=` — expenses grouped by category for the period, with category name, icon, and color. Defaults to current month. Transfers excluded
- `GET /api/v1/reports/trends?months=12` — monthly income, expenses, and net over the last N months. Defaults to 12, max 24. Months with no transactions return zeroes. Transfers excluded

---

### WS4 — Frontend `✅ complete`

**Goal:** Next.js app with Tailwind CSS. Dashboard, transaction list, manual entry, budget views, account management, settings. All pages built and integrated with backend API.

**Dependencies:** WS2 complete

#### Pages Built

**Authentication Pages:**
- `/sign-up` — Email + password + currency selector (3-letter ISO 4217 code). Currency immutable after signup.
- `/sign-in` — Email + password login

**Protected Pages (with sidebar):**
- `/dashboard` — Overview stats (income, expenses, net), budget progress by category, recent transactions, 6-month spending trends
- `/accounts` — CRUD with inline modal. Close/reopen accounts. Shows balance derived from transactions. Total balance roll-up.
- `/transactions` — Paginated list with filters (account, type, date range). Inline add/edit modals. Supports transfers. Decimal amounts (0.01 precision).
- `/budgets` — Month picker. Progress bars per category (spent vs limit). Upsert modal. Shows when over budget.
- `/categories` — Tabbed by type (expense/income/neutral). Custom categories with color/icon. System defaults locked (no edit/delete).
- `/settings` — User email display. Change password. Currency shown as read-only. Sign out.

#### Key Features Implemented

**Currency Handling:**
- User selects currency during signup (INR, USD, EUR, GBP, JPY, AUD, CAD)
- Currency immutable after account creation (backend validates)
- `CurrencyProvider` context fetches user's currency on app load
- `useCurrencyFormatter()` hook returns formatter using user's currency
- All pages use the hook; currency displays automatically via `Intl.NumberFormat`

**Decimal Amounts:**
- Form inputs: `type="number" min="0.01" step="0.01"` allows decimal entry
- On submit: multiply by 100 (100.50 → 10050) before sending to backend
- On edit: divide by 100 when loading (10050 → 100.50)
- Display: divide by 100 and format with 2 decimal places via `formatCurrency()`
- Supports any currency (₹100.50, $100.50, €100,50, etc.)

**Data Fetching:**
- No React Query/SWR (simple enough for MVP)
- Manual loading/error states
- Auto-redirect to sign-in on 401 UNAUTHORIZED
- Parallel fetches with `Promise.all`

**Modals & Forms:**
- Reusable `Modal` component for all add/edit flows
- Consistent input styling via `inputCls`
- Form state pattern: `useState` with spread operator updates

**UI/UX:**
- Responsive design (mobile-first, grid adapts at breakpoints)
- Sidebar on desktop, bottom nav on mobile
- Loading states with skeleton screens
- Empty states with helpful messages
- Pagination with prev/next buttons
- Inline add/edit vs modal dialogs throughout

#### Technical Stack

- **Next.js 14** — App router, server/client components, built-in API proxy
- **React** — `useState`, `useEffect`, context for currency
- **Tailwind CSS** — Utility-first styling with Pothos color system
- **Recharts** — Pie and bar charts on dashboard and reports
- **Lucide React** — Icon library throughout UI
- **TypeScript** — Full type safety, types mirror backend

#### Documentation

See `FRONTEND.md` for detailed architecture, component structure, and patterns.

---

### WS3 — Email Ingestion `✅ complete`

**Goal:** IMAP connection, email polling with cursor per user, LLM adapter, review queue, fallback chain (LLM → regex → pending).

**Dependencies:** WS2 complete, WS4 complete

#### What was built

- `backend/src/services/crypto.ts` — AES-256-GCM encrypt/decrypt for IMAP passwords and LLM API keys. `validateEncryptionKey()` called at startup.
- `backend/src/services/imap.ts` — `testConnection()` and `fetchNewEmails()`. IMAP-agnostic: host/port/mailbox configurable. Uses `imapflow` + `mailparser`. Updates `imap_settings.last_uid` directly after fetch (no separate cursor table).
- `backend/src/services/parser.ts` — `parseEmail()`: LLM (OpenAI → Anthropic) → regex fallback → mark as `"failed"`. Creates `parsed_transactions` row on success.
- `backend/src/services/poller.ts` — `node-cron` scheduler, `IMAP_POLL_INTERVAL_MINUTES` configurable. Per-user isolation. Auto-disables after 3 consecutive IMAP auth failures.
- `backend/src/routes/v1/email.ts` — `GET/PUT/DELETE /email/settings`, `GET /email/status`, `POST /email/poll`.
- `backend/src/routes/v1/llm.ts` — `GET/PUT /llm/settings`. API key masked on GET.
- `backend/src/routes/v1/parsedTransactions.ts` — `GET /parsed-transactions`, `PUT /:id`, `POST /:id/approve`, `POST /:id/reject`.
- `backend/src/routes/v1/parseQueue.ts` — `GET /parse-queue`, `POST /parse-queue/:id/submit` (MCP path for WS5).
- Frontend `/inbox` page — tabbed review queue (Pending Review / Approved / Rejected). Edit modal, approve (blocked without accountId), reject with confirm dialog.
- Frontend `/settings` page additions — Email Integration card (provider presets: Gmail, Outlook, Yahoo, iCloud, Custom) and LLM Settings card.
- Sidebar and BottomNav — pending badge on Inbox nav item showing count of `pending_review` items.

---

### WS5 — MCP Server `⬜ not started`

**Goal:** Thin tool-exposure layer. Calls backend for all logic. Includes `parse_pending` for local Ollama users.

> Tasks TBD — to be planned at start of WS5.

**Dependencies:** WS3 complete

---

## Recommendations for Next Steps

### WS5 — MCP Server (Recommended Next)

**Why:** WS3 is complete. MCP multiplies the value — natural language queries on top of parsed + manual transactions. The `parse_pending` tool enables local Ollama users to process emails that failed the cloud LLM path.

**Key Design Points:**
- Thin tool-exposure layer — no business logic, calls backend for everything
- `parse_pending` tool: polls `GET /api/v1/parse-queue?status=pending`, runs through local Ollama, submits via `POST /api/v1/parse-queue/:id/submit`
- Balance query: returns per-account breakdown + net worth total
- No inbound connections required — home PC makes outbound HTTPS calls only

### WS4.1 — Polish & Quality (Optional)

Consider these low-effort high-value improvements:
- Add toast notifications for action feedback (transaction saved, budget added, etc.)
- Keyboard shortcuts for common flows (Ctrl+T to add transaction, Ctrl+K for search)
- Search bar on transactions/categories pages
- Export current month as PDF (for user records)
- Undo for destructive actions (delete transaction)

---

## Known Gaps / Deferred

- **Multi-currency per account** — Decided against to avoid transfer complexity. YNAB recommends separate budgets for different currencies anyway.
- **Credit card accounts** — Requires inverse balance logic (credit limit - balance). Deferred to v2.
- **Budget rollover** — UI placeholder exists, backend logic deferred.
- **Recurring transactions** — Email parsing covers most recurring expenses. Native support deferred to v2.
- **CSV import/export** — Deferred to v2 (manual entry + email parsing sufficient for MVP).
- **Bank sync (Plaid)** — Nice-to-have, deferred to v2.
- **Multi-user / family** — Significant scope increase, deferred to v2.
