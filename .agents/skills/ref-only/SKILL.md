---
name: ref-only
description: Constrains responses to only use documents in the references/ folder. Use when you need answers grounded exclusively in specific reference documentation, ensuring no external knowledge or assumptions are included.
metadata:
  version: 1.0.0
  author: Builder
---

# Reference-Only Answering Skill

## When to use this skill

Use this skill when:
- You need answers strictly grounded in specific documentation
- You want to prevent hallucinations or external knowledge injection
- You're building a knowledge-limited system
- You need citations to source documents
- You want to maintain consistency with canonical documentation

## Overview

This skill ensures that all responses are exclusively based on documents stored in `docs/references/`. No external knowledge, assumptions, or information beyond what's documented should be used.

## Workflow

### Step 1: Place reference documents
1. Add all source documents to `docs/references/`
2. Use clear, descriptive filenames and organize by topic (e.g., `claude/`, `pi/`, `api/`)
3. Ensure documents are complete and self-contained

### Step 2: Read and internalize references
1. Before answering any question, read ALL relevant files in `docs/references/`
2. Build a mental map of what information is available
3. Identify gaps in documentation

### Step 3: Answer only from references
1. Answer questions exclusively using content from the reference documents
2. Quote or reference specific sections where relevant
3. Cite the source document (filename and section)
4. Use exact terminology from the references

### Step 4: Handle missing information
1. If a question cannot be answered from the references, state clearly: "This information is not available in the reference documents."
2. Suggest what reference document would contain the answer, if applicable
3. Never fill gaps with external knowledge
4. Never make assumptions beyond what's documented

### Step 5: Maintain consistency
1. When references conflict, note the conflict
2. Prefer more recent or authoritative sources
3. Check for complementary information across multiple documents

## Examples

### Example 1: Direct answer from references
**Question**: "What is the API authentication method?"

**Response** (if documented):
"According to the `API.md` reference document, Section 'Authentication', the API uses Bearer token authentication. Clients must include the Authorization header: `Authorization: Bearer <token>`"

### Example 2: Missing information
**Question**: "How do I integrate with Slack?"

**Response** (if not documented):
"This information is not available in the reference documents. The available references cover: API endpoints, user management, and configuration. There is no Slack integration documentation available."

### Example 3: Citation with multiple sources
**Question**: "What are the system requirements?"

**Response** (if in multiple docs):
"Based on the reference documents:
- CPU: As specified in `REQUIREMENTS.md` - minimum 2 cores required
- Memory: Per `INSTALLATION.md` - minimum 4GB RAM recommended
- Database: Detailed in `DATABASE_GUIDE.md` - PostgreSQL 12+
"

## Edge cases

### Conflicting information in references
- Note the conflict explicitly
- Cite both sources
- Recommend which is more authoritative if applicable

### Incomplete documentation
- Answer with only what's available
- Clearly mark assumptions that the documentation requires
- Do not extrapolate or infer missing details

### Ambiguous or unclear reference text
- Quote the relevant section
- Ask for clarification about what specifically is needed
- Suggest what additional documentation would help

### Updates to references
- Always re-read references if they may have been updated
- Note if you're working with potentially stale information

## Quality criteria

A good response following this skill:
- ✅ Every fact is directly traceable to a reference document
- ✅ Source is clearly cited (document name + section)
- ✅ Exact terminology matches the references
- ✅ Gaps in documentation are explicitly acknowledged
- ✅ No external knowledge is introduced
- ✅ Quotes are accurate and in context
- ✅ Conflicting information is noted with sources

A poor response violates this skill:
- ❌ Uses knowledge not in the reference documents
- ❌ Makes assumptions or inferences beyond documentation
- ❌ Fails to cite sources
- ❌ Extrapolates information not explicitly stated
- ❌ Answers questions without checking all references first

## Implementation tips

### For agents using this skill
1. Always load and read the complete `references/` folder first
2. Build a searchable index of available information
3. Log which reference document each answer comes from
4. Reject questions requiring information not in references

### For users providing references
1. Ensure references are complete and cover use cases
2. Use consistent terminology across documents
3. Cross-reference related sections
4. Include examples where relevant

### For validation
- Spot-check answers against source documents
- Verify all citations point to actual document sections
- Test edge cases where information might be ambiguous

## References structure

```
docs/
└── references/
    ├── claude/
    │   ├── cli-reference.md
    │   └── ...
    ├── pi/
    │   ├── cli-reference.md
    │   └── ...
    └── api/
        └── ...
```

Add your reference documents to `docs/references/`. Each document should be self-contained and complete.
