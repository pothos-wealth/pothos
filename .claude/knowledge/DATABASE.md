# Database

Pothos uses SQLite via Drizzle ORM with the `better-sqlite3` driver.

## Enums

Enums are implemented as Drizzle `text` columns with an `enum` option. SQLite stores them as text; TypeScript enforces the allowed values at compile time.

| Enum                     | Values                                 |
| ------------------------ | -------------------------------------- |
| `transaction_type`       | `"income"`, `"expense"`, `"transfer"`  |
| `category_type`          | `"expense"`, `"income"`, `"neutral"`   |
| `pending_message_status` | `"pending"`, `"processed"`, `"failed"` |
| `pending_message_source` | `"imap"`                               |

## Tables

### `users`

| Column         | Type    | Notes                                        |
| -------------- | ------- | -------------------------------------------- |
| id             | text    | nanoid, PK                                   |
| email          | text    | unique, lowercase                            |
| password_hash  | text    | bcrypt                                       |
| is_superadmin  | integer | boolean, default false. Set via SUPERADMIN_EMAIL env var on startup |
| created_at     | integer | Unix timestamp                               |
| updated_at     | integer | Unix timestamp                               |

### `user_settings`

| Column     | Type    | Notes                                             |
| ---------- | ------- | ------------------------------------------------- |
| id         | text    | nanoid, PK                                        |
| user_id    | text    | FK → users, unique                                |
| currency   | text    | ISO 4217 code, set at signup, immutable. Default "INR" |
| created_at | integer | Unix timestamp                                    |
| updated_at | integer | Unix timestamp                                    |

> Created automatically on user registration with defaults. `currency` is set during signup and cannot be changed (backend validates this). Future fields: `budget_rollover`, `notification_preferences`, `week_start_day`.

### `sessions`

| Column     | Type    | Notes          |
| ---------- | ------- | -------------- |
| id         | text    | nanoid, PK     |
| user_id    | text    | FK → users     |
| expires_at | integer | Unix timestamp |
| created_at | integer | Unix timestamp |

> All sessions for a user are deleted on password change.

### `api_keys`

| Column       | Type    | Notes                                             |
| ------------ | ------- | ------------------------------------------------- |
| id           | text    | nanoid, PK                                        |
| user_id      | text    | FK → users, cascade delete                        |
| key_hash     | text    | SHA-256 of raw key, unique                        |
| name         | text    | user-given label (1–64 chars)                     |
| last_used_at | integer | Unix timestamp, nullable                          |
| created_at   | integer | Unix timestamp                                    |

> Raw key is never stored — only the SHA-256 hash. Key format: `pth_<64-char-hex>` (32 random bytes).
> Shown once at creation. `last_used_at` updated asynchronously (non-blocking) on each authenticated request.
> API key management routes are guarded by `sessionOnlyAuthenticate` — cannot be accessed via API key itself.

### `accounts`

| Column          | Type    | Notes                                         |
| --------------- | ------- | --------------------------------------------- |
| id              | text    | nanoid, PK                                    |
| user_id         | text    | FK → users                                    |
| name            | text    | e.g. "Chase Checking"                         |
| type            | text    | free-form, e.g. "checking", "savings", "cash" |
| initial_balance | integer | in minor units (paise/cents)                  |
| is_active       | integer | boolean, 1 = active, 0 = closed. Default 1    |
| created_at      | integer | Unix timestamp                                |
| updated_at      | integer | Unix timestamp                                |

> Account balance is always derived: `initial_balance` + sum of transactions. Never stored directly.
> Accounts are never hard deleted if transactions exist. Use close/reopen instead.
> Hard delete is only allowed if the account has zero transactions (created by mistake).

### `categories`

| Column     | Type          | Notes                                |
| ---------- | ------------- | ------------------------------------ |
| id         | text          | nanoid, PK                           |
| user_id    | text          | FK → users, null for global defaults |
| name       | text          | e.g. "Food & Dining"                 |
| icon       | text          | emoji, nullable                      |
| color      | text          | hex color, nullable                  |
| type       | category_type | "expense", "income", "neutral"       |
| created_at | integer       | Unix timestamp                       |

### `transactions`

| Column                  | Type             | Notes                                                     |
| ----------------------- | ---------------- | --------------------------------------------------------- |
| id                      | text             | nanoid, PK                                                |
| user_id                 | text             | FK → users                                                |
| account_id              | text             | FK → accounts                                             |
| category_id             | text             | FK → categories, nullable                                 |
| transfer_account_id     | text             | FK → accounts, nullable. Other account in transfer        |
| transfer_transaction_id | text             | FK → transactions, nullable. Paired transaction           |
| type                    | transaction_type | "income", "expense", "transfer"                           |
| amount                  | integer          | signed minor units. Positive = inflow, negative = outflow |
| date                    | integer          | Unix timestamp                                            |
| description             | text             | merchant or note                                          |
| notes                   | text             | nullable                                                  |
| created_at              | integer          | Unix timestamp                                            |
| updated_at              | integer          | Unix timestamp                                            |

> Transfer transactions are always created in pairs.
> Each side stores `transfer_account_id` and `transfer_transaction_id` pointing to the counterpart.
> Transfers are excluded from budget and spending reports.
> Balance calculation: `initial_balance + SUM(amount)` — sign encodes direction.

### `budgets`

| Column       | Type    | Notes                                       |
| ------------ | ------- | ------------------------------------------- |
| id           | text    | nanoid, PK                                  |
| user_id      | text    | FK → users                                  |
| category_id  | text    | FK → categories                             |
| amount       | integer | minor units, always positive                |
| month        | integer | 1–12                                        |
| year         | integer | e.g. 2026                                   |
| is_recurring | integer | boolean, default true. Auto-carries forward to current month on first view |
| created_at   | integer | Unix timestamp                              |
| updated_at   | integer | Unix timestamp                              |

> Unique constraint on `(user_id, category_id, month, year)`.
> If `is_recurring = true`, the budget auto-generates for the current month on first view, using the most recent recurring entry per category. Past and future months are not seeded automatically.
> Future months are supported — users can create budgets for upcoming months manually.

### `pending_messages`

| Column      | Type                   | Notes                            |
| ----------- | ---------------------- | -------------------------------- |
| id          | text                   | nanoid, PK                       |
| user_id     | text                   | FK → users                       |
| raw_content | text                   | raw email body (plain text)      |
| subject     | text                   | email subject line, nullable     |
| source      | pending_message_source | `"imap"`                         |
| status      | pending_message_status | "pending", "processed", "failed" |
| error       | text                   | last error message, nullable     |
| created_at  | integer                | Unix timestamp                   |
| updated_at  | integer                | Unix timestamp                   |

### `imap_settings`

| Column         | Type    | Notes                                                       |
| -------------- | ------- | ----------------------------------------------------------- |
| id             | text    | nanoid, PK                                                  |
| user_id        | text    | FK → users, unique                                          |
| email          | text    | IMAP login address                                          |
| password       | text    | AES-256-GCM encrypted App Password: `"iv:tag:ciphertext"`  |
| host           | text    | IMAP host, e.g. `imap.gmail.com`                            |
| port           | integer | IMAP port, default 993                                      |
| mailbox        | text    | Mailbox to poll, default `"INBOX"`                          |
| is_active      | integer | boolean, default true. Set to false after 3 auth failures   |
| last_polled_at | integer | Unix timestamp of last successful poll, nullable            |
| last_uid       | text    | Last processed email UID (cursor), nullable                 |
| created_at     | integer | Unix timestamp                                              |
| updated_at     | integer | Unix timestamp                                              |

> One row per user. `last_uid` replaces the old `gmail_cursors` table — the cursor is stored inline to avoid joins.
> `password` is encrypted at rest via AES-256-GCM using `ENCRYPTION_KEY` env var.
> `is_active` is set to false automatically after 3 consecutive IMAP auth failures.

### `llm_settings`

| Column     | Type    | Notes                                                      |
| ---------- | ------- | ---------------------------------------------------------- |
| id         | text    | nanoid, PK                                                 |
| user_id    | text    | FK → users, unique                                         |
| provider   | text    | `"openai"`, `"anthropic"`, or `"local"`                    |
| api_key    | text    | AES-256-GCM encrypted, nullable (omitted for `"local"`)    |
| model      | text    | e.g. `gpt-4o-mini`, `claude-3-5-haiku-20241022`            |
| created_at | integer | Unix timestamp                                             |
| updated_at | integer | Unix timestamp                                             |

> Per-user LLM configuration. Users bring their own API key.
> `api_key` masked as `"••••" + last4` on GET responses — never returned in plaintext.
> Provider `"local"` skips LLM entirely; raw emails are left as `"failed"` for the MCP `parse_pending` tool.

### `parsed_transactions`

| Column             | Type    | Notes                                                                  |
| ------------------ | ------- | ---------------------------------------------------------------------- |
| id                 | text    | nanoid, PK                                                             |
| user_id            | text    | FK → users                                                             |
| pending_message_id | text    | FK → pending_messages (set null on delete), nullable                   |
| account_id         | text    | FK → accounts (set null on delete), nullable                           |
| category_id        | text    | FK → categories (set null on delete), nullable                         |
| type               | text    | `"income"` or `"expense"`                                              |
| amount             | integer | always positive, minor units (paise/cents). Sign applied on approve.   |
| date               | integer | Unix timestamp                                                         |
| description        | text    | merchant or reference, max 60 chars                                    |
| notes              | text    | nullable                                                               |
| status             | text    | `"pending_review"`, `"approved"`, `"rejected"`                         |
| created_at         | integer | Unix timestamp                                                         |
| updated_at         | integer | Unix timestamp                                                         |

> Review queue for LLM/regex-parsed emails. All parsed emails land here before becoming real transactions.
> `amount` is stored as a positive integer; the approve handler applies sign (income → positive, expense → negative) when creating the actual transaction.
> Approve is blocked if `account_id` is null — user must select an account.
> On approve: creates a transaction via the existing insert logic, sets status=`approved`, sets `pending_message.status=processed`.
> On reject: sets status=`rejected`, sets `pending_message.error="Rejected by user"`, `pending_message.status=failed`.

## Default Categories (Seed)

| Name          | Icon | Type    |
| ------------- | ---- | ------- |
| Food & Dining | 🍔   | expense |
| Transport     | 🚗   | expense |
| Housing       | 🏠   | expense |
| Utilities     | 💡   | expense |
| Healthcare    | 🏥   | expense |
| Entertainment | 🎬   | expense |
| Shopping      | 🛍️   | expense |
| Education     | 📚   | expense |
| Travel        | ✈️   | expense |
| Personal Care | 💅   | expense |
| Salary        | 💰   | income  |
| Freelance     | 💻   | income  |
| Other Income  | 📈   | income  |
| Savings       | 🏦   | neutral |
| Miscellaneous | 📦   | neutral |
