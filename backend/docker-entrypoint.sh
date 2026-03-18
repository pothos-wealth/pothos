#!/bin/sh
set -e

echo "Ensuring data directory is writable..."
chmod 755 /app/data

echo "Running migrations..."
node dist/db/migrate.js

echo "Running seed..."
node dist/db/seed.js

echo "Starting server..."
exec node dist/index.js
