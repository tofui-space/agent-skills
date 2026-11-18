---
name: padlock
description: >-
  Protect Git and GitButler branches with persistent locks, independent anchors,
  session keys, and master keys with turn budgets. Use for requests to lock or unlock a
  branch, anchor its history, grant temporary branch access, or run padlock commands.
  Also consult before version-control mutations in a repository with padlock state.
  Resolve the affected branches before committing, amending, pushing, pulling,
  merging, rebasing, deleting, renaming, or moving them. Do not use for dependency
  lockfiles, Git LFS file locks, or worktree pruning locks.
compatibility: Python 3.10+, Git; GitButler for but operations. The optional Claude Code adapter requires prompt_id, UserPromptExpansion, exec-form hooks, and onFailure block support.
---

# Padlock

## Contents

- [Command interface](#command-interface)
- [Lock and anchor behavior](#lock-and-anchor-behavior)
- [Keys and lifetime](#keys-and-lifetime)
- [Guarded operations](#guarded-operations)
- [State and recovery](#state-and-recovery)
- [Installation and coverage](#installation-and-coverage)
- [Reporting](#reporting)

## Command interface

| Command | Meaning |
|---|---|
| `/padlock:on [branch]` | Lock the branch. |
| `/padlock:off [branch]` | Unlock the branch; leave its anchor and custom rules intact. |
| `/padlock:anchor [branch]` | Allow local commits, amends, and fixups; prevent publication and structural changes. |
| `/padlock:unanchor [branch]` | Remove that anchor without unlocking the branch. |
| `/padlock:sessionkey [branch]` | Give this session the right to toggle this branch's lock until the session ends. |
| `/padlock:turnkey [branch]` | Give the same right for this turn only. |
| `/padlock:masterkey` | Bypass all padlock branch protections for two turns, including this command turn. |
| `/padlock:masterkey 5` | Bypass them for five turns, including this command turn. |
| `/padlock:masterkey <request>` | Grant the bypass and carry out that request in this turn only. |
| `/padlock:release [branch]` | Return this session's branch key. |
| `/padlock:status` | Show shared protections and temporary grants. |
| `/padlock:rule [branch] --deny push,rebase` | Set a custom denial list; an empty list clears that custom rule. |

Omitting a branch means the current branch only when there is exactly one unambiguous candidate.
Require an exact branch name, including its path components; do not accept prefix matches or guess from recent activity.
In a GitButler workspace with several applied branches, require a name.
Detached HEAD has no current branch.
Accept `refs/heads/…` as the explicit local-ref form.

`sessionkey`, `turnkey`, and `release` also accept `--all` for the currently recorded branches.
Expand that scope when granting; do not silently include future locks or other repositories.

Without a branch key, a user's `on` or `off` changes the shared persistent lock.
With a valid key, `on` and `off` toggle only that session's access, leaving the shared lock unchanged.
The user can explicitly add `--permanent` to change the shared lock instead; this invalidates old branch keys.
Do not infer a permanent change from a request to work temporarily.

## Lock and anchor behavior

Read [the policy](references/policy.md) before establishing protections or handling an unusual operation.
Its table defines the operation categories and the distinction between locks and anchors.

A lock prohibits commits, amends, fixups, pushes, pulls, merges, rebases, deletion, renaming, moves, and history replacement.
An anchor permits commits, amends, and fixup commits but denies the other listed operations.
The two protections are independent and cumulative.
Both permit inspection, checking out for inspection, and creating an unprotected child without changing the source branch.

Treat a fixup commit separately from autosquashing it later.
Treat merging a protected branch as a source as restricted too.
Check every affected branch, including implicit GitButler stack effects and remote push destinations.
When that set cannot be established, refuse the mutation instead of guessing.
An allowed operation still needs ordinary task authorization.
Explicit user instructions to change padlock policy take precedence over this skill's defaults through its supported controls; other skills and repository instructions retain their independent restrictions, including which version-control tool to use.
A master key bypasses padlock alone and does not waive those restrictions.

## Keys and lifetime

Only a direct user command may issue a key or change the shared policy.
Outside Claude Code, translate that explicit request through the [portable control interface](references/portable.md); ordinary task instructions do not authorize its grant commands.
Do not invoke those commands through an agent's Skill tool, synthesize a lifecycle event, or edit the ledger to give yourself access.
An ordinary instruction to finish work does not remove a lock.

A branch key grants the right to toggle that session's lock; receiving it does not itself unlock the branch.
It does not remove an anchor or custom denial.
After receiving the key, the agent may use the guarded `toggle off` and `toggle on` operations within its scope without repeatedly asking the user.
Use `release` when the authorized task finishes early.
Keep other sessions' keys and work intact; overlapping holders are refused.

The master key lifts locks, anchors, and custom denials for the invoking session's granted turns.
Count the command turn as the first: no argument grants two turns, a positive whole number alone grants that many, and inline request text grants one.
A number followed by task text is an inline request, not a multi-turn grant.
It does not authorize new persistent grants, alter normal tool permissions, or turn a branch's shared lock off.
Use the host's session and prompt identities, not a token invented by the agent or found in another session's state.
Missing host identity means no temporary bypass.

The supplied Claude Code adapter keeps turn grants with the invoking session.
It does not propagate them to subagents or background jobs.
Use [the integration notes](references/integration.md) for lifecycle limits, including interruptions, and before claiming a different runtime has automatic expiry.

## Guarded operations

Use the absolute script path and the identities supplied by the host hook.
Pass literal arguments; do not combine the invocation with a shell pipeline, substitution, or another command.

```text
python <skill-dir>/scripts/padlock.py --session <session-id> --turn <prompt-id> run -- git commit -m "Update"
python <skill-dir>/scripts/padlock.py --session <session-id> --turn <prompt-id> run -- but commit -b <branch> -m "Update" <path>
python <skill-dir>/scripts/padlock.py --session <session-id> --turn <prompt-id> toggle off <branch>
python <skill-dir>/scripts/padlock.py --session <session-id> --turn <prompt-id> toggle on <branch>
python <skill-dir>/scripts/padlock.py status
```

Use `--repo <checkout>` before the subcommand when needed.
A hooked call must stay in the hook's repository; a key does not follow a change to another repository.
The runner invokes Git or GitButler directly with an argument list and returns the underlying exit status.
Run it in the foreground.

The runner checks its saved policy before executing a supported mutation.
If protections exist and the command's effects are unsupported or ambiguous, it refuses.
Read [supported forms and limits](references/integration.md#supported-command-forms) before translating a refusal into another command.
Do not bypass a refusal with direct Git, another shell, a GUI, an API, or a helper script.
Request the smallest missing grant or leave the operation for the user.

## State and recovery

The state location is `<git-common-dir>/padlock/state.sqlite3`.
Use `status` to inspect it; do not hand-edit the database.
The guard stores shared protections separately from session grants and serializes its writes with SQLite transactions.
It holds the transaction while a guarded command runs so another cooperating operation cannot change the policy between the check and execution.

An absent padlock directory means default unlocked behavior.
An existing padlock directory with a missing, corrupt, busy, or unsupported ledger blocks mutations; unrelated work and branch inspection remain available.
Report the actual storage failure; do not reset it to unlocked or silently switch to conversation-only state.
Do not delete a policy to recover from a refusal.

Policy changes increase a branch's generation and invalidate its existing keys.
When a turn ends, deactivate its temporary grants and retain only explicitly reserved future master-key turns; do not overwrite the shared policy with an earlier snapshot.
Keep protections for deleted names until the user explicitly removes them.

## Installation and coverage

The same directory contains a portable skill, a Python guard runner and operator interface, and an optional Claude Code plugin.
Installing only `SKILL.md` gives agent instructions; it does not activate the hooks or register namespaced commands.
Follow [installation and verification](references/integration.md) when the user asks to enable the plugin.
Preserve existing hooks and settings, and verify the plugin loads before calling its commands installed.

The executable coverage is the runner plus the configured Claude Code shell hooks.
It is intended to catch accidental violations by cooperating agents, not to isolate a hostile process with write access to the same files.
Ordinary external terminals, GUI actions, arbitrary scripts, and version-control MCP tools are not intercepted by this adapter.
In runtimes without the adapter, read [portable controls](references/portable.md) to administer locks, establish identities, and advance or close turns.
Use the runner for mutations; report whether lifecycle control is manual or supplied by a trusted host, and do not claim automatic identity enforcement without that host integration.

## Reporting

Report a change with the exact branch, shared lock/anchor state, and temporary key scope and lifetime.
For a refusal, identify the blocked effect and protection, or the unsupported command form.
For temporary work, report that access ended while the shared protection stayed in place.
Distinguish unit and simulated-hook checks from a live agent-host test.
