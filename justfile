default:
  @just --list

# Run validation checks
validate:
  @./scripts/validate

# Scaffold Builder to target directory (default: current)
scaffold target=".":
  @./scripts/scaffold "{{target}}"

# Remove generated files
clean:
  @find . -name ".DS_Store" -delete
  @echo "Cleaned .DS_Store files"

# Run pi CLI
pi:
  pi

# Run pi with pure-focus extension
focus:
  pi -e extensions/pure-focus.ts

# Run pi with subagent-widget extension
subagent:
  pi -e extensions/subagent-widget.ts
