# Pothos

A self-hostable, open-source budget and expense tracking app.

**Live instance:** [pothos.bryanronad.com](https://pothos.bryanronad.com)

## Features

- Manual transaction entry with decimal precision
- Multiple accounts with transfer support
- Monthly budgets per category with progress tracking
- Dashboard with spending overview and trends
- IMAP email ingestion with LLM parsing (bring your own API key)
- MCP server for agent-based interaction (Claude Desktop, Cline, Cursor, etc.)

## Stack

| Layer    | Tech                                   |
| -------- | -------------------------------------- |
| Backend  | Fastify, TypeScript, SQLite            |
| Frontend | Next.js, Tailwind CSS, shadcn/ui       |
| Auth     | Email + password, server-side sessions |
| Worker   | Node.js cron, IMAP poller, LLM adapter |
| MCP      | `@modelcontextprotocol/sdk`, stdio     |

## Local Development

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run migrations and seed
cd backend && npm run db:migrate && npm run db:seed

# Start dev servers (two terminals)
cd backend && npm run dev         # http://localhost:3001
cd frontend && npm run dev        # http://localhost:3000

# Optional: email poller worker (third terminal)
cd backend && npm run dev:worker
```

Copy `.env.example` to `.env` and fill in your values before starting.

## MCP Server

The Pothos MCP server runs on your local machine and connects to your deployed Pothos instance. It exposes your finances as tools to any MCP-compatible agent — ask questions in natural language, add transactions, check budgets, and more.

No inbound connections required. The MCP makes outbound HTTPS calls to your server only.

### 1. Generate an API Key

In your Pothos instance, go to **Settings → API Keys** and click **Generate Key**. Give it a name (e.g. "Claude Desktop") and copy the key — it's shown once only.

### 2. Create a config file

Create a `.env` file for the MCP (anywhere on your machine):

```env
POTHOS_URL=https://pothos.yourdomain.com
POTHOS_API_KEY=pth_...
```

### 3. Configure your MCP client

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pothos": {
      "command": "npx",
      "args": ["-y", "@pothos/mcp"],
      "env": {
        "POTHOS_URL": "https://pothos.yourdomain.com",
        "POTHOS_API_KEY": "pth_..."
      }
    }
  }
}
```

**Cline / Roo Code** — open MCP Settings and add a new server:

```json
{
  "pothos": {
    "command": "npx",
    "args": ["-y", "@pothos/mcp"],
    "env": {
      "POTHOS_URL": "https://pothos.yourdomain.com",
      "POTHOS_API_KEY": "pth_..."
    }
  }
}
```

**Cursor** — open Settings → MCP and add the same server block as above.

**Other stdio-compatible clients** — run the server directly:

```bash
POTHOS_URL=https://pothos.yourdomain.com POTHOS_API_KEY=pth_... npx @pothos/mcp
```

Or use a `.env` file and run from the directory containing it:

```bash
npx @pothos/mcp
```

### Available Tools

| Tool | Description |
|---|---|
| `get_accounts` | All accounts with current balances and net worth |
| `get_transactions` | Paginated transaction list with filters |
| `get_categories` | All categories (global defaults + custom) |
| `get_budgets` | Monthly budgets with spent/remaining per category |
| `get_spending_overview` | Total income, expenses, net for a month |
| `get_category_breakdown` | Expense breakdown by category |
| `get_spending_trends` | Monthly trends over the last N months |
| `add_transaction` | Add an income or expense transaction |
| `add_transfer` | Transfer funds between accounts |
| `get_pending_emails` | Fetch unparsed emails for the agent to interpret |
| `submit_parsed_email` | Submit an agent-interpreted email for inbox review |
| `dismiss_email` | Dismiss a non-transaction email |

## Production Deployment

```bash
git clone https://github.com/your-username/pothos.git
cd pothos && chmod +x scripts/setup.sh && ./scripts/setup.sh
```

For subsequent deploys: `git pull && ./scripts/deploy.sh`

Requires a Linux VPS with Docker, Docker Compose, and ports 80/443 open. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full guide.

## License

[AGPL v3](LICENSE) — modified versions run as a network service must also be open-sourced.
