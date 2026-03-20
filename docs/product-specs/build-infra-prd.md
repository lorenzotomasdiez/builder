# Build-Infr Workflow - Product Requirements Document

**Status**: Draft  
**Version**: 1.0.0  
**Created**: 2025-03-20  
**Target Stack**: FastAPI + Celery + PostgreSQL + Redis + Astro

---

## 1. Executive Summary

Build-Infr is a vertical-specific autonomous agent workflow that generates complete infrastructure for Python API + Astro frontend projects. Given a project directory, it produces:

- Local Docker setup for development and testing
- Production-ready Docker Compose for DigitalOcean deployment
- CI/CD pipelines (GitHub Actions) for testing and staging/prod environments
- Automated backups, health checks, and deployment scripts

The workflow applies expert AI engineering patterns from Anthropic, OpenAI, and Vercel research to ensure reliable, incremental, and verifiable infrastructure generation.

---

## 2. Problem Statement

### Current Pain Points

1. **Time-consuming setup**: Each new project requires manual Docker, nginx, CI/CD configuration
2. **Inconsistency**: Different projects use different infra patterns
3. **Knowledge gap**: Developers may not know best practices for Docker, GitHub Actions, deployment
4. **Error-prone**: Manual configuration leads to bugs and misconfigurations

### Target Users

- Developers building FastAPI + Astro applications
- Teams wanting standardized infrastructure
- Solo developers who want production-ready setup without expertise

---

## 3. Goals & Non-Goals

### Goals

1. Generate complete, working infrastructure from project code
2. Apply best practices from AI engineering research (Anthropic, OpenAI, Vercel patterns)
3. Produce testable, verifiable infrastructure with health checks
4. Support two environments: local development and DigitalOcean production
5. Enable easy rollback on deployment failures
6. Minimize manual configuration (maximize agent inference)

### Non-Goals

1. Multi-cloud support (AWS, GCP, Azure) - DigitalOcean only
2. Kubernetes/orchestration beyond Docker Compose
3. Auto-scaling infrastructure
4. Agent-created droplets (human creates droplet, agent deploys to it)
5. Real-time monitoring dashboards (Prometheus/Grafana)

---

## 4. Technical Stack

### Supported Stack

| Component | Technology | Version |
|-----------|------------|---------|
| API | FastAPI | Latest |
| Workers | Celery | Latest |
| Database | PostgreSQL | 16 |
| Message Broker | Redis | 7 |
| Frontend | Astro | Latest (SSR or SSG) |
| Node Runtime | Node.js | 20 LTS |
| CI/CD | GitHub Actions | N/A |
| Deployment | DigitalOcean Droplet | Ubuntu 24.04 |
| Reverse Proxy | Nginx | Latest |
| SSL | Certbot | Latest |

### Detection Logic

| File | Detection |
|------|-----------|
| `pyproject.toml` with `fastapi` | FastAPI API |
| `pyproject.toml` with `celery` | Celery workers |
| `astro.config.mjs` with `output: 'server'` | Astro SSR |
| `astro.config.mjs` with `output: 'static'` | Astro SSG |
| `.git/` directory | GitHub workflows enabled |

---

## 5. Workflow Architecture

### 5.1 Agent Chain

```
INITIALIZER → PLANNER → BUILDER → TESTER
```

| Agent | Responsibility | Session File |
|-------|---------------|--------------|
| initializer | Detect stack, ask questions, create specs | `.pi/agent-sessions/initializer.json` |
| planner | Create detailed implementation plan | `.pi/agent-sessions/planner.json` |
| builder | Implement features one at a time | `.pi/agent-sessions/builder.json` |
| tester | Verify end-to-end functionality | `.pi/agent-sessions/tester.json` |

### 5.2 Artifacts

**Primary Artifact:**

| Artifact | Purpose | Owned By | Mutation Rule |
|----------|---------|----------|---------------|
| `progress.md` | Context restoration between sessions — handoff briefing written by current session FOR the next session | All agents | Current State rewritten each session; Session Log append-only. See [Section 10](#10-progress-file--primary-context-restoration-mechanism). |

**Supporting Artifacts:**

| Artifact | Purpose | Created By |
|----------|---------|------------|
| `infra-spec.md` | All decisions documented | initializer |
| `feature-list.json` | Features with test commands | initializer |
| `infra-plan.md` | File-by-file implementation details | planner |
| `detected-stack.json` | Auto-detected stack info | initializer |

### 5.3 Harness Patterns Applied

| Pattern | Source | Implementation |
|---------|--------|----------------|
| Initializer agent | Anthropic | First session: asks questions, creates specs |
| Feature list (JSON) | Anthropic | Every component = one feature with test command |
| Progress file (context restoration) | Anthropic | Primary handoff mechanism: two-part structure (Current State rewritten + Session Log append-only). See Section 10. |
| Session protocol (read-first/write-last) | Anthropic | Every agent reads progress.md FIRST, updates it LAST. Enables multi-session autonomy. |
| Incremental work | Anthropic | ONE feature at a time, test before done |
| Real verification | Anthropic | Health checks, pytest, curl (not "looks good") |
| Repo as record | OpenAI | All specs live in project |
| Progressive disclosure | OpenAI | AGENTS.md points to docs/infra/ |
| Mechanical enforcement | OpenAI | Tests must pass, feature-list.json validates |
| Generic tools | Vercel | `read`, `write`, `edit`, `bash` only |
| Agent chain | agent-chain.ts | Sequential pipeline with $INPUT passing |
| Blocking gate | tilldone.ts | Can't write without feature-list.json |
| Purpose gate | purpose-gate.ts | Session starts with intent declaration |
| Damage control | damage-control.ts | Block dangerous commands |

---

## 6. Feature List

### 6.1 Feature Generation (Programmatic)

Features are generated based on detected stack, not hardcoded.

```typescript
function generateFeatures(stack: Stack): Feature[] {
  const features: Feature[] = [];
  
  // Base features (always included)
  features.push(...getBaseFeatures());
  
  // Stack-specific features
  if (stack.api) features.push(...getAPIFeatures(stack.api));
  if (stack.worker) features.push(...getWorkerFeatures(stack.worker));
  if (stack.database) features.push(...getDatabaseFeatures(stack.database, stack.hasBackups));
  if (stack.frontend) features.push(...getFrontendFeatures(stack.frontend));
  if (stack.hasGithub) features.push(...getCICDFeatures());
  if (stack.hasDomain) features.push(...getDomainFeatures());
  
  // Final validation
  features.push(getStackHealthyFeature());
  
  return sortDependencies(features);
}
```

### 6.2 Feature Categories

#### Docker Files (5 features)
| ID | Description | Test |
|----|-------------|------|
| `dockerfile-api` | Dockerfile for FastAPI | `docker build -f Dockerfile --target build . 2>&1 \| grep -q 'DONE'` |
| `dockerfile-worker` | Dockerfile for Celery worker | `docker build -f Dockerfile.worker --target build . 2>&1 \| grep -q 'DONE'` |
| `dockerfile-frontend` | Dockerfile for Astro | `docker build -f Dockerfile.frontend . 2>&1 \| grep -q 'DONE'` |
| `dockerfile-nginx` | Dockerfile for Nginx | `docker build -f Dockerfile.nginx . 2>&1 \| grep -q 'DONE'` |
| `dockerignore` | .dockerignore file | `test -f .dockerignore` |

#### Docker Compose (3 features)
| ID | Description | Test |
|----|-------------|------|
| `docker-compose-dev` | Local development environment | `docker-compose -f docker-compose.dev.yml config -q` |
| `docker-compose-staging` | Staging environment | `docker-compose -f docker-compose.staging.yml config -q` |
| `docker-compose-prod` | Production environment | `docker-compose -f docker-compose.prod.yml config -q` |

#### Database (5 features)
| ID | Description | Test |
|----|-------------|------|
| `postgres-setup` | PostgreSQL container config | `grep -q 'postgres' docker-compose.dev.yml` |
| `postgres-volume` | Persistent volume for data | `grep -q 'postgres_data' docker-compose.dev.yml` |
| `redis-setup` | Redis for Celery broker | `grep -q 'redis' docker-compose.dev.yml` |
| `redis-volume` | Persistent volume for Redis | `grep -q 'redis_data' docker-compose.dev.yml` |
| `migrations-setup` | Alembic migrations | `test -f alembic.ini && test -d alembic` |

#### Backups (2 features)
| ID | Description | Test |
|----|-------------|------|
| `backup-script` | Automated DB backups | `test -x scripts/backup.sh` |
| `backup-cron` | Cron job for backups | `test -f scripts/backup-cron` |

#### Networking (3 features)
| ID | Description | Test |
|----|-------------|------|
| `nginx-config` | Reverse proxy config | `nginx -t -c $(pwd)/nginx/nginx.conf 2>&1 \| grep -q 'successful'` |
| `ssl-setup` | Certbot with auto-renewal | `test -f scripts/setup-ssl.sh` |
| `network-isolation` | Docker network config | `grep -q 'networks:' docker-compose.prod.yml` |

#### Application (4 features)
| ID | Description | Test |
|----|-------------|------|
| `health-endpoint-api` | /health on API | `grep -rq '/health' app/` |
| `health-endpoint-worker` | Celery health check | `grep -q 'celery inspect' scripts/health-check.sh` |
| `env-management` | .env files | `test -f .env.example && test -f .env.production.template` |
| `logging-setup` | Structured logging | `grep -q 'logging' app/main.py` |

#### CI/CD (3 features)
| ID | Description | Test |
|----|-------------|------|
| `github-ci` | CI pipeline for PRs | `test -f .github/workflows/ci.yml` |
| `github-cd-staging` | Auto-deploy testing branch | `test -f .github/workflows/deploy-staging.yml` |
| `github-cd-prod` | Auto-deploy main (requires approval) | `test -f .github/workflows/deploy-prod.yml` |

#### Testing (3 features)
| ID | Description | Test |
|----|-------------|------|
| `pytest-setup` | Pytest configuration | `test -f pytest.ini && test -f conftest.py` |
| `test-containers` | Test database in Docker | `grep -q 'testcontainers' requirements.txt` |
| `e2e-setup` | Playwright for frontend | `test -f playwright.config.ts` |

#### Deployment (3 features)
| ID | Description | Test |
|----|-------------|------|
| `deploy-script` | SSH deploy to DO | `test -x scripts/deploy.sh && grep -q 'ssh' scripts/deploy.sh` |
| `setup-droplet` | First-time server provisioning | `test -x scripts/setup-droplet.sh` |
| `rollback-script` | Auto-rollback on failure | `test -x scripts/rollback.sh` |

#### Monitoring (1 feature)
| ID | Description | Test |
|----|-------------|------|
| `health-check-script` | Docker health checks | `test -x scripts/health-check.sh` |

#### Documentation (2 features)
| ID | Description | Test |
|----|-------------|------|
| `readme-infra` | How to run/deploy | `grep -q 'docker-compose' README.md` |
| `runbook` | Troubleshooting guide | `test -f docs/runbook.md` |

#### Validation (1 feature)
| ID | Description | Test |
|----|-------------|------|
| `stack-healthy` | Full stack starts and passes | `docker-compose -f docker-compose.dev.yml up -d && sleep 15 && ./scripts/health-check.sh` |

**Total: 28 features**

### 6.3 Feature Schema

```json
{
  "id": "dockerfile-api",
  "desc": "Dockerfile for FastAPI service",
  "file": "Dockerfile",
  "template": "docker/Dockerfile.fastapi",
  "test": "docker build -f Dockerfile --target build . 2>&1 | grep -q 'DONE'",
  "depends_on": [],
  "pass": false,
  "status": "idle",
  "attempts": 0,
  "skip": false
}
```

**Status values**: `idle` | `in_progress` | `done` | `failed` | `skipped`

---

## 7. Templates

### 7.1 Template Variables

Variables follow AI engineering best practices: clear, descriptive names that LLMs can reason about.

#### Global Variables (all templates)

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `{{PROJECT_NAME}}` | Project identifier | `my-api` | User input / folder name |
| `{{PROJECT_DESCRIPTION}}` | Brief description | `My API` | User input |
| `{{DOMAIN}}` | Production domain | `api.example.com` | User input |
| `{{DOMAIN_STAGING}}` | Staging domain | `staging.api.example.com` | Derived from DOMAIN |

#### Python Variables

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `{{PYTHON_VERSION}}` | Python version | `3.12` | Detected from pyproject.toml |
| `{{APP_ENTRY}}` | FastAPI app path | `app.main:app` | Detected from main.py |
| `{{API_PORT}}` | API port | `8000` | Default |
| `{{WORKER_CONCURRENCY}}` | Celery worker processes | `4` | Default |

#### Database Variables

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `{{POSTGRES_VERSION}}` | PostgreSQL version | `16` | Default |
| `{{POSTGRES_USER}}` | Database user | `postgres` | Default |
| `{{POSTGRES_DB}}` | Database name | `{{PROJECT_NAME}}` | Derived |
| `{{POSTGRES_PORT}}` | Database port | `5432` | Default |
| `{{REDIS_VERSION}}` | Redis version | `7` | Default |
| `{{REDIS_PORT}}` | Redis port | `6379` | Default |

#### Frontend Variables

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `{{NODE_VERSION}}` | Node.js version | `20` | Default |
| `{{ASTRO_MODE}}` | SSR or SSG | `ssr` | Detected from astro.config.mjs |
| `{{FRONTEND_PORT}}` | Frontend port | `3000` | Default |

#### Infrastructure Variables

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `{{NGINX_PORT}}` | Nginx HTTP port | `80` | Default |
| `{{NGINX_PORT_SSL}}` | Nginx HTTPS port | `443` | Default |
| `{{DROPLET_SIZE}}` | DO droplet size | `s-2vcpu-2gb` | Default |

#### Backup Variables

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `{{BACKUP_ENABLED}}` | Enable backups | `true` | User input |
| `{{BACKUP_SERVER}}` | Backup server host | `backup.example.com` | User input |
| `{{BACKUP_PATH}}` | Backup storage path | `/backups/{{PROJECT_NAME}}` | Default |
| `{{BACKUP_RETENTION_DAYS}}` | Days to keep backups | `7` | Default |

### 7.2 Template Files

#### Docker Templates (5 files)

```
templates/infra/docker/
├── Dockerfile.fastapi       # FastAPI service
├── Dockerfile.celery        # Celery worker
├── Dockerfile.astro-ssr     # Astro SSR
├── Dockerfile.astro-ssg     # Astro SSG
└── Dockerfile.nginx         # Nginx reverse proxy
```

#### Compose Templates (3 files)

```
templates/infra/compose/
├── docker-compose.dev.yml      # Local development
├── docker-compose.staging.yml  # Staging environment
└── docker-compose.prod.yml     # Production environment
```

#### Nginx Templates (3 files)

```
templates/infra/nginx/
├── nginx.dev.conf      # Development config
├── nginx.staging.conf  # Staging config
└── nginx.prod.conf     # Production config (SSL)
```

#### Script Templates (5 files)

```
templates/infra/scripts/
├── deploy.sh           # Deploy to DO
├── backup.sh           # Database backup
├── rollback.sh         # Rollback on failure
├── health-check.sh     # Health check all services
└── setup-droplet.sh    # First-time server setup
```

#### GitHub Workflow Templates (3 files)

```
templates/infra/github/
├── ci.yml              # Test on PRs
├── deploy-staging.yml  # Deploy testing branch
└── deploy-prod.yml     # Deploy main (requires approval)
```

#### Python Config Templates (4 files)

```
templates/infra/python/
├── pytest.ini          # Pytest configuration
├── conftest.py         # Pytest fixtures
├── alembic.ini         # Alembic config
└── testcontainers.py   # Test database setup
```

#### Environment Templates (2 files)

```
templates/infra/env/
├── .env.example             # Local development env
└── .env.production.template # Production env template
```

### 7.3 Template Engine Rules

1. **Variable substitution**: `{{VARIABLE}}` replaced with value
2. **Conditional blocks**: `{{#if CONDITION}}...{{/if}}` for optional sections
3. **Iterative blocks**: `{{#each ITEMS}}...{{/each}}` for lists
4. **Default values**: `{{VARIABLE:-default}}` syntax
5. **Validation**: All variables must be resolved before file generation

---

## 8. Agent Definitions

### 8.1 Initializer Agent

**Purpose**: Analyze project and gather requirements

**Tools**: `read`, `bash`, `grep`, `glob`

**Session File**: `.pi/agent-sessions/initializer.json`

**Inputs**: Project directory path

**Outputs**:
- `infra-spec.md` - All decisions documented
- `feature-list.json` - All features with test commands
- `detected-stack.json` - Auto-detected stack info
- Updated `progress.md` - Current State with detection results and next-session instructions

**Workflow**:
1. Read progress.md — if resuming, follow Next Session Instructions
2. Detect existing code structure
3. Ask clarifying questions for unknowns
4. Generate feature list programmatically
5. Create specification files
6. Update progress.md — write Current State with detection results, gotchas discovered, and Next Session Instructions for planner

**Detection Logic**:
```
1. Read pyproject.toml → Python version, dependencies
2. Find main.py or app/main.py → FastAPI entry point
3. Read astro.config.mjs → SSR or SSG mode
4. Check .git/ → GitHub workflows enabled
5. Check existing Dockerfile → Note what exists
```

**Questions (if not detectable)**:
1. Project name (used for containers, DB name)
2. Domain name (for nginx, SSL, CORS)
3. Database size expectation
4. Enable automated backups? (y/n)
5. Backup server SSH details (if backups enabled)

**Blocking Rules**:
- Cannot proceed without project name
- Cannot proceed without domain (if GitHub/deploy enabled)
- Must create both infra-spec.md AND feature-list.json

### 8.2 Planner Agent

**Purpose**: Create detailed implementation plan

**Tools**: `read`, `bash`

**Session File**: `.pi/agent-sessions/planner.json`

**Inputs**:
- `infra-spec.md`
- `feature-list.json`
- `templates/infra/` (all template files)

**Outputs**:
- `infra-plan.md` - File-by-file implementation details
- Updated `progress.md` - Current State with planning results and next-session instructions

**Workflow**:
1. Read progress.md — follow Next Session Instructions from initializer
2. Read specification files
3. Read all applicable templates
4. For each feature, specify exact implementation
5. Order by dependencies
6. Update progress.md — write Current State with planning results and Next Session Instructions for builder

**infra-plan.md Format**:
```markdown
## Feature: dockerfile-api
- File: Dockerfile
- Template: templates/infra/docker/Dockerfile.fastapi
- Variables:
  - PYTHON_VERSION: "3.12"
  - APP_ENTRY: "app.main:app"
  - API_PORT: "8000"
- Depends on: none
- Test: docker build -f Dockerfile --target build . 2>&1 | grep -q 'DONE'

## Feature: postgres-setup
- File: docker-compose.dev.yml
- Template: templates/infra/compose/docker-compose.dev.yml
- Variables:
  - PROJECT_NAME: "my-api"
  - POSTGRES_VERSION: "16"
  - POSTGRES_USER: "postgres"
  - POSTGRES_DB: "my-api"
  - POSTGRES_PORT: "5432"
- Depends on: none
- Test: docker-compose -f docker-compose.dev.yml config -q
```

### 8.3 Builder Agent

**Purpose**: Implement infrastructure files

**Tools**: `read`, `write`, `edit`, `bash`

**Session File**: `.pi/agent-sessions/builder.json`

**Inputs**:
- `feature-list.json`
- `infra-plan.md`
- `templates/infra/` (template files)

**Outputs**:
- All infrastructure files
- Updated `feature-list.json` (pass: true)
- Updated `progress.md`

**Workflow (per feature)**:
1. Read progress.md — follow Next Session Instructions; determine which feature to build next
2. Read next failing feature from feature-list.json (or as directed by progress.md)
3. Mark feature as `in_progress`
4. Read template and substitute variables
5. Write file(s)
6. Run test command
7. If pass: commit, mark `done`
8. If fail (attempt < 3): retry
9. If fail (attempt >= 3): ask user (skip/retry/abort)
10. Update progress.md — rewrite Current State with feature results, gotchas discovered during build, and Next Session Instructions for next feature or tester

**Blocking Rules**:
- Cannot write if feature-list.json doesn't exist
- Cannot write if no feature is `in_progress`
- Must run test before marking `done`
- Max 3 retry attempts per feature

**Commit Format**:
```
feat(infra): add dockerfile-api

- Dockerfile for FastAPI service
- Uses Python 3.12 slim
- Includes health check

Feature: dockerfile-api
Test: PASSED
```

### 8.4 Tester Agent

**Purpose**: Verify end-to-end functionality

**Tools**: `read`, `bash`

**Session File**: `.pi/agent-sessions/tester.json`

**Inputs**:
- `docker-compose.dev.yml`
- All infrastructure files

**Outputs**:
- Test results
- Updated `feature-list.json` (stack-healthy: true)
- Updated `progress.md` - Final Current State with test results and workflow completion
- Screenshots in `test-results/` (if UI available)

**Workflow**:
1. Read progress.md — confirm builder has completed all features; follow Next Session Instructions
2. Run `docker-compose -f docker-compose.dev.yml up -d`
3. Wait for services (max 60s)
4. Run health checks on each service
5. Run pytest (if tests exist)
6. Run Playwright E2E tests (if configured)
7. Mark `stack-healthy` as `done`
8. Stop containers
9. Report results
10. Update progress.md — write final Current State with test results, mark workflow complete, and Next Session Instructions (if any follow-up needed)

**Health Checks**:
- API: `curl -f http://localhost:8000/health`
- Frontend: `curl -f http://localhost:3000`
- Postgres: `pg_isready -h localhost -p 5432`
- Redis: `redis-cli ping`

---

## 9. User Interaction

### 9.1 Interaction Points

| Point | Trigger | Question Type |
|-------|---------|---------------|
| Resume | Found progress.md | Show Current State summary and Next Session Instructions; Confirm: "Resume from [phase], [N/M] features done? Next: [instructions summary]" |
| Feature fail (3x) | Builder can't pass test | Choice: "Skip/retry/abort?" |
| Initializer unknown | Can't detect from code | Input: "What is the project name?" |
| Stack ambiguity | Multiple entry points | Choice: "Which file is the main app?" |
| Deploy confirmation | About to deploy | Confirm: "Deploy to staging?" |

### 9.2 Failure Handling

```
Feature fails test (attempt 1)
    → Retry automatically

Feature fails test (attempt 2)
    → Retry automatically

Feature fails test (attempt 3)
    → ASK USER:
      "Feature X failed 3 times:
       Error: [test output]
       
       Options:
       1. Skip - Mark as skipped, continue
       2. Retry - Try again with same approach
       3. Debug - Show detailed error
       4. Abort - Stop entire workflow"
```

### 9.3 Skip Behavior

When user skips a failed feature:
- Mark feature status as `skipped`
- Set `skip: true`
- Add to progress.md with reason
- Continue to next feature
- At end, report skipped features

---

## 10. Progress File — Primary Context Restoration Mechanism

The progress file is the single most important artifact for multi-session agent work. It is not a log — it is a **handoff briefing** written by the current session FOR the next session. This is the mechanism that makes autonomous multi-session workflows possible.

> **Design insight** (from Anthropic's "Effective Harnesses for Long-Running Agents"): The progress file should be treated as the primary context restoration mechanism. A new session reading progress.md should be able to understand exactly where things stand and what to do next — without reading any other file first.

### 10.1 Design Principles

| Principle | Description |
|-----------|-------------|
| **Read-first, write-last** | Every agent reads progress.md as its FIRST action and updates it as its LAST action. No exceptions. |
| **Two-part structure** | Current State (rewritten each session) + Session Log (append-only). This separates "what matters now" from "what happened before." |
| **Prospective, not retrospective** | The most important content is forward-looking: Next Session Instructions tell the next agent exactly what to do. |
| **Self-contained** | A new session should be able to resume from progress.md alone. It cross-references other artifacts but does not depend on reading them first. |
| **Compact** | Current State must fit comfortably in any context window. It is a briefing, not a dump. |

### 10.2 Schema

progress.md has two distinct parts with different mutation rules:

```markdown
# Build-Infra Progress

## Current State
<!-- REWRITTEN each session — this is NOT append-only -->

### Where We Are
- **Active agent**: [initializer | planner | builder | tester]
- **Current phase**: [detection | planning | building | testing]
- **Feature progress**: [N/M] features complete ([list of done IDs])
- **Current feature**: [feature-id] — [status: idle | in_progress | blocked]
- **Overall health**: [on-track | blocked | needs-user-input]

### Gotchas Discovered
<!-- Non-obvious findings that the next session MUST know -->
- [e.g., "pyproject.toml uses poetry, not pip — all install commands must use poetry"]
- [e.g., "Port 8000 is used by existing app process — dev compose uses 8001"]
- [e.g., "Astro config uses hybrid mode, not pure SSR — affects Dockerfile"]

### Key Decisions Made
<!-- Decisions that constrain future work -->
- [e.g., "Using multi-stage Docker builds for all services (agreed with user)"]
- [e.g., "Skipped backup-cron feature — user has no backup server"]

### Next Session Instructions
<!-- The most important section — tells the next agent exactly what to do -->
1. [e.g., "Resume builder agent from feature dockerfile-worker"]
2. [e.g., "The Dockerfile.worker template needs WORKER_CONCURRENCY set to 2, not 4 — user confirmed"]
3. [e.g., "After dockerfile-worker, proceed to dockerfile-frontend"]
4. [e.g., "Watch for: Celery app import path is 'tasks.celery' not 'app.celery'"]

---

## Session Log
<!-- APPEND-ONLY — never modify previous entries -->

### [ISO-TIMESTAMP] — [agent-name]
- **Intent**: [what this session set out to do]
- **Features attempted**: [feature-id-1, feature-id-2, ...]
- **Duration**: [seconds]s
- **Result**: [completed N features | blocked on X | failed at Y]
- **Commits**: [git-hash-1, git-hash-2, ...]
- **Errors encountered**: [brief description or "none"]
- **User interventions**: [description or "none"]

### [ISO-TIMESTAMP] — [agent-name]
- ...
```

**Key differences from a simple log:**
- Current State is **rewritten** each session (not appended)
- Next Session Instructions are **prescriptive** (not descriptive)
- Gotchas Discovered captures **non-obvious** findings only
- Session Log entries are **append-only** and never modified

### 10.3 Session Protocol

Every agent follows this rigid protocol:

**On session start (FIRST actions):**
1. Read progress.md
2. Parse Current State section
3. Follow Next Session Instructions — these override default behavior
4. Cross-reference feature-list.json for current feature statuses
5. If progress.md doesn't exist, create it with initial Current State

**On session end (LAST actions):**
1. Rewrite Current State with up-to-date information
2. Write Gotchas Discovered (only non-obvious findings that affect future work)
3. Write Key Decisions Made (only decisions that constrain future sessions)
4. Write Next Session Instructions (specific, actionable steps for the next agent)
5. Append a new Session Log entry with this session's activity
6. Commit progress.md with message `chore: update progress.md`

**During session:**
- If a significant discovery is made (e.g., unexpected stack configuration), note it immediately in a local variable for inclusion in Gotchas Discovered at session end
- If user makes a decision that affects future work, note it for Key Decisions Made

### 10.4 Resume Logic

```
On workflow start:
1. Check for progress.md
2. If exists:
   a. Read and parse Current State
   b. Surface to user:
      "Found existing progress:
       - Phase: [current phase]
       - Progress: [N/M] features complete
       - Next steps: [summary of Next Session Instructions]
       Resume from here?"
   c. If yes:
      - Load Next Session Instructions as primary directive
      - Cross-reference feature-list.json for feature statuses
      - Begin from the agent/feature specified in Current State
   d. If no:
      - Archive current progress.md to progress.md.bak
      - Start fresh from initializer
3. If not exists:
   - Create initial progress.md with empty Current State
   - Start from initializer
```

### 10.5 What Makes This Different From a Log

| Aspect | Traditional Log | Progress File |
|--------|----------------|---------------|
| **Audience** | Humans reviewing history | The next agent session |
| **Tense** | Past ("what happened") | Future ("what to do next") |
| **Structure** | Append-only | Two parts: mutable Current State + append-only Session Log |
| **Mutability** | Never modified | Current State rewritten every session |
| **First action** | Write an entry | Read the file |
| **Content** | Events and outcomes | Handoff briefing with actionable instructions |
| **Without it** | Lose history | Lose ability to resume autonomously |

---

## 11. Branch Strategy

### 11.1 Git Branches

```
main (protected, production)
  │
  ├── testing (auto-deploy to staging)
  │     │
  │     └── feature/* → PR → merge to testing
  │                              ↓
  │                         staging env
  │                              ↓
  │                         merge to main
  │                              ↓
  │                         prod env
```

### 11.2 CI/CD Workflows

| Workflow | Trigger | Branch | Action |
|----------|---------|--------|--------|
| `ci.yml` | Pull request | Any | Run tests |
| `deploy-staging.yml` | Push/merge | `testing` | Deploy to staging |
| `deploy-prod.yml` | Push/merge | `main` | Deploy to prod (requires approval) |

### 11.3 Protection Rules

- `main`: Require PR approval, require status checks
- `testing`: Require status checks (no approval)
- Feature branches: No restrictions

---

## 12. Environments

### 12.1 Environment Configuration

| Aspect | Local | Staging | Production |
|--------|-------|---------|------------|
| Compose file | `docker-compose.dev.yml` | `docker-compose.staging.yml` | `docker-compose.prod.yml` |
| Env file | `.env` | `.env.staging` | `.env.production` |
| Domain | localhost | `staging.{{DOMAIN}}` | `{{DOMAIN}}` |
| SSL | None | Certbot staging | Certbot production |
| Backups | Disabled | Disabled | Enabled |
| Debug | Enabled | Enabled | Disabled |
| Hot reload | Enabled | Disabled | Disabled |

### 12.2 Deployment Process

**Staging** (automatic):
1. Merge PR to `testing` branch
2. GitHub Actions runs tests
3. If tests pass: SSH to staging server
4. `git pull`
5. `docker-compose -f docker-compose.staging.yml pull`
6. `docker-compose -f docker-compose.staging.yml up -d`
7. Run health checks
8. If fail: rollback, notify

**Production** (automatic with approval):
1. Merge `testing` to `main` (requires approval)
2. GitHub Actions runs tests
3. If tests pass: SSH to production server
4. `git pull`
5. `docker-compose -f docker-compose.prod.yml pull`
6. `docker-compose -f docker-compose.prod.yml up -d`
7. Run health checks
8. If fail: `./scripts/rollback.sh`, notify

---

## 13. File Structure

### 13.1 Generated Files

```
project/
├── Dockerfile                    # API service
├── Dockerfile.worker             # Celery worker
├── Dockerfile.frontend           # Frontend service
├── Dockerfile.nginx              # Nginx
├── .dockerignore                 # Docker ignore rules
├── docker-compose.dev.yml        # Local development
├── docker-compose.staging.yml    # Staging environment
├── docker-compose.prod.yml       # Production environment
├── nginx/
│   ├── nginx.conf                # Main nginx config
│   └── conf.d/
│       └── default.conf          # Site config
├── scripts/
│   ├── deploy.sh                 # Deploy to DO
│   ├── backup.sh                 # Database backup
│   ├── rollback.sh               # Rollback on failure
│   ├── health-check.sh           # Health check all services
│   └── setup-droplet.sh          # First-time server setup
├── .github/
│   └── workflows/
│       ├── ci.yml                # Test on PRs
│       ├── deploy-staging.yml    # Deploy testing branch
│       └── deploy-prod.yml       # Deploy main
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── .gitkeep
├── alembic.ini                   # Alembic config
├── pytest.ini                    # Pytest config
├── conftest.py                   # Pytest fixtures
├── playwright.config.ts          # E2E test config
├── .env.example                  # Local env template
├── .env.production.template      # Production env template
├── docs/
│   └── runbook.md                # Troubleshooting guide
├── test-results/                 # Test outputs
│   ├── screenshots/
│   └── videos/
├── infra-spec.md                 # Infrastructure specification
├── feature-list.json             # Features with test commands
├── infra-plan.md                 # Implementation plan
├── progress.md                   # Session progress
└── detected-stack.json           # Detected stack info
```

### 13.2 Builder Framework Files

```
builder/
├── .pi/
│   ├── agents/
│   │   ├── initializer.md
│   │   ├── planner.md
│   │   ├── builder.md
│   │   ├── tester.md
│   │   └── build-infra.yaml
│   └── agent-sessions/
│       ├── initializer.json
│       ├── planner.json
│       ├── builder.json
│       └── tester.json
├── extensions/
│   └── build-infra.ts
├── templates/
│   └── infra/
│       ├── docker/
│       ├── compose/
│       ├── nginx/
│       ├── scripts/
│       ├── github/
│       ├── python/
│       └── env/
├── schemas/
│   ├── feature-list.json
│   ├── infra-spec.json
│   └── progress.json
├── lib/
│   ├── feature-generator.ts
│   ├── template-engine.ts
│   ├── orchestrator.ts
│   └── user-interaction.ts
└── docs/
    └── infra/
        ├── feature-generation.md
        ├── template-variables.md
        └── troubleshooting.md
```

---

## 14. Success Metrics

### 14.1 Functional Requirements

- [ ] Agent detects stack correctly (95%+ accuracy)
- [ ] All generated Dockerfiles build successfully
- [ ] All docker-compose files validate (`config -q`)
- [ ] `docker-compose up` starts all services
- [ ] Health checks pass on all services
- [ ] Pytest runs successfully (if tests exist)
- [ ] Deploy script successfully deploys to DO
- [ ] SSL certificates provisioned via Certbot
- [ ] Backups run on schedule (if enabled)
- [ ] Rollback works on deployment failure

### 14.2 Quality Metrics

- [ ] Average feature implementation time: <30 seconds
- [ ] Total workflow time: <20 minutes
- [ ] Test coverage for generated configs: 100%
- [ ] Zero manual configuration required (after initial questions)
- [ ] Progress resume works across sessions
- [ ] User intervention rate: <10% of runs

### 14.3 AI Engineering Metrics

- [ ] Generic tools only (read, write, edit, bash)
- [ ] Feature list prevents premature completion
- [ ] Progress file enables context continuity
- [ ] Blocking gates prevent invalid state
- [ ] Tests verify every feature (no "looks good")
- [ ] All specs in repo (no external dependencies)

---

## 15. Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Agent definitions (initializer, planner, builder, tester)
- [ ] Chain config (build-infra.yaml)
- [ ] Extension skeleton (build-infra.ts)
- [ ] Progress file (progress.md schema, session protocol, resume logic)

### Phase 2: Feature Generation
- [ ] Stack detection logic
- [ ] Feature generation matrix
- [ ] Feature definitions (all 28 features)
- [ ] Dependency sorting algorithm

### Phase 3: Templates
- [ ] Docker templates (5 files)
- [ ] Compose templates (3 files)
- [ ] Nginx templates (3 files)
- [ ] Script templates (5 files)
- [ ] GitHub workflow templates (3 files)
- [ ] Python config templates (4 files)
- [ ] Env templates (2 files)

### Phase 4: Template Engine
- [ ] Variable substitution
- [ ] Conditional blocks
- [ ] Template selection logic
- [ ] File generation

### Phase 5: Orchestrator
- [ ] Background agent spawning
- [ ] Progress widget
- [ ] User interaction handling
- [ ] Resume capability
- [ ] Failure handling

### Phase 6: Testing & Validation
- [ ] Test on sample FastAPI + Astro project
- [ ] Validate all features generate correctly
- [ ] Test resume functionality
- [ ] Test failure handling
- [ ] Document edge cases

---

## 16. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Stack detection fails | Medium | High | Fallback to manual questions |
| Template variable missing | Low | Medium | Validation before generation |
| Test flakiness | Medium | Medium | Retry logic, clear error messages |
| Context window exhaustion | Low | High | Background agent sessions, progress.md resume — Current State section is a compact briefing designed to fit any context window; new sessions restore full context without replaying history |
| User confusion on questions | Medium | Low | Clear question prompts, sensible defaults |
| Generated config errors | Medium | High | Validation tests, rollback scripts |

---

## 17. Future Enhancements

### v2.0
- [ ] Django support
- [ ] Flask support
- [ ] Multiple database support (MySQL, SQLite)
- [ ] RQ worker alternative to Celery
- [ ] React/Next.js frontend alternative

### v3.0
- [ ] Multi-service architecture (microservices)
- [ ] Kubernetes manifests
- [ ] Multi-cloud support (AWS, GCP)
- [ ] Real-time monitoring integration
- [ ] Auto-scaling configuration

---

## 18. References

### AI Engineering Research
- Anthropic: "Effective harnesses for long-running agents"
- OpenAI: "Harness engineering: leveraging Codex in an agent-first world"
- Vercel: Generic tools vs specialized tools (3.5× improvement)

### Extension Patterns
- `extensions-examples/agent-chain.ts` - Sequential pipeline
- `extensions-examples/agent-team.ts` - Multi-agent orchestration
- `extensions-examples/tilldone.ts` - Blocking gate pattern
- `extensions-examples/purpose-gate.ts` - Intent declaration
- `extensions-examples/damage-control.ts` - Safety rules

### Documentation
- `TODO.md` - Implementation plan
- `docs/design-docs/core-beliefs.md` - Agent-first principles
- `docs/design-docs/architecture.md` - System structure

---

## 19. Glossary

| Term | Definition |
|------|------------|
| Feature | A single infrastructure component with a test command |
| Feature list | JSON file tracking all features and their status |
| Progress file | Primary context restoration mechanism — two-part file (mutable Current State + append-only Session Log) that serves as a handoff briefing between agent sessions. See Section 10. |
| Template | Static file with `{{VARIABLE}}` placeholders |
| Stack | The combination of technologies used (FastAPI, Celery, etc.) |
| Chain | Sequential agent workflow (initializer → planner → builder → tester) |
| Blocking gate | Rule that prevents action until prerequisites are met |
| Background agent | Agent spawned by orchestrator, runs in separate session |

---

## 20. Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | | | Pending |
| Tech Lead | | | Pending |
| AI Engineer | | | Pending |

---

**Document History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-03-20 | Builder Agent | Initial PRD creation |
