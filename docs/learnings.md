# Learnings — Building Agentic Teams with Pi

Lessons from real mistakes made while building and debugging Pi extension-based agent systems.

---

## 1. Role-playing an agent is not invoking it

**What went wrong:** When asked to "launch docker-ops", the primary agent read `.pi/agents/docker-ops.md` and impersonated it inline — silently doing the wrong thing while appearing to work.

**Fix:** Real invocation requires spawning a `pi` subprocess with `--append-system-prompt`. Document this explicitly in `AGENTS.md` and mark the anti-pattern clearly. Reading a `.md` file does nothing.

---

## 2. `pi.setActiveTools()` is what makes dispatch autonomous

**What went wrong:** `dispatch_agent` was registered as a Pi tool but `pi.setActiveTools(["dispatch_agent"])` was never called. Every autonomous dispatch triggered a user approval prompt.

**Fix:** Call `pi.setActiveTools(["dispatch_agent"])` in `session_start`. This restricts the primary agent to only that tool AND pre-approves it — no confirmation needed. The tradeoff: primary agent loses direct codebase tools, becoming a pure dispatcher.

---

## 3. Streaming log commands hang agents forever

**What went wrong:** `docker-ops` agent ran `just logs-web 2>&1 | tail -100`. The `just logs-web` command uses `docker compose logs -f` (follow mode), which streams forever. `tail -100` buffers until EOF — which never comes. Agent froze at 8715 seconds.

**Fix:** Add `-snap` variants to the justfile using `--no-log-prefix --tail=200` (no follow). Mark the streaming variants as "human use only" in the agent's `.md`. Add a timeout watchdog in `dispatchAgent()` that sends SIGTERM → SIGKILL after N seconds.

---

## 4. Re-reading disk on every widget render is expensive

**What went wrong:** `renderDashboard()` called `loadAgents()`, `loadTeams()`, `loadSkills()` on every invocation — including every 1-second timer tick from a running agent subprocess. Unnecessary disk I/O every second.

**Fix:** Cache static data (`agents`, `teams`, `skills`) at `session_start`. Only re-read dynamic data (`features.json`, `claude-progress.txt`) on each render since those change during a session.

---

## 5. Always capture subprocess stderr to a log file

**What went wrong:** `proc.stderr.on('data', () => {})` discarded all stderr. When the agent hung, there was no way to diagnose why.

**Fix:** Write stderr to `.pi/agent-sessions/{agent}-stderr.log` during the run. Add a `/agent-logs <agent>` command to read it. First place to look when an agent behaves unexpectedly.

---

## 6. `before_agent_start` system prompt must drive behavior, not just describe

**What went wrong:** The initial system prompt injected via `before_agent_start` was 5 lines: "you can delegate using dispatch_agent, here are the agents." The primary agent ignored it and used its own tools directly.

**Fix:** Use a strong dispatcher prompt matching agent-team.ts: explicit role ("You are the primary agent"), explicit rules ("NEVER attempt bash/file operations directly"), and a structured agent catalog with dispatch names. Weak prompts are ignored under pressure.

---

## Checklist for new agentic repos

- [ ] `AGENTS.md` with execution model table (Skill / Prompt / Agent / Team)
- [ ] `pi.setActiveTools(["dispatch_agent"])` in `session_start`
- [ ] Strong dispatcher system prompt in `before_agent_start`
- [ ] All log/streaming commands have `-snap` non-following variants
- [ ] Timeout watchdog in `dispatchAgent()` (tune per workload — bowser needs 3000s+)
- [ ] Stderr captured to log file per agent
- [ ] `/kill <agent>` and `/agent-logs <agent>` debug commands registered
