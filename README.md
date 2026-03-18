# Pothos

A self-hostable, open-source budget and expense tracking app.

**Live instance:** [pothos.bryanronad.com](https://pothos.bryanronad.com)

## Features

- Manual transaction entry with decimal precision
- Multiple accounts with transfer support
- Monthly budgets per category with progress tracking
- Dashboard with spending overview and trends
- Gmail ingestion *(coming soon)*
- MCP server for agent-based interaction *(coming soon)*

## Stack

| Layer    | Tech                                   |
| -------- | -------------------------------------- |
| Backend  | Fastify, TypeScript, SQLite            |
| Frontend | Next.js, Tailwind CSS, shadcn/ui       |
| Auth     | Email + password, server-side sessions |

## Local Development

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run migrations and seed
cd backend && npm run db:migrate && npm run db:seed

# Start dev servers
cd backend && npm run dev   # http://localhost:3001
cd frontend && npm run dev  # http://localhost:3000
```

Copy `.env.example` to `.env` and fill in your values before starting.

## Production Deployment

```bash
git clone https://github.com/your-username/pothos.git
cd pothos && chmod +x scripts/setup.sh && ./scripts/setup.sh
```

For subsequent deploys: `git pull && ./scripts/deploy.sh`

Requires a Linux VPS with Docker, Docker Compose, and ports 80/443 open. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full guide.

## License

[AGPL v3](LICENSE) — modified versions run as a network service must also be open-sourced.
