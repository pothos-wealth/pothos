# Decision Log

## Infrastructure & Tooling

**Repo structure** — Single repo, three independent folders: `backend/`, `frontend/`, `mcp/`. No monorepo tooling (no Turborepo). Each folder is its own Node project.

**Database** — SQLite via Drizzle ORM. Single file, zero infra, perfect for t2.micro self-hosted setup. Driver: `better-sqlite3` (synchronous, no external deps, battle-tested).

**SQLite transactions** — Synchronous only, no async callbacks. `better-sqlite3` limitation — use `.run()` explicitly inside transactions.

**Drizzle ORM version awareness** — Always verify usage against the official docs at https://orm.drizzle.team. The API is actively evolving and patterns from older examples may be outdated.

**Backend framework** — Fastify v5. Fast, TypeScript-native, ships with Pino logging.

**Frontend framework** — Next.js + Tailwind CSS + shadcn/ui. Modern, well-supported, great DX.

**Deployment** — Single `docker-compose.yml`, production only. Dev runs natively via `npm run dev` per folder to avoid Windows/Docker hot-reload issues.

**Production build** — `tsc` compile to `dist/`, run via `node dist/index.js`. No tsx in prod.

**Reverse proxy** — Nginx with Let's Encrypt SSL via Certbot, auto-renewal every 12h. Subdomain-based e.g. `pothos.test.com`.

**License** — AGPL v3. Ensures hosted deployments must open-source modifications.

---

## Auth

**Auth strategy** — Email + password with server-side sessions stored in SQLite, HttpOnly cookie. No OAuth complexity in v1.

**Session expiry** — 7 days, fixed. Reasonable balance of convenience and security.

**Session invalidation** — All sessions deleted on password change.

**Password policy** — Min 8 chars, at least one uppercase, one number, one special character.

**Timing attack prevention** — Constant-time bcrypt comparison on login even when user not found. Prevents user enumeration via response timing.

---

## Data Model

**YNAB as reference** — YNAB used as the primary reference for finance data model decisions. Well-designed, battle-tested personal finance app with a public API and documented data model.

**Signed amounts** — Amounts are signed integers in minor units. Positive = inflow (income, transfer credit). Negative = outflow (expense, transfer debit). Balance calculation becomes `initial_balance + SUM(amount)` — trivially simple. Mirrors YNAB's proven data model.

**Transfer linking** — Each transfer transaction stores `transfer_account_id` (the other account) and `transfer_transaction_id` (the paired transaction ID). Direct lookup without a separate linking table. Replaces the old `transfer_id` shared nanoid approach.

**Shared types** — Types live in `backend/src/types/` only. Frontend mirrors shapes locally, no cross-folder imports.

**Enums** — Drizzle `text` with `enum` option. SQLite has no native enum; TypeScript enforces at compile time. Adding a new value requires a migration.

---

## Accounts

**Account deletion** — Hard delete only if zero transactions. Soft delete (close) if transactions exist. Preserves transaction history and mirrors real-world account lifecycle.

**Account closure** — Only allowed if balance = 0. Sets `is_active = false`. Can't close an account with money still in it.

**Closed accounts in reports** — Included by default. Historical accuracy — past spending happened regardless of account status.

**Closed accounts in account list** — Excluded by default, opt-in via `?includeInactive=true`. Keeps UI clean while preserving data.

---

## Categories

**Global defaults** — Seeded on first run with `user_id = null`. Users can add custom categories on top.

**Category deletion** — Blocked if any transactions reference it. Global defaults are never deletable or editable.

---

## Budgets

**Budget structure** — One budget per category per month, enforced via unique constraint on `(user_id, category_id, month, year)`. Posting to the same category/month/year upserts the existing row.

**Budget recurrence** — Budgets default to `is_recurring = true`. When a month is first viewed, the backend auto-generates budget rows for that month from the most recent recurring entry per category. Avoids users having to manually recreate budgets every month.

**Future month budgets** — Allowed with no restriction. Budgeting is planning — users should be able to set budgets for upcoming months freely.

**Budget rollover** — Deferred to v2. Will live in `user_settings` when added.

---

## Email & Integrations

**Email ingestion** — Gmail only in v1 via IMAP + App Password. No OAuth complexity.

**LLM provider** — Adapter pattern, OpenAI default, user-configurable via env vars. Bring-your-own key.

**Pending queue** — DB-backed via SQLite table + poller. No Redis or BullMQ needed at this scale.

**MCP balance query** — Returns per-account breakdown + net worth total. Full context in one query.

---

## Deferred to v2

- CSV import/export
- Credit card accounts (inverse balance logic adds complexity)
- Subcategories (flat categories sufficient for v1)
- Recurring transactions (Gmail parsing covers most recurring expenses)
- Budget rollover
- Budget alerts
- Multi-user / family
- Bank sync (Plaid)
- Savings goals

---

## Workstream Order

WS1 → WS2 → WS4 → WS3 → WS5. Frontend before Gmail/MCP — core product usability first.
