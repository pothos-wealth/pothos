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

## Currency

**Single currency per user, immutable** — Each user selects a currency (ISO 4217 code) during signup. Cannot be changed after account creation. Prevents data corruption from mid-session conversions and avoids complex multi-currency calculations.

**Why immutable** — Amounts are stored as integers in the smallest currency unit (paise for INR, cents for USD, etc.). Changing currency mid-stream would reinterpret all historical data (100 INR stored as 10050 would display as $100.50, a 12x difference). Single, immutable currency avoids this trap.

**Storage** — `user_settings.currency` set at registration. Backend validates via `z.string().length(3).toUpperCase()` (ISO 4217). Settings endpoint rejects any PUT that attempts to change it.

**Supported currencies** — Frontend sign-up offers: INR, USD, EUR, GBP, JPY, AUD, CAD (extensible in `CURRENCIES` array). Backend accepts any valid ISO 4217 code.

**Display formatting** — Frontend uses `Intl.NumberFormat` with the user's currency code. Handles locale-specific symbols and grouping automatically (₹100.50, $100.50, €100,50, etc.).

---

## Decimal Amounts & Formatting

**Storage as integers** — All amounts stored as integers in minor units to avoid floating-point errors. User enters "100.50", frontend multiplies by 100 → backend stores 10050.

**Frontend input** — Form inputs use `type="number" min="0.01" step="0.01"` to allow decimal entry. On submit, multiply by 100. On edit/load, divide by 100.

**Display formatting** — `formatCurrency(amount, currency)` divides by 100 and formats with 2 decimal places using `Intl.NumberFormat`. Example: 10050 → "₹100.50".

**Currency context** — `CurrencyProvider` (React context) fetches user's currency once on app load. `useCurrencyFormatter()` hook returns a formatter that automatically uses the user's currency. All pages that display amounts use this hook instead of hardcoding currency.

**Why context** — Centralized currency management avoids passing currency as a prop through every component. Single source of truth that persists across the app.

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

**Budget recurrence** — Budgets default to `is_recurring = true`. When the current month is first viewed, the backend auto-generates budget rows from the most recent recurring entry per category. Auto-generation only applies to the current month — past and future months are not seeded automatically.

**Future month budgets** — Allowed with no restriction. Budgeting is planning — users should be able to set budgets for upcoming months freely.

**Budget rollover** — Deferred to v2. Will live in `user_settings` when added.

---

## Email & Integrations

**Email ingestion** — IMAP-agnostic in v1. Users configure host/port/mailbox directly. Frontend provides presets for Gmail, Outlook, Yahoo, and iCloud, plus a Custom option for any IMAP provider. No OAuth complexity — App Passwords only.

**Why IMAP-agnostic** — Binding to Gmail would limit adoption. IMAP is a universal standard; every major email provider supports it. The same polling and parsing logic works for any provider at zero extra cost.

**Cursor per user** — `last_uid` stored directly on `imap_settings` (no separate `imap_cursors` table). Updated after each successful poll to avoid re-parsing already processed emails.

**Credential encryption** — IMAP passwords and LLM API keys are encrypted at rest using AES-256-GCM with a 32-byte `ENCRYPTION_KEY` env var. Key validated at startup — fails fast if missing or wrong length.

**LLM provider** — Per-user adapter pattern. Users bring their own OpenAI or Anthropic API key (stored encrypted). Provider `"local"` skips LLM — emails are left as `"failed"` for the MCP `parse_pending` tool (WS5).

**Parsing** — LLM only (OpenAI or Anthropic). If no API key is configured, LLM fails, or provider is `"local"`, the email is marked `"failed"` — available for manual review in the Inbox or local MCP/Ollama processing. No regex fallback — avoids unreliable auto-entries that the user still has to verify anyway.

**Review queue** — All parsed transactions land in `parsed_transactions` with `status="pending_review"`. Users approve/edit/reject before the transaction is created. Non-negotiable: avoids phantom transactions from marketing emails or misparsed amounts.

**Poller isolation** — Each user polled independently via `node-cron`. One user's IMAP failure is logged and swallowed — never affects others. Auto-disables after 3 consecutive auth failures (`is_active = false`). Interval configurable via `IMAP_POLL_INTERVAL_MINUTES` (default 15).

**Pending queue** — DB-backed via SQLite + `node-cron` poller. No Redis or BullMQ needed at this scale.

**MCP balance query** — Returns per-account breakdown + net worth total. Full context in one query.

---

---

## Deployment & Security

**Environment secrets** — All secrets (SESSION_SECRET, API keys) externalized via `.env` file. Never hardcoded fallbacks. Fails fast if secrets are missing.

**Session secret generation** — 32-byte random hex string. Generated automatically via `scripts/setup.sh` using Node's crypto module. Non-negotiable for production.

**Rate limiting** — Global limit of 100 req/min on all routes. Auth routes have stricter per-route limits (register: 5/min, login: 10/min). IP-based keying via `request.ip`. All limits configurable via `RATE_LIMIT_GLOBAL_MAX`, `RATE_LIMIT_REGISTER_MAX`, `RATE_LIMIT_LOGIN_MAX` env vars.

**Request size limit** — 1 MB max body size. Prevents accidental/malicious large uploads. Configured in Fastify: `bodyLimit: 1048576`.

**Health checks** — All services have Docker health checks. Backend verifies database connectivity. Nginx only starts after backend & frontend report healthy. Enables proper startup ordering and self-healing.

**Database backups** — Daily automated backups via cron (2 AM). Saves to local filesystem, keeps last 7 days. Simple, no external deps. Located at `/opt/pothos/backups/`.

**SSL/TLS** — Let's Encrypt via Certbot. Initial bootstrap manual (one-time). Auto-renewal every 12 hours. Nginx enforces HTTPS with redirect from HTTP.

**Deployment scripts** — Two scripts for minimal manual effort:
- `scripts/setup.sh` — First deploy (asks for domain, email, generates secrets, bootstraps SSL, starts app)
- `scripts/deploy.sh` — Subsequent deploys (git pull, rebuild, restart)

**Docker health ordering** — Nginx `depends_on` uses `condition: service_healthy` to wait for backend & frontend before starting. Prevents startup race conditions.

**Worker process isolation** — Email poller runs as a separate `worker` Docker service (same image as `backend`, different entrypoint: `docker-worker-entrypoint.sh` → `dist/worker.js`). Rationale: IMAP connections and LLM calls should not share heap or event loop with HTTP request handling on a 1 vCPU / 1 GB instance. A poller crash no longer takes down the API. Worker `depends_on: backend: service_healthy` so migrations always run before the worker connects to the DB. No health check on the worker (no HTTP port to probe) — `restart: unless-stopped` handles recovery. In dev, run `npm run dev:worker` in a second terminal alongside `npm run dev`; manual poll via `POST /email/poll` still works without the worker running.

---

## Deferred to v2

**Pending message retention** — `failed` status rows (dismissed emails, non-transactions, parse failures) accumulate indefinitely. A scheduled cleanup job to delete `failed` `pending_messages` older than 30 days would keep the DB lean. Deferred — acceptable at current scale.

**Worker heartbeat** — If the worker crashes, `docker-compose` restarts it but `GET /health` still returns 200 in the gap — no visibility for the self-hoster. Planned fix: worker writes a `data/worker.heartbeat` file every poll cycle; health endpoint flags it stale if older than `2 × IMAP_POLL_INTERVAL_MINUTES`. Deferred to v2.

**`authFailures` counter is in-memory only** — The 3-strike auto-disable counter in `poller.ts` resets to zero if the worker process restarts, meaning a flaky IMAP connection could take more than 3 real failures to trigger `is_active = false`. Fix: persist a `consecutive_auth_failures` column on `imap_settings`. Deferred to v2.



- CSV import/export
- Credit card accounts (inverse balance logic adds complexity)
- Subcategories (flat categories sufficient for v1)
- Recurring transactions (email parsing covers most recurring expenses)
- Budget rollover
- Budget alerts
- Multi-user / family
- Bank sync (Plaid)
- Savings goals
- Helmet.js security headers (nice-to-have, not critical for self-hosted)
- CORS configuration (unnecessary with same-origin proxy setup)
- Prometheus metrics / Grafana monitoring (Docker logs sufficient for v1)

---

## Workstream Order

WS1 → WS2 → WS4 → WS3 → WS5. Frontend before email ingestion/MCP — core product usability first.

Post-v1: Security hardening (Helmet, advanced monitoring), MCP refinement, deployment to production.
