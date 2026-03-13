# Conventions

## Money

- All monetary amounts are stored as **integers in minor units** (paise for INR, cents for USD).
- Example: ₹12.50 → `1250`, $99.99 → `9999`
- Division by 100 happens only at the display layer (frontend).
- The word "cents" is avoided in code — use "amount" or "minor units" to stay currency-agnostic.
- Amounts are **always positive** in the database. The `type` field (`income`, `expense`, `transfer`) determines the sign semantics.

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
- Both records share the same `transfer_id` (a nanoid generated at creation time).
- The debit side has `type = "transfer"` on the source account.
- The credit side has `type = "transfer"` on the destination account.
- Transfers are **always excluded** from budget calculations and spending reports.

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
