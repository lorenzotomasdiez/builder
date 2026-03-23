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

# Run pi with build-infra extension (infrastructure generation)
build-infra:
  pi -e extensions/build-infra.ts

# Scaffold build-infra toolkit to target directory
scaffold-infra target:
  @./scripts/scaffold-build-infra "{{target}}"

# Remove build-infra toolkit from target directory
clean-infra target:
  @./scripts/clean-build-infra "{{target}}"
