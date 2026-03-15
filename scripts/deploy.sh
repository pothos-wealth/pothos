#!/bin/bash
# Redeploy after code changes

set -e

DOMAIN=$(grep "^DOMAIN=" .env | cut -d'=' -f2)

echo "Pulling latest changes..."
git pull

echo "Pulling latest images..."
docker-compose pull backend frontend

echo "Restarting services..."
docker-compose up -d

echo "✓ Deployed to https://$DOMAIN"
