# Architecture

## Summary

Pothos is a self-hostable, open-source budget and expense tracking app. The architecture is split into three concerns: the core product on AWS, an optional local setup for power users, and a pluggable MCP layer for agent-based interaction.

### AWS (Core Product)

The frontend (React / Next.js) is deployed on the same AWS instance as the backend and served via Docker. It talks to a Backend API which is the single source of truth — all business logic, budget calculations, and orchestration live here. The backend connects to a SQLite database via Drizzle ORM and handles email integrations directly, maintaining a cursor per user per provider to avoid re-parsing already processed messages. When parsing is needed, the backend runs a fallback chain: cloud LLM first, then an external model via user-supplied API key, then regex. If all parsers fail, the raw message is pushed to a Pending Queue for later processing.

### User's Home PC (Optional)

Users who want to run a local LLM can install the MCP server on their own machine. The MCP server is a thin tool-exposure layer — it has no business logic of its own and calls the backend API for everything. It also includes a `parse_pending` tool which polls the backend's Pending Queue, runs unparsed items through a local LLM (via Ollama), and sends the structured results back. The home PC only makes outbound HTTPS calls to the backend — no inbound connections or tunnels required.

### MCP Clients (Pluggable)

Any MCP-compatible client — OpenClaw, Cline, Claude Desktop, or others — can connect to the MCP server and interact with the user's finances via natural language. When queried for balances, the MCP returns a per-account breakdown and a net worth total. The backend handles all deterministic logic (budget checks, transaction math, balance calculations) and returns structured responses; the LLM handles narration only.

## Key Principles

- The backend is the single hub. Everything flows through it.
- MCP is additive. The core product works without it.
- The LLM never does math. It only narrates structured responses from the backend.
- Parsers are bring-your-own. The backend doesn't care how data was extracted, only that it conforms to the expected schema.
- Local LLMs are supported via a poll-based queue. No always-on connectivity required.
- Transfers between accounts are represented as linked transaction pairs to avoid double-counting in reports.

## Auth

- Email + password authentication with server-side sessions stored in SQLite.
- Sessions are stored as HttpOnly cookies and expire after 7 days.
- All sessions for a user are invalidated on password change.
- Passwords are hashed with bcrypt (12 salt rounds).
- Timing attack prevention on login via constant-time bcrypt comparison.
- Protected routes use the `authenticate` preHandler middleware.

## Security

- **Rate limiting**: 1 request per 10 seconds on auth routes (`/api/v1/auth/*`) to prevent brute-force attacks.
- **Request limits**: 1 MB max body size to prevent DoS via large uploads.
- **Health checks**: All services report health. Database connectivity verified on every health check. Nginx waits for backend & frontend to be healthy before starting.
- **Secrets management**: All secrets (SESSION_SECRET, API keys) externalized via `.env`. Fails fast if secrets are missing.
- **SSL/TLS**: Let's Encrypt via Certbot. Auto-renewal every 12 hours. HTTP redirects to HTTPS.

## Deployment

- **Docker**: Multi-stage builds for optimized images. All services managed via `docker-compose.yml`.
- **Startup**: Proper health checks ensure services start in correct order. Nginx only starts after backend & frontend are healthy.
- **Backups**: Automated daily backups of SQLite database to local filesystem. Keeps last 7 days.
- **Scripts**: Two simple deployment scripts:
  - `scripts/setup.sh` — First deploy (interactive, generates secrets, bootstraps SSL, starts app)
  - `scripts/deploy.sh` — Subsequent deploys (git pull, rebuild, restart)

## Frontend Architecture

The frontend (Next.js + React) fetches data from the backend API and displays it. All amounts are stored as integers in minor units (paise/cents) and converted for display via `formatCurrency()`.

**Currency Handling:**
- Users select a currency (ISO 4217 code) during signup
- Currency is immutable after account creation (prevents data corruption)
- `CurrencyProvider` context fetches and provides the user's currency to all components
- `useCurrencyFormatter()` hook returns a formatter that uses the user's currency
- All pages use this hook instead of hardcoding 'INR'

**Decimal Amounts:**
- Form inputs accept decimals (e.g., "100.50")
- On submit, multiply by 100 before sending to backend (100.50 → 10050)
- On display, divide by 100 and format with 2 decimal places (10050 → "₹100.50")
- `Intl.NumberFormat` handles locale-specific symbols and grouping

## Further Reading

- [Database Schema](.claude/knowledge/DATABASE.md)
- [Decision Log](.claude/knowledge/DECISIONS.md)
- [Conventions](.claude/knowledge/CONVENTIONS.md)
- [Frontend Architecture](.claude/knowledge/FRONTEND.md)
