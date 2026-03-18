#!/bin/sh
set -e

# Fix data directory ownership if running as root (first-time volume mount)
if [ "$(id -u)" = "0" ]; then
    chown -R node:node /app/data
    exec su-exec node "$0" "$@"
fi

echo "Running migrations..."
node dist/db/migrate.js

echo "Running seed..."
node dist/db/seed.js

echo "Starting server..."
exec node dist/index.js
