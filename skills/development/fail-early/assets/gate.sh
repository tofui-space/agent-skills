#!/bin/sh
# fail-early v1 gate. POSIX sh, no dependencies.
# Usage: gate.sh edit|stop|compact   (hook JSON arrives on stdin)
#
#   edit     PostToolUse. Marks the session as edited. Runs "edit:" checks.
#   stop     Stop / SubagentStop. Runs "stop:" checks when the session edited files.
#   compact  SessionStart(compact). Prints the rule block so the rules survive compaction.
#
# Exit 2 sends stderr to Claude. On Stop, exit 2 also prevents the stop.

mode=${1:-stop}
input=$(cat)

root=$(git rev-parse --show-toplevel 2>/dev/null) || root=${CLAUDE_PROJECT_DIR:-$(pwd)}
dir="$root/.claude/fail-early"
[ -d "$dir" ] || dir="${CLAUDE_PROJECT_DIR:-$root}/.claude/fail-early"
checks="$dir/checks"

session=$(printf '%s' "$input" \
  | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  | head -n 1 | tr -cd 'A-Za-z0-9_-')
marker="${TMPDIR:-/tmp}/fail-early-${session:-nosession}.dirty"

report=""
failed=0
ran=0

run_checks() {
  want=$1
  [ -f "$checks" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case $line in
      "$want: "*) cmd=${line#"$want: "} ;;
      *) continue ;;
    esac
    ran=$((ran + 1))
    out=$(cd "$root" && sh -c "$cmd" </dev/null 2>&1)
    status=$?
    if [ "$status" -ne 0 ]; then
      failed=$((failed + 1))
      report="$report
CHECK FAILED (exit $status): $cmd
$(printf '%s\n' "$out" | tail -n 40)
"
    fi
  done <"$checks"
}

user_message() {
  # Static text only: no JSON escaping is needed.
  printf '{"systemMessage":"%s"}\n' "$1"
}

case $mode in
  compact)
    rules="$root/.claude/rules/fail-early.md"
    [ -f "$rules" ] || exit 0
    echo "Project rules from .claude/rules/fail-early.md, reprinted after compaction:"
    cat "$rules"
    exit 0
    ;;

  edit)
    : >"$marker"
    run_checks edit
    if [ "$failed" -gt 0 ]; then
      {
        echo "fail-early: $failed of $ran edit check(s) failed."
        printf '%s\n' "$report"
        echo "Rule 2: after 2 failed fix attempts at the same check, file a stop report."
      } >&2
      exit 2
    fi
    exit 0
    ;;

  stop)
    [ -f "$marker" ] || exit 0

    # A stop report is an accepted outcome. Never force work past it.
    if printf '%s' "$input" | grep -q 'FAIL-EARLY STOP REPORT'; then
      rm -f "$marker"
      user_message "fail-early: stop report filed. Completion checks were not run."
      exit 0
    fi

    run_checks stop

    if [ "$ran" -eq 0 ]; then
      rm -f "$marker"
      user_message "fail-early: no stop checks configured in .claude/fail-early/checks. Completion is unverified."
      exit 0
    fi

    if [ "$failed" -eq 0 ]; then
      rm -f "$marker"
      exit 0
    fi

    # Second consecutive failure: do not loop. Tell the user instead.
    if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
      rm -f "$marker"
      user_message "fail-early: $failed of $ran completion check(s) still fail. Treat the completion report as unverified."
      exit 0
    fi

    {
      echo "fail-early: $failed of $ran completion check(s) failed. The task is not complete."
      printf '%s\n' "$report"
      echo "Two accepted next steps: fix the cause, or file a stop report."
      echo "A stop report starts with the line FAIL-EARLY STOP REPORT. Format: .claude/fail-early/stop-report.md"
      echo "Changing a check to make it pass is rule 5: stop report."
    } >&2
    exit 2
    ;;

  *)
    echo "fail-early gate: unknown mode '$mode'" >&2
    exit 1
    ;;
esac
