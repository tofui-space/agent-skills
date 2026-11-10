#!/usr/bin/env bash
# Send a handoff brief to Codex CLI in non-interactive mode.
# Usage: codex_handoff.sh <brief.md> [out.md] [--restate]
#   --restate  Codex restates the task without doing it (round-trip check).
# Sandbox is read-only: Codex can read files but cannot modify them.
set -euo pipefail

brief="${1:?usage: codex_handoff.sh <brief.md> [out.md] [--restate]}"
out="${2:-${brief%.md}.codex-out.md}"
mode="${3:-}"

command -v codex >/dev/null 2>&1 || { echo "error: codex CLI not found on PATH" >&2; exit 127; }
[ -f "$brief" ] || { echo "error: brief not found: $brief" >&2; exit 1; }

brief_abs="$(cd "$(dirname "$brief")" && pwd)/$(basename "$brief")"

if [ "$mode" = "--restate" ]; then
  prompt="Read the file ${brief_abs}. Do not carry out the task. In your own words, write four sections: 1) Task, 2) Constraints, 3) Required output format, 4) Unclear terms or instructions. Output only these four sections."
else
  prompt="Read the file ${brief_abs} and carry out the task it describes. Follow its Constraints and Output format sections exactly."
fi

# Progress output goes to stderr; the final message goes to $out.
codex exec -s read-only --skip-git-repo-check --output-last-message "$out" "$prompt" >&2

echo "$out"
