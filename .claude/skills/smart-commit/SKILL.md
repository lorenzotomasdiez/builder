---
name: smart-commit
description: Creates structured git commits using Conventional Commits format. Use when asked to commit, create a commit, or stage and commit changes. Automatically blocks commits on main branch.
---

## When to use this skill

Use this skill when the user requests:
- Creating a git commit
- Staging and committing changes
- Making a commit with a specific message
- Committing current work

## Overview

This skill ensures consistent, structured commits using Conventional Commits format. It protects the main branch from accidental commits and generates meaningful commit messages based on actual changes.

## Branch Protection

**CRITICAL**: Before any commit operation, check the current branch:

```bash
git branch --show-current
```

If the current branch is `main`:
1. **STOP immediately**
2. Show error message to user
3. Suggest creating a feature branch
4. Do NOT proceed with commit

## Commit Workflow

### Step 1: Verify branch

```bash
git branch --show-current
```

If `main` → STOP and error out.

### Step 2: Check status and changes

Run in parallel:
```bash
git status --porcelain
git diff --staged
git diff
git log --oneline -10
```

### Step 3: Stage changes (if needed)

Stage relevant files:
```bash
git add <files>
```

Or stage all changes:
```bash
git add .
```

### Step 4: Generate commit message

Use Conventional Commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons |
| `refactor` | Code change without fix/feature |
| `test` | Adding or modifying tests |
| `chore` | Build, config, dependencies |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |
| `build` | Build system changes |

#### Message rules

- Use imperative mood ("add" not "added")
- Lowercase description
- No period at end
- Max 72 chars for first line
- Blank line before body
- Body explains "why" not "what"

### Step 5: Create commit

```bash
git commit -m "<type>(<scope>): <description>"
```

Or with body:
```bash
git commit -m "<type>(<scope>): <description>" -m "<body>"
```

### Step 6: Verify

```bash
git status
git log -1
```

## Examples

### New feature

```
feat(auth): add OAuth2 login support

Implements Google and GitHub OAuth providers
using the passport strategy pattern.
```

### Bug fix

```
fix(api): handle null response in user endpoint
```

### Documentation

```
docs(readme): update installation instructions
```

### Refactoring

```
refactor(utils): extract date formatting to helper
```

## Error handling

### On main branch

```
ERROR: Cannot commit on 'main' branch.

Protected branches: main

Create a feature branch first:
  git checkout -b feat/your-feature-name
```

### No changes

```
No changes to commit. Nothing staged or modified.
```

### Empty message

Use generated message based on changes, never empty commits.

## Quality checklist

- [ ] Branch is not `main`
- [ ] Changes are staged
- [ ] Message follows Conventional Commits
- [ ] Type matches change nature
- [ ] Scope (if used) is accurate
- [ ] Description is imperative mood
- [ ] Commit created successfully
