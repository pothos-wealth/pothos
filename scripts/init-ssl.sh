#!/bin/bash
set -e

DOMAIN="pothos.test.com"
EMAIL="your-email@example.com"

echo "Starting initial Nginx with HTTP only..."
cp nginx/nginx.init.conf nginx/nginx.conf.bak
docker compose up -d nginx

echo "Obtaining SSL certificate..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

echo "Switching to full HTTPS config..."
cp nginx/nginx.conf.bak nginx/nginx.conf

echo "Reloading Nginx..."
docker compose exec nginx nginx -s reload

echo "SSL setup complete."
