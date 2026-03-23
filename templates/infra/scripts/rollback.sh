#!/bin/bash
# Rollback script
# Usage: ./scripts/rollback.sh [staging|production]

set -e

ENVIRONMENT="${1:-production}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
PROJECT_NAME="{{PROJECT_NAME}}"

echo "Rolling back ${PROJECT_NAME} in ${ENVIRONMENT}..."

# Get previous commit
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)

echo "Rolling back to commit: ${PREVIOUS_COMMIT}"

# Checkout previous commit
git checkout ${PREVIOUS_COMMIT}

# Rebuild and restart
docker-compose -f ${COMPOSE_FILE} down
docker-compose -f ${COMPOSE_FILE} build --no-cache
docker-compose -f ${COMPOSE_FILE} up -d

# Wait for services
echo "Waiting for services to start..."
sleep 15

# Run health checks
./scripts/health-check.sh

# Go back to main branch
git checkout main

echo "Rollback complete!"
