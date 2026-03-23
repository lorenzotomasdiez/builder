# Core Beliefs - Agent-First Development

This document defines the operating principles for agent-first software development. These beliefs shape all decisions in this framework.

## The Shift

Traditional development: Humans write code, tools assist.
Agent-first development: Humans steer, agents execute.

This isn't about AI assistance—it's about AI as the primary code author.

## Core Principles

### 1. No Manually-Written Code

Humans never write implementation code. They:
- Define intent and acceptance criteria
- Design systems and feedback loops
- Review and validate outcomes
- Encode constraints mechanically

Agents:
- Write all implementation code
- Write tests, CI config, documentation
- Fix their own bugs
- Maintain consistency

**Why**: Human time is the scarce resource. Spend it on high-leverage activities.

### 2. Repository is the System of Record

Everything the agent needs lives in the repository:
- Design documents
- Architecture decisions
- Reference documentation
- Execution plans
- Technical debt tracking

**What doesn't count**:
- Slack discussions
- Google Docs
- Notion pages
- Tribal knowledge

If it's not in the repo, it doesn't exist to the agent.

### 3. Progressive Disclosure

Agents start with a small entry point (AGENTS.md) and navigate to what they need. The structure is:

```
AGENTS.md → docs/ → specific documents
```

Not:
```
1000-line instruction manual
```

**Why**: Context is scarce. Overwhelming agents reduces effectiveness.

### 4. Mechanical Enforcement

Constraints are enforced by tools, not conventions:
- Linters for code structure
- Structural tests for architecture
- CI checks for documentation freshness
- Automated validation of cross-links

**Why**: Agents can't "remember" conventions. They need enforceable rules.

### 5. Encode Human Judgment Once

When humans provide feedback:
1. Update documentation
2. Create or update linters
3. The rule now applies everywhere

**Why**: Capture taste once, enforce continuously.

## Anti-Patterns to Avoid

### Giant AGENTS.md
A monolithic instruction file:
- Crowds out task context
- Becomes stale immediately
- Cannot be mechanically verified

### External Knowledge Dependencies
Relying on:
- Chat history
- External documentation sites
- Human memory

### Manual Code Review as Quality Gate
At scale, humans cannot review every line. Instead:
- Encode review criteria into tools
- Agent-to-agent review
- Spot-check and iterate

### Perfect-First Mindset
In high-throughput agent systems:
- Corrections are cheap
- Waiting is expensive
- Ship fast, fix fast

## How to Apply These Beliefs

1. **Starting a new project**: Copy this framework, customize core-beliefs.md
2. **Adding a feature**: Create spec in docs/product-specs/, let agent implement
3. **Making architecture decisions**: Document in docs/design-docs/
4. **Learning from bugs**: Update linters or documentation, not just fix code

## Measuring Success

- Lines of manually-written code: Approaching zero
- Agent PR throughput: High and increasing
- Human time spent: Shifting from coding to steering
- Codebase coherence: Maintained through enforcement, not memory
