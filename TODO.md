# TODO - Build-Infr Implementation Plan

Based on PRD: `docs/product-specs/build-infra-prd.md`

---

## Overview

Build a vertical-specific autonomous agent workflow that generates complete infrastructure for FastAPI + Celery + PostgreSQL + Redis + Astro projects.

**Key Principles** (from AI engineering research):
- Generic tools only (`read`, `write`, `edit`, `bash`)
- Feature list with pass/fail (prevents premature completion)
- Progress file for session memory
- Background agent orchestration
- Real verification (health checks, not "looks good")

---

## Phase 1: Foundation (Days 1-2)

### 1.1 Directory Structure
- [ ] Create `.pi/agents/` directory
- [ ] Create `.pi/agent-sessions/` directory  
- [ ] Create `templates/infra/` with subdirectories
- [ ] Create `lib/` directory
- [ ] Create `schemas/` directory

### 1.2 Schemas
- [ ] Create `schemas/feature-list.json` (JSON Schema)
- [ ] Create `schemas/infra-spec.json` (JSON Schema)
- [ ] Create `schemas/progress.json` (JSON Schema)
- [ ] Create `schemas/detected-stack.json` (JSON Schema)

### 1.3 Extension Skeleton
- [ ] Create `extensions/build-infra.ts` with basic structure
- [ ] Register `/build-infra` command
- [ ] Implement progress widget placeholder
- [ ] Implement session file management

---

## Phase 2: Agent Definitions (Days 3-4)

### 2.1 Initializer Agent
- [ ] Create `.pi/agents/initializer.md` with frontmatter
- [ ] Define stack detection logic
- [ ] Define question prompts
- [ ] Define output file schemas
- [ ] Test detection logic standalone

### 2.2 Planner Agent
- [ ] Create `.pi/agents/planner.md` with frontmatter
- [ ] Define template reading logic
- [ ] Define infra-plan.md format
- [ ] Define variable resolution
- [ ] Test planning standalone

### 2.3 Builder Agent
- [ ] Create `.pi/agents/builder.md` with frontmatter
- [ ] Define blocking gate rules
- [ ] Define feature implementation loop
- [ ] Define test-before-done rule
- [ ] Define retry/ask-user logic
- [ ] Test building standalone

### 2.4 Tester Agent
- [ ] Create `.pi/agents/tester.md` with frontmatter
- [ ] Define health check commands
- [ ] Define pytest integration
- [ ] Define screenshot/video capture
- [ ] Test verification standalone

### 2.5 Chain Config
- [ ] Create `.pi/agents/build-infra.yaml`
- [ ] Define step sequence
- [ ] Define prompt templates
- [ ] Define variable passing ($INPUT, $ORIGINAL)

---

## Phase 3: Feature Generation (Days 5-6)

### 3.1 Stack Detection
- [ ] Implement `lib/detect-stack.ts`
  - [ ] Detect FastAPI from pyproject.toml
  - [ ] Detect Celery from pyproject.toml
  - [ ] Detect PostgreSQL from dependencies
  - [ ] Detect Redis from dependencies
  - [ ] Detect Astro SSR/SSG from astro.config.mjs
  - [ ] Detect .git for GitHub workflows

### 3.2 Feature Definitions
- [ ] Create `lib/feature-definitions.ts`
- [ ] Define all 28 features:
  - [ ] Docker files (5 features)
  - [ ] Docker Compose (3 features)
  - [ ] Database (5 features)
  - [ ] Backups (2 features)
  - [ ] Networking (3 features)
  - [ ] Application (4 features)
  - [ ] CI/CD (3 features)
  - [ ] Testing (3 features)
  - [ ] Deployment (3 features)
  - [ ] Monitoring (1 feature)
  - [ ] Documentation (2 features)
  - [ ] Validation (1 feature)

### 3.3 Feature Generator
- [ ] Implement `lib/feature-generator.ts`
  - [ ] `generateFeatures(stack)` function
  - [ ] Feature category generators
  - [ ] Dependency sorting algorithm
  - [ ] Test command generation

### 3.4 Feature List Manager
- [ ] Implement `lib/feature-list.ts`
  - [ ] Load feature list
  - [ ] Update feature status
  - [ ] Mark feature in_progress/done/failed/skipped
  - [ ] Get next failing feature
  - [ ] Validate feature list structure

---

## Phase 4: Templates (Days 7-9)

### 4.1 Docker Templates
- [ ] Create `templates/infra/docker/Dockerfile.fastapi`
- [ ] Create `templates/infra/docker/Dockerfile.celery`
- [ ] Create `templates/infra/docker/Dockerfile.astro-ssr`
- [ ] Create `templates/infra/docker/Dockerfile.astro-ssg`
- [ ] Create `templates/infra/docker/Dockerfile.nginx`
- [ ] Create `templates/infra/docker/.dockerignore`

### 4.2 Compose Templates
- [ ] Create `templates/infra/compose/docker-compose.dev.yml`
- [ ] Create `templates/infra/compose/docker-compose.staging.yml`
- [ ] Create `templates/infra/compose/docker-compose.prod.yml`

### 4.3 Nginx Templates
- [ ] Create `templates/infra/nginx/nginx.dev.conf`
- [ ] Create `templates/infra/nginx/nginx.staging.conf`
- [ ] Create `templates/infra/nginx/nginx.prod.conf`

### 4.4 Script Templates
- [ ] Create `templates/infra/scripts/deploy.sh`
- [ ] Create `templates/infra/scripts/backup.sh`
- [ ] Create `templates/infra/scripts/rollback.sh`
- [ ] Create `templates/infra/scripts/health-check.sh`
- [ ] Create `templates/infra/scripts/setup-droplet.sh`

### 4.5 GitHub Workflow Templates
- [ ] Create `templates/infra/github/ci.yml`
- [ ] Create `templates/infra/github/deploy-staging.yml`
- [ ] Create `templates/infra/github/deploy-prod.yml`

### 4.6 Python Config Templates
- [ ] Create `templates/infra/python/pytest.ini`
- [ ] Create `templates/infra/python/conftest.py`
- [ ] Create `templates/infra/python/alembic.ini`
- [ ] Create `templates/infra/python/alembic/env.py`
- [ ] Create `templates/infra/python/alembic/script.py.mako`
- [ ] Create `templates/infra/python/alembic/versions/.gitkeep`

### 4.7 Environment Templates
- [ ] Create `templates/infra/env/.env.example`
- [ ] Create `templates/infra/env/.env.production.template`

---

## Phase 5: Template Engine (Days 10-11)

### 5.1 Variable Resolution
- [ ] Implement `lib/template-engine.ts`
  - [ ] Variable substitution ({{VAR}})
  - [ ] Default values ({{VAR:-default}})
  - [ ] Conditional blocks ({{#if}}...{{/if}})
  - [ ] Equality checks ({{#if_equals VAR "value"}})
  - [ ] Variable validation

### 5.2 Template Selection
- [ ] Implement template selection logic
  - [ ] Select based on stack (Dockerfile.fastapi vs Dockerfile.django)
  - [ ] Select based on mode (Dockerfile.astro-ssr vs Dockerfile.astro-ssg)
  - [ ] Select based on environment (nginx.dev.conf vs nginx.prod.conf)

### 5.3 File Generation
- [ ] Implement file generation
  - [ ] Read template
  - [ ] Resolve variables
  - [ ] Write to target path
  - [ ] Handle multi-file templates (alembic/*)

---

## Phase 6: Orchestrator (Days 12-14)

### 6.1 Background Agent Spawning
- [ ] Implement `lib/orchestrator.ts`
  - [ ] Spawn agent subprocess
  - [ ] Pass session file path
  - [ ] Stream output
  - [ ] Track agent state
  - [ ] Handle agent completion/failure

### 6.2 Progress Widget
- [ ] Implement progress widget in extension
  - [ ] Show current step (initializer/planner/builder/tester)
  - [ ] Show feature grid (like agent-chain.ts)
  - [ ] Show current feature being worked on
  - [ ] Show test status
  - [ ] Update in real-time

### 6.3 Progress Tracking
- [ ] Implement `lib/progress.ts`
  - [ ] Create progress.md
  - [ ] Append session entries
  - [ ] Parse progress.md for resume
  - [ ] Generate summary

### 6.4 User Interaction
- [ ] Implement `lib/user-interaction.ts`
  - [ ] Ask initial questions (project name, domain, etc.)
  - [ ] Ask on feature failure (skip/retry/abort)
  - [ ] Ask on ambiguity (which entry point?)
  - [ ] Ask on resume (continue from feature X?)

### 6.5 Resume Capability
- [ ] Implement resume logic
  - [ ] Check for progress.md on start
  - [ ] Parse last state
  - [ ] Load feature-list.json
  - [ ] Determine current step
  - [ ] Ask user to resume or restart

---

## Phase 7: Blocking Gates (Day 15)

### 7.1 Feature List Gate
- [ ] Implement blocking in builder agent
  - [ ] Check feature-list.json exists
  - [ ] Block if not: "Run initializer first"

### 7.2 In-Progress Gate
- [ ] Implement blocking in builder agent
  - [ ] Check feature is in_progress before writing
  - [ ] Block if not: "Mark feature in_progress first"

### 7.3 Test-Before-Done Gate
- [ ] Implement blocking in builder agent
  - [ ] Run test before marking done
  - [ ] Block marking done if test fails
  - [ ] Retry up to 3 times

### 7.4 Damage Control
- [ ] Integrate with damage-control.ts pattern
  - [ ] Block `rm -rf data/`
  - [ ] Block `docker system prune -af`
  - [ ] Block dangerous SQL commands

---

## Phase 8: Extension Integration (Days 16-17)

### 8.1 Command Registration
- [ ] Register `/build-infra` command
- [ ] Implement command handler
- [ ] Call orchestrator.runChain()

### 8.2 Widget Registration
- [ ] Register build-infra widget
- [ ] Implement render() method
- [ ] Implement invalidate() method
- [ ] Handle widget placement

### 8.3 Session Lifecycle
- [ ] Hook into `session_start` event
- [ ] Hook into `session_end` event
- [ ] Hook into `before_agent_start` event (for system prompt)
- [ ] Clean up on session end

### 8.4 Footer Integration
- [ ] Show current step in footer
- [ ] Show feature progress (X/Y)
- [ ] Show context usage

---

## Phase 9: Testing & Validation (Days 18-20)

### 9.1 Sample Project
- [ ] Create sample FastAPI + Astro project
  - [ ] FastAPI app with /health endpoint
  - [ ] Celery worker
  - [ ] Astro SSR frontend
  - [ ] pyproject.toml with dependencies
  - [ ] requirements.txt (alternative)

### 9.2 Workflow Testing
- [ ] Test initializer on sample project
  - [ ] Verify detection works
  - [ ] Verify questions asked
  - [ ] Verify infra-spec.md created
  - [ ] Verify feature-list.json created
- [ ] Test planner on output
  - [ ] Verify infra-plan.md created
  - [ ] Verify templates referenced correctly
- [ ] Test builder on plan
  - [ ] Verify files created
  - [ ] Verify tests run
  - [ ] Verify commits made
  - [ ] Verify feature-list.json updated
- [ ] Test tester on built infra
  - [ ] Verify docker-compose starts
  - [ ] Verify health checks pass
  - [ ] Verify stack-healthy marked

### 9.3 Resume Testing
- [ ] Test resume from initializer
- [ ] Test resume from builder (mid-feature)
- [ ] Test resume from tester

### 9.4 Failure Testing
- [ ] Test feature failure (force bad template)
- [ ] Test user skip
- [ ] Test user retry
- [ ] Test abort

### 9.5 Edge Cases
- [ ] Test with no pyproject.toml
- [ ] Test with multiple FastAPI entry points
- [ ] Test with existing Dockerfile
- [ ] Test with missing dependencies

---

## Phase 10: Documentation (Day 21)

### 10.1 User Documentation
- [ ] Create `docs/infra/README.md`
- [ ] Document how to run `/build-infra`
- [ ] Document what questions will be asked
- [ ] Document expected output
- [ ] Document troubleshooting

### 10.2 Developer Documentation
- [ ] Document agent definitions
- [ ] Document feature generation logic
- [ ] Document template engine
- [ ] Document orchestrator flow

### 10.3 Template Documentation
- [ ] Document all template variables
- [ ] Document template selection logic
- [ ] Document how to add new templates

---

## Phase 11: Polish & Optimization (Day 22)

### 11.1 Error Messages
- [ ] Improve error messages for clarity
- [ ] Add remediation hints
- [ ] Make errors actionable

### 11.2 Performance
- [ ] Optimize template loading
- [ ] Optimize feature generation
- [ ] Cache detection results

### 11.3 UX
- [ ] Improve widget visualization
- [ ] Add progress percentage
- [ ] Add estimated time remaining
- [ ] Add success/failure sounds (optional)

---

## Phase 12: Final Validation (Day 23)

### 12.1 Full Workflow Test
- [ ] Run complete workflow on fresh project
- [ ] Verify all 28 features generate
- [ ] Verify all tests pass
- [ ] Verify deploy script works
- [ ] Verify docker-compose up works

### 12.2 Success Criteria Check
- [ ] Agent detects stack correctly (95%+ accuracy)
- [ ] All generated Dockerfiles build successfully
- [ ] All docker-compose files validate
- [ ] docker-compose up starts all services
- [ ] Health checks pass on all services
- [ ] Total workflow time: <20 minutes
- [ ] User intervention rate: <10%

---

## File Checklist

### Must Create

```
.pi/
├── agents/
│   ├── initializer.md
│   ├── planner.md
│   ├── builder.md
│   ├── tester.md
│   └── build-infra.yaml

templates/infra/
├── docker/
│   ├── Dockerfile.fastapi
│   ├── Dockerfile.celery
│   ├── Dockerfile.astro-ssr
│   ├── Dockerfile.astro-ssg
│   ├── Dockerfile.nginx
│   └── .dockerignore
├── compose/
│   ├── docker-compose.dev.yml
│   ├── docker-compose.staging.yml
│   └── docker-compose.prod.yml
├── nginx/
│   ├── nginx.dev.conf
│   ├── nginx.staging.conf
│   └── nginx.prod.conf
├── scripts/
│   ├── deploy.sh
│   ├── backup.sh
│   ├── rollback.sh
│   ├── health-check.sh
│   └── setup-droplet.sh
├── github/
│   ├── ci.yml
│   ├── deploy-staging.yml
│   └── deploy-prod.yml
├── python/
│   ├── pytest.ini
│   ├── conftest.py
│   ├── alembic.ini
│   └── alembic/
│       ├── env.py
│       ├── script.py.mako
│       └── versions/.gitkeep
└── env/
    ├── .env.example
    └── .env.production.template

lib/
├── detect-stack.ts
├── feature-definitions.ts
├── feature-generator.ts
├── feature-list.ts
├── template-engine.ts
├── orchestrator.ts
├── progress.ts
└── user-interaction.ts

schemas/
├── feature-list.json
├── infra-spec.json
├── progress.json
└── detected-stack.json

extensions/
└── build-infra.ts
```

### Must Update

```
docs/
├── product-specs/
│   └── build-infra-prd.md (created ✓)
└── references/
    ├── build-infra-feature-generation.md (created ✓)
    └── build-infra-template-variables.md (created ✓)
```

---

## Dependencies

### NPM Packages (if needed)
- [ ] yaml parser (for agent-chain.yaml)
- [ ] handlebars or similar (for template engine)
- [ ] json-schema validation

### External Tools
- Docker (for testing)
- Docker Compose (for testing)
- Git (for commits)
- curl (for health checks)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Detection accuracy | 95%+ |
| Template generation success | 100% |
| Test pass rate | 100% |
| Total workflow time | <20 min |
| User intervention rate | <10% |
| Resume success rate | 100% |
| Code quality | No lint errors |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Detection failures | Fallback to manual questions |
| Template errors | Validation before generation |
| Context exhaustion | Background sessions + progress.md |
| Test flakiness | Retry logic + clear errors |

---

## Timeline

| Week | Focus | Days |
|------|-------|------|
| 1 | Foundation + Agents | 1-4 |
| 2 | Features + Templates | 5-9 |
| 3 | Engine + Orchestrator | 10-14 |
| 4 | Gates + Integration | 15-17 |
| 5 | Testing + Docs | 18-21 |
| 6 | Polish + Validation | 22-23 |

**Total: ~3-4 weeks**
