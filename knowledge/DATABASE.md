# Database

Pothos uses SQLite via Drizzle ORM with the `better-sqlite3` driver.

## Enums

Enums are implemented as Drizzle `text` columns with an `enum` option. SQLite stores them as text; TypeScript enforces the allowed values at compile time.

| Enum                     | Values                                 |
| ------------------------ | -------------------------------------- |
| `transaction_type`       | `"income"`, `"expense"`, `"transfer"`  |
| `category_type`          | `"expense"`, `"income"`, `"neutral"`   |
| `pending_message_status` | `"pending"`, `"processed"`, `"failed"` |
| `pending_message_source` | `"gmail"`                              |

## Tables

### `users`

| Column        | Type    | Notes             |
| ------------- | ------- | ----------------- |
| id            | text    | nanoid, PK        |
| email         | text    | unique, lowercase |
| password_hash | text    | bcrypt            |
| created_at    | integer | Unix timestamp    |
| updated_at    | integer | Unix timestamp    |

### `user_settings`

| Column     | Type    | Notes                        |
| ---------- | ------- | ---------------------------- |
| id         | text    | nanoid, PK                   |
| user_id    | text    | FK → users, unique           |
| currency   | text    | ISO 4217 code, default "INR" |
| created_at | integer | Unix timestamp               |
| updated_at | integer | Unix timestamp               |

> Created automatically on user registration with defaults. Future fields: `budget_rollover`, `notification_preferences`, `week_start_day`.

### `sessions`

| Column     | Type    | Notes          |
| ---------- | ------- | -------------- |
| id         | text    | nanoid, PK     |
| user_id    | text    | FK → users     |
| expires_at | integer | Unix timestamp |
| created_at | integer | Unix timestamp |

> All sessions for a user are deleted on password change.

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

| Column      | Type             | Notes                                        |
| ----------- | ---------------- | -------------------------------------------- |
| id          | text             | nanoid, PK                                   |
| user_id     | text             | FK → users                                   |
| account_id  | text             | FK → accounts                                |
| category_id | text             | FK → categories, nullable                    |
| transfer_id | text             | links paired transfer transactions, nullable |
| type        | transaction_type | "income", "expense", "transfer"              |
| amount      | integer          | minor units, always positive                 |
| date        | integer          | Unix timestamp                               |
| description | text             | merchant or note                             |
| notes       | text             | nullable                                     |
| created_at  | integer          | Unix timestamp                               |
| updated_at  | integer          | Unix timestamp                               |

> Transfer transactions are always created in pairs. The `transfer_id` links both sides. Transfers are excluded from budget and spending reports.

### `budgets`

| Column      | Type    | Notes           |
| ----------- | ------- | --------------- |
| id          | text    | nanoid, PK      |
| user_id     | text    | FK → users      |
| category_id | text    | FK → categories |
| amount      | integer | minor units     |
| month       | integer | 1–12            |
| year        | integer | e.g. 2025       |
| created_at  | integer | Unix timestamp  |
| updated_at  | integer | Unix timestamp  |

> Unique constraint on `(user_id, category_id, month, year)`. One budget per category per month. Editing updates the existing row.

### `pending_messages`

| Column      | Type                   | Notes                            |
| ----------- | ---------------------- | -------------------------------- |
| id          | text                   | nanoid, PK                       |
| user_id     | text                   | FK → users                       |
| raw_content | text                   | raw email content                |
| source      | pending_message_source | "gmail"                          |
| status      | pending_message_status | "pending", "processed", "failed" |
| error       | text                   | last error message, nullable     |
| created_at  | integer                | Unix timestamp                   |
| updated_at  | integer                | Unix timestamp                   |

### `gmail_cursors`

| Column     | Type    | Notes                    |
| ---------- | ------- | ------------------------ |
| id         | text    | nanoid, PK               |
| user_id    | text    | FK → users, unique       |
| last_uid   | text    | last processed email UID |
| updated_at | integer | Unix timestamp           |

> One row per user. Updated after each successful poll to avoid re-parsing old emails.

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
