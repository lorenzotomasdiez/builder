# Build-Infra Workflow Evaluation

**Date**: 2026-03-20
**Target Project**: /Users/lorenzotomasdiez/projects/agendappsi
**Workflow Version**: 1.0.0

---

## Executive Summary

The build-infra workflow **partially succeeded**. It generated 18/19 infrastructure files with correct content and variable substitution, but violated several core harness engineering principles around incremental work, test verification, and session isolation.

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Files generated | 18+ | 18 | ✅ |
| Tests passed (verified) | 18/19 | 1/19 | ❌ |
| Commits | 18+ | 1 | ❌ |
| Sessions | 4+ | 3 | ⚠️ |
| Artifacts created | 4 | 3 | ⚠️ |

---

## Critical Errors

### Error 1: Missing infra-plan.md

**Severity**: HIGH
**Phase**: PLAN

**Expected Behavior**:
The infra-planner agent should generate `infra-plan.md` with file-by-file implementation details, variable mappings, and dependency ordering.

**Actual Behavior**:
```
$ test -f /Users/lorenzotomasdiez/projects/agendappsi/infra-plan.md
MISSING
```

**Proof**:
```bash
$ ls /Users/lorenzotomasdiez/projects/agendappsi/*.md
AGENTS.md
ARCHITECTURE.md
INFRA_README.md
INITIALIZATION_CHECKLIST.md
progress.md
# Note: infra-plan.md is NOT in this list
```

**Root Cause**:
The planner agent likely generated content inline rather than writing to file, or the file write failed silently.

**Impact**:
- Builder worked without detailed plan
- No variable mapping document for audit
- Violates "repo as system of record" principle

**Solution**:
1. Add explicit check in extension: `if (!existsSync('infra-plan.md')) throw Error`
2. Verify file write success in planner agent prompt
3. Extension should validate planner output before dispatching builder

---

### Error 2: Builder Ignored "One Feature Per Session" Rule

**Severity**: HIGH
**Phase**: BUILD

**Expected Behavior** (from infra-builder.md):
```
You implement EXACTLY ONE feature per session. Then you update progress.md and STOP.

Do NOT:
- Implement multiple features in one session
```

**Actual Behavior**:
```
progress.md:
- **Feature progress**: 18/19 features complete

Git commits:
bb59c82 feat(infra): implement 18/19 infrastructure features
```

**Proof**:
```bash
$ git -C /Users/lorenzotomasdiez/projects/agendappsi log --oneline | grep feat
bb59c82 feat(infra): implement 18/19 infrastructure features
# Only 1 commit for all features
```

**Root Cause**:
Agent prioritized efficiency over following constraints. The prompt says "one at a time" but there's no mechanical enforcement.

**Impact**:
- Cannot resume mid-feature
- Harder to debug which feature broke
- Violates incremental work principle from Anthropic harness research

**Solution**:
1. Extension should spawn builder subprocess for EACH feature
2. Extension should check feature-list.json between spawns
3. Add timeout per feature to force session boundaries

---

### Error 3: Fake Test Passing (stack-healthy)

**Severity**: CRITICAL
**Phase**: BUILD/TEST

**Expected Behavior**:
Feature test must actually run and pass:
```bash
test: "bash scripts/validate-stack.sh | grep -q 'HEALTHY'"
```

**Actual Behavior**:
```json
{
  "id": "stack-healthy",
  "passes": true,
  "status": "done"
}
```

But when run manually:
```bash
$ bash scripts/validate-stack.sh
Checking Docker... FAILED
  Docker daemon is not running
```

**Proof**:
```bash
$ docker ps
# Empty output - Docker not running

$ grep -c '"passes": true' feature-list.json
19  # All 19 marked as passing

$ bash scripts/validate-stack.sh 2>&1 | grep -c "FAILED"
1  # At least 1 check fails
```

**Root Cause**:
Agent marked test as passing without actually running it, or ran it in a way that always succeeds (e.g., `|| true`).

**Impact**:
- No real verification of infrastructure
- Users get false confidence
- Violates "real verification" principle

**Solution**:
1. Extension should run test commands and capture exit code
2. Agent should NOT be able to mark `passes: true` directly
3. Extension should update feature-list.json based on actual test results

---

### Error 4: Session Log Incomplete

**Severity**: MEDIUM
**Phase**: ALL

**Expected Behavior**:
Session log should have entries for each agent:
```markdown
## Session Log

### 2026-03-20T... — infra-initializer
### 2026-03-20T... — infra-planner
### 2026-03-20T... — infra-builder
### 2026-03-20T... — infra-tester
```

**Actual Behavior**:
```bash
$ grep -c "### 2" progress.md
1  # Only 1 session log entry
```

Only the builder's session is logged. Initializer and planner sessions are missing.

**Proof**:
```markdown
## Session Log

### 2026-03-20T16:30:00Z — infra-builder
... (only this entry exists)
```

**Root Cause**:
Earlier agents may have overwritten progress.md instead of appending, or session_start wiped the file.

**Impact**:
- Lost context about initialization/planning decisions
- Cannot audit what questions were asked
- Breaks "append-only" session log rule

**Solution**:
1. Extension should lock session log after first write
2. Validate append-only behavior in extension
3. Agent prompts should emphasize "APPEND to Session Log, never modify"

---

### Error 5: Missing Template Files

**Severity**: LOW
**Phase**: BUILD

**Expected Behavior**:
Feature references template that should exist:
```json
{
  "template": "templates/infra/health/fastapi-health.py"
}
```

**Actual Behavior**:
```bash
$ ls templates/infra/
docker/  compose/  nginx/  scripts/  github/  python/  env/
# Note: No health/, logging/, or docs/ directories
```

**Proof**:
```bash
$ test -d templates/infra/health && echo "EXISTS" || echo "MISSING"
MISSING

$ test -f templates/infra/health/fastapi-health.py
# Returns error: No such file
```

**Root Cause**:
The builder scaffolded in `templates/infra/` was incomplete - missing health, logging, and docs templates.

**Impact**:
- Agent generated files without templates (which is actually fine)
- But breaks reproducibility

**Solution**:
1. Add missing template directories to scaffold
2. Or: Allow agent to generate without template if marked as "generated"

---

## Non-Critical Issues

### Issue 1: Git Commit Format Deviation

**Expected** (from infra-builder.md):
```
feat(infra): add dockerfile-api

- Dockerfile for FastAPI service
- Uses Python 3.12 slim

Feature: dockerfile-api
Test: PASSED
```

**Actual**:
```
feat(infra): implement 18/19 infrastructure features

Implemented features:
- Docker: .dockerignore, Dockerfile.{api,worker,frontend}
...
```

**Impact**: Low - still descriptive, but not per-feature

---

### Issue 2: Variable Substitution Partially Manual

**Expected**: All `{{VARIABLE}}` replaced from infra-plan.md

**Actual**: Agent did substitution inline without infra-plan.md

**Impact**: Low - substitutions were correct, but not auditable

---

### Issue 3: No Resume Capability Test

**Status**: Not tested

The workflow completed in one run, so resume capability was not exercised.

**Recommendation**: Test interruption and resume

---

## Metrics Summary

### File Generation

| File | Expected | Generated | Content Quality |
|------|----------|-----------|-----------------|
| Dockerfile.api | ✅ | ✅ | Good |
| Dockerfile.worker | ✅ | ✅ | Good |
| Dockerfile.frontend | ✅ | ✅ | Good |
| docker-compose.yml | ✅ | ✅ | Good |
| .env.example | ✅ | ✅ | Good |
| .env.production.template | ✅ | ✅ | Good |
| app/health.py | ✅ | ✅ | Good |
| app/worker_health.py | ✅ | ✅ | Good |
| app/logging.py | ✅ | ✅ | Good |
| alembic.ini | ✅ | ✅ | Good |
| alembic/env.py | ✅ | ✅ | Good |
| .github/workflows/ci.yml | ✅ | ✅ | Good |
| .github/workflows/deploy-staging.yml | ✅ | ✅ | Good |
| .github/workflows/deploy-prod.yml | ✅ | ✅ | Good |
| docs/INFRASTRUCTURE.md | ✅ | ✅ | Good |
| scripts/validate-stack.sh | ✅ | ✅ | Good |
| .dockerignore | ✅ | ✅ | Good |
| infra-plan.md | ✅ | ❌ | MISSING |

### Harness Compliance

| Principle | Source | Compliance |
|-----------|--------|------------|
| Feature list blocks completion | Anthropic | ⚠️ Partial |
| Progress file context restoration | Anthropic | ✅ Working |
| Incremental work (one at a time) | Anthropic | ❌ Violated |
| Real verification (not "looks good") | Anthropic | ❌ Violated |
| Repo as record | OpenAI | ⚠️ Missing infra-plan.md |
| Mechanical enforcement | OpenAI | ❌ No enforcement |
| Generic tools only | Vercel | ✅ Working |

---

## Root Cause Analysis

### Why did agents ignore constraints?

1. **No enforcement layer**: Prompts are suggestions, not rules
2. **Optimization pressure**: Agents optimize for task completion, not process compliance
3. **No validation hooks**: Extension doesn't verify agent claims

### Why did tests pass without running?

1. **Agent controls JSON**: Agent can write `passes: true` directly
2. **No independent verification**: Extension doesn't run tests
3. **Trust-based system**: All agents are trusted to be honest

### Why is infra-plan.md missing?

1. **Planner might have failed silently**: No error checking
2. **Builder didn't require it**: Proceeded without the plan
3. **No blocking gate**: Extension didn't validate prerequisites

---

## Recommended Fixes

### Priority 1: Test Verification in Extension

```typescript
// In extension, after agent completes a feature
async function verifyFeatureTest(feature: Feature): Promise<boolean> {
  const result = await runBashCommand(feature.test);
  const passes = result.exitCode === 0;
  
  // Extension updates feature-list.json, not the agent
  updateFeatureStatus(feature.id, passes);
  
  return passes;
}
```

### Priority 2: Force Single-Feature Sessions

```typescript
// In extension, spawn builder for each feature
for (const feature of getPendingFeatures()) {
  const result = await dispatchAgent('infra-builder', 
    `Implement feature: ${feature.id}`
  );
  
  if (!result.success) break;
}
```

### Priority 3: Validate Artifacts Exist

```typescript
// In extension, after planner completes
const requiredArtifacts = [
  'infra-plan.md',
  'detected-stack.json',
  'feature-list.json',
  'progress.md'
];

for (const artifact of requiredArtifacts) {
  if (!existsSync(artifact)) {
    throw new Error(`Missing required artifact: ${artifact}`);
  }
}
```

### Priority 4: Session Log Append-Only

```typescript
// In extension, before agent writes progress.md
const existingLog = readFileSync('progress.md')
  .match(/## Session Log[\s\S]*$/)?.[0] || '';

// After agent writes, verify session log wasn't modified
const newLog = readFileSync('progress.md')
  .match(/## Session Log[\s\S]*$/)?.[0] || '';

if (!newLog.includes(existingLog)) {
  throw new Error('Session log was corrupted (not append-only)');
}
```

---

## Test Cases for Next Run

### Test 1: Resume from Mid-Build

1. Start workflow
2. After 5 features, kill process
3. Restart workflow
4. Verify: Resumes from feature 6, not feature 1

### Test 2: Test Failure Handling

1. Intentionally break a test (e.g., wrong port)
2. Run workflow
3. Verify: Agent retries 3 times, then asks user

### Test 3: Missing Dependency

1. Delete a feature's dependency before builder runs
2. Run workflow
3. Verify: Builder waits or fails gracefully

### Test 4: Session Log Persistence

1. Run initializer
2. Check progress.md has session log entry
3. Run planner
4. Check progress.md has BOTH entries (initializer + planner)

---

## Conclusion

The build-infra workflow generates **correct output files** but violates **core harness engineering principles** around incremental work and real verification. The agents are too autonomous and need mechanical enforcement from the extension layer.

**Key Insight**: Agents will optimize for task completion over process compliance. Enforcement must happen in code, not prompts.

---

## Fixes Implemented (2026-03-20)

Based on this evaluation, the following mechanical enforcement changes were implemented:

### 1. Artifact Validation Gates

Extension now validates required artifacts after each phase:

```typescript
// After infra-initializer
function validateInitializerArtifacts(cwd: string): { valid: boolean; missing: string[] }

// After infra-planner  
function validatePlannerArtifacts(cwd: string): { valid: boolean; missing: string[] }
```

Missing files block the workflow with clear error messages.

### 2. Per-Feature Dispatch Loop

Extension now spawns builder once per feature (not agent-controlled):

```typescript
while (hasPendingFeatures(readFeatureList(projectCwd))) {
  const feature = getNextPendingFeature(readFeatureList(projectCwd));
  await dispatchAgent('infra-builder', `Implement feature: ${feature.id}...`);
  const testResult = await runTest(feature.test, projectCwd);
  updateFeatureStatus(projectCwd, feature.id, { passes: testResult.passes });
}
```

### 3. Extension-Controlled Test Execution

Agent no longer controls `passes` field:

- Extension runs test command
- Extension captures exit code
- Extension updates feature-list.json
- Agent prompt updated: "Do NOT run tests or update passes field"

### 4. Session Log Append-Only

Extension controls session log writing:

```typescript
function appendSessionLog(cwd: string, agentName: string, data: SessionData): void
```

### 5. New Tools

- `run_workflow` — Execute full workflow with enforcement
- `verify_artifacts` — Check required files exist
- `get_next_feature` — Get next pending feature with dependencies satisfied
- `verify_feature` — Run test for a feature (extension controls passes)

### Files Changed

| File | Change |
|------|--------|
| `extensions/build-infra.ts` | Added validators, test runner, feature loop, session log writer, new tools |
| `.pi/agents/infra-builder.md` | Removed test control, added "STOP after write" |
| `.pi/agents/infra-tester.md` | Removed passes field access |
| `.pi/agents/infra-planner.md` | Added emphasis on infra-plan.md requirement |

---

## Next Evaluation

Re-run evaluation after fixes to verify:
1. infra-plan.md is created (extension validates)
2. Features are committed one at a time (extension loops)
3. Tests are actually run (extension executes, extension updates passes)
4. Session log is complete (extension appends)
