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

## Further Reading

- [Database Schema](docs/DATABASE.md)
- [Decision Log](docs/DECISIONS.md)
- [Conventions](docs/CONVENTIONS.md)
