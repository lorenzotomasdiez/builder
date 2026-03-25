# Hop-Automate Command Template

## Purpose
Higher-order orchestration command that loads saved workflow files, detects skill/mode/vision from keyword arguments, and executes.

## Usage
```
/bowser:hop-automate <workflow-name> [prompt] [playwright|claude] [headed|headless] [vision]
```

## Variable Extraction from Arguments

### Required
- **WORKFLOW**: First argument (e.g., `amazon-add-to-cart`)

### Keyword Detection (case-insensitive, from remaining args)
| Keyword | Variable | Value |
|---------|----------|-------|
| `claude` | SKILL | `claude-bowser` |
| `playwright` | SKILL | `playwright-bowser` (default) |
| `headless` | MODE | `headless` |
| `headed` | MODE | `headed` |
| `vision` | VISION | `true` |
| _remaining text_ | PROMPT | User's freeform input |

### Priority
CLI keyword overrides > Workflow frontmatter defaults > System defaults

## Four-Phase Workflow

### Phase 1: Parse & Validate
1. If no arguments: list available workflows via Glob and stop
2. Extract WORKFLOW from first argument
3. Validate workflow file exists: `.claude/commands/bowser/{WORKFLOW}.md`
4. Parse remaining arguments for keywords

### Phase 2: Load Workflow
1. Read workflow file
2. Check frontmatter for `defaults:` (skill, mode, vision)
3. Apply keyword overrides (take priority over frontmatter)
4. Extract workflow steps (content after frontmatter)

### Phase 3: Execute
Execute the resolved skill with combined prompt:
```
(headed: {MODE}) (vision: {VISION})
{workflow content with {PROMPT} replaced}
```

### Phase 4: Report
- Which workflow was run
- Which skill and mode were used
- Skill's output/results

## Workflow File Format

```markdown
---
description: Short description of what this workflow does
defaults:
  skill: playwright-bowser
  mode: headless
  vision: false
---

1. Navigate to {URL}
2. Verify page loads
3. Do something with {PROMPT}
4. Report results
```

## Examples
```bash
# Run amazon workflow with Chrome (needs real auth)
/bowser:hop-automate amazon-add-to-cart "wireless earbuds under $30"

# Override skill and mode
/bowser:hop-automate amazon-add-to-cart "usb-c hub" playwright headless

# Run blog summarizer
/bowser:hop-automate blog-summarizer "https://example.com/blog"

# List available workflows
/bowser:hop-automate
```
