# Build-Infr - Template Variables Reference

Complete reference for all template variables used in infrastructure generation.

---

## Variable Naming Convention

Variables follow these naming conventions for optimal LLM comprehension:

1. **SCREAMING_SNAKE_CASE**: All variables use uppercase with underscores
2. **Descriptive names**: No abbreviations unless universally known (API, DB, SSL)
3. **Grouped prefixes**: Related variables share prefixes (POSTGRES_*, REDIS_*, etc.)
4. **Suffixes for clarity**: *_PORT, *_VERSION, *_PATH, *_URL

---

## Global Variables

### Project Identity

| Variable | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `{{PROJECT_NAME}}` | string | Yes | Project identifier (slug format) | `my-api` |
| `{{PROJECT_NAME_SLUG}}` | string | Auto | URL-safe project name | `my-api` |
| `{{PROJECT_DESCRIPTION}}` | string | No | Brief project description | `My FastAPI Application` |
| `{{PROJECT_AUTHOR}}` | string | No | Author/organization name | `My Company` |

### Domain Configuration

| Variable | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `{{DOMAIN}}` | string | Conditional | Production domain | `api.example.com` |
| `{{DOMAIN_STAGING}}` | string | Auto | Staging subdomain | `staging.api.example.com` |
| `{{DOMAIN_LOCAL}}` | string | Auto | Local development domain | `localhost` |

**Conditional**: Required if `stack.hasGithub` or `stack.hasDomain`

### Ports

| Variable | Type | Default | Description | Used In |
|----------|------|---------|-------------|---------|
| `{{API_PORT}}` | integer | `8000` | FastAPI port | Dockerfile, compose |
| `{{FRONTEND_PORT}}` | integer | `3000` | Frontend port | Dockerfile, compose |
| `{{NGINX_HTTP_PORT}}` | integer | `80` | Nginx HTTP port | nginx.conf |
| `{{NGINX_HTTPS_PORT}}` | integer | `443` | Nginx HTTPS port | nginx.conf |

---

## Python Variables

### Runtime

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{PYTHON_VERSION}}` | string | Detected | Python version | `3.12` |
| `{{PYTHON_VERSION_SHORT}}` | string | Auto | Python version (short) | `3.12` → `3.12` |
| `{{PIP_VERSION}}` | string | Default | Pip version | `latest` |

### Application

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{APP_ENTRY}}` | string | Detected | FastAPI app import path | `app.main:app` |
| `{{APP_MODULE}}` | string | Auto | App module (without :app) | `app.main` |
| `{{APP_INSTANCE}}` | string | Auto | App instance name | `app` |
| `{{WORK_DIR}}` | string | Default | Working directory in container | `/app` |

### Worker (Celery)

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{CELERY_APP}}` | string | Detected | Celery app import path | `app.celery_app` |
| `{{CELERY_QUEUE}}` | string | Default | Default queue name | `default` |
| `{{WORKER_CONCURRENCY}}` | integer | Default | Worker processes | `4` |
| `{{WORKER_LOG_LEVEL}}` | string | Default | Worker log level | `INFO` |

---

## Database Variables

### PostgreSQL

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{POSTGRES_VERSION}}` | string | Default | PostgreSQL version | `16` |
| `{{POSTGRES_USER}}` | string | Default | Database user | `postgres` |
| `{{POSTGRES_PASSWORD}}` | string | Generated | Database password | `<random>` |
| `{{POSTGRES_DB}}` | string | Auto | Database name | `{{PROJECT_NAME}}` |
| `{{POSTGRES_PORT}}` | integer | Default | Database port | `5432` |
| `{{POSTGRES_HOST}}` | string | Default | Database host | `postgres` |
| `{{DATABASE_URL}}` | string | Auto | Full database URL | `postgresql://...` |

### Redis

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{REDIS_VERSION}}` | string | Default | Redis version | `7` |
| `{{REDIS_PORT}}` | integer | Default | Redis port | `6379` |
| `{{REDIS_HOST}}` | string | Default | Redis host | `redis` |
| `{{REDIS_PASSWORD}}` | string | Generated | Redis password | `<random>` |
| `{{REDIS_URL}}` | string | Auto | Full Redis URL | `redis://...` |

---

## Frontend Variables (Astro)

### Runtime

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{NODE_VERSION}}` | string | Default | Node.js version | `20` |
| `{{ASTRO_MODE}}` | string | Detected | SSR or SSG | `ssr` |
| `{{ASTRO_OUTPUT}}` | string | Auto | Output mode for Astro | `server` or `static` |

### Build

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{BUILD_COMMAND}}` | string | Default | Build command | `npm run build` |
| `{{DEV_COMMAND}}` | string | Default | Dev command | `npm run dev` |
| `{{OUTPUT_DIR}}` | string | Default | Build output directory | `dist` |

---

## Infrastructure Variables

### Docker

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{DOCKER_REGISTRY}}` | string | Default | Docker registry | `""` (Docker Hub) |
| `{{IMAGE_PREFIX}}` | string | Auto | Image name prefix | `{{PROJECT_NAME}}` |
| `{{COMPOSE_PROJECT_NAME}}` | string | Auto | Compose project name | `{{PROJECT_NAME}}` |

### Volumes

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{POSTGRES_VOLUME}}` | string | Default | Postgres volume name | `postgres_data` |
| `{{REDIS_VOLUME}}` | string | Default | Redis volume name | `redis_data` |
| `{{BACKUPS_VOLUME}}` | string | Default | Backups volume name | `backups_data` |

### Networks

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{NETWORK_NAME}}` | string | Auto | Docker network name | `{{PROJECT_NAME}}_network` |
| `{{NETWORK_DRIVER}}` | string | Default | Network driver | `bridge` |

---

## Deployment Variables

### DigitalOcean

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{DROPLET_HOST}}` | string | User input | Droplet IP or domain | `123.45.67.89` |
| `{{DROPLET_USER}}` | string | Default | SSH user | `root` |
| `{{DROPLET_SIZE}}` | string | Default | Droplet size slug | `s-2vcpu-2gb` |
| `{{DROPLET_REGION}}` | string | Default | DO region | `nyc1` |

### SSH

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{SSH_KEY_PATH}}` | string | Default | SSH key path | `~/.ssh/id_rsa` |
| `{{SSH_PORT}}` | integer | Default | SSH port | `22` |

---

## Backup Variables

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{BACKUP_ENABLED}}` | boolean | User input | Enable backups | `true` |
| `{{BACKUP_SERVER}}` | string | User input | Backup server host | `backup.example.com` |
| `{{BACKUP_USER}}` | string | Default | Backup server user | `backup` |
| `{{BACKUP_PATH}}` | string | Default | Backup storage path | `/backups/{{PROJECT_NAME}}` |
| `{{BACKUP_RETENTION_DAYS}}` | integer | Default | Days to keep backups | `7` |
| `{{BACKUP_SCHEDULE}}` | string | Default | Cron schedule | `0 2 * * *` (daily at 2 AM) |

---

## SSL/Certbot Variables

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{CERTBOT_EMAIL}}` | string | User input | Email for Let's Encrypt | `admin@{{DOMAIN}}` |
| `{{CERTBOT_STAGING}}` | string | Auto | Use staging CA | `--test-cert` for staging |
| `{{SSL_CERT_PATH}}` | string | Default | SSL certificate path | `/etc/letsencrypt/live/{{DOMAIN}}` |

---

## CI/CD Variables

### GitHub Actions

| Variable | Type | Source | Description | Example |
|----------|------|--------|-------------|---------|
| `{{GITHUB_REPO}}` | string | Detected | Repository name | `user/repo` |
| `{{GITHUB_BRANCH_STAGING}}` | string | Default | Staging branch | `testing` |
| `{{GITHUB_BRANCH_PROD}}` | string | Default | Production branch | `main` |
| `{{GITHUB_NODE_VERSION}}` | string | Default | Node version for CI | `20` |
| `{{GITHUB_PYTHON_VERSION}}` | string | Auto | Python version for CI | `{{PYTHON_VERSION}}` |

### Secrets (referenced, not generated)

| Variable | Type | Description |
|----------|------|-------------|
| `${{ secrets.DROPLET_SSH_KEY }}` | secret | Private SSH key for droplet |
| `${{ secrets.DROPLET_HOST }}` | secret | Droplet IP address |
| `${{ secrets.BACKUP_SERVER_KEY }}` | secret | SSH key for backup server |

---

## Environment Variables

### Generated for .env files

| Variable | Used In | Template File |
|----------|---------|---------------|
| `{{PROJECT_NAME}}` | All | .env.example, .env.production.template |
| `{{DATABASE_URL}}` | API, Worker | .env.example, .env.production.template |
| `{{REDIS_URL}}` | API, Worker | .env.example, .env.production.template |
| `{{API_PORT}}` | All | .env.example |
| `{{FRONTEND_PORT}}` | Frontend | .env.example |
| `{{DOMAIN}}` | All | .env.production.template |
| `{{SECRET_KEY}}` | API | .env.example (placeholder) |
| `{{JWT_SECRET}}` | API | .env.example (placeholder) |

### Secrets (placeholder in templates)

These are marked with `<SET_VALUE>` placeholder:

- `SECRET_KEY` - Application secret
- `JWT_SECRET` - JWT signing secret
- `POSTGRES_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password
- `API_KEY` - External API keys

---

## Variable Derivation Rules

### Auto-derived Variables

```typescript
// From PROJECT_NAME
PROJECT_NAME_SLUG = slugify(PROJECT_NAME)  // "My API!" → "my-api"
IMAGE_PREFIX = PROJECT_NAME_SLUG
COMPOSE_PROJECT_NAME = PROJECT_NAME_SLUG
POSTGRES_DB = PROJECT_NAME_SLUG
NETWORK_NAME = `${PROJECT_NAME_SLUG}_network`

// From DOMAIN
DOMAIN_STAGING = `staging.${DOMAIN}`
DOMAIN_LOCAL = "localhost"
SSL_CERT_PATH = `/etc/letsencrypt/live/${DOMAIN}`
CERTBOT_EMAIL = `admin@${DOMAIN}`

// From APP_ENTRY (e.g., "app.main:app")
APP_MODULE = APP_ENTRY.split(":")[0]  // "app.main"
APP_INSTANCE = APP_ENTRY.split(":")[1]  // "app"

// From DATABASE_URL components
DATABASE_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`
REDIS_URL = `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`
```

---

## Conditional Template Blocks

### Syntax

```
{{#if CONDITION}}
Content only if CONDITION is true
{{/if}}

{{#if_equals VARIABLE "value"}}
Content only if VARIABLE equals "value"
{{/if_equals}}
```

### Examples

**Conditional backup section in docker-compose:**
```yaml
{{#if BACKUP_ENABLED}}
  backup:
    build:
      context: .
      dockerfile: Dockerfile.backup
    volumes:
      - {{BACKUPS_VOLUME}}:/backups
      - postgres_data:/var/lib/postgresql/data:ro
    environment:
      - BACKUP_PATH={{BACKUP_PATH}}
      - BACKUP_RETENTION_DAYS={{BACKUP_RETENTION_DAYS}}
{{/if}}
```

**SSR vs SSG in Dockerfile:**
```dockerfile
{{#if_equals ASTRO_MODE "ssr"}}
EXPOSE {{FRONTEND_PORT}}
CMD ["node", "dist/server/entry.mjs"]
{{/if_equals}}

{{#if_equals ASTRO_MODE "ssg"}}
CMD ["nginx", "-g", "daemon off;"]
{{/if_equals}}
```

---

## Template Validation

### Required Variables Check

Before rendering any template, validate:

```typescript
function validateTemplate(templatePath: string, vars: Record<string, any>): string[] {
  const content = fs.readFileSync(templatePath, 'utf-8');
  const missing: string[] = [];
  
  // Find all {{VARIABLE}} patterns
  const varPattern = /\{\{([A-Z_]+)\}\}/g;
  let match;
  while ((match = varPattern.exec(content)) !== null) {
    const varName = match[1];
    if (!(varName in vars) || vars[varName] === undefined) {
      missing.push(varName);
    }
  }
  
  return missing;
}
```

### Error on Missing Variables

If required variables are missing:
1. Stop template rendering
2. Report missing variables to orchestrator
3. Orchestrator asks user or uses defaults
4. Retry rendering

---

## Usage in Templates

### Dockerfile Example

```dockerfile
# templates/infra/docker/Dockerfile.fastapi

FROM python:{{PYTHON_VERSION}}-slim AS base

WORKDIR {{WORK_DIR}}

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:{{API_PORT}}/health || exit 1

# Run application
CMD ["uvicorn", "{{APP_ENTRY}}", "--host", "0.0.0.0", "--port", "{{API_PORT}}"]
```

### docker-compose Example

```yaml
# templates/infra/compose/docker-compose.dev.yml

version: "3.8"

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "{{API_PORT}}:{{API_PORT}}"
    environment:
      - DATABASE_URL={{DATABASE_URL}}
      - REDIS_URL={{REDIS_URL}}
    depends_on:
      - postgres
      - redis
    volumes:
      - .:{{WORK_DIR}}

{{#if_equals ASTRO_MODE "ssr"}}
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "{{FRONTEND_PORT}}:{{FRONTEND_PORT}}"
    environment:
      - API_URL=http://api:{{API_PORT}}
    depends_on:
      - api
{{/if_equals}}

  postgres:
    image: postgres:{{POSTGRES_VERSION}}
    ports:
      - "{{POSTGRES_PORT}}:{{POSTGRES_PORT}}"
    environment:
      - POSTGRES_USER={{POSTGRES_USER}}
      - POSTGRES_PASSWORD={{POSTGRES_PASSWORD}}
      - POSTGRES_DB={{POSTGRES_DB}}
    volumes:
      - {{POSTGRES_VOLUME}}:/var/lib/postgresql/data

  redis:
    image: redis:{{REDIS_VERSION}}
    ports:
      - "{{REDIS_PORT}}:{{REDIS_PORT}}"
    command: redis-server --requirepass {{REDIS_PASSWORD}}
    volumes:
      - {{REDIS_VOLUME}}:/data

volumes:
  {{POSTGRES_VOLUME}}:
  {{REDIS_VOLUME}}:

networks:
  default:
    name: {{NETWORK_NAME}}
```
