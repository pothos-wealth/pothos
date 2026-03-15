# Known Bugs

Bugs that have been identified but not yet fixed. Remove entries once resolved.

---

## UI / Mobile

### [BUG-001] Form inputs cause auto-zoom on iOS Safari
**Pages affected:** All pages with forms (accounts, transactions, budgets, categories, sign-up, sign-in, settings)
**Severity:** Medium
**Description:** iOS Safari automatically zooms in when a form input is focused if its `font-size` is below 16px. All form inputs currently use `text-sm` (14px in Tailwind), triggering this on every tap. The user has to manually pinch-zoom out after submitting.
**Fix:** Change all form `<input>`, `<select>`, and `<textarea>` elements from `text-sm` to `text-base` (16px). The visual difference is minimal but prevents the browser zoom.

### [BUG-002] Large currency values overflow stat cards on mobile
**Pages affected:** Dashboard
**Severity:** Low
**Description:** On mobile with a 2-column stat card grid, very large currency values (e.g. ₹10,00,00,000.00) can still overflow the card even after the `text-lg sm:text-2xl` fix, depending on the currency and number of digits.
**Fix:** Consider switching to a 1-column layout on the smallest screens (`grid-cols-1 xs:grid-cols-2`) or implementing dynamic font scaling.

---

## Backend

*(none)*

---

## Data / Logic

*(none)*
