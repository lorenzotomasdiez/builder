# Build-API Evaluation 001

**Date**: 2026-03-23  
**Target**: `/Users/lorenzotomasdiez/projects/agendappsi`  
**PRD**: `docs/product-specs/build-api-prd.md`  
**Extension**: `extensions/build-api.ts`  

---

## Executive Summary

The build-api workflow **partially succeeded** with critical gaps in status tracking and mechanical enforcement. Code generation is working well, but the extension fails to track real progress when pytest is unavailable.

### Overall Assessment

| Aspect | Status | Score |
|--------|--------|-------|
| Code Generation | ✅ Working | 9/10 |
| TDD Enforcement | ⚠️ Partial | 4/10 |
| Feature Tracking | ❌ Broken | 2/10 |
| Real-time Status | ❌ Not Working | 1/10 |
| Artifact Validation | ✅ Working | 8/10 |
| Mechanical Enforcement | ⚠️ Partial | 5/10 |

**Verdict**: The build-api extension generates high-quality code but fails to track progress accurately when tests cannot run.

---

## 1. What Was Actually Generated

### 1.1 Files Created (Verified)

| Category | File | Status | Quality |
|----------|------|--------|---------|
| **Models** | `app/models/user.py` | ✅ Exists | Excellent |
| **Auth** | `app/auth/password.py` | ✅ Exists | Good |
| | `app/auth/jwt.py` | ✅ Exists | Good |
| | `app/auth/middleware.py` | ✅ Exists | Good |
| **Schemas** | `app/schemas/user.py` | ✅ Exists | Good |
| **Services** | `app/services/user_service.py` | ✅ Exists | Good |
| **Routes** | `app/routes/auth.py` | ✅ Exists | Good |
| | `app/routes/users.py` | ✅ Exists | Good |
| **Tests** | `tests/unit/models/test_user.py` | ✅ Exists | Excellent |
| | `tests/unit/auth/test_password.py` | ✅ Exists | Good |
| | `tests/unit/auth/test_jwt.py` | ✅ Exists | Good |
| | `tests/unit/auth/test_middleware.py` | ✅ Exists | Good |
| | `tests/integration/test_auth.py` | ✅ Exists | Good |
| | `tests/integration/test_users.py` | ✅ Exists | Good |
| | `tests/conftest.py` | ✅ Exists | Good |

### 1.2 Code Quality Assessment

**User Model** (`app/models/user.py`):
- ✅ SQLAlchemy 2.0 async-ready with `Mapped` types
- ✅ Proper enum for UserRole (admin, user, guest)
- ✅ Password verification method
- ✅ Role helper methods (`is_admin()`, `is_user()`, `is_guest()`)
- ✅ Proper timestamps with `server_default=func.now()`
- ✅ Full docstrings and type hints
- ⚠️ Imports `verify_password` from auth module (circular dependency risk)

**Test Quality** (`tests/unit/models/test_user.py`):
- ✅ 502 lines of comprehensive tests
- ✅ Tests for all role types
- ✅ Tests for password verification
- ✅ Tests for timestamp behavior
- ✅ Tests for uniqueness constraints
- ✅ Integration test scenarios

---

## 2. Feature-List Tracking Issues

### 2.1 Current State (from `feature-list.json`)

```json
{
  "id": "auth-models",
  "status": "failed",
  "passes": false,
  "test_exists": true,
  "implementation_exists": true,
  "tdd_phase": "green"
}
```

### 2.2 Reality Check

| Feature ID | feature-list.json Status | File Exists | Test Exists | Actual Status |
|------------|--------------------------|-------------|-------------|---------------|
| auth-models | `failed` | ✅ Yes | ✅ Yes | Should be `done` |
| auth-password | `in_progress` | ✅ Yes | ✅ Yes | Should be `done` or `in_progress` |
| auth-jwt | `failed` | ✅ Yes | ✅ Yes | Should be `done` |
| auth-middleware | `failed` | ✅ Yes | ⚠️ Yes* | Should be `done` |
| auth-routes | `idle` | ✅ Yes | ❓ Unknown | Should NOT be `idle` |
| user-schema | `idle` | ✅ Yes | ✅ Yes | Should NOT be `idle` |
| user-service | `idle` | ✅ Yes | ✅ Yes | Should NOT be `idle` |
| user-list | `idle` | ✅ Yes | ❓ Unknown | Dependency blocked |

**Critical Issue**: Features marked as `idle` in feature-list.json have files that exist on disk.

### 2.3 Root Cause

The extension only updates feature status based on **test execution results**:

```typescript
// From build-api.ts line 1168-1186
const testResult = await runTest(feature.test, projectCwd);

const updates: Partial<Feature> = {
    passes: testResult.passes,  // <- Only updated if test runs
    attempts: feature.attempts + 1,
};
```

**Problem**: When `pytest` command fails with "command not found", the feature is marked as `failed` regardless of whether files were actually created.

**Expected Behavior** (per PRD):
> "Extension validates artifacts, runs tests, sets passes based on actual test result"

**Actual Behavior**: Extension sets `passes: false` and `status: "failed"` when test command fails, without checking file existence.

---

## 3. Comparison with Build-Infra

### 3.1 What Build-Infra Does Correctly

| Aspect | Build-Infra | Build-API |
|--------|-------------|-----------|
| Test Execution | Tests actually run (health checks) | Tests fail (pytest not found) |
| Status Tracking | Accurate | Inaccurate |
| Feature Loop | Works correctly | Works correctly |
| Widget Display | Real-time updates | Real-time updates |
| Session Log | Append-only ✅ | Append-only ✅ |

### 3.2 Key Difference

Build-infra runs **health checks** (curl to localhost) which work in most environments. Build-api runs **pytest** which requires:
1. Python environment with pytest installed
2. All dependencies available
3. Database connection (for integration tests)

### 3.3 What's Missing in Build-API

The extension lacks a **file verification fallback**:

```typescript
// Should exist but doesn't
function verifyFileExists(filePath: string): boolean {
    return existsSync(join(projectCwd, filePath));
}

// Should be called when test fails
if (!testResult.passes && testResult.output.includes("command not found")) {
    // Fallback to file existence check
    const fileExists = verifyFileExists(feature.file);
    const testFileExists = verifyFileExists(feature.test_file);
    
    updateFeatureStatus(projectCwd, feature.id, {
        implementation_exists: fileExists,
        test_exists: testFileExists,
        status: fileExists && testFileExists ? "done" : "failed"
    });
}
```

---

## 4. PRD Compliance Check

### 4.1 Mechanical Enforcement Requirements

| Requirement | PRD Section | Status | Notes |
|-------------|-------------|--------|-------|
| Extension validates api-plan.md | 5.3 | ✅ Working | Blocks build if missing |
| Extension runs tests (not agent) | 5.3, 7.2 | ⚠️ Partial | Runs but pytest unavailable |
| Extension sets passes field | 7.2 | ✅ Working | Sets based on test result |
| Extension commits per feature | 7.1 | ❌ Not Implemented | No git commits made |
| Session log append-only | 7.1 | ✅ Working | Extension controls logging |
| TDD RED phase | 5.4 | ⚠️ Partial | Agent writes tests but verification fails |
| TDD GREEN phase | 5.4 | ⚠️ Partial | Agent writes impl but verification fails |

### 4.2 Artifact Requirements

| Artifact | Required | Created | Validated |
|----------|----------|---------|-----------|
| `api-spec.md` | ✅ | ✅ | ✅ |
| `feature-list.json` | ✅ | ✅ | ✅ |
| `detected-conventions.json` | ✅ | ✅ | ✅ |
| `progress.md` | ✅ | ✅ | ✅ |
| `api-plan.md` | ✅ | ❌ | ❌ |

**Critical**: `api-plan.md` was never created by the planner agent, which is why the build phase was originally blocked.

### 4.3 Feature Generation Requirements

| Requirement | PRD Section | Status |
|-------------|-------------|--------|
| Auth features generated from auth.yaml | 6.3 | ✅ |
| Entity CRUD features from entities.yaml | 6.3 | ✅ |
| Dependency ordering | 6.2 | ✅ |
| TDD fields (test_exists, implementation_exists, tdd_phase) | 6.2 | ⚠️ Tracked but inaccurate |

---

## 5. Real-Time Status Tracking Issues

### 5.1 Widget Display

The widget correctly reads `feature-list.json` and `progress.md`:

```typescript
// build-api.ts line 428-434
if (existsSync(featureListPath)) {
    featureStats = getFeatureStats(parseFeatureList(readFileSync(featureListPath, "utf-8")));
}
```

**Problem**: The widget shows correct information from the files, but the files contain incorrect data.

### 5.2 Progress.md Session Log

The session log accurately records all verification attempts:

```markdown
### 2026-03-23T16:38:07.274Z — extension-verify
- **Intent**: Verify feature: auth-models
- **Features**: auth-models
- **TDD Phase**: green
- **Result**: FAILED
- **Duration**: 0s
- **Errors**: /bin/sh: pytest: command not found
```

This is **correct behavior** - the extension is accurately logging that tests couldn't run.

### 5.3 What's Not Being Tracked

1. **File creation events** - No log entry when `app/models/user.py` is created
2. **Agent dispatch results** - No tracking of what the builder actually accomplished
3. **Dependency satisfaction** - No tracking when dependencies become available

---

## 6. Specific Issues Found

### 6.1 Issue: Feature Status Doesn't Reflect File Creation

**Location**: `extensions/build-api.ts:1168-1186`

**Current Code**:
```typescript
const testResult = await runTest(feature.test, projectCwd);

const updates: Partial<Feature> = {
    passes: testResult.passes,
    attempts: feature.attempts + 1,
};

if (tddPhase === "red") {
    updates.test_exists = true;
    // ...
} else if (tddPhase === "green") {
    updates.implementation_exists = true;
    // ...
}
```

**Problem**: `test_exists` and `implementation_exists` are set based on TDD phase assumption, not actual file verification.

**Fix**:
```typescript
// Verify files were actually created
const fileExists = feature.file ? existsSync(join(projectCwd, feature.file)) : true;
const testFileExists = feature.test_file ? existsSync(join(projectCwd, feature.test_file)) : true;

const testResult = await runTest(feature.test, projectCwd);

const updates: Partial<Feature> = {
    passes: testResult.passes,
    attempts: feature.attempts + 1,
    implementation_exists: fileExists,
    test_exists: testFileExists,
};
```

### 6.2 Issue: No Commit Per Feature

**PRD Requirement**: Section 7.1 states "Extension commits if passing"

**Current Code**: No git commit functionality exists.

**Missing**:
```typescript
// Should exist in runBuildPhase after line 1190
if (testResult.passes) {
    built++;
    
    // Commit the feature
    await commitFeature(projectCwd, feature);
}

async function commitFeature(cwd: string, feature: Feature): Promise<void> {
    const { stdout } = await execAsync('git status --porcelain', { cwd });
    if (stdout.trim()) {
        await execAsync(`git add -A && git commit -m "feat(api): add ${feature.id}"`, { cwd });
    }
}
```

### 6.3 Issue: api-plan.md Not Created

**Symptom**: Build phase blocked with "Run plan phase first. Missing: api-plan.md"

**Root Cause**: The planner agent outputs content but doesn't write files.

**Evidence from conversation**:
```
✓ INIT: Product spec read, feature list generated
✗ PLAN: Planner did not create api-plan.md. BUILD PHASE WILL BE BLOCKED.
```

**The planner agent needs explicit instructions to write the file**:

```typescript
// Current (line 1078-1080)
"Read feature list and templates, Create api-plan.md with variable mappings. This file is REQUIRED."

// Should be more explicit
"Read feature list, api-spec.md, and templates. You MUST use the Write tool to CREATE api-plan.md file. This is a critical requirement. The build phase will be blocked without this file."
```

### 6.4 Issue: Agent Session Files Cleared on Start

**Location**: `extensions/build-api.ts:1415-1422`

```typescript
const sessDir = join(_ctx.cwd, ".pi", "agent-sessions");
if (existsSync(sessDir)) {
    for (const f of readdirSync(sessDir)) {
        if (f.endsWith(".json")) {
            try { unlinkSync(join(sessDir, f)); } catch {}
        }
    }
}
```

**Problem**: This clears session state on every session start, preventing resume functionality.

**Comparison**: Build-infra has the same code, so this affects both extensions.

---

## 7. Recommendations

### 7.1 Critical Fixes (P0)

1. **Add File Existence Verification**
   - Check `feature.file` and `feature.test_file` exist after builder dispatch
   - Update `implementation_exists` and `test_exists` based on actual files
   - Fallback when pytest unavailable

2. **Fix Feature Status Logic**
   - Mark as `done` when both test and implementation exist (even if tests can't run)
   - Add `verification_pending` status for features with files but no test execution
   - Track `passes` separately from `status`

3. **Implement Git Commits**
   - Add `commitFeature()` function
   - Commit after each passing feature
   - Use conventional commit format: `feat(api): add {feature-id}`

### 7.2 High Priority Fixes (P1)

4. **Strengthen Planner Instructions**
   - Agent prompt must explicitly require using Write tool
   - Add validation that checks api-plan.md has content (not just exists)
   - Provide clearer error message when planner fails

5. **Preserve Agent Sessions**
   - Don't clear session files on start
   - Only clear when explicitly starting fresh
   - Add `/build-api-reset` command to clear sessions

6. **Add Verification Bypass**
   - When pytest unavailable, allow manual verification
   - Add `skip_verification` flag for features
   - Add `--skip-tests` option to run_workflow

### 7.3 Medium Priority Fixes (P2)

7. **Enhanced Status Reporting**
   - Add `files_created` array to feature
   - Track actual file sizes
   - Report file creation in session log

8. **Dependency Graph Visualization**
   - Show blocked features and why
   - Display dependency tree in widget
   - Highlight circular dependencies

9. **Test Environment Validation**
   - Check pytest availability at session start
   - Warn if tests can't run
   - Suggest setup steps

---

## 8. Code Examples for Fixes

### 8.1 File Existence Check

```typescript
// Add after line 1157 in build-api.ts
const beforeFiles = {
    impl: feature.file ? existsSync(join(projectCwd, feature.file)) : true,
    test: feature.test_file ? existsSync(join(projectCwd, feature.test_file)) : true,
};

const buildResult = await dispatchAgent("api-builder", taskDesc, ctx);

const afterFiles = {
    impl: feature.file ? existsSync(join(projectCwd, feature.file)) : true,
    test: feature.test_file ? existsSync(join(projectCwd, feature.test_file)) : true,
};

// Track what was actually created
const createdFiles = {
    impl: !beforeFiles.impl && afterFiles.impl,
    test: !beforeFiles.test && afterFiles.test,
};

// Log file creation
if (createdFiles.impl || createdFiles.test) {
    appendSessionLog(projectCwd, "api-builder", {
        intent: `Created files for ${feature.id}`,
        result: "files_created",
        features: [feature.id],
        duration: buildResult.elapsed,
    });
}
```

### 8.2 Graceful Test Failure Handling

```typescript
// Replace line 1168-1195
const testResult = await runTest(feature.test, projectCwd);

// Check if test infrastructure is available
const testUnavailable = testResult.output.includes("command not found") ||
                        testResult.output.includes("No module named");

if (testUnavailable) {
    // Fallback to file verification
    const fileVerified = afterFiles.impl && afterFiles.test;
    
    updateFeatureStatus(projectCwd, feature.id, {
        passes: false,  // Can't verify
        test_exists: afterFiles.test,
        implementation_exists: afterFiles.impl,
        status: fileVerified ? "verification_pending" : "failed",
        attempts: feature.attempts + 1,
        tdd_phase: tddPhase,
    });
    
    if (fileVerified) {
        built++;  // Count as built, just not verified
    } else {
        failed++;
    }
    continue;
}

// Normal test execution path
const updates: Partial<Feature> = {
    passes: testResult.passes,
    attempts: feature.attempts + 1,
    test_exists: afterFiles.test,
    implementation_exists: afterFiles.impl,
};

// ... rest of existing logic
```

### 8.3 Commit Function

```typescript
// Add new function after line 309
async function commitFeature(cwd: string, feature: Feature): Promise<boolean> {
    try {
        // Check if there are changes to commit
        const { stdout: status } = await execAsync('git status --porcelain', { cwd });
        if (!status.trim()) {
            return false;  // Nothing to commit
        }
        
        // Stage and commit
        await execAsync('git add -A', { cwd });
        
        const commitMessage = `feat(api): add ${feature.id}\n\n${feature.desc}`;
        await execAsync(`git commit -m "${commitMessage}"`, { cwd });
        
        return true;
    } catch (error) {
        // Git not available or other error - not critical
        return false;
    }
}
```

---

## 9. Testing Recommendations

### 9.1 Test Scenarios

1. **Happy Path**: Full workflow with pytest available
2. **No Pytest**: Workflow when pytest command not found
3. **Partial Tests**: Some tests pass, some fail
4. **Resume**: Interrupt and resume workflow
5. **Blocked Dependencies**: Features with unsatisfied dependencies

### 9.2 Validation Checklist

- [ ] All generated files are syntactically correct Python
- [ ] Feature-list.json accurately reflects file creation
- [ ] Progress.md session log is accurate
- [ ] Widget displays correct real-time status
- [ ] Commits are created when tests pass
- [ ] Resume works after interruption
- [ ] Blocked features show dependency info

---

## 10. Conclusion

The build-api extension demonstrates **good code generation** but **poor progress tracking**. The core workflow is sound, but the extension is too dependent on test execution for status updates.

### Key Takeaways

1. **Code generation works** - High quality files created
2. **Status tracking broken** - feature-list.json doesn't match reality
3. **Test dependency is blocking** - pytest unavailable causes false failures
4. **Mechanical enforcement partial** - Missing commits, file verification

### Priority Order

1. **Fix file verification** - Most critical for accurate tracking
2. **Add git commits** - Required by PRD
3. **Strengthen planner** - Prevent api-plan.md missing
4. **Graceful test failure** - Handle pytest unavailable

### Recommended Next Steps

1. Implement P0 fixes (file verification, status logic)
2. Add integration tests for the extension
3. Test with real pytest environment
4. Compare results with build-infra on same project
