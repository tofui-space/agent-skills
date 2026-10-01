---
name: sort-into-virtual-branches
description: "Sort a working tree holding several unrelated pieces of work, or one oversized commit, into GitButler virtual branches — one branch per scope, committing hunk by hunk, leaving anything unplaceable uncommitted and reported. Use when the user says 'sort these changes', 'split this into branches', 'fan these out', 'organise the working tree', 'split this commit', 'these belong on different branches', or asks for a messy `but status` / `but diff` to become reviewable branches. Also use before committing when one working tree clearly holds several unrelated pieces of work. Do NOT use for resolving conflicts, for a single-scope change that needs one ordinary commit, for reordering or rewriting existing history, or in a repository that is not a GitButler workspace."
---

# Sort changes into virtual branches

Every line below is a single statement. `[probe]` marks behaviour observed by running the command
against GitButler 0.22.3. `[source]` marks behaviour read from the CLI source at that version.
`[decision]` marks a choice made for this skill, not a property of the tool. `[unverified]` marks a
statement nobody has tested — treat those as the thin ice they are.

Prefix every `but` command with `NO_BG_TASKS=1`, which suppresses a background fetch of every remote
plus forge and update queries. `[source]`

## P — preconditions

Check all of these before the first command. If any fails, stop and report which one.

* **P1** `NO_BG_TASKS=1 but status` exits 0. Otherwise the repository is not a GitButler workspace.
* **P2** `but status` shows no commit marked conflicted.
* **P3** No branch holding work to sort is marked merged upstream. Mutations are refused on those. `[source]`
* **P4** The work to sort is not pushed. A push cannot be withdrawn.
* **P5** No other session or agent is acting on this repository. The working tree and the oplog are
  shared; a second writer invalidates every ID read here. `[source]`
* **P6** Determine whether version-control writes are reserved for the user, by a hook, a rule, or a
  direct instruction. If they are, every `but` command below is emitted for the user to run, in
  order, and none is executed.

## F — tool facts

* **F1** The smallest unit that can be committed is a hunk. There is no line-level selector. `[probe]`
* **F2** `but diff` prints one box per hunk, headed `<file-id>:<hunk-id> <path>`. `[probe]`
* **F3** A hunk ID read from one `but diff` still resolves after other hunks have been committed,
  even when the displayed short ID has since shortened. `[probe]` Exception: two hunks in one file
  with identical diffs get IDs suffixed `#<index>-<count>`, such as `ab:0#0-2` and `ab:0#1-2`.
  Once one of them is committed, the other loses its suffix and the saved suffixed ID no longer
  resolves. `[source]`
* **F4** A repository-relative path may be passed instead of an ID. It selects the whole file, and
  works for added and deleted files as well as modified ones. `[probe]`
* **F5** Two hunks of one file can be committed to two branches that are not stacked. `[probe]`
* **F6** IDs are separated by spaces. A comma is part of an ID, not a separator: `ab,cd` resolves as
  one ID and fails. `[source]`
* **F7** `but commit -b <branch> -m "<msg>"` with no IDs commits every uncommitted change in the main
  worktree. `[source]`
* **F8** A refused commit creates nothing: no commit, no branch. `[probe]`
* **F9** A refusal takes one of two forms. `[probe]`
  * `line <n> depends on <branch> (<commit>)` — the hunk edits a line that branch introduced.
  * `conflicts with commits on <branch> (edits touch the same file)` — the hunk overlaps a hunk
    that branch already committed.
* **F10** After either refusal, `but branch new <branch> --above <named-branch>` followed by the
  identical commit command succeeds. `[probe]`
* **F11** `--anchor` is accepted, prints a deprecation warning, and is replaced by `--above`. GitButler's
  own refusal hint still suggests `--anchor`. `[probe]`
* **F12** Committing to the branch that owns the lines always succeeds, however many times. `[probe]`
* **F13** `but oplog snapshot -m "<label>"` prints `Snapshot ID: <sha>`. `[probe]`
* **F14** `but uncommit <commit-id> && but diff` is safe as one call: `but diff` needs no ID from the
  first command. `[source]`

## A — assignment

A scope is one branch. Assignment is positive-only: a hunk is assigned when a listed signal applies,
and is left unassigned otherwise.

* **A1** The scopes are the ones the user named, and only those. If the user has not named them,
  ask before doing anything else; do not invent scopes from the changes. `[decision]`
* **A1a** A scope's first hunk is assigned by A3 alone, since A2 needs an assigned hunk to compare
  against. If no hunk qualifies under A3 for a scope, that scope starts empty and is skipped in S4. `[decision]`
* **A2** Assign a hunk to a scope when its changed lines contain an identifier, path, or string that
  also appears in another hunk already assigned to that scope. `[decision]`
* **A3** Assign a hunk to a scope when its file sits under a directory that only that scope
  touches. `[decision]`
* **A4** Leave a hunk unassigned when A2 and A3 disagree with each other. `[decision]`
* **A5** Leave a hunk unassigned, regardless of A2 and A3, when it is in a lockfile, generated
  output, or shared configuration; when it mixes a rename or move with an edit; or when it belongs
  to work done outside this session. `[decision]`
* **A6** Never assign a hunk on the strength of its file path alone when other scopes also touch
  that file. `[decision]`

An unassigned hunk costs the user one decision. A wrongly assigned hunk hides a change inside a
branch nobody reviews for it.

## S — procedure

* **S1** `NO_BG_TASKS=1 but oplog snapshot -m "before sorting"`. Record the printed snapshot ID.
* **S2** `NO_BG_TASKS=1 but diff`. Record every hunk ID, its path, and the lines it changes. Do not
  re-read between commits (F3), unless any recorded ID contains `#`: then re-read `but diff` before
  each commit and match the planned hunks by path and changed lines.
* **S3** Apply section A to every hunk. Produce two lists: assigned hunks per scope, and unassigned
  hunks.
* **S3a** `NO_BG_TASKS=1 but branch list -a`. A scope's branch name must not appear in the output.
  `-b <name>` on an existing applied branch adds the commit on top of that branch's history, and
  on an existing unapplied branch it fails. `[source]` If a name is taken, choose another and say so
  in S8.
* **S4** For each scope that has at least one assigned hunk, in any order:
  `NO_BG_TASKS=1 but commit -b <branch> -m "<message>" <id> <id>`
  The IDs are exactly that scope's assigned hunks from S3. Never run this command with no IDs (F7).
* **S5** On a refusal, apply E1.
* **S6** Leave every unassigned hunk uncommitted. Do not create a branch for them. `[decision]`
* **S7** `NO_BG_TASKS=1 but diff`. Its output must contain exactly the unassigned hunks from S3 and
  nothing else. Any other difference means a hunk was lost track of: stop and report.
* **S8** Report: each branch created with its commit message; every unassigned hunk by path and ID,
  each with the rule from A that left it unassigned; the snapshot ID from S1.

## E — error handling

* **E1** On a refusal (F9): stop. Report the full refusal message, the scope and hunk IDs it
  concerned, and the branch the message names. Do not create a stacked branch and do not retry.
  The recovery GitButler suggests, `but branch new <branch> --above <named-branch>` followed by the
  same commit, was observed to work with a path selector (F10) and has not been tested with hunk
  IDs (U1); it is the user's to run.
* **E2** Leave the refused scope's hunks uncommitted. Continue with the remaining scopes only if
  none of them touches a file the refused scope touches; otherwise stop entirely. `[decision]`
* **E3** If any command fails for a reason not listed in F9, stop. Do not retry, and do not
  substitute a different command.
* **E4** If S1 fails, stop. Sorting without a checkpoint is not worth the risk.

## Splitting one oversized commit

Only when the commit is local, unpushed, and not marked merged upstream. Check section P, then run
`NO_BG_TASKS=1 but diff`: if it shows any uncommitted change, stop and report that the tree must be
clean before a commit can be split. Otherwise run S1, record its snapshot ID, then:

```
NO_BG_TASKS=1 but uncommit <commit-id> && NO_BG_TASKS=1 but diff
```

The commit's changes become uncommitted (F14). Continue from S2.

## U — untested

* **U1** Whether a hunk ID survives a refusal followed by `but branch new --above`. The probe that
  tested E1 used a path, not a hunk ID (F4).
* **U2** Whether the boundary in F9 is per hunk or per file. Two hunks far apart went to separate
  branches (F5); two edits inside one hunk were refused with a message that says "file".
* **U3** Whether a scope refused once can be committed at all without stacking, for example after
  the user reorders the scopes.

Do not write around these. If one is reached, stop and report which.

## Recovery

Read `references/recovering.md` before undoing anything: before restoring a snapshot, when a commit
landed on the wrong branch, or when a branch has vanished from the workspace.
