# Bowser QA Architecture

## Four-Layer Composable Stack

Bowser uses a four-layer architecture where each layer can be tested and deployed independently.

### Layer 1: Capability (Skills)
**What:** Drive the browser via CLI or Chrome MCP.

Two complementary browser skills:

| Skill | Mode | Parallel | Auth | Best For |
|-------|------|----------|------|----------|
| **Playwright Bowser** | Headless (default) | Yes (named sessions) | Persistent profiles | CI/CD, public sites, batch testing |
| **Chrome Bowser** | Headed only | No (single instance) | Real Chrome profile | Authenticated sites, observable automation |

**Key insight:** Playwright CLI is token-efficient — it doesn't dump accessibility trees into LLM context. Use `snapshot` to get element refs, then interact via refs.

### Layer 2: Scale (Agents)
**What:** Parallel execution in isolated sessions with structured reporting.

- **bowser-qa-agent** — Executes user stories step-by-step, screenshots each step, reports PASS/FAIL
- **playwright-bowser-agent** — Thin wrapper for headless parallel spawning
- **chrome-bowser-agent** — Wrapper for Chrome MCP automation

Each agent runs in its own session with isolated state. The QA agent is the workhorse — it parses stories, executes steps, captures evidence, and produces structured reports.

### Layer 3: Orchestration (Commands)
**What:** Discover stories, fan out agents, collect results.

- **ui-review** — Discovers all YAML story files, spawns one QA agent per story in parallel, aggregates results into a summary table
- **hop-automate** — Higher-order command that loads saved workflow files, applies skill/mode overrides from arguments, and executes

**ui-review workflow:**
1. **Discover** — Glob `.yaml` files, parse stories, generate run directory with timestamp
2. **Spawn** — TeamCreate → TaskCreate per story → Spawn agents in parallel
3. **Collect** — Wait for reports, parse PASS/FAIL, mark tasks complete
4. **Report** — Aggregate into summary table, cleanup team

**hop-automate keyword detection** (case-insensitive):
- `claude` → Use Chrome Bowser skill
- `playwright` → Use Playwright Bowser skill (default)
- `headless` / `headed` → Set browser mode
- `vision` → Enable screenshot-based validation
- Remaining text → Becomes the prompt

### Layer 4: Reusability (Justfile)
**What:** One command to run everything.

```bash
just ui-review                    # Run all user stories
just ui-review headed             # Run with visible browser
just ui-review vision             # Run with screenshot validation
just test-qa                      # Test single QA agent
just hop amazon-add-to-cart "keyboard"  # Run saved workflow
```

## Design Principles

1. **Composability** — Each layer wraps the one below it. Test at any layer independently.
2. **Token efficiency** — CLI-based approach avoids verbose MCP tool schemas in context.
3. **Parallel by default** — Named sessions enable concurrent story validation.
4. **Evidence capture** — Screenshots after every step, not just failures.
5. **Fail-fast** — Stop on first failure, capture console errors for debugging.
6. **Structured reports** — Consistent PASS/FAIL tables that can be parsed programmatically.

## User Story Format (YAML)

Stories are stored in `ai_review/user_stories/` as YAML files:

```yaml
stories:
  - name: "Human-readable story name"
    url: "https://starting-url.com"
    workflow: |
      Navigate to the starting URL
      Verify the page loads successfully
      Verify specific elements are visible
      Perform user actions (click, fill, etc.)
      Verify expected outcomes
```

**Supported step formats:**
- Simple sentences: "Click the login button"
- Imperative: "Navigate to /dashboard"
- BDD: "Given I am on the homepage, When I click Login, Then I see the form"
- Narrative: "The user fills in their email and clicks submit"
- Checklists: "- [ ] Verify header is visible"

## Workflow File Format (for hop-automate)

Saved workflows live in `.claude/commands/bowser/` as markdown files:

```markdown
---
description: What this workflow does
defaults:
  skill: playwright-bowser  # or claude-bowser
  mode: headless             # or headed
  vision: false
---

1. Navigate to {URL}
2. Verify the page loads
3. Perform actions using {PROMPT}
4. Report results
```

- `{PROMPT}` is replaced with user-provided freeform input
- `defaults:` in frontmatter set preferred skill/mode
- CLI keyword overrides take precedence over defaults
