---
name: fail-early
description: "Makes Claude Code stop and file a stop report when an observable stop condition occurs, in place of continuing with unverified code. On invoke, checks whether the current repo is prepared (.claude/rules/fail-early.md, .claude/fail-early/, hook entries in .claude/settings.json) and installs the missing parts once, so later sessions need no skill and no setup. Invoke on 'fail-early', '/fail-early', 'install fail-early', 'set up stop rules', 'prepare this repo for Claude Code', and at the start of work in a new or freshly cloned repo. Also invoke when the user reports invented APIs or symbols, fix loops, weakened or always-green tests, stubs or workarounds in production code, success claimed without running checks, a half-finished task reported as done, a symptom patched without a root cause, or design drift from an ambiguous task. Do NOT use to review code, to size a bulk task, or to check prose."
---

# Fail early

## Why this skill exists

A model detects risk reliably before a task starts, from facts visible in the context: a missing file, an ambiguous sentence, a library absent from the repo. A model detects its own fabrication unreliably during generation, because an invented API and a real API produce equally fluent text.

An instruction such as "stop when unsure" depends on the unreliable half. This skill replaces it with two mechanisms:

- **Stop rules written as observable conditions.** Each rule names a fact that is checkable from the transcript or the file system.
- **External checks run by hooks.** A hook runs deterministically. A hook result does not depend on adherence to instructions late in a long session.

One more fact shapes the design: producing output is the default outcome of training. A stop needs explicit permission. The rule block therefore opens with "A stop report is a successful task outcome."

## What gets installed

| Path in the repo | Role |
|---|---|
| `.claude/rules/fail-early.md` | The 9 rules. Claude Code loads unscoped files in `.claude/rules/` at session start, so `CLAUDE.md` stays untouched. |
| `.claude/fail-early/gate.sh` | One hook script with 3 modes: `edit`, `stop`, `compact`. |
| `.claude/fail-early/stop-report.md` | The stop report format. |
| `.claude/fail-early/checks` | The repo's completion checks. Owned by the repo after creation. |
| `.claude/fail-early/README.md` | A record of the setup, the hook behavior, and the removal steps. |
| `.claude/settings.json` → `hooks` | 4 entries that call `gate.sh`. |

After the install, the repo is self-contained. A teammate or a CI session without this skill gets the same rules and the same gate.

## On invoke

6 steps. Steps 1 and 6 are scripted. Do not replace them with manual copies: a retyped rule block drifts from the source.

1. **Status.** Run `sh <skill-dir>/scripts/install.sh status <repo-root>`. If every part is `CURRENT` or `PRESENT` and the line `HOOKS` reads `4 of 4`, run step 6 and stop there.
2. **Install files.** Run `sh <skill-dir>/scripts/install.sh install <repo-root>`. The script copies `MISSING` parts only. A part reported as `DIFFERS` was edited locally or comes from another skill version: show the diff against the skill asset and ask which copy wins. Do not overwrite.
3. **Propose the checks.** Read the stack markers present in the repo: `package.json` scripts, `deno.json` tasks, `*.csproj` or `*.sln`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `CMakeLists.txt`, `Makefile`. Propose `stop:` lines for typecheck or build, tests, and lint, using commands that exist in those files. Run each proposed command once and show its result. Rule 1 applies here as well: a command absent from the repo's own files is not proposed.
   - A command that fails before any work has started is a broken foundation (rule 4). Report it. Do not add a failing command as a check, and do not fix it as part of the install.
   - Propose an `edit:` line only for a check that finished in under about 5 seconds. A slow `edit:` check runs after every file edit.
   - Wait for the user's confirmation, then write the confirmed lines to `.claude/fail-early/checks`.
4. **Merge the hooks.** Merge `assets/settings-hooks.json` into `.claude/settings.json`. Create the file if absent. Keep every existing key and every existing hook entry. Add an entry only if no entry with the same `gate.sh` mode exists.
5. **Executable bit.** The install script sets it. On a `DIFFERS` resolution done by hand, run `chmod +x .claude/fail-early/gate.sh`.
6. **Verify and report.** Run `sh <skill-dir>/scripts/install.sh verify <repo-root>`. Show the output. Show `git status --short` for `.claude/`. State that hook changes take effect through the settings file watcher, and that `/hooks` lists the 4 entries. Never stage and never commit: the user reviews the diff and commits.

If `verify` reports a gap that steps 2–5 did not close, stop and report the gap. Do not edit `gate.sh` or the verify script to make the gap disappear.

## The rules

The installed rule block is `assets/fail-early.md`. Read it before an implementation task in a session where this skill is active. Short names, for stop reports:

| # | Short name | Kind |
|---|---|---|
| 1 | no source | stop |
| 2 | two attempts | stop |
| 3 | design ambiguity | stop |
| 4 | broken foundation | stop |
| 5 | workaround or changed check | stop |
| 6 | no root cause | stop |
| 7 | library docs first | before code |
| 8 | completion evidence | before completion |
| 9 | test fails against broken code | before completion |

`references/rationale.md` holds the reason and one invented example per rule. Read it when a rule's boundary is unclear, and before proposing a change to a rule.

The block stays at 9 rules. Each added line lowers adherence to the other lines. A new rule replaces a rule or goes into a different skill.

## The stop report

Format: `assets/stop-report.md`. The first line, `FAIL-EARLY STOP REPORT`, is fixed. `gate.sh stop` searches the final message for that line and lets the stop through without running checks.

This exception is the core of the design. Without it, a failing check would refuse the stop, and the refusal would push toward the workaround that rule 5 forbids. With it, two outcomes pass the gate: verified completion, and an explicit stop report. An unverified success claim passes neither.

## Gate behavior

| Situation at the end of a turn | Result |
|---|---|
| No file edit in this session since the last pass | Stop allowed. No check runs. |
| Final message contains `FAIL-EARLY STOP REPORT` | Stop allowed. The user sees "stop report filed". |
| All `stop:` checks pass | Stop allowed, silently. |
| A `stop:` check fails, first time | Stop refused. The output goes to Claude with the two accepted next steps. |
| A `stop:` check fails, second time in a row | Stop allowed. The user sees "completion is unverified". No loop. |
| No active `stop:` line | Stop allowed. The user sees "completion is unverified". |

## Boundaries

- **Task size.** Degradation caused by too many files or items is a separate concern with its own preflight. This skill covers missing knowledge and missing verification.
- **Prose.** Empty or unverifiable prose is a separate concern. This skill covers code and task execution.
- **Reviews.** "A review verifies against primary sources" is a review-task rule. It is not part of this block, because it would load in every non-review session.
- **Subagents.** Hooks from settings files also run inside subagents, and `SubagentStop` calls the same gate.
- **Version control.** The install never stages and never commits.

## Known gaps

- Shell-made edits (`sed -i`, code generators) do not mark the session as edited, so the stop gate does not run for them.
- A check that can never fail passes the gate. Rule 9 covers this by instruction only.
- Uncertain — whether unscoped `.claude/rules/` files are re-injected after compaction: the docs state it for the project-root `CLAUDE.md` only. The `compact` mode reprints the block to cover the gap. The cost is 25 duplicate lines when both mechanisms fire.

## Updating

The rule block carries a version stamp in its first line. After a skill update, `status` reports the skill-owned parts as `DIFFERS`. Show the diff, ask, replace the confirmed parts, run `verify`. The `checks` file is never replaced.
