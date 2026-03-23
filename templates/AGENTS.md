# [Project Name] - Agent Entry Point

Brief description for agents to understand the project purpose.

## Quick Start

1. Copy `.agents/`, `docs/`, and this file to your project
2. Customize `docs/design-docs/core-beliefs.md`
3. Add project-specific skills to `.agents/skills/`

## Repository Map

```
[project]/
├── AGENTS.md              # This file
├── .agents/
│   └── skills/            # Agent skills
├── docs/
│   ├── design-docs/       # Architecture, decisions
│   ├── exec-plans/        # Work plans
│   ├── product-specs/     # Feature specs
│   └── references/        # External docs
└── src/                   # Application code
```

## Core Beliefs

See `docs/design-docs/core-beliefs.md`. Key principles:

- **No manually-written code** - Humans steer, agents execute
- **Repository is the system of record**
- **Progressive disclosure**
- **Mechanical enforcement**

## Available Skills

| Skill | Purpose |
|-------|---------|
| `smart-commit` | Structured git commits |
| `ref-only` | Ground responses in reference docs |

## Documentation

- **Architecture**: `docs/design-docs/architecture.md`
- **Design decisions**: `docs/design-docs/`
- **Active work**: `docs/exec-plans/active/`
- **References**: `docs/references/`

## Commands

```bash
just validate    # Run validation checks
just test        # Run tests
just lint        # Run linters
```
