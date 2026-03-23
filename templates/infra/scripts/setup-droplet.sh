#!/bin/bash
# First-time server setup script for DigitalOcean
# Usage: ./scripts/setup-droplet.sh

set -e

DOMAIN="{{DOMAIN}}"
EMAIL="{{SSL_EMAIL}}"

echo "Setting up droplet for ${DOMAIN}..."

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Setup firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

# Create app directory
mkdir -p /var/www/{{PROJECT_NAME}}
cd /var/www/{{PROJECT_NAME}}

# Clone repository
git clone https://github.com/{{GITHUB_REPO}}.git .

# Setup SSL certificates
certbot certonly --nginx -d ${DOMAIN} -d www.${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email

# Setup SSL renewal cron
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# Copy environment file
cp .env.production.template .env.production

echo "Droplet setup complete!"
echo "Next steps:"
echo "1. Edit .env.production with your values"
echo "2. Run ./scripts/deploy.sh production"
