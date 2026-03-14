#!/bin/bash
# Redeploy after code changes

set -e

DOMAIN=$(grep "^DOMAIN=" .env | cut -d'=' -f2)

echo "Redeploying Pothos..."
docker-compose up -d --build

echo "✓ Deployed to https://$DOMAIN"
