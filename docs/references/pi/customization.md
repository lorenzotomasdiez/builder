## Customization

### Prompt Templates

Reusable prompts as Markdown files. Type `/name` to expand.

```markdown
<!-- ~/.pi/agent/prompts/review.md -->
Review this code for bugs, security issues, and performance problems.
Focus on: {{focus}}
```

Place in `~/.pi/agent/prompts/`, `.pi/prompts/`, or a [pi package](#pi-packages) to share with others. See [docs/prompt-templates.md](docs/prompt-templates.md).

### Skills

On-demand capability packages following the [Agent Skills standard](https://agentskills.io). Invoke via `/skill:name` or let the agent load them automatically.

```markdown
<!-- ~/.pi/agent/skills/my-skill/SKILL.md -->
# My Skill
Use this skill when the user asks about X.

## Steps
1. Do this
2. Then that
```

Place in `~/.pi/agent/skills/`, `~/.agents/skills/`, `.pi/skills/`, or `.agents/skills/` (from `cwd` up through parent directories) or a [pi package](#pi-packages) to share with others. See [docs/skills.md](docs/skills.md).

### Extensions

<p align="center"><img src="docs/images/doom-extension.png" alt="Doom Extension" width="600"></p>

TypeScript modules that extend pi with custom tools, commands, keyboard shortcuts, event handlers, and UI components.

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

**What's possible:**
- Custom tools (or replace built-in tools entirely)
- Sub-agents and plan mode
- Custom compaction and summarization
- Permission gates and path protection
- Custom editors and UI components
- Status lines, headers, footers
- Git checkpointing and auto-commit
- SSH and sandbox execution
- MCP server integration
- Make pi look like Claude Code
- Games while waiting (yes, Doom runs)
- ...anything you can dream up

Place in `~/.pi/agent/extensions/`, `.pi/extensions/`, or a [pi package](#pi-packages) to share with others. See [docs/extensions.md](docs/extensions.md) and [examples/extensions/](examples/extensions/).

### Themes

Built-in: `dark`, `light`. Themes hot-reload: modify the active theme file and pi immediately applies changes.

Place in `~/.pi/agent/themes/`, `.pi/themes/`, or a [pi package](#pi-packages) to share with others. See [docs/themes.md](docs/themes.md).

### Pi Packages

Bundle and share extensions, skills, prompts, and themes via npm or git. Find packages on [npmjs.com](https://www.npmjs.com/search?q=keywords%3Api-package) or [Discord](https://discord.com/channels/1456806362351669492/1457744485428629628).

> **Security:** Pi packages run with full system access. Extensions execute arbitrary code, and skills can instruct the model to perform any action including running executables. Review source code before installing third-party packages.

```bash
pi install npm:@foo/pi-tools
pi install npm:@foo/pi-tools@1.2.3      # pinned version
pi install git:github.com/user/repo
pi install git:github.com/user/repo@v1  # tag or commit
pi install git:git@github.com:user/repo
pi install git:git@github.com:user/repo@v1  # tag or commit
pi install https://github.com/user/repo
pi install https://github.com/user/repo@v1      # tag or commit
pi install ssh://git@github.com/user/repo
pi install ssh://git@github.com/user/repo@v1    # tag or commit
pi remove npm:@foo/pi-tools
pi uninstall npm:@foo/pi-tools          # alias for remove
pi list
pi update                               # skips pinned packages
pi config                               # enable/disable extensions, skills, prompts, themes
```

Packages install to `~/.pi/agent/git/` (git) or global npm. Use `-l` for project-local installs (`.pi/git/`, `.pi/npm/`). If you use a Node version manager and want package installs to reuse a stable npm context, set `npmCommand` in `settings.json`, for example `["mise", "exec", "node@20", "--", "npm"]`.

Create a package by adding a `pi` key to `package.json`:

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Without a `pi` manifest, pi auto-discovers from conventional directories (`extensions/`, `skills/`, `prompts/`, `themes/`).

See [docs/packages.md](docs/packages.md).

---

