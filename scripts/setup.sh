#!/bin/bash
# One-time setup for Pothos deployment

set -e

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "Pothos Initial Setup"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Step 1: Creating .env..."
    read -p "Domain (e.g., pothos.example.com): " DOMAIN
    read -p "Email for SSL (e.g., admin@example.com): " EMAIL

    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

    cat > .env <<EOF
SESSION_SECRET=$SESSION_SECRET
SESSION_TTL_DAYS=7
PORT=3001
NODE_ENV=production
DATABASE_URL=/app/data/pothos.db
LLM_PROVIDER=openai
LLM_API_KEY=
NEXT_PUBLIC_API_URL=https://$DOMAIN
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF
    echo "✓ .env created"
else
    DOMAIN=$(grep "^DOMAIN=" .env | cut -d'=' -f2)
    EMAIL=$(grep "^EMAIL=" .env | cut -d'=' -f2)
    echo "✓ .env already exists (Domain: $DOMAIN)"
fi

echo ""

# Step 2: Update nginx config with domain
echo "Step 2: Updating nginx configuration..."
sed -i "s/pothos\.test\.com/$DOMAIN/g" nginx/nginx.conf
echo "✓ Updated nginx for $DOMAIN"

echo ""

# Step 3: Bootstrap SSL certificate
if [ ! -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "Step 3: Bootstrapping SSL certificate..."
    mkdir -p certbot/conf certbot/www

    docker run --rm \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/certbot/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive

    echo "✓ SSL certificate obtained"
else
    echo "✓ SSL certificate already exists"
fi

echo ""
echo "Step 4: Starting application..."
docker-compose up -d
echo "✓ Application started"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "✓ Setup complete!"
echo ""
echo "Your app is running at https://$DOMAIN"
echo ""
echo "For future updates, run: docker-compose up -d --build"
echo "═══════════════════════════════════════════════════════════════════════════════"
