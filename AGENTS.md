# Builder - Agent-First Development Framework

Framework for agent-first software development. Copy into any project to enable structured AI-assisted coding.

## Quick Start

1. Copy `.agents/`, `docs/`, and `AGENTS.md` to your project
2. Customize `docs/design-docs/core-beliefs.md` for your project
3. Run with your AI agent (Claude, Codex, etc.)

## Repository Map

```
builder/
├── AGENTS.md              # This file - entry point for agents
├── TODO.md                # Implementation plan for Build-Infr
├── .agents/               # Skills and agent configuration
│   └── skills/            # Reusable agent skills
├── docs/                  # Knowledge base (system of record)
│   ├── design-docs/       # Architecture, core beliefs, decisions
│   ├── exec-plans/        # Active and completed work plans
│   ├── product-specs/     # Feature specifications
│   │   └── build-infra-prd.md  # Build-Infr workflow PRD
│   └── references/        # External documentation for grounding
│       ├── build-infra-feature-generation.md
│       └── build-infra-template-variables.md
├── templates/             # Scaffolds for new projects
│   └── infra/             # Infrastructure templates
├── extensions/            # Pi extensions
│   └── extensions-examples/  # Reference implementations
└── lib/                   # Core libraries for Build-Infr
```

## Core Beliefs

See `docs/design-docs/core-beliefs.md` for the philosophy. Key principles:

- **No manually-written code** - Humans steer, agents execute
- **Repository is the system of record** - Everything versioned in-repo
- **Progressive disclosure** - Start here, drill down as needed
- **Mechanical enforcement** - Linters and tests, not conventions

## Skills

Located in `.agents/skills/`. Load with your agent's skill system.

| Skill | Purpose |
|-------|---------|
| `smart-commit` | Structured git commits (Conventional Commits) |
| `ref-only` | Ground responses exclusively in reference docs |
| `skill-generator` | Create new agent skills |
| `mermaid-diagrams` | Generate software diagrams |
| `find-skills` | Discover and install skills |

## Documentation Structure

### Design Docs (`docs/design-docs/`)
- `core-beliefs.md` - Agent-first operating principles
- `architecture.md` - System architecture decisions
- `index.md` - Catalog of all design documents

### Execution Plans (`docs/exec-plans/`)
- `active/` - Work in progress
- `completed/` - Historical record
- `tech-debt-tracker.md` - Known technical debt

### Product Specs (`docs/product-specs/`)
- Feature specifications and requirements
- User stories and acceptance criteria

### References (`docs/references/`)
- External documentation for grounding responses
- API docs, framework guides, tool references

## How Agents Work Here

1. Read AGENTS.md (this file)
2. Navigate to relevant docs based on task
3. Use skills as needed
4. All context must come from in-repo sources

## Adding New Content

1. **New skill**: Use `skill-generator` or copy existing skill structure
2. **New feature spec**: Add to `docs/product-specs/`
3. **Architecture decision**: Add to `docs/design-docs/`
4. **Reference docs**: Add to `docs/references/`

## Validation

Run `just validate` to check:
- Documentation cross-links are valid
- No stale references
- Skill metadata is correct

## Core Commands

```bash
just validate    # Run all validation checks
just scaffold    # Copy framework to new project
just clean       # Remove generated files
```
