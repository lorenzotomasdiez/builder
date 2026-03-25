# Build-API Workflow

Generate FastAPI REST APIs from product-spec with **enforced TDD**.

## Quick Start

```bash
# In your project directory
./scripts/setup-build-api.sh .
pi -e extensions/build-api.ts
```

## What it does

Given a `/product-spec/` folder with YAML files describing your API, generates:

- SQLAlchemy 2.0 async models
- Pydantic v2 schemas
- FastAPI routes (CRUD + custom)
- Service layer
- JWT authentication
- pytest tests (unit + integration, >80% coverage)

## Workflow

```
INITIALIZER → PLANNER → BUILDER → TESTER
```

1. **initializer** - Reads product-spec, generates feature list
2. **planner** - Creates api-plan.md (BLOCKS if missing)
3. **builder** - Implements features (RED→GREEN per feature)
4. **tester** - Runs tests with coverage

## TDD Enforcement

Each feature goes through:

1. **RED** - Builder writes TEST only (no implementation)
2. **GREEN** - Builder writes IMPLEMENTATION
3. Extension runs test, sets `passes`

## Product Spec Format

### entities.yaml

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
      - name: role
        type: enum
        values: [admin, user, guest]
        default: user
    relationships:
      - has_many: Post
        foreign_key: author_id
    crud:
      create: admin_only
      read: authenticated
      update: owner_or_admin
      delete: admin_only
```

### auth.yaml

```yaml
auth:
  enabled: true
  type: jwt
  jwt:
    algorithm: HS256
    access_token_expire_minutes: 30
  roles:
    - name: admin
      permissions: [create, read, update, delete]
```

### endpoints.yaml (optional)

```yaml
endpoints:
  - name: user-posts
    method: GET
    path: /users/{user_id}/posts
    auth: authenticated
    query_params:
      - name: limit
        type: integer
        default: 10
```

## Generated Structure

```
app/
├── models/
│   ├── base.py
│   ├── user.py
│   └── post.py
├── schemas/
│   ├── user.py
│   └── post.py
├── routes/
│   ├── auth.py
│   ├── users.py
│   └── posts.py
├── services/
│   ├── user_service.py
│   └── post_service.py
├── auth/
│   ├── jwt.py
│   ├── password.py
│   └── middleware.py
├── config.py
├── database.py
└── main.py
tests/
├── conftest.py
├── unit/
│   ├── models/
│   ├── schemas/
│   └── services/
└── integration/
    ├── test_auth.py
    ├── test_users.py
    └── test_posts.py
```

## Mechanical Enforcement

- **api-plan.md** must exist (extension blocks build if missing)
- **Extension** runs tests (agent cannot)
- **Extension** sets `passes` (agent cannot modify)
- **Per-feature** commits (extension-controlled)
- **Session log** append-only (extension-managed)

## Commands

- `/build-api` - Start workflow
- `/build-api-status` - Show progress
- `/build-api-resume` - Resume from checkpoint

## Tools

- `run_workflow` - Execute full workflow with enforcement
- `verify_artifacts` - Check required files exist
- `get_next_feature` - Get next pending feature with TDD phase
- `verify_feature` - Run test (extension controls passes)
- `dispatch_agent` - Low-level agent dispatch

## Based On

- build-infra-prd.md - Base architecture
- build-infra-evaluation-001.md - Mechanical enforcement lessons
- AI Engineering research (Anthropic, OpenAI, Vercel)
