# Build-API Workflow - Product Requirements Document

**Status**: Draft
**Version**: 1.0.0
**Created**: 2026-03-23
**Target Stack**: FastAPI + SQLAlchemy 2.0 + PostgreSQL + pytest
**Based On**: build-infra-prd.md with lessons from build-infra-evaluation-001.md

---

## 1. Executive Summary

Build-API is a vertical-specific autonomous agent workflow that generates REST API code following Test-Driven Development (TDD). Given a `/product-spec/` folder describing entities, authentication, and endpoints, it produces:

- SQLAlchemy 2.0 models with relationships
- Pydantic schemas for validation
- FastAPI routes with CRUD operations
- Service layer for business logic
- JWT-based authentication/authorization
- Comprehensive unit and integration tests

The workflow applies lessons from the build-infra evaluation to ensure **mechanical enforcement from day one** - extension controls tests, commits, and session integrity.

---

## 2. Problem Statement

### Current Pain Points

1. **Repetitive CRUD code**: Every entity needs models, schemas, routes, services, tests
2. **Inconsistent patterns**: Different developers use different API structures
3. **Missing tests**: TDD is often skipped due to time pressure
4. **Knowledge gap**: Best practices for FastAPI, SQLAlchemy 2.0 async, pytest
5. **Auth complexity**: JWT, role-based access, middleware setup

### Target Users

- Developers building FastAPI REST APIs
- Teams wanting standardized API patterns with tests
- Solo developers who want production-ready code without boilerplate

---

## 3. Goals & Non-Goals

### Goals

1. Generate working REST API code from product specifications
2. Enforce TDD - tests written before implementation (RED → GREEN)
3. Apply mechanical enforcement lessons from build-infra evaluation
4. Support custom endpoints beyond CRUD
5. Generate comprehensive test coverage (>80%)
6. Follow SQLAlchemy 2.0 async best practices

### Non-Goals

1. GraphQL API generation
2. gRPC/protobuf support
3. Microservices architecture
4. WebSocket/SSE endpoints
5. Frontend code generation
6. Infrastructure code (use build-infra for that)

---

## 4. Technical Stack

### Supported Stack

| Component | Technology | Version |
|-----------|------------|---------|
| API Framework | FastAPI | Latest |
| ORM | SQLAlchemy | 2.0+ (async) |
| Validation | Pydantic | v2 |
| Database | PostgreSQL | 16 |
| Testing | pytest + pytest-asyncio | Latest |
| Auth | python-jose (JWT) | Latest |
| Password | passlib + bcrypt | Latest |
| Migrations | Alembic | Latest |

### Code Patterns

```
app/
├── models/         # SQLAlchemy ORM models
├── schemas/        # Pydantic request/response schemas
├── routes/         # FastAPI route handlers
├── services/       # Business logic layer
├── auth/           # JWT, middleware, dependencies
└── config.py       # Settings (Pydantic Settings)
```

---

## 5. Workflow Architecture

### 5.1 Agent Chain

```
INITIALIZER → PLANNER → BUILDER → TESTER
```

| Agent | Responsibility | Session File |
|-------|---------------|--------------|
| initializer | Read product-spec, generate feature list | `.pi/agent-sessions/api-initializer.json` |
| planner | Create detailed implementation plan | `.pi/agent-sessions/api-planner.json` |
| builder | Implement features one at a time (TDD) | `.pi/agent-sessions/api-builder.json` |
| tester | Run full test suite, verify coverage | `.pi/agent-sessions/api-tester.json` |

### 5.2 Artifacts

**Primary Artifact:**

| Artifact | Purpose | Owned By | Mutation Rule |
|----------|---------|----------|---------------|
| `progress.md` | Context restoration between sessions | Extension | Current State rewritten; Session Log append-only |

**Supporting Artifacts:**

| Artifact | Purpose | Created By | Validated By |
|----------|---------|------------|--------------|
| `api-spec.md` | Summary of product-spec | initializer | Extension |
| `feature-list.json` | Features with test commands | initializer | Extension |
| `api-plan.md` | File-by-file implementation details | planner | Extension (blocks if missing) |
| `detected-conventions.json` | Code style from existing files | initializer | Extension |

### 5.3 Lessons from Build-Infra Evaluation

**Critical Issues Fixed from Day One:**

| Issue (build-infra) | Root Cause | Fix (build-api) |
|---------------------|------------|-----------------|
| infra-plan.md missing | No validation gate | Extension validates api-plan.md exists after planner |
| Agent runs tests | Trust-based system | Extension runs tests, agent CANNOT |
| Agent sets passes:true | Agent controls JSON | Extension sets passes, agent CANNOT modify |
| Single giant commit | Agent-controlled batching | Extension spawns per-feature, extension commits |
| Session log noise | Agent appends per-test | Extension appends once per phase |
| No enforcement | Prompts only | Mechanical enforcement in extension code |

**Key Principle (from evaluation):**
> "Agents will optimize for task completion over process compliance. Enforcement must happen in code, not prompts."

### 5.4 TDD Workflow

For each feature, the workflow enforces Test-Driven Development:

```
1. BUILDER writes TEST file (RED phase)
   - Extension runs test → FAILS (expected, feature not implemented)
   - Extension sets test_exists: true, implementation_exists: false
   
2. BUILDER writes IMPLEMENTATION (GREEN phase)
   - Extension runs test → PASSES or FAILS
   - Extension sets passes: true/false based on actual test result
   
3. Extension commits if passing
   - Commit message: "feat(api): add users-list endpoint"
   - Extension controls commits, not agent
```

---

## 6. Feature List

### 6.1 Feature Categories

#### Authentication (5 features)

| ID | Description | Test |
|----|-------------|------|
| `auth-models` | User model with password hash | `pytest tests/unit/test_user_model.py -v` |
| `auth-password` | Password hashing utilities | `pytest tests/unit/test_password.py -v` |
| `auth-jwt` | JWT token creation/validation | `pytest tests/unit/test_jwt.py -v` |
| `auth-routes` | Login, register, refresh endpoints | `pytest tests/integration/test_auth.py -v` |
| `auth-middleware` | Auth dependency injection | `pytest tests/unit/test_auth_middleware.py -v` |

#### Per-Entity CRUD (8 features per entity)

| ID | Description | Test |
|----|-------------|------|
| `{entity}-model` | SQLAlchemy model | `pytest tests/unit/models/test_{entity}.py -v` |
| `{entity}-schema` | Pydantic schemas | `pytest tests/unit/schemas/test_{entity}.py -v` |
| `{entity}-service` | Service layer CRUD | `pytest tests/unit/services/test_{entity}_service.py -v` |
| `{entity}-list` | GET /{entity}s endpoint | `pytest tests/integration/test_{entity}_list.py -v` |
| `{entity}-get` | GET /{entity}s/{id} endpoint | `pytest tests/integration/test_{entity}_get.py -v` |
| `{entity}-create` | POST /{entity}s endpoint | `pytest tests/integration/test_{entity}_create.py -v` |
| `{entity}-update` | PUT/PATCH /{entity}s/{id} | `pytest tests/integration/test_{entity}_update.py -v` |
| `{entity}-delete` | DELETE /{entity}s/{id} | `pytest tests/integration/test_{entity}_delete.py -v` |

#### Custom Endpoints (variable)

Defined in `product-spec/endpoints.yaml`, each gets:
| ID | Description | Test |
|----|-------------|------|
| `{name}-endpoint` | Custom route implementation | `pytest tests/integration/test_{name}.py -v` |

#### Final Validation (1 feature)

| ID | Description | Test |
|----|-------------|------|
| `api-healthy` | All tests pass, coverage >80% | `pytest --cov=app --cov-fail-under=80` |

### 6.2 Feature Schema

```json
{
  "id": "users-list",
  "desc": "GET /users endpoint with pagination",
  "file": "app/routes/users.py",
  "test_file": "tests/integration/test_users_list.py",
  "test": "pytest tests/integration/test_users_list.py -v",
  "depends_on": ["users-model", "users-schema", "users-service"],
  "passes": false,
  "test_exists": false,
  "implementation_exists": false,
  "status": "idle",
  "attempts": 0,
  "skip": false,
  "tdd_phase": null
}
```

**Status values**: `idle` | `in_progress` | `done` | `failed` | `skipped`
**TDD phase values**: `null` | `red` | `green`

### 6.3 Feature Generation

Features are generated from `/product-spec/`:

```typescript
function generateFeatures(spec: ProductSpec): Feature[] {
  const features: Feature[] = [];
  
  // Auth features (if auth enabled)
  if (spec.auth?.enabled) {
    features.push(...getAuthFeatures(spec.auth));
  }
  
  // Entity CRUD features
  for (const entity of spec.entities) {
    features.push(...getEntityCRUDFeatures(entity));
  }
  
  // Custom endpoint features
  for (const endpoint of spec.endpoints) {
    features.push(getEndpointFeature(endpoint));
  }
  
  // Final validation
  features.push(getAPIHealthyFeature());
  
  return sortDependencies(features);
}
```

---

## 7. Mechanical Enforcement

### 7.1 Extension Architecture

The extension (`extensions/build-api.ts`) implements these functions:

**Artifact Validation:**
```typescript
function validateInitializerArtifacts(cwd: string): { valid: boolean; missing: string[] }
// Checks: api-spec.md, feature-list.json, detected-conventions.json

function validatePlannerArtifacts(cwd: string): { valid: boolean; missing: string[] }
// Checks: api-plan.md (BLOCKS if missing)
```

**Per-Feature Dispatch:**
```typescript
async function runBuildPhase(ctx: any): Promise<BuildResult> {
  while (hasPendingFeatures(readFeatureList(projectCwd))) {
    const feature = getNextPendingFeature(readFeatureList(projectCwd));
    
    // Mark in_progress
    updateFeatureStatus(projectCwd, feature.id, { status: 'in_progress' });
    
    // TDD: RED phase - write test first
    if (!feature.test_exists) {
      await dispatchAgent('api-builder', 
        `Write TEST for feature: ${feature.id}\n` +
        `Test file: ${feature.test_file}\n` +
        `Write the test, then STOP. Do NOT implement.`
      );
      updateFeatureStatus(projectCwd, feature.id, { test_exists: true, tdd_phase: 'red' });
    }
    
    // TDD: GREEN phase - implement
    await dispatchAgent('api-builder',
      `Write IMPLEMENTATION for feature: ${feature.id}\n` +
      `File: ${feature.file}\n` +
      `Write implementation to pass the test, then STOP.`
    );
    updateFeatureStatus(projectCwd, feature.id, { implementation_exists: true, tdd_phase: 'green' });
    
    // EXTENSION runs test (NOT agent)
    const testResult = await runTest(feature.test, projectCwd);
    
    // EXTENSION sets passes (NOT agent)
    updateFeatureStatus(projectCwd, feature.id, {
      passes: testResult.passes,
      status: testResult.passes ? 'done' : 'failed'
    });
    
    // EXTENSION commits if passing
    if (testResult.passes) {
      await commitFeature(feature);
    }
  }
}
```

**Test Execution:**
```typescript
async function runTest(testCommand: string, cwd: string): Promise<TestResult> {
  return new Promise((resolve) => {
    exec(testCommand, { cwd, timeout: 60000 }, (error, stdout, stderr) => {
      resolve({
        passes: !error,
        output: stdout + stderr,
        exitCode: error?.code || 0
      });
    });
  });
}
```

**Session Log Control:**
```typescript
function appendSessionLog(cwd: string, agent: string, data: SessionData): void {
  // Extension controls logging, validates append-only
  const existing = readFileSync(join(cwd, 'progress.md'), 'utf-8');
  const existingLog = existing.match(/## Session Log[\s\S]*$/)?.[0] || '';
  
  // Append new entry
  const entry = formatEntry(agent, data);
  const updated = existing.replace(/## Session Log[\s\S]*$/, existingLog + entry);
  writeFileSync(join(cwd, 'progress.md'), updated);
  
  // Validate append-only
  const newLog = readFileSync(join(cwd, 'progress.md'), 'utf-8').match(/## Session Log[\s\S]*$/)?.[0];
  if (!newLog?.includes(existingLog)) {
    throw new Error('Session log corrupted');
  }
}
```

### 7.2 Extension Tools

| Tool | Purpose | Agent Can Use? |
|------|---------|----------------|
| `run_workflow` | Execute full workflow with enforcement | Yes |
| `verify_artifacts` | Check required files exist | Yes |
| `get_next_feature` | Get next pending feature | Yes |
| `verify_feature` | Run test, set passes | Yes (extension executes) |
| `dispatch_agent` | Dispatch to specialist | Yes |

### 7.3 What Agents CANNOT Do

Agent prompts explicitly forbid:

```
CRITICAL RESTRICTIONS - You CANNOT:
1. Run pytest or any test commands
2. Modify passes field in feature-list.json
3. Modify status field in feature-list.json
4. Commit changes (extension handles this)
5. Implement multiple features in one session
6. Skip the test-first (RED) phase
```

---

## 8. Agent Definitions

### 8.1 Initializer Agent

**Purpose**: Read product-spec and generate feature list

**Tools**: `read`, `bash`, `grep`, `glob`

**Inputs**: `/product-spec/` folder

**Outputs**:
- `api-spec.md` - Summary of requirements
- `feature-list.json` - All features with test commands
- `detected-conventions.json` - Code style from existing files
- Updated `progress.md`

**Workflow**:
1. Read progress.md (resume if exists)
2. Read all files in `/product-spec/`
3. Detect existing code conventions (read existing models/routes if present)
4. Generate feature list from spec
5. Validate feature dependencies
6. Update progress.md

**Blocking Rules**:
- Cannot proceed if `/product-spec/` folder missing
- Must create both api-spec.md AND feature-list.json

### 8.2 Planner Agent

**Purpose**: Create detailed implementation plan

**Tools**: `read`

**Inputs**:
- `api-spec.md`
- `feature-list.json`
- `detected-conventions.json`

**Outputs**:
- `api-plan.md` - File-by-file implementation details
- Updated `progress.md`

**api-plan.md Format**:
```markdown
## Feature: users-model
- File: app/models/user.py
- Test file: tests/unit/models/test_user.py
- Template: models/sqlalchemy-user.py
- Variables:
  - ENTITY_NAME: "User"
  - TABLE_NAME: "users"
  - FIELDS: [id, email, hashed_password, is_active, created_at]
- Depends on: auth-password
- Test: pytest tests/unit/models/test_user.py -v

## Feature: users-list
- File: app/routes/users.py
- Test file: tests/integration/test_users_list.py
- Implementation:
  - Route: GET /users
  - Query params: skip, limit
  - Response: List[UserOut]
  - Auth: required (admin only)
- Depends on: users-model, users-schema, users-service, auth-middleware
- Test: pytest tests/integration/test_users_list.py -v
```

**CRITICAL**: This file MUST be created. Extension validates and blocks build if missing.

### 8.3 Builder Agent

**Purpose**: Implement features following TDD

**Tools**: `read`, `write`, `edit`

**Restrictions**:
- CANNOT run tests
- CANNOT modify passes/status in feature-list.json
- CANNOT commit
- CANNOT implement multiple features

**Workflow (per feature)**:

**RED Phase (test-first)**:
1. Read api-plan.md for feature details
2. Read existing code conventions
3. Write TEST file only
4. STOP - extension will verify test fails

**GREEN Phase (implementation)**:
1. Read api-plan.md for feature details
2. Read existing code conventions
3. Write IMPLEMENTATION file
4. STOP - extension will run test and set passes

**Prompt Structure**:
```
You are implementing feature: {feature.id}

PHASE: {RED|GREEN}

{if RED}
Write the TEST file: {feature.test_file}
Test should FAIL initially (no implementation exists yet).
DO NOT write implementation. STOP after writing test.

{if GREEN}
Write the IMPLEMENTATION file: {feature.file}
Implementation should pass the test in {feature.test_file}.
DO NOT run tests. STOP after writing implementation.

CRITICAL RESTRICTIONS:
- Do NOT run pytest or any test commands
- Do NOT modify feature-list.json
- Do NOT commit changes
- Do NOT implement multiple features
```

### 8.4 Tester Agent

**Purpose**: Run full test suite and verify coverage

**Tools**: `read`, `bash`

**Restrictions**:
- CANNOT modify passes in feature-list.json
- Reports only, extension handles updates

**Workflow**:
1. Read progress.md
2. Run `pytest --cov=app --cov-report=term-missing`
3. Parse coverage report
4. Run integration tests
5. Report pass/fail with details
6. STOP - extension updates api-healthy feature

---

## 9. Product Spec Format

Users provide `/product-spec/` folder with these files:

### 9.1 entities.yaml

```yaml
entities:
  - name: User
    table: users
    fields:
      - name: email
        type: string
        unique: true
        required: true
      - name: hashed_password
        type: string
        required: true
        exclude_from_response: true
      - name: is_active
        type: boolean
        default: true
      - name: role
        type: enum
        values: [admin, user, guest]
        default: user
      - name: created_at
        type: datetime
        auto: true
    relationships:
      - has_many: Post
        foreign_key: author_id
    crud:
      create: admin_only
      read: authenticated
      update: owner_or_admin
      delete: admin_only

  - name: Post
    table: posts
    fields:
      - name: title
        type: string
        required: true
        max_length: 200
      - name: content
        type: text
        required: true
      - name: published
        type: boolean
        default: false
      - name: author_id
        type: foreign_key
        references: User
        required: true
    relationships:
      - belongs_to: User
        as: author
    crud:
      create: authenticated
      read: public
      update: owner_only
      delete: owner_only
```

### 9.2 auth.yaml

```yaml
auth:
  enabled: true
  type: jwt
  jwt:
    algorithm: HS256
    access_token_expire_minutes: 30
    refresh_token_expire_days: 7
  password:
    algorithm: bcrypt
  endpoints:
    login: /auth/login
    register: /auth/register
    refresh: /auth/refresh
    me: /auth/me
  roles:
    - name: admin
      permissions: [create, read, update, delete]
    - name: user
      permissions: [create, read, update_own]
    - name: guest
      permissions: [read]
```

### 9.3 endpoints.yaml

```yaml
endpoints:
  - name: user-posts
    method: GET
    path: /users/{user_id}/posts
    description: Get all posts by a specific user
    auth: authenticated
    query_params:
      - name: skip
        type: integer
        default: 0
      - name: limit
        type: integer
        default: 10
        max: 100
    response: List[PostOut]
    
  - name: search-posts
    method: GET
    path: /posts/search
    description: Full-text search on posts
    auth: public
    query_params:
      - name: q
        type: string
        required: true
        min_length: 3
      - name: skip
        type: integer
        default: 0
      - name: limit
        type: integer
        default: 20
    response: List[PostOut]
```

### 9.4 services.yaml

```yaml
services:
  - name: email
    description: Email sending service
    methods:
      - name: send_welcome_email
        params:
          - name: user
            type: User
        returns: bool
      - name: send_notification
        params:
          - name: user
            type: User
          - name: message
            type: str
        returns: bool
```

---

## 10. Test Structure

### 10.1 Directory Structure

```
tests/
├── conftest.py              # Fixtures (client, db, users)
├── unit/
│   ├── models/
│   │   ├── test_user.py
│   │   └── test_post.py
│   ├── schemas/
│   │   ├── test_user_schema.py
│   │   └── test_post_schema.py
│   ├── services/
│   │   ├── test_user_service.py
│   │   └── test_post_service.py
│   └── auth/
│       ├── test_jwt.py
│       └── test_password.py
└── integration/
    ├── test_auth.py
    ├── test_users_crud.py
    ├── test_posts_crud.py
    └── test_custom_endpoints.py
```

### 10.2 Test Templates

**Unit Test (Model)**:
```python
# tests/unit/models/test_user.py
import pytest
from app.models.user import User

def test_user_creation():
    user = User(email="test@example.com", hashed_password="hash")
    assert user.email == "test@example.com"
    assert user.is_active is True

def test_user_default_role():
    user = User(email="test@example.com", hashed_password="hash")
    assert user.role == "user"
```

**Integration Test (Endpoint)**:
```python
# tests/integration/test_users_list.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_list_users_authenticated(client: AsyncClient, auth_headers: dict):
    response = await client.get("/users", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_list_users_unauthenticated(client: AsyncClient):
    response = await client.get("/users")
    assert response.status_code == 401
```

### 10.3 Test Fixtures (conftest.py)

```python
import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.main import app
from app.database import get_db

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as session:
        yield session

@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers(create_user):
    # Returns headers with valid JWT
    ...
```

---

## 11. Templates

### 11.1 Template Variables

Variables follow same pattern as build-infra - descriptive names for LLM comprehension.

#### Global Variables

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `{{PROJECT_NAME}}` | Project identifier | `my-api` | User input |
| `{{ENTITY_NAME}}` | Entity class name | `User` | From entities.yaml |
| `{{ENTITY_NAME_LOWER}}` | Lowercase entity | `user` | Derived |
| `{{TABLE_NAME}}` | Database table | `users` | From entities.yaml |
| `{{PRIMARY_KEY}}` | Primary key field | `id` | Default |

#### Auth Variables

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `{{JWT_ALGORITHM}}` | JWT algorithm | `HS256` | From auth.yaml |
| `{{ACCESS_TOKEN_EXPIRE}}` | Token expiry minutes | `30` | From auth.yaml |
| `{{PASSWORD_ALGORITHM}}` | Hash algorithm | `bcrypt` | From auth.yaml |

#### Field Variables (per entity)

| Variable | Description | Example |
|----------|-------------|---------|
| `{{FIELD_NAME}}` | Field name | `email` |
| `{{FIELD_TYPE}}` | Python type | `str` |
| `{{FIELD_PYDANTIC}}` | Pydantic type | `EmailStr` |
| `{{FIELD_SQLALCHEMY}}` | SQLAlchemy type | `String(255)` |
| `{{FIELD_REQUIRED}}` | Is required | `True` |
| `{{FIELD_DEFAULT}}` | Default value | `None` |

### 11.2 Template Files

#### Model Templates (1 per entity type)

```
templates/api/models/
├── base.py.jinja           # Base model class
├── entity.py.jinja         # Generic entity model
├── user.py.jinja           # User model with auth fields
└── relationship.py.jinja   # Relationship helpers
```

#### Schema Templates (3 per entity)

```
templates/api/schemas/
├── base.py.jinja           # Base schema class
├── create.py.jinja         # Create schema (input)
├── update.py.jinja         # Update schema (partial)
└── out.py.jinja            # Output schema (response)
```

#### Service Templates (1 per entity)

```
templates/api/services/
├── base.py.jinja           # Base service class
└── crud.py.jinja           # CRUD service implementation
```

#### Route Templates (5 per entity + auth)

```
templates/api/routes/
├── base.py.jinja           # Base router class
├── list.py.jinja           # GET /entities list endpoint
├── get.py.jinja            # GET /entities/{id} endpoint
├── create.py.jinja         # POST /entities endpoint
├── update.py.jinja         # PUT/PATCH /entities/{id}
├── delete.py.jinja         # DELETE /entities/{id}
└── auth.py.jinja           # Auth routes (login, register, refresh)
```

#### Auth Templates

```
templates/api/auth/
├── jwt.py.jinja            # JWT utilities
├── password.py.jinja       # Password hashing
├── middleware.py.jinja     # Auth middleware
└── dependencies.py.jinja   # FastAPI dependencies
```

#### Test Templates

```
templates/api/tests/
├── conftest.py.jinja       # Test fixtures
├── unit/
│   ├── model.py.jinja      # Unit test for model
│   ├── schema.py.jinja     # Unit test for schema
│   ├── service.py.jinja    # Unit test for service
│   └── auth.py.jinja       # Unit test for auth utils
└── integration/
    ├── crud.py.jinja       # Integration test for CRUD
    ├── auth.py.jinja       # Integration test for auth
    └── custom.py.jinja     # Integration test for custom endpoints
```

#### Config Templates

```
templates/api/config/
├── settings.py.jinja       # Pydantic Settings
├── database.py.jinja       # SQLAlchemy async setup
└── main.py.jinja           # FastAPI app factory
```

### 11.3 Template Engine Rules

Same as build-infra:
1. Variable substitution: `{{VARIABLE}}`
2. Conditional blocks: `{% if CONDITION %}...{% endif %}`
3. Iterative blocks: `{% for ITEM in ITEMS %}...{% endfor %}`
4. Default values: `{{VARIABLE|default('value')}}`
5. Validation: All variables resolved before generation

---

## 12. File Structure

### 12.1 Generated Files

```
project/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app
│   ├── config.py                  # Settings (Pydantic)
│   ├── database.py                # Async DB setup
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py                # Base model class
│   │   ├── user.py                # User model
│   │   └── post.py                # Post model (example)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py                # User schemas (create, update, out)
│   │   └── post.py                # Post schemas
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py                # Login, register, refresh
│   │   ├── users.py               # User CRUD
│   │   └── posts.py               # Post CRUD
│   ├── services/
│   │   ├── __init__.py
│   │   ├── user_service.py
│   │   └── post_service.py
│   └── auth/
│       ├── __init__.py
│       ├── jwt.py
│       ├── password.py
│       └── middleware.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── unit/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── auth/
│   └── integration/
│       ├── test_auth.py
│       ├── test_users_crud.py
│       ├── test_posts_crud.py
│       └── test_custom_endpoints.py
├── migrations/
│   └── versions/
├── product-spec/
│   ├── entities.yaml
│   ├── auth.yaml
│   ├── endpoints.yaml
│   └── services.yaml
├── api-spec.md                    # Generated summary
├── api-plan.md                    # Implementation plan
├── feature-list.json              # Feature status
├── progress.md                    # Session progress
├── pytest.ini
├── requirements.txt
└── alembic.ini
```

### 12.2 Builder Framework Files (Toolkit Source)

```
builder/
├── .pi/
│   └── agents/
│       ├── api-initializer.md     # Read product-spec, generate features
│       ├── api-planner.md         # Implementation planning
│       ├── api-builder.md         # Feature implementation (TDD)
│       ├── api-tester.md          # End-to-end verification
│       └── build-api.yaml         # Team definition (agent order)
├── extensions/
│   └── build-api.ts               # Orchestrator extension
└── templates/
    └── api/
        ├── models/
        ├── schemas/
        ├── routes/
        ├── services/
        ├── auth/
        ├── tests/
        └── config/
```

### 12.3 Usage

```bash
# In your project directory with /product-spec/ folder
pi -e extensions/build-api.ts

# Or use justfile
just build-api
```

The orchestrator will:
1. Load agents from `.pi/agents/api-*.md`
2. Dispatch to each agent in sequence (initializer → planner → builder → tester)
3. Track progress via `progress.md` and `feature-list.json`
4. Generate API code from templates with enforcement
5. Run tests via extension (not agents)
6. Commit per feature

---

## 13. Progress File

Same structure as build-infra, with API-specific fields:

```markdown
# Build-API Progress

## Current State

### Where We Are
- **Active agent**: [initializer | planner | builder | tester]
- **Current phase**: [spec | planning | building | testing]
- **Feature progress**: [N/M] features complete
- **Current feature**: [feature-id] — [status] — [TDD phase: RED|GREEN]
- **Overall health**: [on-track | blocked | needs-user-input]

### Gotchas Discovered
- [e.g., "Existing code uses sync SQLAlchemy - all new code must be async"]
- [e.g., "User model already exists - skip users-model feature"]

### Key Decisions Made
- [e.g., "Using role-based auth instead of permission-based"]

### Next Session Instructions
1. [Specific instructions for next agent]
2. [Dependency order notes]

---

## Session Log

### 2026-03-23T10:00:00Z — api-initializer
- **Intent**: Read product-spec, generate features
- **Features generated**: 21
- **Duration**: 45s
- **Result**: completed
- **Commits**: none
- **Errors**: none

### 2026-03-23T10:01:00Z — api-planner
...
```

---

## 14. Comparison with Build-Infra

### 12.1 What's the Same

| Aspect | Implementation |
|--------|----------------|
| Agent chain | INITIALIZER → PLANNER → BUILDER → TESTER |
| Progress file | Two-part (Current State + Session Log) |
| Feature list | JSON with test commands, dependencies |
| Session protocol | Read-first/write-last |
| Generic tools | read, write, edit, bash |
| Extension control | Extension runs tests, sets passes, commits |

### 12.2 What's Different

| Aspect | Build-Infra | Build-API |
|--------|-------------|-----------|
| Input | Code detection | `/product-spec/` folder |
| Output | Docker/CI/CD files | Python API code |
| Testing | Health checks | pytest unit + integration |
| TDD | No | Yes (enforced) |
| Feature types | Infrastructure components | Models, schemas, routes, services |
| Test-first | No | Yes (RED → GREEN per feature) |
| Conventions | Infrastructure patterns | Code style detection |

### 12.3 What's Improved (Lessons Applied)

| Issue from Build-Infra | Fix in Build-API |
|------------------------|------------------|
| infra-plan.md missing | Extension validates api-plan.md exists (blocks if not) |
| Agent runs tests | Extension runs tests via `runTest()` |
| Agent sets passes | Extension sets passes, agent prompt forbids |
| Single giant commit | Per-feature commits (extension-controlled) |
| Session log noise (25 entries) | Extension appends once per phase (4-5 entries) |
| No enforcement until v2 | Mechanical enforcement from day one |

---

## 15. Success Metrics

### 15.1 Functional Requirements

- [ ] Agent reads product-spec correctly
- [ ] All features have tests (100%)
- [ ] All generated tests pass
- [ ] API starts and responds correctly
- [ ] Authentication works (JWT)
- [ ] CRUD endpoints work for all entities
- [ ] Custom endpoints work as specified
- [ ] Database migrations apply cleanly

### 15.2 TDD Metrics

- [ ] Tests written before implementation (RED phase)
- [ ] Tests fail initially (no implementation)
- [ ] Tests pass after implementation (GREEN phase)
- [ ] Coverage > 80%

### 15.3 Mechanical Enforcement Metrics

- [ ] api-plan.md created and validated
- [ ] Extension runs all tests (not agent)
- [ ] Extension sets passes field (not agent)
- [ ] One commit per feature
- [ ] Session log clean (no noise)
- [ ] Resume works correctly

### 15.4 Quality Metrics

- [ ] Total workflow time: < 15 minutes
- [ ] User intervention rate: < 5%
- [ ] Generated code follows project conventions
- [ ] All imports resolve correctly
- [ ] No hardcoded values

---

## 16. Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Extension skeleton (build-api.ts)
- [ ] Agent definitions (api-initializer, api-planner, api-builder, api-tester)
- [ ] Progress file schema
- [ ] Mechanical enforcement functions (validation, test runner, session log)

### Phase 2: Product Spec Parser
- [ ] YAML parser for entities.yaml
- [ ] YAML parser for auth.yaml
- [ ] YAML parser for endpoints.yaml
- [ ] YAML parser for services.yaml
- [ ] Feature generator from parsed specs
- [ ] Dependency resolver

### Phase 3: Templates
- [ ] Model templates (SQLAlchemy 2.0 async)
- [ ] Schema templates (Pydantic v2)
- [ ] Service templates
- [ ] Route templates (FastAPI)
- [ ] Auth templates (JWT, middleware)
- [ ] Test templates (unit + integration)
- [ ] Fixture templates (conftest.py)

### Phase 4: Test Execution
- [ ] pytest runner in extension
- [ ] Coverage report parser
- [ ] Test failure handling
- [ ] TDD phase tracking (RED/GREEN)

### Phase 5: Integration
- [ ] End-to-end workflow
- [ ] Resume capability
- [ ] Error handling
- [ ] User notifications

### Phase 6: Validation
- [ ] Test on sample project
- [ ] Verify TDD enforcement
- [ ] Verify mechanical enforcement
- [ ] Document edge cases

---

## 17. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Product spec ambiguous | Medium | High | Clear schema, validation, examples |
| Test generation incorrect | Medium | High | Extension runs tests, agent cannot fake |
| Dependencies complex | Low | Medium | Topological sort, clear deps in spec |
| Context window exhaustion | Low | High | Progress file resume, compact Current State |
| Generated code style mismatch | Medium | Low | Read existing code first, mimic patterns |
| TDD violations | Medium | High | Extension enforces RED before GREEN |
| Coverage below threshold | Medium | Medium | Extension validates coverage in api-healthy |

---

## 18. References

### Lessons Learned
- `docs/exec-plans/build-infra-evaluation-001.md` - Root causes and fixes
- `docs/exec-plans/build-infra-evaluation-002.md` - Verification checklist
- `docs/product-specs/build-infra-prd.md` - Base architecture

### AI Engineering Research
- Anthropic: "Effective harnesses for long-running agents"
- OpenAI: "Harness engineering: leveraging Codex in an agent-first world"
- Vercel: Generic tools vs specialized tools (3.5x improvement)

### Related Files
- `extensions/build-infra.ts` - Reference implementation with enforcement
- `.pi/agents/infra-*.md` - Reference agent prompts

---

## 19. Glossary

| Term | Definition |
|------|------------|
| Feature | Single API component (endpoint, model, service) with test |
| TDD | Test-Driven Development - tests written before implementation |
| RED phase | Test written, fails (no implementation exists) |
| GREEN phase | Implementation written, test passes |
| Mechanical enforcement | Code-based rules enforced by extension, not prompts |
| Product spec | YAML files describing API requirements |
| Entity | Domain model (User, Post) with CRUD operations |
| CRUD | Create, Read, Update, Delete operations |

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
| 1.0.0 | 2026-03-23 | Builder Team | Initial PRD with lessons from infra evaluation |
