# Deployment

Self-hosted on AWS t2.micro with Docker Compose.

## Quick Start

1. **Install Docker** (on your instance):
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose
```

2. **First deploy**:
```bash
git clone <repo> && cd pothos
chmod +x scripts/setup.sh && ./scripts/setup.sh
```
Prompts for domain and email. Generates secrets, bootstraps SSL, starts app.

3. **Subsequent deploys**:
```bash
git pull && ./scripts/deploy.sh
```

## What's Included

- **Fastify backend** — API, auth, database
- **Next.js frontend** — Dashboard, transactions, budgets, reports
- **Nginx** — Reverse proxy, HTTP→HTTPS redirect
- **SQLite** — Single-file database, persistent volume
- **Let's Encrypt** — Free SSL, auto-renewal every 12 hours
- **Health checks** — All services verify connectivity before starting
- **Rate limiting** — 1 req/10s on auth routes (brute-force protection)
- **Daily backups** — Via cron to `/opt/pothos/backups/` (7-day retention)

## Verify Deployment

```bash
# Health check
curl https://your-domain.com/api/v1/health
# {"status":"ok","database":"connected",...}

# Check container status
docker-compose ps

# View logs
docker-compose logs -f backend
```

## Maintenance

**Daily**: Nothing (backups run automatically at 2 AM)

**Weekly**: `ls /opt/pothos/backups/` (verify 7 backups exist)

**Code updates**: `git pull && ./scripts/deploy.sh` (zero downtime)

**Disaster recovery**: See `scripts/backup.sh` for restore instructions

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Health check fails | `docker-compose logs backend` (check DATABASE errors) |
| Containers won't start | `docker-compose logs` (read error messages) |
| Port in use | `sudo lsof -i :80` or `sudo lsof -i :443` |
| Database locked | `docker-compose restart backend` |
| SSL issues | `docker-compose logs certbot` |

See `scripts/backup.sh` for backup/restore procedures.
