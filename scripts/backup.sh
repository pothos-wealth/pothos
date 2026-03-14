#!/bin/bash
# Daily backup script for SQLite database
# Add to crontab: 0 2 * * * /path/to/backup.sh

set -e

BACKUP_DIR="/opt/pothos/backups"
DB_PATH="/var/lib/docker/volumes/pothos_sqlite_data/_data/pothos.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pothos-$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Copy database (Docker handles file locks)
docker cp pothos-backend-1:/app/data/pothos.db "$BACKUP_FILE" 2>/dev/null || {
    echo "Error: Failed to backup database. Is pothos-backend-1 running?"
    exit 1
}

echo "✓ Backup saved: $BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "pothos-*.db" -mtime +7 -delete

# Show backup status
echo "Recent backups:"
ls -lh "$BACKUP_DIR" | tail -5
