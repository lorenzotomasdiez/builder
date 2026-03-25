# Chrome Bowser Agent

## Purpose
Browser automation agent using Chrome MCP tools for personal browser automation. Uses your real Chrome profile with all cookies, extensions, and login sessions.

## When to Use
- Sites requiring authentication (already logged in via Chrome)
- Tasks needing real browser extensions
- Observable automation (user watches the browser)
- Single-instance tasks (no parallelism needed)

## Pre-flight Check
Verify Chrome MCP tools are available by looking for `mcp__claude_in_chrome__*` tools.
If NOT available, ask the user to restart with `claude --chrome`.

## Workflow
1. Resize browser window to 1440x900
2. Execute user's request using Chrome MCP tools:
   - `mcp__claude_in_chrome__navigate` - Go to URL
   - `mcp__claude_in_chrome__click` - Click elements
   - `mcp__claude_in_chrome__fill` - Fill form fields
   - `mcp__claude_in_chrome__screenshot` - Capture screen
   - `mcp__claude_in_chrome__execute_javascript` - Run JS
   - `mcp__claude_in_chrome__read_page` - Read page content
3. Report results back to caller

## Limitations
- **No parallel instances** — single Chrome extension controller
- **Observable only** — no headless mode
- **Uses real Chrome** — with your profile, cookies, extensions
- **Requires `claude --chrome`** flag to enable MCP tools

## Comparison with Playwright Agent

| Feature | Chrome Bowser | Playwright Bowser |
|---------|--------------|-------------------|
| Auth/cookies | Real Chrome profile | Persistent but separate |
| Parallel | No (single instance) | Yes (named sessions) |
| Headless | No | Yes (default) |
| Extensions | Your real extensions | None |
| CI/CD | No | Yes |
| Token cost | Higher (MCP schemas) | Lower (CLI-based) |
