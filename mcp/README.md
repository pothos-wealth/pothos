# @pothos-wealth/mcp

MCP server for [Pothos](https://github.com/pothos-wealth/pothos) — natural language access to your budgets, transactions, and finances via any MCP-compatible AI agent.

Runs on your local machine. Connects to your self-hosted Pothos instance. No inbound connections required.

---

## Prerequisites

A running Pothos instance. See the [Pothos repo](https://github.com/pothos-wealth/pothos) for self-hosting instructions.

---

## Setup

**1. Generate an API key**

In Pothos, go to **Settings → API Keys**, click **Generate Key**, give it a name (e.g. "Claude Desktop"), and copy the key. It is only shown once.

**2. Add to your MCP client config**

```json
{
  "mcpServers": {
    "pothos": {
      "command": "npx",
      "args": ["-y", "@pothos-wealth/mcp"],
      "env": {
        "POTHOS_URL": "https://pothos.yourdomain.com",
        "POTHOS_API_KEY": "pth_..."
      }
    }
  }
}
```

Config file location varies by client — refer to your agent's MCP documentation. Works with Claude Desktop, Claude Code, Cursor, GitHub Copilot, Cline, and any other MCP-compatible client.

**3. Start chatting**

- "How much have I spent on food this month?"
- "Add a $12.50 coffee expense to my checking account."
- "Am I on track with my budgets?"
- "What's my net worth across all accounts?"

---

## Available Tools

| Tool | Description |
| ---- | ----------- |
| `get_accounts` | All accounts with current balances and net worth |
| `get_transactions` | Paginated transaction list with filters |
| `get_categories` | All categories grouped by type |
| `get_budgets` | Monthly budgets with spent and remaining per category |
| `get_spending_overview` | Total income, expenses, and net for a month |
| `get_category_breakdown` | Expense breakdown by category with percentages |
| `get_spending_trends` | Monthly trends over the last N months |
| `add_transaction` | Add an income or expense transaction |
| `add_transfer` | Transfer funds between accounts |
| `get_pending_emails` | Fetch unprocessed emails for the agent to parse |
| `submit_parsed_email` | Submit a parsed result to the inbox for review |
| `dismiss_email` | Dismiss a non-transaction email |

---

## Local Email Parsing (Ollama)

If you've configured Pothos to use provider `"local"` for LLM settings, emails won't be auto-parsed in the cloud — they'll sit in the queue for the MCP agent to handle. Any MCP-compatible agent (Claude, GPT, local Ollama, etc.) can call `get_pending_emails`, parse the content, and submit results via `submit_parsed_email`.

To parse emails locally using [Ollama](https://ollama.com), clone the repo and run the standalone script:

```bash
git clone https://github.com/pothos-wealth/pothos.git
cd pothos/mcp && npm install && npm run build
```

Create a `.env` file:

```
POTHOS_URL=https://pothos.yourdomain.com
POTHOS_API_KEY=pth_...
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

Then run:

```bash
node dist/ollama-parse.js
```

This fetches pending emails, parses them locally, and submits results to your inbox for review — no cloud API key required.

---

## License

[AGPL-3.0](https://github.com/pothos-wealth/pothos/blob/main/LICENSE)
