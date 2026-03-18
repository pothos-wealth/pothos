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

The setup script prompts for your domain and email, generates a `SESSION_SECRET`, bootstraps SSL via Let's Encrypt, and starts all services.

## Subsequent Deploys

```bash
git pull
./scripts/deploy.sh
```

## Environment Variables

| Variable           | Description                                 |
| ------------------ | ------------------------------------------- |
| `SESSION_SECRET`   | 32-byte random hex (auto-generated)         |
| `SESSION_TTL_DAYS` | Session lifetime in days (default: 7)       |
| `NODE_ENV`         | `production`                                |
| `DATABASE_URL`     | Path to SQLite file (`/app/data/pothos.db`) |
| `DOMAIN`           | Your domain (e.g. `pothos.example.com`)     |
| `EMAIL`            | For Let's Encrypt renewal notifications     |
| `LLM_API_KEY`      | Optional — for cloud LLM email parsing      |

## Low-RAM Instances

On 512 MB instances, add swap to prevent out-of-memory kills during Docker builds:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Troubleshooting

**Build fails / out of memory** — Add swap (see above) or upgrade to 1 GB+ RAM.

**SSL errors** — Verify DNS points to your server IP (`dig yourdomain.com`), then check certbot logs: `docker logs pothos-certbot-1`.

**Service not starting** — Check logs: `docker logs backend` or `docker logs frontend`. Ensure `.env` exists with all required variables.

## Backups

Automated daily backups run at 2 AM and are saved locally for 7 days. To trigger manually:

```bash
./scripts/backup.sh
```
