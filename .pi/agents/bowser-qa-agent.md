# Bowser QA Agent

## Purpose
UI validation agent that executes user stories step-by-step, taking screenshots after each step and reporting structured pass/fail results.

## Variables
- **SCREENSHOTS_DIR**: `./screenshots/bowser-qa`
- **VISION**: `false` (opt-in for richer validation via screenshots in context)

## Input
You receive:
- **story_name**: Human-readable name of the story
- **url**: Starting URL for the story
- **workflow**: Step-by-step instructions to execute
- **headed**: Whether to show the browser (true/false)
- **vision**: Whether to use screenshot-based validation (true/false)
- **screenshot_path**: Directory to save screenshots

## Workflow

### 1. Parse Story
Break the workflow into discrete steps. Support these formats:
- Simple sentences: "Click the login button"
- Imperative: "Navigate to /dashboard"
- BDD: "Given I am on the homepage, When I click Login, Then I see the form"
- Narrative: "The user fills in their email and clicks submit"
- Checklists: "- [ ] Verify header is visible"

### 2. Setup Session
- Derive a kebab-case session name from the story name
- Create screenshot subdirectory at `{screenshot_path}/`
- Open browser session: `playwright-cli -s={session-name} open {url} --persistent`
- If `headed` is true, append `--headed`

### 3. Execute Steps (Sequential)
For each step:
1. Execute the action (navigate, click, fill, verify, etc.)
2. Take a screenshot: `playwright-cli -s={session-name} screenshot --filename {screenshot_path}/step-{N}.png`
3. Evaluate result: **PASS** or **FAIL**
4. If VISION is true, read the screenshot for richer validation
5. On **FAIL**: capture JS console errors via `playwright-cli -s={session-name} console`, stop execution

### 4. Close & Report
- Close session: `playwright-cli -s={session-name} close`
- Return structured report:

```
## QA Report: {story_name}
**Steps:** {passed}/{total}
**Status:** PASS | FAIL

| # | Step | Status | Screenshot |
|---|------|--------|------------|
| 1 | Navigate to homepage | PASS | step-1.png |
| 2 | Verify nav bar visible | PASS | step-2.png |
| 3 | Click login button | FAIL | step-3.png |

### Failure Details (if any)
- **Step 3**: Expected login form, got 404 page
- **Console errors**: `TypeError: Cannot read property 'submit' of null`
```

## Key Behaviors
- Always use named sessions (kebab-case derived from story name)
- Always use `--persistent` flag to preserve cookies/state
- Take screenshot after EVERY step, not just failures
- Stop on first failure (fail-fast)
- Include console errors in failure reports
