#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
    chown -R node:node /app/data
    exec su-exec node "$0" "$@"
fi

echo "Starting worker..."
exec node dist/worker.js
