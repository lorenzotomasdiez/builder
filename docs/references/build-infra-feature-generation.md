# Build-Infr - Feature Generation Reference

Reference document for the feature generation system.

---

## Stack Detection Matrix

### Primary Detection (File-based)

| File Pattern | Key to Find | Stack Component | Confidence |
|--------------|-------------|-----------------|------------|
| `pyproject.toml` | `fastapi` in dependencies | FastAPI API | High |
| `pyproject.toml` | `celery` in dependencies | Celery Workers | High |
| `pyproject.toml` | `django` in dependencies | Django API | High |
| `pyproject.toml` | `flask` in dependencies | Flask API | High |
| `requirements.txt` | `fastapi` | FastAPI API | High |
| `requirements.txt` | `celery` | Celery Workers | High |
| `astro.config.mjs` | `output: 'server'` | Astro SSR | High |
| `astro.config.mjs` | `output: 'static'` or no output | Astro SSG | High |
| `.git/` directory | exists | GitHub enabled | High |
| `package.json` | exists | Node.js detected | Medium |

### Secondary Detection (Code-based)

| File Pattern | Content Pattern | Detection |
|--------------|-----------------|-----------|
| `**/main.py` | `app = FastAPI()` | FastAPI entry point |
| `**/main.py` | `celery = Celery(` | Celery app |
| `**/celery.py` | `Celery(` | Celery config |
| `**/settings.py` | `DATABASES = {` | Django database |
| `alembic.ini` | exists | Alembic migrations |
| `pytest.ini` | exists | Pytest configured |
| `playwright.config.ts` | exists | E2E tests configured |

### Detection Code

```typescript
interface Stack {
  api: "fastapi" | "django" | "flask" | null;
  worker: "celery" | "rq" | null;
  database: "postgresql" | "mysql" | "sqlite" | null;
  broker: "redis" | "rabbitmq" | null;
  frontend: "astro-ssr" | "astro-ssg" | null;
  hasGithub: boolean;
  hasDomain: boolean;
  hasBackups: boolean;
}

async function detectStack(cwd: string): Promise<Stack> {
  const stack: Stack = {
    api: null,
    worker: null,
    database: null,
    broker: null,
    frontend: null,
    hasGithub: false,
    hasDomain: false,
    hasBackups: false,
  };

  // Check pyproject.toml
  const pyprojectPath = path.join(cwd, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    const content = fs.readFileSync(pyprojectPath, "utf-8");
    if (content.includes("fastapi")) stack.api = "fastapi";
    else if (content.includes("django")) stack.api = "django";
    else if (content.includes("flask")) stack.api = "flask";
    
    if (content.includes("celery")) stack.worker = "celery";
    if (content.includes("rq")) stack.worker = "rq";
    
    if (content.includes("psycopg") || content.includes("postgres")) stack.database = "postgresql";
    else if (content.includes("mysql")) stack.database = "mysql";
    
    if (content.includes("redis")) stack.broker = "redis";
    else if (content.includes("rabbitmq") || content.includes("amqp")) stack.broker = "rabbitmq";
  }

  // Check astro.config.mjs
  const astroPath = path.join(cwd, "astro.config.mjs");
  if (fs.existsSync(astroPath)) {
    const content = fs.readFileSync(astroPath, "utf-8");
    if (content.includes("output: 'server'") || content.includes('output: "server"')) {
      stack.frontend = "astro-ssr";
    } else {
      stack.frontend = "astro-ssg";
    }
  }

  // Check .git/
  stack.hasGithub = fs.existsSync(path.join(cwd, ".git"));

  // Defaults if not detected but required
  if (stack.worker === "celery" && !stack.broker) {
    stack.broker = "redis"; // Default for Celery
  }
  if (stack.api && !stack.database) {
    stack.database = "postgresql"; // Default for APIs
  }

  return stack;
}
```

---

## Feature Categories

### Category 1: Docker Files

Generated when API, Worker, or Frontend detected.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `dockerfile-api` | `stack.api` exists | `docker/Dockerfile.{{stack.api}}` |
| `dockerfile-worker` | `stack.worker` exists | `docker/Dockerfile.{{stack.worker}}` |
| `dockerfile-frontend` | `stack.frontend` exists | `docker/Dockerfile.{{stack.frontend}}` |
| `dockerfile-nginx` | Any stack | `docker/Dockerfile.nginx` |
| `dockerignore` | Any stack | `docker/.dockerignore` |

### Category 2: Docker Compose

Always generated for any stack.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `docker-compose-dev` | Any stack | `compose/docker-compose.dev.yml` |
| `docker-compose-staging` | `stack.hasGithub` | `compose/docker-compose.staging.yml` |
| `docker-compose-prod` | `stack.hasGithub` | `compose/docker-compose.prod.yml` |

### Category 3: Database

Generated when database detected.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `postgres-setup` | `stack.database === "postgresql"` | Inline (compose) |
| `postgres-volume` | `stack.database === "postgresql"` | Inline (compose) |
| `redis-setup` | `stack.broker === "redis"` | Inline (compose) |
| `redis-volume` | `stack.broker === "redis"` | Inline (compose) |
| `migrations-setup` | `stack.api === "fastapi"` | `python/alembic.ini`, `python/alembic/*` |

### Category 4: Backups

Generated when backups enabled.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `backup-script` | `stack.hasBackups` | `scripts/backup.sh` |
| `backup-cron` | `stack.hasBackups` | `scripts/backup-cron` |

### Category 5: Networking

Generated when domain specified.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `nginx-config` | `stack.hasDomain` | `nginx/nginx.{{env}}.conf` |
| `ssl-setup` | `stack.hasDomain` | `scripts/setup-ssl.sh` |
| `network-isolation` | Production compose exists | Inline (compose) |

### Category 6: Application

Always generated for any stack.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `health-endpoint-api` | `stack.api` exists | Inline (code modification) |
| `health-endpoint-worker` | `stack.worker` exists | `scripts/health-check.sh` (partial) |
| `env-management` | Any stack | `env/.env.example`, `env/.env.production.template` |
| `logging-setup` | Any stack | Inline (code modification) |

### Category 7: CI/CD

Generated when GitHub detected.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `github-ci` | `stack.hasGithub` | `github/ci.yml` |
| `github-cd-staging` | `stack.hasGithub` | `github/deploy-staging.yml` |
| `github-cd-prod` | `stack.hasGithub` | `github/deploy-prod.yml` |

### Category 8: Testing

Generated based on existing test setup.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `pytest-setup` | `stack.api` exists, no pytest.ini | `python/pytest.ini`, `python/conftest.py` |
| `test-containers` | `stack.api` exists | `python/testcontainers.py` |
| `e2e-setup` | `stack.frontend` exists | `playwright.config.ts` |

### Category 9: Deployment

Generated when GitHub detected.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `deploy-script` | `stack.hasGithub` | `scripts/deploy.sh` |
| `setup-droplet` | `stack.hasGithub` | `scripts/setup-droplet.sh` |
| `rollback-script` | `stack.hasGithub` | `scripts/rollback.sh` |

### Category 10: Monitoring

Always generated.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `health-check-script` | Any stack | `scripts/health-check.sh` |

### Category 11: Documentation

Always generated.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `readme-infra` | Any stack | Inline (append to README.md) |
| `runbook` | Any stack | `docs/runbook.md` |

### Category 12: Validation

Always generated as final step.

| Feature ID | Condition | Template |
|------------|-----------|----------|
| `stack-healthy` | Any stack | None (test-only feature) |

---

## Feature Dependency Graph

```
dockerfile-api ─────────────────┐
dockerfile-worker ─────────────┤
dockerfile-frontend ───────────┤
dockerfile-nginx ──────────────┤
                                ▼
                        docker-compose-dev
                                │
                                ▼
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  postgres-setup           redis-setup          health-endpoint-*
        │                       │                       │
        ▼                       ▼                       │
  postgres-volume          redis-volume                 │
        │                       │                       │
        ▼                       ▼                       │
  migrations-setup              │                       │
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                        health-check-script
                                │
                                ▼
                        github-ci (parallel)
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
        github-cd-staging               github-cd-prod
                │                               │
                ▼                               ▼
        deploy-script                    deploy-script
                │                               │
                ▼                               ▼
        setup-droplet                    rollback-script
                │                               │
                └───────────────┬───────────────┘
                                ▼
                        stack-healthy
```

---

## Feature Test Commands

### Docker Build Tests

```bash
# dockerfile-api
docker build -f Dockerfile --target build . 2>&1 | grep -q 'DONE'

# dockerfile-worker
docker build -f Dockerfile.worker --target build . 2>&1 | grep -q 'DONE'

# dockerfile-frontend
docker build -f Dockerfile.frontend . 2>&1 | grep -q 'DONE'

# dockerfile-nginx
docker build -f Dockerfile.nginx . 2>&1 | grep -q 'DONE'
```

### Docker Compose Tests

```bash
# docker-compose-dev
docker-compose -f docker-compose.dev.yml config -q

# docker-compose-staging
docker-compose -f docker-compose.staging.yml config -q

# docker-compose-prod
docker-compose -f docker-compose.prod.yml config -q
```

### File Existence Tests

```bash
# dockerignore
test -f .dockerignore

# migrations-setup
test -f alembic.ini && test -d alembic

# pytest-setup
test -f pytest.ini && test -f conftest.py

# e2e-setup
test -f playwright.config.ts
```

### Script Executable Tests

```bash
# deploy-script
test -x scripts/deploy.sh && grep -q 'ssh' scripts/deploy.sh

# backup-script
test -x scripts/backup.sh

# rollback-script
test -x scripts/rollback.sh
```

### Nginx Tests

```bash
# nginx-config
nginx -t -c $(pwd)/nginx/nginx.conf 2>&1 | grep -q 'successful'
```

### Integration Tests

```bash
# stack-healthy
docker-compose -f docker-compose.dev.yml up -d && \
  sleep 15 && \
  curl -f http://localhost:8000/health && \
  curl -f http://localhost:3000 && \
  pg_isready -h localhost -p 5432 && \
  redis-cli ping
```

---

## Variable Resolution Order

Variables are resolved in this priority (highest to lowest):

1. **User input** (from initializer questions)
2. **Detected from code** (from pyproject.toml, astro.config.mjs, etc.)
3. **Derived from other variables** (e.g., DOMAIN_STAGING from DOMAIN)
4. **Default values** (hardcoded in feature definitions)

Example:
```typescript
const vars = {
  // User input (highest priority)
  PROJECT_NAME: userInput.projectName || undefined,
  DOMAIN: userInput.domain || undefined,
  
  // Detected from code
  PYTHON_VERSION: detectPythonVersion(cwd) || undefined,
  APP_ENTRY: detectFastAPIEntry(cwd) || undefined,
  
  // Derived
  PROJECT_NAME_SLUG: slugify(vars.PROJECT_NAME),
  DOMAIN_STAGING: `staging.${vars.DOMAIN}`,
  
  // Defaults (lowest priority)
  POSTGRES_VERSION: "16",
  REDIS_VERSION: "7",
  NODE_VERSION: "20",
  API_PORT: "8000",
  FRONTEND_PORT: "3000",
};
```
