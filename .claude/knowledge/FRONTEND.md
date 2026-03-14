# Frontend Architecture

Pothos frontend is built with Next.js 14 + React + Tailwind CSS. All client-side features use the `'use client'` directive.

## Key Libraries

- **Next.js 14** — App router, server/client components, built-in API proxy
- **Tailwind CSS** — Utility-first styling
- **Recharts** — Charts (pie, bar, line)
- **Lucide React** — Icons
- **Zod** — Optional runtime validation (mostly backend-driven)

## Structure

```
frontend/src/
├── app/                          # Next.js app router
│   ├── (app)/                    # Protected routes, sidebar layout
│   │   ├── accounts/
│   │   ├── budgets/
│   │   ├── categories/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   ├── settings/
│   │   ├── transactions/
│   │   └── layout.tsx            # Main app layout (Sidebar)
│   ├── (auth)/                   # Auth routes, no sidebar
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── layout.tsx
│   ├── page.tsx                  # Landing page
│   └── layout.tsx                # Root layout (providers)
├── components/
│   ├── app/                      # App-specific components (Sidebar, BottomNav)
│   ├── dashboard/                # Dashboard section components
│   ├── landing/                  # Landing page components
│   └── ui/                       # Reusable UI components (Card, Modal, Skeleton)
├── lib/
│   ├── api.ts                    # API client (mirrors backend routes)
│   ├── currency-context.tsx      # React context for currency (fetches user's currency)
│   ├── types.ts                  # TypeScript types (mirrors backend)
│   └── utils.ts                  # Helpers (formatCurrency, useCurrencyFormatter, etc.)
└── providers/
    └── ThemeProvider.tsx         # Theme setup (CSS variables)
```

## Currency Handling

### Context Setup

`CurrencyProvider` (in `lib/currency-context.tsx`):
- Fetches user's currency from `/user/settings` on app load
- Stores in React context (single source of truth)
- Falls back to 'INR' on error
- Provides `useCurrency()` hook for accessing the currency

Added to root layout so all pages can access it.

### Formatting

**`formatCurrency(amount: number, currency: string = 'INR'): string`**
- Divides amount by 100 (converts from minor units)
- Formats using `Intl.NumberFormat` with the currency code
- Shows 2 decimal places
- Handles invalid currency codes gracefully

**`useCurrencyFormatter(): (amount: number) => string`**
- Hook that wraps `formatCurrency` with the user's currency
- Eliminates need to pass currency through component tree
- Used in all pages that display amounts

### Updated Pages/Components

**Pages using `useCurrencyFormatter()`:**
- `/accounts` — displays account balances
- `/dashboard` — shows overview stats and balances
- `/budgets` — shows budget amounts and spending
- `/transactions` — displays transaction amounts
- `/reports` — shows spending and trend stats

**Components using `useCurrencyFormatter()`:**
- `SpendingChart` — chart tooltips and legend
- `BudgetProgress` — budget vs spent amounts
- `RecentTransactions` — transaction amounts

## Decimal Amounts

### Input Handling

All amount inputs use:
```
type="number" min="0.01" step="0.01"
```

This allows users to type amounts like "100.50" (with decimals).

### Conversion Flow

**On Submit (Creating/Updating):**
```javascript
amount: Math.round(Number(formValue) * 100)
// "100.50" → 10050
```

**On Edit (Loading existing data):**
```javascript
amount: String(Math.abs(txAmount) / 100)
// 10050 → "100.50"
```

This ensures:
1. User input is in user-friendly rupees/dollars
2. Backend storage is integer minor units (paise/cents)
3. Loaded data displays correctly with decimals

## API Client

`lib/api.ts` mirrors the backend structure:

```javascript
export const api = {
  auth: { login, logout, register, changePassword },
  accounts: { list, create, update, delete, close, reopen },
  categories: { list, create, update, delete },
  transactions: { list, create, createTransfer, update, delete },
  budgets: { list, upsert, delete },
  reports: { overview, categories, trends },
  user: { me, settings, updateSettings },
}
```

All requests include credentials (cookies) and pass through the Next.js proxy (`/api/v1/*` → backend).

## Auth Flow

1. **Sign-up** — Email + password + **currency selector**
   - Currency chosen at signup, cannot be changed
   - API call: `register(email, password, currency)`

2. **Settings** — Shows currency as read-only
   - Displays user's immutable currency
   - Cannot be edited in UI or via API

3. **Session Management** — HttpOnly cookies, 7-day expiry
   - Auto-redirects to sign-in on 401 UNAUTHORIZED

## Styling

- **CSS Variables** — Colors defined in `app/globals.css`
- **Tailwind Config** — Maps Pothos colors to Tailwind classes
- **Design System** — All UI components follow the card + input pattern
- **Responsive** — Mobile-first, grid adapts at breakpoints

Example color palette:
- `bg`, `bg-2`, `bg-3` — background shades
- `fg`, `fg-muted` — foreground/text
- `primary`, `primary-hover` — brand color
- `expense`, `expense-light` — expense indicator
- `border` — card/input borders

## Modals & Forms

**Modal Component** (`components/ui/Modal.tsx`):
- Overlay-based (not next/dialog)
- Accepts title, children, open state, close handler
- Reused for add/edit across all pages

**Form Pattern**:
```javascript
const [form, setForm] = useState({ fieldName: '' })

<input
  value={form.fieldName}
  onChange={(e) => setForm(f => ({ ...f, fieldName: e.target.value }))}
  className={inputCls}
/>
```

Consistent input styling via `inputCls` variable.

## Pagination

Transactions page implements pagination:
- Backend returns `data`, `pagination: { page, limit, total, totalPages }`
- UI shows "Page X of Y · Z total"
- Prev/Next buttons disabled at boundaries
- Page resets to 1 when filters change

## Data Fetching

All data fetching happens in `useEffect`:
- No React Query / SWR (simple enough for v1)
- Manual loading/error states
- Redirects to sign-in on 401
- Promise.all for parallel requests

Example:
```javascript
useEffect(() => {
  Promise.all([api.accounts.list(), api.categories.list()])
    .then(([accs, cats]) => { setAccounts(accs); setCategories(cats) })
    .catch((err) => { if (err.message === 'UNAUTHORIZED') router.push('/sign-in') })
    .finally(() => setLoading(false))
}, [dependencies])
```
