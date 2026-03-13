#!/bin/sh
set -e

echo "Running migrations..."
node dist/db/migrate.js

echo "Running seed..."
node dist/db/seed.js

echo "Starting server..."
exec node dist/index.js
