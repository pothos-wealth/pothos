# Conventions

## Money

- All monetary amounts are stored as **signed integers in minor units** (paise for INR, cents for USD).
- Inflows (income, transfer credits) are **positive**. Outflows (expenses, transfer debits) are **negative**.
- Example: ₹12.50 income → `1250`, ₹12.50 expense → `-1250`
- Division by 100 happens only at the display layer (frontend).
- The word "cents" is avoided in code — use "amount" or "minor units" to stay currency-agnostic.
- Account balance is always derived: `initial_balance + SUM(amount)`. Never stored directly.

## Currency

- Currency codes follow **ISO 4217** (e.g. `"INR"`, `"USD"`, `"EUR"`).
- Currency is stored per user in `user_settings.currency`.
- Default currency is `"INR"`.
- Frontend uses the browser's `Intl.NumberFormat` API for display formatting.
- Multi-currency support (cross-account) is out of scope for v1.

## Timestamps

- All timestamps are stored as **Unix timestamps (integers)** in seconds.
- `Date.now()` returns milliseconds — always divide by 1000 before storing: `Math.floor(Date.now() / 1000)`
- Frontend converts to local time using the browser's timezone.

## IDs

- All IDs are **nanoid** strings (21 characters by default).
- Never use auto-increment integers as primary keys — nanoids are safe to expose in URLs and API responses.

## Enums

- Enums are Drizzle `text` columns with an `enum` option.
- SQLite stores them as plain text; TypeScript enforces allowed values at compile time.
- Adding a new enum value requires a migration.

## Transfers

- A transfer between accounts creates **exactly two transaction records**.
- Both records have `type = "transfer"`.
- The debit side (source account) has a **negative amount**.
- The credit side (destination account) has a **positive amount**.
- Each transfer transaction stores:
    - `transfer_account_id` — the other account in the transfer
    - `transfer_transaction_id` — the ID of the paired transaction
- Transfers are **always excluded** from budget calculations and spending reports.
- To find the paired transaction: use `transfer_transaction_id` for a direct lookup.

## API

- All routes are versioned under `/api/v1/`.
- Request bodies are validated with **Zod** schemas defined in `backend/src/types/index.ts`.
- Responses always return JSON.
- Errors follow the shape: `{ error: string, details?: unknown }`
- All protected routes use the `authenticate` preHandler middleware.

## Database

- `better-sqlite3` is synchronous — never use `async/await` inside transactions.
- Always call `.run()` explicitly on insert/update/delete queries inside transactions.
- Foreign keys are enforced via `PRAGMA foreign_keys = ON` on every connection.
- WAL mode is enabled via `PRAGMA journal_mode = WAL` for better read performance.

## File Structure (Backend)

```
backend/src/
├── db/
│   ├── schema.ts       ← Drizzle schema definitions
│   ├── index.ts        ← database connection + Drizzle instance
│   ├── migrate.ts      ← migration runner
│   └── seed.ts         ← default data seed
├── routes/
│   └── v1/             ← versioned route handlers
├── middleware/
│   └── authenticate.ts ← session auth preHandler
├── types/
│   ├── index.ts        ← Zod schemas + inferred TS types
│   └── fastify.d.ts    ← Fastify request augmentation (user, session)
└── index.ts            ← Fastify app entry point
```

## Code Style

- Double quotes for strings.
- 4 spaces for indentation.
- Trailing commas in multi-line expressions.
- Max line width: 100 characters.
- No `any` types without a comment explaining why.
- Unused variables prefixed with `_` to satisfy the linter.
- Error type in catch blocks: use `err instanceof Error ? err.message : String(err)`.
