# fail-early (installed)

Installed by the `fail-early` Claude Code skill. This file records the setup, so nobody has to remember it.

## Purpose

Claude Code stops and files a stop report when an observable stop condition occurs. It does not continue with unverified code.

## Installed parts

| Path | Role | Owner |
|---|---|---|
| `.claude/rules/fail-early.md` | The 9 rules. Claude Code loads the file at every session start. | skill (do not edit here) |
| `.claude/fail-early/gate.sh` | Hook script: `edit`, `stop`, `compact` modes. | skill (do not edit here) |
| `.claude/fail-early/stop-report.md` | Stop report format. | skill (do not edit here) |
| `.claude/fail-early/checks` | The completion checks for this repo. | **this repo** (edit freely) |
| `.claude/settings.json` → `hooks` | 4 entries that call `gate.sh`. | this repo |

## Behavior of the hooks

- **After a file edit:** the session is marked as edited. `edit:` checks run. A failure is sent to Claude.
- **When Claude finishes a turn:** nothing runs unless the session edited files. Otherwise the `stop:` checks run.
  - All pass: Claude stops.
  - A check fails: the stop is refused once, and Claude receives the output.
  - The check fails a second time: Claude stops, and you receive a warning that completion is unverified.
  - The final message starts a stop report (`FAIL-EARLY STOP REPORT`): Claude stops without checks. A stop report is an accepted outcome.
- **After context compaction:** the rule block is printed into the context again.

## Change the checks

Edit `.claude/fail-early/checks`. Format: `stop: <command>` or `edit: <command>`, one per line. Commands run from the repository root.

## Verify, update, remove

- Verify: `sh <skill-dir>/scripts/install.sh verify .`
- Update: update the skill, delete the skill-owned files listed above, and invoke the skill again.
- Remove: delete `.claude/rules/fail-early.md` and `.claude/fail-early/`, then delete the 4 `gate.sh` entries from `.claude/settings.json`.
- Disable for one run: `claude --settings '{"disableAllHooks": true}'`. The rules still load.

## Known gaps

- Edits made through shell commands (`sed -i`, code generators) do not mark the session as edited.
- The gate verifies that checks pass. It cannot verify that the checks are meaningful. Rule 9 covers that by instruction only.
