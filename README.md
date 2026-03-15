# Pothos

A self-hostable, open-source budget and expense tracking app for individuals and families.

**Live instance:** [pothos.bryanronad.com](https://pothos.bryanronad.com)

## Features

- Manual transaction entry with decimal precision
- Multiple accounts with transfer support
- Monthly budgets per category with progress tracking
- Dashboard with spending overview and trends
- Category breakdown charts and reports
- Gmail ingestion (auto-parse expenses from emails) *(coming soon)*
- MCP server for agent-based interaction (Claude Desktop, Cline, etc.) *(coming soon)*

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

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full guide.

### Quick Start (First Deploy)

```bash
git clone https://github.com/your-username/pothos.git
cd pothos
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This handles:
- Environment configuration (generates `SESSION_SECRET` automatically)
- Nginx configuration (updates domain)
- SSL certificate bootstrap (Let's Encrypt)
- Container startup

### Subsequent Deploys

```bash
git pull
./scripts/deploy.sh
```

### Requirements

- AWS Lightsail or any Ubuntu/Debian VPS
- 1 GB RAM minimum (512 MB works with swap)
- Domain pointed at instance IP
- Ports 80 and 443 open
- Docker & Docker Compose installed

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) for details.

Any modified version of Pothos that is run as a network service must also be
made available under the AGPL v3.
