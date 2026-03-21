#!/bin/bash
# Redeploy after code changes

set -e

DOMAIN=$(grep "^DOMAIN=" .env | cut -d'=' -f2)

echo "Pulling latest changes..."
git pull

echo "Pruning unused Docker resources..."
docker system prune -af

echo "Pulling latest images..."
docker-compose pull backend frontend

echo "Restarting services..."
docker-compose up -d

echo "Waiting for services to be healthy..."
sleep 10

echo "Running health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/v1/health")
if [ "$HTTP_STATUS" != "200" ]; then
    echo "✗ Health check failed (HTTP $HTTP_STATUS). Check logs: docker-compose logs"
    exit 1
fi

echo "✓ Deployed to https://$DOMAIN"
