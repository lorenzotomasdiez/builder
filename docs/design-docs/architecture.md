# Architecture Overview

This document describes the structural architecture of the Builder framework and how to adapt it for your projects.

## Framework Structure

```
project-root/
├── AGENTS.md              # Entry point for agents (~100 lines)
├── .agents/               
│   ├── skills/            # Reusable agent skills
│   │   ├── smart-commit/
│   │   ├── ref-only/
│   │   └── ...
│   └── settings.json      # Agent configuration (optional)
├── docs/
│   ├── design-docs/       # Architecture, decisions, beliefs
│   ├── exec-plans/        # Work plans (active/completed)
│   ├── product-specs/     # Feature specifications
│   └── references/        # External docs for grounding
├── templates/             # Project scaffolds
└── src/                   # Your application code
```

## Layer Responsibilities

### AGENTS.md
- Table of contents for the repository
- Points to deeper documentation
- Lists available skills
- Provides quick start guidance
- **Length**: ~100 lines max

### docs/design-docs/
Permanent documentation about the system:
- Core beliefs and philosophy
- Architecture decisions (ADRs)
- Quality standards
- Index of all design documents

### docs/exec-plans/
Ephemeral work tracking:
- `active/` - Work in progress
- `completed/` - Historical record
- `tech-debt-tracker.md` - Known issues

### docs/product-specs/
Product-level documentation:
- Feature specifications
- User stories
- Acceptance criteria
- Roadmap items

### docs/references/
External knowledge made local:
- API documentation
- Framework guides
- Tool references
- llms.txt files for better agent comprehension

### .agents/skills/
Reusable agent capabilities:
- Each skill in its own directory
- SKILL.md defines the skill
- References folder for skill-specific docs

## Dependency Rules

```
AGENTS.md → points to → docs/* and .agents/skills/*
docs/* → may reference → other docs/* files
.agents/skills/* → may use → docs/references/*
src/* → no dependency on → docs/* (docs describe src, not vice versa)
```

## Adapting for Your Project

### Minimal Setup
1. Copy AGENTS.md
2. Copy docs/design-docs/core-beliefs.md (customize it)
3. Copy .agents/skills/ you need

### Full Setup
1. Copy entire framework
2. Customize core-beliefs.md for your domain
3. Add project-specific skills
4. Add your reference docs to docs/references/
5. Create initial product specs

## Extension Points

### Custom Skills
Create `.agents/skills/your-skill/SKILL.md`:
```markdown
---
name: your-skill
description: What it does
---

## When to use
...

## Workflow
...
```

### Custom Linters
Add validation scripts that:
- Check documentation cross-links
- Verify architecture constraints
- Validate skill metadata

### Custom Templates
Add to templates/ for:
- New microservices
- New packages
- New documentation types
