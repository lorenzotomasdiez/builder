# Design Documents Index

Catalog of all design documents in this repository.

## Core Documents

| Document | Status | Description |
|----------|--------|-------------|
| [core-beliefs.md](./core-beliefs.md) | Active | Agent-first operating principles |
| [architecture.md](./architecture.md) | Active | System structure and layering |

## Product Specifications

| Document | Status | Description |
|----------|--------|-------------|
| [../product-specs/build-infra-prd.md](../product-specs/build-infra-prd.md) | Draft | Build-Infr workflow for infrastructure generation |

## References

| Document | Description |
|----------|-------------|
| [../references/build-infra-feature-generation.md](../references/build-infra-feature-generation.md) | Feature generation system reference |
| [../references/build-infra-template-variables.md](../references/build-infra-template-variables.md) | Template variables reference |

## Status Definitions

- **Active**: Current and maintained
- **Draft**: Work in progress
- **Deprecated**: No longer applies, kept for history

## Adding New Design Documents

1. Create markdown file in this directory
2. Follow naming convention: `kebab-case.md`
3. Update this index
4. Link from AGENTS.md if broadly relevant

## Document Template

```markdown
# [Title]

## Context
Why this decision/document exists.

## Decision
What was decided.

## Consequences
What changes as a result.

## Related
Links to related documents.
```
