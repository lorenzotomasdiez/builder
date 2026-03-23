#!/bin/bash
# Deploy script for DigitalOcean
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT="${1:-production}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
PROJECT_NAME="{{PROJECT_NAME}}"

echo "Deploying ${PROJECT_NAME} to ${ENVIRONMENT}..."

# Pull latest code
git pull origin main

# Pull latest images
docker-compose -f ${COMPOSE_FILE} pull

# Stop old containers
docker-compose -f ${COMPOSE_FILE} down

# Start new containers
docker-compose -f ${COMPOSE_FILE} up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 15

# Run health checks
./scripts/health-check.sh

# Clean up old images
docker image prune -f

echo "Deployment complete!"
