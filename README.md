# Pothos

A self-hostable, open-source budget and expense tracking app for individuals and families.

## Features

- Manual transaction entry
- Budget management with categories
- Gmail ingestion (auto-parse expenses from emails)
- LLM-powered parsing with regex fallback
- MCP server for agent-based interaction (Claude Desktop, Cline, etc.)

## Stack

| Layer    | Tech                                   |
| -------- | -------------------------------------- |
| Backend  | Fastify, TypeScript                    |
| Database | SQLite via Drizzle ORM                 |
| Frontend | Next.js, Tailwind CSS, shadcn/ui       |
| Auth     | Email + password, server-side sessions |
| MCP      | @modelcontextprotocol/sdk              |

## Getting Started (Local Development)

### Prerequisites

- Node.js (v20.20.1)
- npm

### 1. Clone the repo

```bash
git clone https://github.com/your-username/pothos.git
cd pothos
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../mcp && npm install
```

### 4. Run database migrations and seed

```bash
cd backend
npm run db:migrate
npm run db:seed
```

### 5. Start the backend

```bash
cd backend
npm run dev
```

### 6. Start the frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:3001`.

## Production Deployment

```bash
cp .env.example .env
# Fill in production values

docker compose up -d
```

## MCP Server

The MCP server is independently installable. See [`mcp/README.md`](mcp/README.md) for setup instructions.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) for details.

Any modified version of Pothos that is run as a network service must also be
made available under the AGPL v3.
