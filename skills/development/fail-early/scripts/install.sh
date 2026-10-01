#!/bin/sh
# fail-early installer. POSIX sh, no dependencies. Idempotent. Never commits.
# Usage: install.sh status|install|verify <project_dir>
#
#   status   Reports each part: MISSING, CURRENT, or DIFFERS. Changes nothing.
#   install  Copies MISSING parts. Never overwrites a file that DIFFERS.
#   verify   Checks the full installation, including the hook entries. Exit 1 on a gap.
#
# settings.json is never edited here: a JSON merge needs a JSON parser.
# The skill instructs Claude to merge assets/settings-hooks.json, then to run "verify".

set -u
action=${1:-status}
project=${2:-.}
skill=$(cd "$(dirname "$0")/.." && pwd)
assets="$skill/assets"

[ -d "$project" ] || { echo "ERROR: not a directory: $project" >&2; exit 1; }
project=$(cd "$project" && pwd)

# source-asset : target-path
parts="fail-early.md:.claude/rules/fail-early.md
gate.sh:.claude/fail-early/gate.sh
stop-report.md:.claude/fail-early/stop-report.md
README.md:.claude/fail-early/README.md"

state_of() {
  if [ ! -f "$2" ]; then echo MISSING
  elif cmp -s "$1" "$2"; then echo CURRENT
  else echo DIFFERS
  fi
}

gaps=0
gap() { echo "GAP      $1"; gaps=$((gaps + 1)); }

echo "fail-early $action: $project"

echo "$parts" | while IFS=: read -r src dst; do
  state=$(state_of "$assets/$src" "$project/$dst")
  case "$action:$state" in
    install:MISSING)
      mkdir -p "$(dirname "$project/$dst")"
      cp "$assets/$src" "$project/$dst"
      echo "COPIED   $dst" ;;
    *) echo "$state  $dst" ;;
  esac
done

checks="$project/.claude/fail-early/checks"
if [ -f "$checks" ]; then
  echo "PRESENT  .claude/fail-early/checks (project-owned, never overwritten)"
elif [ "$action" = install ]; then
  mkdir -p "$(dirname "$checks")"
  cp "$assets/checks.template" "$checks"
  echo "COPIED   .claude/fail-early/checks (template: no active check yet)"
else
  echo "MISSING  .claude/fail-early/checks"
fi

[ "$action" = install ] && chmod +x "$project/.claude/fail-early/gate.sh"

settings="$project/.claude/settings.json"
hooked=0
if [ -f "$settings" ]; then
  hooked=$(grep -c 'fail-early/gate.sh' "$settings")
fi
echo "HOOKS    $hooked of 4 gate.sh entries in .claude/settings.json (snippet: $assets/settings-hooks.json)"

[ "$action" = verify ] || exit 0

# ---- verify ----
echo "$parts" | while IFS=: read -r src dst; do
  [ "$(state_of "$assets/$src" "$project/$dst")" = CURRENT ] || echo "GAP      $dst is not CURRENT"
done | tee /tmp/fail-early-verify.$$ 
gaps=$(grep -c '^GAP' /tmp/fail-early-verify.$$); rm -f /tmp/fail-early-verify.$$

[ -x "$project/.claude/fail-early/gate.sh" ] || gap "gate.sh is not executable"
[ "$hooked" -ge 4 ] || gap "settings.json holds $hooked of 4 hook entries"
for m in edit stop compact; do
  grep -q "\"$m\"" "$settings" 2>/dev/null || gap "settings.json has no gate.sh entry with mode \"$m\""
done
if [ -f "$checks" ] && grep -q '^stop: ' "$checks"; then :; else
  gap "checks has no active \"stop: \" line, so completion is never verified"
fi
if [ -x "$project/.claude/fail-early/gate.sh" ]; then
  out=$(cd "$project" && echo '{}' | CLAUDE_PROJECT_DIR="$project" ./.claude/fail-early/gate.sh compact)
  case $out in *"Fail early"*) ;; *) gap "gate.sh compact did not print the rule block" ;; esac
fi

if [ "$gaps" -eq 0 ]; then echo "VERIFIED no gaps"; exit 0; fi
echo "NOT VERIFIED: $gaps gap(s)"; exit 1
