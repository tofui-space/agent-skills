# Installation and guard coverage

## Contents

- [Load the Claude Code plugin](#load-the-claude-code-plugin)
- [Verify before relying on it](#verify-before-relying-on-it)
- [Supported command forms](#supported-command-forms)
- [Lifetime and storage limits](#lifetime-and-storage-limits)
- [Other runtimes](#other-runtimes)

## Load the Claude Code plugin

Require Python 3.10 or later and Git on the executable search path.
Require a Claude Code version supporting `prompt_id`, `UserPromptExpansion`, exec-form hooks, and `onFailure: "block"`.
The documented minimum for `onFailure` is 2.1.295; verify the other events and fields in the installed version too. Checked: read in [vendor documentation](https://code.claude.com/docs/en/hooks).

For a local trial, start Claude Code with this skill directory as the plugin root:

```text
claude --plugin-dir <skill-dir>
```

That loading mechanism is documented by the vendor. Checked: read in [vendor documentation](https://code.claude.com/docs/en/plugins).
Use the normal plugin installer for a lasting installation.
Do not replace existing project settings or hooks, and do not install globally unless requested.
Copying this directory as an ordinary skill alone does not enable its plugin hooks. Checked: read in vendor documentation, linked above.

The plugin declares the namespaced commands in `commands/` and its lifecycle hooks in `hooks/hooks.json`. Checked: read in source code.
Its root `SKILL.md` supplies the agent policy. Checked: read in source code.

## Verify before relying on it

Run the bundled checks:

```text
python -m unittest discover -s <skill-dir>/scripts -p test_padlock.py
```

Then use a disposable repository in a real Claude Code session:

1. Run `/padlock:on` and confirm the exact resolved branch.
2. Ask for a commit. Confirm the guarded runner refuses before Git or GitButler executes it.
3. Run `/padlock:sessionkey`, then ask the agent to temporarily unlock and commit through the runner.
4. In a second session, confirm the branch remains locked.
5. Run `/padlock:anchor`; confirm a lock key does not permit pushing.
6. Run `/padlock:masterkey`; verify access for its command turn and the following turn, then refusal in the third. Check a numeric count and an inline request too.
7. Repeat with a granted turn interrupted, then a new prompt. Confirm the old prompt ID cannot be reused and only explicitly reserved turns remain.
8. Confirm a missing guard script blocks a hooked tool call rather than silently allowing it.

Do not report these live-host checks as passed based only on the unit tests.
Use [tool evidence](tool-evidence.md) when checking event schemas and external command semantics.

## Supported command forms

These are implementation boundaries, not an exhaustive list of Git or GitButler capabilities. Checked: read in source code.

| Command family | Guard behavior when protections exist | Checked |
|---|---|---|
| Common status, diff, log, show, and ref inspection | Allow without consulting the policy ledger. | Source; ran tests. |
| `git commit`, `--amend`, `--fixup` | Check the current branch; refuse a commit completing a merge. | Source. |
| `git push <remote> <source>:<destination>` | Check the local source and matching destination name, including deletion. | Source; ran tests. |
| `git pull` with one configured upstream | Check the current branch and upstream source; refuse explicit refspecs. | Source. |
| `git merge <local-branch>` | Check source and destination. | Source; ran tests. |
| Plain branch creation and checkout | Permit unchanged sources; protect reused destination names. | Source; ran tests. |
| Git deletion and recognized rename forms | Check named branches; carry protections to successful rename destinations. | Source; ran tests. |
| `but commit`, `but amend` | Check the target and possible rewrites within its stack. | Source; ran tests. |
| Plain `but branch new <name>` | Permit additive creation. | Source; ran tests. |
| `but push <branch>`, `but pr new <branch>` | Resolve push preview sources and remote destinations; PR creation checks the whole selected stack. | Source; ran tests and a real push preview. |
| `but pull`, `but merge <branch>` | Check the configured target, upstream integration and affected workspace/worktree branches. | Source; ran tests. |
| `but branch delete/update <branch>` | Check the target and possible stack rewrites; update also checks its upstream. | Source; ran tests. |
| `but reword <branch> -m <name>` | Check both names; migrate protection after success. | Source; ran tests. |
| `but move` to one existing destination or `--unstack` | Check source and destination stacks. | Source; ran tests. |
| `but uncommit`, `but squash` with explicit branch/commit subjects | Check affected stacks and branch removal. | Source; ran tests. |
| Other forms, unknown options, bulk pushes, aliases, compound commands | Refuse when the affected branches cannot be established. | Source; ran selected refusal tests. |

The table was checked by reading `scripts/operations.py` and `scripts/padlock.py`; the simulated operation tests exercise selected forms. Checked: read in source code; ran the bundled tests.
Do not replace an unsupported GitButler operation with Git if the repository reserves writes for GitButler.
Supported GitButler operations use branch-scoped keys; an unrelated protected branch does not itself block them. Checked: read in source code; ran tests.
Stack rewrite checks conservatively include the selected stack because empty branches can share tips; this can block more than the eventual rewrite would affect. Checked: read in source code.
Push resolution uses `but push --dry-run --json`; that preview may fetch remote-tracking refs, but does not publish or integrate local branches. Checked: read in vendor source code linked in tool evidence; ran a real preview.
The adapter accepts the standard fetch mapping and rejects custom mappings, Gerrit mode, or unknown preview schemas rather than guessing a destination. Checked: read in source code; ran tests.
Pull/merge require an exact local `gitbutler.project.targetRef` and one resolvable upstream when configured. Checked: read in source code; ran installed GitButler configuration inspection.
Unknown command forms still require a verified adapter or an explicit master key.
The master key bypasses branch restrictions, but still requires the runner and rejects repository override arguments.

## Lifetime and storage limits

The adapter issues grants from `UserPromptExpansion`, not from arbitrary prompt text. Checked: read in source code.
Claude Code documents expansion as the direct user-command path, while ordinary prompt submission also serves automatically started turns. Checked: read in [vendor documentation](https://code.claude.com/docs/en/hooks#userpromptexpansion).
Session and turn IDs come from host events, and the script checks them again before admitting guarded shell work. Checked: read in source code.

`Stop` and `StopFailure` deactivate the current grant; each new prompt ID activates and consumes one explicitly reserved master-key turn, if any. Checked: read in source code.
`SessionEnd` removes the session's keys and remaining turn budget. Checked: read in source code.
Count distinct host prompt IDs as turns, including automatically started turns.
Claude Code documents that `Stop` does not fire on user interruption. Checked: read in [vendor documentation](https://code.claude.com/docs/en/hooks#stop).
Consequently, do not grant this adapter's turn bypass to subagents or background jobs; they could outlive an interrupted parent turn.
Treat expiry as a bar on starting another guarded operation, not cancellation or rollback of one already started.

Resuming a session through `SessionStart` invalidates its old keys; a compaction event preserves session keys. Checked: read in source code.
Missing hook identity or an unreadable ledger never establishes a temporary bypass. Checked: read in source code.
The ledger lives under Git's shared directory, so linked worktrees use the same location. Checked: read in source code and [vendor documentation](https://git-scm.com/docs/git-worktree).
Other clones and machines do not share this local ledger. Checked: read in source code.

An external terminal, GUI, MCP tool, or arbitrary program can bypass the shell adapter. Checked: read in source code.
The hook recognizes direct or visibly nested Git/GitButler commands; it does not analyze arbitrary program source or monitor every filesystem write. Checked: read in source code.
After an interrupted rename or an external policy/branch change, inspect both branch names and the ledger before continuing; do not assume metadata reconciliation completed.

## Other runtimes

Use the portable policy and runner when another agent runtime is in use.
Read [portable controls](portable.md) to create a session, apply direct user policy requests, and explicitly advance or close turns.
The operator CLI and Claude Code adapter share the same command parser and persisted policy. Checked: read in source code; ran tests.
Do not claim that this Claude Code plugin registers commands or lifecycle enforcement in that runtime.
A new adapter must provide trusted session and turn identities, direct-user grant authorization, a tool gate, and expiry signals before exposing the same automatic key behavior.
