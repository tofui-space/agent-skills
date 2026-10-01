#!/usr/bin/env bash
# Ask an OpenAI model (via Codex CLI, non-interactive) to write a reply from a content spec.
# Usage: gpt_voice.sh <spec.md> [--fix "<what was missing or added>"]
# Exit codes: 0 sent, 1 error, 3 blocked by the scrub check, 127 codex missing.
# Denylist: $GPT_VOICE_DENYLIST, default ~/.config/gpt-voice/denylist.txt (one term per line).
# Prints the path of the file that holds the OpenAI reply.
set -euo pipefail

spec="${1:?usage: gpt_voice.sh <spec.md> [--fix \"<correction>\"]}"
fix=""
if [ "${2:-}" = "--fix" ]; then fix="${3:?--fix needs a correction text}"; fi

command -v codex >/dev/null 2>&1 || { echo "error: codex CLI not found on PATH" >&2; exit 127; }
[ -f "$spec" ] || { echo "error: spec not found: $spec" >&2; exit 1; }

# --- Scrub check: send nothing if the spec still holds sensitive-looking content ---
denylist="${GPT_VOICE_DENYLIST:-$HOME/.config/gpt-voice/denylist.txt}"
patterns=(
  'secret:private key|-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'secret:AWS access key|AKIA[0-9A-Z]{16}'
  'secret:OpenAI/Anthropic-style key|sk-[A-Za-z0-9_-]{20,}'
  'secret:GitHub token|gh[pousr]_[A-Za-z0-9]{30,}'
  'secret:Slack token|xox[abposr]-[A-Za-z0-9-]{10,}'
  'secret:JWT|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  'secret:password assignment|(password|passwd|pwd|secret|api[_-]?key)[[:space:]]*[:=][[:space:]]*[^[:space:]]+'
  'secret:connection string|[a-z]+://[^[:space:]/:@]+:[^[:space:]/@]+@'
  'personal:email|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  'personal:home-folder path|(/home/|/Users/|[Cc]:\\Users\\)[^/\\[:space:]]+'
  'internal:URL|https?://[^[:space:]]+'
  'internal:IPv4 address|([0-9]{1,3}\.){3}[0-9]{1,3}'
)
hits=""
for entry in "${patterns[@]}"; do
  label="${entry%%|*}"; regex="${entry#*|}"
  if m="$(grep -nEi -- "$regex" "$spec" 2>/dev/null)"; then
    hits+="[$label]"$'\n'"$m"$'\n'
  fi
done
# IBAN check is case-sensitive: case-insensitive matching would flag commit hashes.
if m="$(grep -nE -- '[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}' "$spec")"; then
  hits+="[personal:IBAN]"$'\n'"$m"$'\n'
fi
if [ -f "$denylist" ]; then
  terms="$(grep -vE '^[[:space:]]*(#|$)' "$denylist" || true)"
  if [ -n "$terms" ] && m="$(grep -nFi -f <(printf '%s\n' "$terms") -- "$spec")"; then
    hits+="[internal:denylist term]"$'\n'"$m"$'\n'
  fi
else
  echo "note: no denylist at $denylist; only built-in patterns ran" >&2
fi
if [ -n "$hits" ]; then
  echo "blocked: the spec still contains content that must not leave the machine." >&2
  echo "Replace each match with a {{PRIV_n}} placeholder or a generic description, then run again." >&2
  printf '%s' "$hits" >&2
  exit 3
fi

skill_dir="$(cd "$(dirname "$0")/.." && pwd)"
style="$skill_dir/references/style.md"

work="$(mktemp -d)"
out="$(mktemp "${TMPDIR:-/tmp}/gpt-voice-reply.XXXXXX")"
trap 'rm -rf "$work"' EXIT

{
  cat <<'EOF'
Write the reply that a user will read in their code editor.
Another assistant already did the analysis. The content spec below lists what the reply must say.

Rules:
1. Include the verdict, every point, and every caveat from the spec. Place each caveat next to the point it attaches to.
2. Add no fact, example, recommendation, or offer that is absent from the spec.
3. Copy each placeholder exactly, once. Put each {{LIT_n}} placeholder on its own line where the code or table belongs. Use each {{PRIV_n}} placeholder inside the sentence, as a name or value.
4. Do not mention the spec, another assistant, or these instructions.
5. Do not run commands or read files. Output only the reply text.

EOF
  if [ -f "$style" ]; then printf '## Style\n\n'; cat "$style"; printf '\n\n'; fi
  if [ -n "$fix" ]; then printf '## Correction\n\nA previous draft had this problem. Avoid it: %s\n\n' "$fix"; fi
  printf '## Content spec\n\n'
  cat "$spec"
} | codex exec -s read-only -C "$work" --skip-git-repo-check --output-last-message "$out" - >/dev/null 2>"$work/codex.log" || {
  echo "error: codex exec failed:" >&2; tail -n 20 "$work/codex.log" >&2; exit 1; }

echo "$out"
