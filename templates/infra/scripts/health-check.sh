#!/bin/bash
# Health check script
# Usage: ./scripts/health-check.sh [dev|staging|production]

set -e

ENVIRONMENT="${1:-dev}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"

echo "Running health checks for ${ENVIRONMENT} environment..."

ERRORS=0

# Check API
echo -n "API: "
if curl -sf http://localhost:{{API_PORT}}/health > /dev/null 2>&1; then
    echo "OK"
else
    echo "FAILED"
    ERRORS=$((ERRORS + 1))
fi

# Check Frontend
echo -n "Frontend: "
if curl -sf http://localhost:{{FRONTEND_PORT}} > /dev/null 2>&1; then
    echo "OK"
else
    echo "FAILED"
    ERRORS=$((ERRORS + 1))
fi

# Check PostgreSQL
echo -n "PostgreSQL: "
if docker-compose -f ${COMPOSE_FILE} exec -T postgres pg_isready -U {{POSTGRES_USER}} -d {{POSTGRES_DB}} > /dev/null 2>&1; then
    echo "OK"
else
    echo "FAILED"
    ERRORS=$((ERRORS + 1))
fi

# Check Redis
echo -n "Redis: "
if docker-compose -f ${COMPOSE_FILE} exec -T redis redis-cli ping | grep -q "PONG" 2>&1; then
    echo "OK"
else
    echo "FAILED"
    ERRORS=$((ERRORS + 1))
fi

if [ ${ERRORS} -gt 0 ]; then
    echo "Health checks failed: ${ERRORS} errors"
    exit 1
fi

echo "All health checks passed!"
exit 0
