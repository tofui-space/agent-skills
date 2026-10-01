#!/usr/bin/env bash
# SessionStart hook: inject this repo's output-shaping skills into every session.
#
# a11y-writing and anti-vacuity must apply to every response, but skills load
# only when the model chooses to invoke them. Reading the SKILL.md files here
# makes that unconditional.
#
# Sources are the working tree, not the installed copies under the config dir —
# same reason the CLI prefers an enclosing checkout: local edits stay testable.

set -uo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS=(general/a11y-writing general/anti-vacuity)

emitted=0

for skill in "${SKILLS[@]}"; do
  file="$REPO_ROOT/skills/$skill/SKILL.md"
  [ -r "$file" ] || continue

  if [ "$emitted" -eq 0 ]; then
    cat <<'HEADER'
=== ALWAYS-ON OUTPUT RULES ===

The skills below are active for EVERY response in this session, from this turn
onward. Do not re-decide per turn whether they apply, and do not invoke them
via the Skill tool - their full contents are already here.

They govern chat prose only: not file contents, code, commit messages, or
catalog content under skills/ and rules/.

HEADER
  fi

  printf -- '--- %s ---\n\n' "${skill##*/}"
  # Strip YAML frontmatter; the body is what shapes output.
  awk 'NR==1 && /^---[[:space:]]*$/ {fm=1; next} fm && /^---[[:space:]]*$/ {fm=0; next} !fm' "$file"
  printf '\n'

  emitted=1
done

exit 0
