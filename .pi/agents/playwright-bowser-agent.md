# Playwright Bowser Agent

## Purpose
Headless browser automation agent using playwright-cli for isolated, parallel browser sessions. Thin wrapper enabling parallel spawning.

## When to Use
- Headless automation (no visual browser needed)
- Parallel execution (multiple instances)
- Public sites (no auth/cookies needed)
- CI/CD environments

## Workflow
1. Receive prompt from caller
2. Derive named session (kebab-case from context)
3. Execute playwright-bowser skill commands
4. Report results and session_id back to caller

## Playwright-CLI Quick Reference

### Session Management
```bash
playwright-cli -s=<name> open <url> --persistent   # Open with named session
playwright-cli list                                  # List all sessions
playwright-cli -s=<name> close                       # Close specific session
playwright-cli close-all                             # Close all sessions
```

### Core Commands
```bash
playwright-cli -s=<name> open <url>       # Open URL
playwright-cli -s=<name> goto <url>       # Navigate to URL
playwright-cli -s=<name> click <ref>      # Click element (ref from snapshot)
playwright-cli -s=<name> fill <ref> <text> # Fill input field
playwright-cli -s=<name> type <text>      # Type text
playwright-cli -s=<name> snapshot         # Get element refs (token-efficient)
playwright-cli -s=<name> screenshot       # Take screenshot
```

### Navigation
```bash
playwright-cli -s=<name> go-back
playwright-cli -s=<name> go-forward
playwright-cli -s=<name> reload
```

### Keyboard & Mouse
```bash
playwright-cli -s=<name> press <key>
playwright-cli -s=<name> keydown <key>
playwright-cli -s=<name> keyup <key>
playwright-cli -s=<name> mousemove <x> <y>
playwright-cli -s=<name> mousedown
playwright-cli -s=<name> mouseup
playwright-cli -s=<name> mousewheel <dx> <dy>
```

### Tabs
```bash
playwright-cli -s=<name> tab-list
playwright-cli -s=<name> tab-new <url>
playwright-cli -s=<name> tab-close
playwright-cli -s=<name> tab-select <index>
```

### Save & Export
```bash
playwright-cli -s=<name> screenshot --filename <path>
playwright-cli -s=<name> pdf
```

### Storage & State
```bash
playwright-cli -s=<name> state-save
playwright-cli -s=<name> state-load
playwright-cli -s=<name> cookie-*
playwright-cli -s=<name> localstorage-*
playwright-cli -s=<name> sessionstorage-*
```

### DevTools
```bash
playwright-cli -s=<name> console            # Read console output
playwright-cli -s=<name> run-code <js>       # Execute JavaScript
playwright-cli -s=<name> tracing-start
playwright-cli -s=<name> tracing-stop
playwright-cli -s=<name> video-start
playwright-cli -s=<name> video-stop
playwright-cli -s=<name> network             # View network requests
```

### Configuration
- Headed mode: `playwright-cli open <url> --headed`
- Browser choice: `playwright-cli open <url> --browser firefox`
- Viewport: `PLAYWRIGHT_MCP_VIEWPORT_SIZE=1440x900`
- Vision mode: `PLAYWRIGHT_MCP_CAPS=vision`
- Config file: `playwright-cli.json` in working directory

Example `playwright-cli.json`:
```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": { "headless": true },
    "contextOptions": { "viewport": { "width": 1440, "height": 900 } }
  },
  "outputDir": "./screenshots"
}
```

## Key Properties
- **Headless by default** (pass `--headed` to see browser)
- **Parallel sessions** via `-s=<name>`
- **Persistent profiles** (cookies, localStorage preserved)
- **Token-efficient** (no accessibility trees in context — use `snapshot` for element refs)
- **Vision mode opt-in** via `PLAYWRIGHT_MCP_CAPS=vision`
