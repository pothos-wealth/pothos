# Transactions Page: Category Filter, Edit Bug, and Net Summary

## Background

Three issues reported on the transactions page:

1. The category filter dropdown lists all categories (income, expense, neutral) flat, with no type indicator. Since nothing prevents duplicate names across types, a user can end up with two visually identical entries (e.g. "Other" for both income and expense).
2. Some transactions show no category when opened for editing.
3. Desire for a way to see the net (income − expense) of whatever set of transactions the current filters produce, without a manual multi-select UI.

## Root cause investigation (issue 2)

`categories` (`backend/src/db/schema.ts:86-96`) is a single table with a `type` enum (`expense` | `income` | `neutral`), not separate tables per type. Nothing enforces name uniqueness, so duplicate-named categories across types are expected and legitimate.

The edit modal's category `<select>` (`frontend/src/app/(app)/transactions/page.tsx:853-870`) filters its options to `c.type === editTx.type || c.type === "neutral"`. If the transaction's stored `categoryId` doesn't match any rendered `<option>`, the native select shows blank.

Confirmed root cause: the type toggle in both the Add Transaction form (`page.tsx:589`) and the Recurring Transactions form (`RecurringTransactionsPanel.tsx:317-323`) changes `type` but does **not** reset `categoryId` (except when switching to `"transfer"` in the recurring form). Sequence:

1. User opens Add Transaction (defaults to type `expense`), picks a category, e.g. "Coffee" (an expense category).
2. User clicks the Income toggle.
3. The category `<select>` re-filters to income/neutral options. "Coffee" isn't among them, so the dropdown visually shows blank — but `txForm.categoryId` still holds Coffee's id underneath.
4. If the user doesn't notice and submits, the transaction is created with `type: "income"` and `categoryId` pointing to an expense category.
5. Later, editing that transaction shows a blank category, because the edit dropdown filters by the transaction's type and that category id doesn't qualify.

This is consistent with the user having same-named/emoji categories for both income and expense — the blank dropdown after a type switch could be mistaken for "pick the other same-named category," masking the real bug.

Decision: fix going forward only. No backfill/migration for existing affected transactions (user's call) — they'll continue to show their currently-assigned (mismatched) category until manually re-edited.

## Fix 1: Group category filter dropdown by type

File: `frontend/src/app/(app)/transactions/page.tsx:363-378`

Replace the flat list of `<option>` elements with `<optgroup label="Income">`, `<optgroup label="Expense">`, `<optgroup label="Neutral">` sections, each populated with categories of that type. Filtering behavior is unchanged (still filters by exact `categoryId`); this only changes presentation so same-named categories are visually distinguishable by their group.

## Fix 2: Reset categoryId on type change

Files:
- `frontend/src/app/(app)/transactions/page.tsx:589` — Add Transaction type toggle handler. Change `setTxForm((f) => ({ ...f, type: t }))` to also reset `categoryId: ""`.
- `frontend/src/app/(app)/transactions/RecurringTransactionsPanel.tsx:317-323` — change the conditional reset (`categoryId: type === "transfer" ? "" : current.categoryId`) to unconditionally reset `categoryId: ""` on every type change.

This guarantees a transaction's `categoryId` can never be submitted while pointing to a category of a different (non-neutral) type than the transaction itself.

## Fix 3: Net summary for current filters

Goal: show a subtle summary line — income / expense / net — for whatever the current filter set (account, category, type, date range, search) matches, across all matching pages, not just the visible page of 20.

**Backend** — `backend/src/routes/v1/transactions.ts`, `GET /transactions` handler (lines 56-104):

After computing `total` via the existing count query, add a second aggregate query reusing the same `conditions` array (pre-pagination), excluding transfers:

```ts
const summaryResult = db
  .select({
    income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
    expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
  })
  .from(transactions)
  .where(and(...conditions))
  .get()

const income = summaryResult?.income ?? 0
const expense = summaryResult?.expense ?? 0
```

Add to the response payload:

```ts
summary: {
  income,
  expense,
  net: income - expense,
}
```

(`amount` is stored as a positive integer in minor units per row regardless of type, per `schema.ts:111` comment "always positive, minor units" — confirm this holds for both `transactions` and any legacy rows before relying on raw `sum`.)

Transfers are excluded entirely — they move money between the user's own accounts and aren't income or expense.

**Frontend** — `frontend/src/app/(app)/transactions/page.tsx`:

- Extend the `TransactionList` type (wherever it's defined, likely `frontend/src/lib/types.ts`) to include `summary: { income: number; expense: number; net: number }`.
- Render a muted-text summary line directly above the transaction list (below the filter row), formatted with the existing `useCurrencyFormatter`, e.g.:
  `Income $1,240.00 · Expense $860.50 · Net $379.50`
- Style subtly (small, muted-foreground text) — not a bold banner — consistent with the user's preference to avoid UI pollution.
- No client-side selection state, no checkboxes. The summary simply reflects whatever filters are currently applied.

## Testing

- Manually verify: switching type toggle in Add Transaction clears any previously selected category, in both directions (expense→income, income→expense).
- Manually verify: same for Recurring Transactions form, including transfer↔non-transfer transitions still working as before.
- Manually verify: category filter dropdown renders three labeled groups and same-named categories appear under their correct group.
- Manually verify: net summary updates correctly when changing filters, and correctly excludes transfers, across a filtered set spanning more than one page (20+ matching transactions).
