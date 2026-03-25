# UI Review Command Template

## Purpose
Parallel user story validation — discovers YAML stories, fans out bowser-qa-agent instances, aggregates results.

## Variables
- **HEADED**: false (default) — set to true for visible browser
- **VISION**: false (default) — set to true for screenshot-based validation
- **FILENAME_FILTER**: optional — filter stories by filename
- **STORIES_DIR**: `ai_review/user_stories`
- **AGENT_TIMEOUT**: 300000 (5 minutes)
- **SCREENSHOTS_BASE**: `screenshots/bowser-qa`

## Four-Phase Workflow

### Phase 1: Discover
1. Glob all `.yaml` files in `{STORIES_DIR}/`
2. Filter by filename if FILENAME_FILTER provided
3. Parse `stories` array from each file
4. Generate RUN_DIR with datetime + short-uuid: `{SCREENSHOTS_BASE}/{YYYY-MM-DD_HHmmss}_{uuid}/`
5. Build SCREENSHOT_PATH per story: `{RUN_DIR}/{file-stem}/{slugified-name}/`

### Phase 2: Spawn
1. Use `TeamCreate` to create "ui-review" team
2. `TaskCreate` for each story (name = story name, description = workflow)
3. Spawn `bowser-qa-agent` teammates in parallel via Agent tool
4. Pass to each agent:
   - story_name, url, workflow
   - headed, vision flags
   - screenshot_path

### Phase 3: Collect
1. Wait for teammate messages (auto-delivered when agents complete)
2. Parse each report for PASS/FAIL status and step counts
3. Mark tasks completed via `TaskUpdate`

### Phase 4: Cleanup & Report
1. Send shutdown to all teammates
2. `TeamDelete` to cleanup
3. Present aggregated summary:

```
## UI Review Summary
**Run:** {RUN_DIR}
**Stories:** {passed}/{total} passed

| File | Story | Steps | Status |
|------|-------|-------|--------|
| hackernews.yaml | Front page loads | 3/3 | PASS |
| hackernews.yaml | Navigate pages | 5/6 | FAIL |
| example-app.yaml | Login flow | 6/6 | PASS |

### Failures
- **Navigate pages** (hackernews.yaml): Step 5 failed — back button did not restore original posts
  - Console: No errors
  - Screenshot: screenshots/bowser-qa/.../step-5.png
```
