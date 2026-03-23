#!/bin/bash
# Database backup script
# Usage: ./scripts/backup.sh

set -e

PROJECT_NAME="{{PROJECT_NAME}}"
BACKUP_DIR="{{BACKUP_PATH:-/backups}}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${PROJECT_NAME}_${TIMESTAMP}.sql.gz"

echo "Creating backup: ${BACKUP_FILE}"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Run pg_dump and compress
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U {{POSTGRES_USER}} {{POSTGRES_DB}} | gzip > ${BACKUP_FILE}

echo "Backup created successfully!"

# Clean up old backups (keep last {{BACKUP_RETENTION_DAYS:-7}} days)
find ${BACKUP_DIR} -name "${PROJECT_NAME}_*.sql.gz" -mtime +{{BACKUP_RETENTION_DAYS:-7}} -delete
echo "Old backups cleaned up."
