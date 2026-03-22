# Deployment Guide

## Requirements

- Ubuntu 22.04+ VPS (1 GB RAM recommended, 512 MB + swap works)
- Docker & Docker Compose installed
- Domain pointed at your server IP
- Ports 80 and 443 open

## First Deploy

```bash
git clone https://github.com/your-username/pothos.git
cd pothos
bash scripts/setup.sh
```

The setup script prompts for your domain and email, generates `SESSION_SECRET` and `ENCRYPTION_KEY`, updates the Nginx config, bootstraps SSL via Let's Encrypt, and starts all services.

## Subsequent Deploys

```bash
bash scripts/deploy.sh
```

Pulls latest code, rebuilds images, restarts services, and runs a health check.

## Environment Variables

`setup.sh` generates and writes these automatically. The full reference:

| Variable                  | Required | Description                                                       |
| ------------------------- | -------- | ----------------------------------------------------------------- |
| `SESSION_SECRET`          | Yes      | 32-byte random hex — signs session cookies (auto-generated)       |
| `ENCRYPTION_KEY`          | Yes      | 32-byte random hex — encrypts IMAP passwords and LLM keys at rest (auto-generated) |
| `DOMAIN`                  | Yes      | Your domain, e.g. `pothos.example.com`                            |
| `EMAIL`                   | Yes      | Email for Let's Encrypt renewal notifications                     |
| `DATABASE_URL`            | Yes      | Path to SQLite file (default: `/app/data/pothos.db`)              |
| `NODE_ENV`                | Yes      | Set to `production`                                               |
| `PORT`                    | Yes      | Backend port (default: `3001`)                                    |
| `NEXT_PUBLIC_API_URL`     | Yes      | Full URL of your domain, e.g. `https://pothos.example.com`        |
| `SESSION_TTL_DAYS`        | No       | Session lifetime in days (default: `7`)                           |
| `SUPERADMIN_EMAIL`        | No       | Email of the user to promote to superadmin on startup. User must exist first — sign up, set this, then restart. |
| `REGISTRATION_CODE`       | No       | Invite code required to register. Leave empty for open registration. Visible with copy button in the admin panel. |
| `RATE_LIMIT_GLOBAL_MAX`   | No       | Max requests per minute globally (default: `100`)                 |
| `RATE_LIMIT_REGISTER_MAX` | No       | Max registration attempts per minute (default: `5`)               |
| `RATE_LIMIT_LOGIN_MAX`    | No       | Max login attempts per minute (default: `10`)                     |
| `IMAP_POLL_CRON`          | No       | Cron schedule for email polling (default: `*/15 * * * *`)         |
| `IMAP_POLL_CONCURRENCY`   | No       | Max simultaneous IMAP connections per poll cycle (default: `10`)  |
| `MAINTENANCE_CRON`        | No       | Cron schedule for maintenance tasks (default: `0 3 * * *`)        |

## Superadmin Setup

The superadmin role is configured via `SUPERADMIN_EMAIL` in `.env`. The user must already exist before setting this.

1. Deploy and open your app — sign up for an account.
2. Add `SUPERADMIN_EMAIL=your@email.com` to `.env`.
3. Restart the backend: `docker-compose restart backend`.
4. The backend promotes your account on startup. Access the admin panel at `/admin`.

This process is idempotent — safe to restart repeatedly.

## Restricting Registration

By default, anyone can sign up. To require an invite code:

1. Add `REGISTRATION_CODE=your-secret-code` to `.env`.
2. Restart: `docker-compose restart backend`.
3. The sign-up page will show an invite code field. The superadmin panel displays the current code with a copy button.

To re-open registration, remove `REGISTRATION_CODE` from `.env` and restart.

## MCP Server (Optional)

The MCP server lets users interact with their finances via Claude Desktop, Cline, or any MCP-compatible client. It runs on the user's own machine — no server changes needed.

**User setup:**

1. Go to **Settings → API Keys** in the app and generate a key.
2. Install the MCP:

```bash
npx @pothos-wealth/mcp
```

3. Create a `.env` file alongside the MCP:

```env
POTHOS_URL=https://pothos.example.com
POTHOS_API_KEY=pth_...
```

4. Configure your MCP client (Claude Desktop, Cline, etc.) to run the MCP server. Refer to the [MCP README](mcp/README.md) for client-specific setup.

## Low-RAM Instances

On 512 MB instances, add swap to prevent out-of-memory kills during Docker builds:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Backups

The database is backed up automatically daily at 2 AM. Backups are kept for 7 days at `/opt/pothos/backups/`.

To trigger a backup manually:

```bash
bash scripts/backup.sh
```

## Troubleshooting

**Build fails / out of memory** — Add swap (see above) or upgrade to 1 GB+ RAM.

**SSL errors** — Verify DNS points to your server IP (`dig yourdomain.com`). Check certbot logs: `docker logs pothos-certbot-1`.

**Service not starting** — Check logs:

```bash
docker-compose logs backend
docker-compose logs frontend
docker-compose logs worker
```

Ensure `.env` exists and contains `SESSION_SECRET`, `ENCRYPTION_KEY`, `DOMAIN`, and `EMAIL`.

**Worker not processing emails** — The `worker` service runs the IMAP poller separately from the API. If emails aren't being picked up, check `docker-compose logs worker`. IMAP credentials are configured per-user in **Settings → Email Integration**.

**API key auth not working** — Keys are shown once at creation. If lost, revoke it in **Settings → API Keys** and generate a new one.
