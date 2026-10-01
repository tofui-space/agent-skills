# GitButler CLI (`but`): primary-source verification

| | |
|---|---|
| Installed `but` | **0.22.3**. `~/.local/bin/but` links to `~/Applications/GitButler.app/Contents/MacOS/gitbutler-tauri`. The local VCS-write hook blocked `but --version`, so the version comes from the bundle's `Info.plist` (`CFBundleShortVersionString = 0.22.3`), and the binary's strings also contain `0.22.3`. |
| Source | `gitbutlerapp/gitbutler`, tag `release/0.22.3`, commit `0ba35dc675c0d0eebcf2e1d5e114b73d46019942`. This is an exact match. Every `crates/...` path below is at this tag. |
| Docs | `gitbutlerapp/gitbutler-docs` (the source of docs.gitbutler.com), `main` at `fde5f9265e7f8aa37377919c851cc744a97f1e8a` (committed 2026-08-31), downloaded 2026-09-17. `content/docs/commands/*.mdx` are generated from the clap doc comments. The docs follow `main`, not 0.22.3. Where the docs and the source disagree, the source wins. |
| Context7 | `/gitbutlerapp/gitbutler-docs`. It is stale: it still returns the retired `but commit -p h0,i0 ... <branch>` syntax. Used only as a cross-check. |

In this file, **Source:** marks what the code or docs say, and **Inference:** marks reasoning that goes beyond them.

## Summary

| # | Claim | Verdict | Primary citation |
|---|---|---|---|
| 1 | `commit`/`amend`/`discard` take file or hunk IDs, never line ranges | **Partly true.** They never take line ranges, but they accept more kinds of selector than file and hunk IDs. | `crates/but/src/args/commit.rs:92-96`; `crates/but/src/args/atoms/cli_id.rs:209-252` |
| 2 | A single hunk cannot be split by any ID or flag | **Confirmed** for the CLI. Hunk size depends on the `contextLines` app setting. | `crates/but/src/utils/diff_specs.rs:115-116`; `crates/but/src/command/legacy/status/tui/mod.rs:759-765` |
| 3 | Hunk IDs are derived from hunk content | **Confirmed** | `crates/but/src/id/mod.rs:987-1011` |
| 4 | File IDs are derived from the path; stable across successive commits? | **Confirmed** for derivation. The displayed short ID can change between commands. | `crates/but/src/id/mod.rs:117-142, 822-890`; `crates/but/src/id/tests.rs:3202-3260` |
| 5 | A commit that depends on another branch fails atomically, leaving no commit and no branch | **Confirmed** | `crates/but/src/command/legacy/commit.rs:331-363`; `crates/but-transaction/src/lib.rs:137-143, 193-195` |
| 6 | Mutations refuse branches and commits already landed upstream | **Partly true.** Only some commands check, and `--allow-merged` bypasses the check. | `crates/but/src/utils/merged_upstream.rs:168-191` |
| 7 | After committing X and restoring X+Y, `but diff` shows only Y | **Confirmed from source.** The worktree is diffed against `HEAD^{tree}`, which is the `gitbutler/workspace` merge commit. | `crates/but-core/src/diff/worktree.rs:32-39`; `crates/but/src/id/mod.rs:1074`; `content/docs/workspace-branch.mdx:43-51` |
| 8 | `but commit` accepts a plain file path | **Confirmed** | `crates/but/src/id/mod.rs:1159-1178, 1309-1311` |
| 9 | `undo`/`redo`/`oplog restore` act on the whole project's oplog, whoever wrote it | **Confirmed.** There is one oplog per project, shared by all sessions and users. | `crates/but-api/src/legacy/oplog.rs:174-262`; `crates/but-project-handle/src/storage_path.rs:27-38` |

---

## 1. Change selectors for `commit`, `amend` and `discard`

**Source.**
- `args/commit.rs:92-96`: "One or more changes to commit. A change can either be a file or a hunk." The type is `changes: Vec<CliIdArg>`.
- `args/amend.rs:23-26`: "One or more uncommitted files or hunks to amend. If omitted, all changes in the uncommitted area (`zz`) are amended."
- `args/discard.rs:9-12`: "Changes may be selected by branch, commit, committed file, uncommitted file, or uncommitted hunk CLI ID. Use `zz`, or omit `<CHANGES>`, to discard all uncommitted changes."
- `commit` resolves each argument with `try_resolve_uncommitted` (`command/legacy/commit.rs:184-194`). That accepts any of the following:
  - a file ID
  - `<file-id>:<hunk-id>`
  - an exact path
  - a `dir/` prefix
  - `zz`
  - a linked-worktree name
  - `zz:<path>` or `<worktree>:<path>`

  The code is in `args/atoms/cli_id.rs:209-252` and `id/mod.rs:1265-1320, 1467-1477, 1498-1508`. A hunk can also be named by position, as `<file-id>:#<index>` (`id/mod.rs:2013-2030`).
- `amend` sources go through `resolve_uncommitted` (`command/legacy/amend.rs:55-66`). `discard` resolves with `Purpose::Source` in the full namespace (`command/legacy/discard.rs:290`) and rejects committed hunks (`discard.rs:296-302`).
- The only `a-b` range syntax is in `id/parser.rs:90-97, 123-179`. It is a range of whole *files* in display order, and only `but absorb` (`command/legacy/absorb.rs:54`) and `but pr` selectors (`command/legacy/forge/review.rs:1263`) use it.
- Docs, `content/docs/cli-guides/cli-tutorial/branching-and-commiting.mdx:56`: "Don't comma-separate IDs or use line ranges."

**Explanation.** None of the three commands has line-range syntax. "File or hunk IDs" understates what they accept: plain paths, directory prefixes, `zz` and worktree names all work, and `discard` also takes branches, commits and committed files. The three commands also resolve in different scopes. `commit` and `amend` look only at uncommitted changes. `discard` searches everything, which matters for stale IDs (see §4).

## 2. Splitting a hunk

**Source.**
- A hunk selector resolves to a single `SingleHunk` (`id/mod.rs:2031-2050`). `DiffSpecBuilder::push_changes_from_uncommitted` passes it on unchanged: `self.push_hunks(hunks.map(|id_and_hunk| id_and_hunk.hunk))` (`utils/diff_specs.rs:115-116`).
- The interactive picker behind `but commit -i` can return only whole-hunk or whole-file selections (`Selectable::UncommittedHunkOrFile`, `command/legacy/status/tui/mod.rs:759-765`; consumed at `commit.rs:219-229`).
- No flag in `args/commit.rs`, `args/amend.rs` or `args/discard.rs` carries a line selection.
- Hunks come from a diff computed with `ctx.settings.context_lines` (`id/mod.rs:1065, 1121`; `utils/change_source.rs:122`). The default is `"contextLines": 3` (`crates/but-settings/assets/defaults.jsonc:3`). This is an app setting, not a CLI flag.

**Explanation.** No ID, flag or TUI path divides a hunk. **Inference:** a smaller `contextLines` value produces more, smaller hunks when changes are separated by unchanged lines. Changes on adjacent lines always form one hunk. The only CLI way to commit part of a hunk is to edit the file on disk so it holds just that part, commit, and then restore the file (the technique in §7).

## 3. Hunk IDs

**Source.**
- `id/mod.rs:963-986`: "Assign unique hunk IDs based on content hash." When hashes collide, the format is `<prefix>#<collision_index>-<num_collisions>`. A hunk with no diff gets the prefix `"q"`.
- `id/mod.rs:993-1002`: the hash is SHA-1 over every diff line except the `@@` header, `.filter(|line| !line.starts_with_str(b"@@"))`.
- `id/mod.rs:1013-1042`: the displayed form is the shortest prefix that tells the hunk apart from the other hunks *in the same file*.
- Committed hunks use the same function (`id/mod.rs:323`). The qualified form is `<file-short-id>:<hunk-short-id>` (`id/mod.rs:927`).

**Explanation.** A hunk's ID comes from its added, removed and context lines. The header's line numbers are excluded. **Inference:**
- Moving an otherwise identical hunk within the file keeps its ID.
- Editing its context lines, or changing `contextLines`, changes the ID.
- The prefix can get longer or shorter as other hunks in the same file come and go. `matches_prefix` (`id/mod.rs:78-103`) keeps longer, previously printed forms working after the displayed form gets shorter.

## 4. File IDs and their stability

**Source (derivation).**
- `create_reverse_hex_id` (`id/mod.rs:117-142`) hashes the path with SHA-1. For a linked worktree it first mixes in the worktree name plus a NUL byte; for the main worktree it does not. If every byte of the path is in `k..=z`, the path itself becomes the ID's prefix (`138-140`).
- Help text, `args/mod.rs:135`: "Uncommitted file: A path-derived ID that is typically 1-3 characters."

**Source (displayed short ID).** `IdMap::new` (`id/mod.rs:822-890`) picks the shortest unambiguous prefix. The prefix must be unique against all of the following:
- the other uncommitted files
- a synthetic one-character entry that forces at least two characters
- branch short IDs and short filenames (`non_hex_used_short_ids`)
- the change ID of every workspace commit

The comment at `826-836` says: "creating a new commit may result in a prefix collision with an uncommitted file, making a previously unambiguous ID ambiguous." The help text at `args/mod.rs:142-144` says: "Many CLI IDs depend on the context and may change ... when new data is written to files, commits are made or rearranged and branches are created or deleted."

**Source (resolving an earlier ID).**
- `but commit` and `but amend` resolve sources in `SourceScope::UncommittedOnly` (`id/mod.rs:1534-1550`; `args/atoms/cli_id.rs:72-80`). File IDs there match by prefix of the full ID (`id/mod.rs:1246-1263, 1340-1347`), so change IDs of commits made later cannot shadow them. The test `uncommitted_selector_is_not_shadowed_by_commit_change_id` covers this (`id/tests.rs:3202-3270`).
- Such an ID stops resolving in two cases:
  - its prefix now matches two or more uncommitted files, which gives an "Ambiguous uncommitted change" error (`cli_id.rs:282-322`)
  - it exactly equals a displayed branch or stack short ID (`id/mod.rs:1340-1345`)
- `but diff <id>` (`command/legacy/diff.rs:441`) and `but discard <id>` (`discard.rs:290`) resolve in the **full** namespace. The same test asserts "the commit change ID shadows the file ID in the full namespace" (`id/tests.rs:3256`).

**Explanation.** The full ID depends only on the path and the worktree, so it never changes. Across successive `but commit` calls, a file ID copied from `but diff` normally keeps resolving to the same file, even when the *displayed* ID has grown longer in the meantime.

What can change or invalidate a displayed file ID:
1. Another uncommitted file whose full ID shares the prefix appears or disappears.
2. A commit is created or removed whose random change ID shares the prefix.
3. Branches are created or deleted.
4. The file no longer has uncommitted changes. Committing the whole file makes its ID disappear.
5. The file is renamed.

**Inference (hazard):** a file ID copied *before* a commit can resolve to that new commit in `but discard`. In that case `but discard` removes the commit, not the file's changes. Re-read `but diff` or `but status` before running `discard` or `diff` with an ID.

## 5. Dependent changes fail atomically

**Source.**
- `commit.rs:331-363`: the commit runs inside `but_transaction::with_transaction_with_perm`. Any `rejected_specs` returns `Err(rejection::RejectedChanges(...))` from inside the closure (`351-353`).
- `utils/rejection.rs:3-7`: "a change that depends on a commit in another branch cannot be committed elsewhere on its own. When that happens the whole transaction rolls back". Also `rejection.rs:71-73`: "A branch that would have been created; the rollback removed it again."
- `crates/but-transaction/src/lib.rs:137-143`: when the callback returns `Err`, the code calls `inner.pending_ref_changes.rollback(&repo)?; return Err(err);`. This happens before materialization. The oplog snapshot is committed only when there is no rollback (`193-195`).
- A new `-b <branch>` ref is created eagerly and recorded (`lib.rs:631`). Rollback deletes it (`lib.rs:1015-1020`, then `restore_one` issues a `Change::Delete`).
- The test `bails_on_rejected_specs` (`crates/but/tests/but/command/commit.rs:826-849`) prints `Cannot commit: 1 change could not be applied: first / line 1 depends on foo (1)`, followed by the hint `but branch new bar --anchor foo`.

**Explanation.** Nothing is committed, the new branch ref is deleted, no workspace metadata is written, and no oplog entry is added. The same abort applies to *any* rejected change, not only dependency conflicts (`commit.rs:351`). The transaction calls itself "best effort", not ACID, and "project-database rows are *not* part of it" (`lib.rs:36-41`). **Inference:** if deleting the ref fails during rollback, the branch ref could survive. The test does not assert that the branch is absent afterwards; that follows from the code.

## 6. Merged-upstream guard

**Source.**
- `args/atoms/mod.rs:18-27`: "By default, mutations refuse to touch history that has landed in the target branch." The escape hatch is `--allow-merged`.
- `utils/merged_upstream.rs:168-191`: the errors are `Commit … is merged upstream` and `Branch '…' is merged upstream`, with a hint to run `but pull`.
- Files that build the guard: `commit`, `amend` (through squash), `squash`, `move`, `reword`, `_reword2`, `uncommit`, `pick`, `absorb`, `push`, `branch/new` and the TUI's squash mode.
- `branch new` checks only its `--below` target (`command/legacy/branch/new.rs:104-110`). The `--above` path at `113-121` has no check.
- `discard`, `land`, `apply`, `unapply`, `resolve`, `clean`, `pull`, `undo`, `redo` and `oplog restore` never reference `MergedUpstream`.
- Detection uses the local workspace projection (`merged_upstream.rs:32-45, 53-87`).

**Explanation.** The guard exists, but only in the commands listed above, and `--allow-merged` bypasses it. **Inference:** work that has landed but has not been fetched is not detected.

## 7. Does `but diff` show only Y?

**Source (code path).**
1. `but diff` with no target calls `render_uncommitted`, which calls `IdMap::legacy_new_from_context` and then `new_from_context` (`utils/diff_rendering.rs:578-599`; `id/mod.rs:1053-1076`).
2. `id/mod.rs:1074` calls `but_core::diff::ui::worktree_changes(&repo)`. Per `crates/but-core/src/diff/worktree.rs:32-39`, that is "equivalent to a `git status` which is 'boiled down' into all the changes that one would have to add into `HEAD^{tree}` to get a commit with a tree equal to the current worktree". Tree-to-index and index-to-worktree items are merged (`worktree.rs:494-495`, `merge_changes` at `690`).
3. Hunks are built from those changes (`utils/change_source.rs:122`).
4. In a managed workspace, HEAD is `gitbutler/workspace`: "a merge commit … the tree of that commit is the union of all the committed work on all your applied parallel branches" (`content/docs/workspace-branch.mdx:43-51`).
5. After `but commit`, the transaction materializes. It calls `safe_checkout_from_head(head.target, … merge_base_override)` (`crates/but-rebase/src/graph_rebase/materialize.rs:239-247`). That function updates HEAD's target and "the `.git/index` to match the `new_head_id^{tree}`" (`crates/but-core/src/worktree/checkout/function.rs:16-24`). The override is "`HEAD^{tree}` + consumed changes … so consumed hunks cancel and don't reappear as uncommitted changes" (`graph_rebase/mod.rs:252-256`).

**Explanation.**
1. The file starts as B+X+Y and is rewritten to B+X.
2. `but commit -b A <file>` commits the file content B+X to branch A.
3. The workspace commit's tree now holds B+X. The worktree matches it, so there are no uncommitted changes.
4. Restoring the file to B+X+Y makes the diff against `HEAD^{tree}` (B+X) equal to **Y only**.

The working tree is diffed against the workspace merge commit, not the target base. The **target base** is the commit on the target branch (e.g. `origin/main`) that the workspace is built on; `HEAD^{tree}` is the merge commit's tree, which already contains X.

**Inference:** this holds with one caveat and two related cases.
- **Caveat:** if X and Y are within about 2×`contextLines` lines of each other, Y's hunk shows X's lines as unchanged context. They are not shown as additions.
- **Unapplying A later:** the workspace tree no longer contains X, so X shows up as uncommitted again (or conflicts).
- **Single-branch mode:** HEAD is the branch itself, and the result is the same.

An optional live confirmation is in *Unsettled*.

## 8. Plain file paths as selectors

**Source.**
- `id/mod.rs:1309-1311` runs `matches.extend(self.parse_uncommitted_filename(element, None))` in both scopes. `parse_uncommitted_filename` compares `hunk.1.path == element.as_bytes()` (`id/mod.rs:1159-1178`).
- Doc comment, `id/mod.rs:1524-1525`: "Besides generated IDs, this method also accepts filenames, which are interpreted as uncommitted, uncommitted files."
- `commit` resolves its arguments through this path (`commit.rs:189`).
- `dir/` prefixes are accepted (`id/mod.rs:1290-1292`) for the main worktree only (`1180-1209`), as is `zz:<path>` (`1498-1508`).

**Explanation.** `but commit -b A -m msg src/lib.rs` works. **Inference:**
- The match is an exact byte comparison of the repo-relative path, so `./src/lib.rs` or an absolute path does not match.
- A path match wins over ID prefix matching (`1321-1323`).
- A path that is dirty both in the main checkout and in a linked worktree is ambiguous. Use `zz:<path>` (`cli_id.rs:299-313`).
- Paths that contain `:` are split as ID separators (`id/mod.rs:1559-1582`). Use the file ID for those.

## 9. `undo`, `redo`, `oplog restore` and oplog scope

**Source.**
- **Undo.** `get_undo_target_snapshot` (`crates/but-api/src/legacy/oplog.rs:174-213`) walks `ctx.snapshots_iter(None, …)` from newest to oldest. It does not filter by process, session, user or command. Each `RestoreFromSnapshotViaUndo` entry cancels one older real entry. `run` restores the result (`crates/but/src/command/legacy/undo_redo.rs:155-194`).
- **What a snapshot holds.** It records the state *before* its operation (`crates/gitbutler-oplog/src/oplog.rs:334`; `content/docs/cli-guides/cli-tutorial/operations-log.mdx:36`).
- **Redo.** `get_redo_target_snapshot` (`legacy/oplog.rs:220-262`) returns nothing once a real operation follows the last undo.
- **Oplog restore.** `restore_to_oplog` calls `rev_parse_single(oplog_sha)` and restores without a confirmation prompt (`crates/but/src/command/legacy/oplog.rs:280-323`). The restore first records a before-restore snapshot (`gitbutler-oplog/src/oplog.rs:1038-1048`). Docs: "Restorations create a new oplog entry before running, so you can always easily undo it" (`operations-log.mdx:32`).
- **Storage.** The oplog head is kept in `<project_data_dir>/operations-log.toml` (`gitbutler-oplog/src/lib.rs:12`, `oplog.rs:303`). `project_data_dir` is `repo.git_dir()/gitbutler` unless `gitbutler.storagePath` is set (`crates/but-project-handle/src/storage_path.rs:27-38`; `crates/but-ctx/src/lib.rs:89-100`). Snapshot commits stay reachable through the reflog of `refs/heads/gitbutler/target` (`gitbutler-oplog/src/reflog.rs:36-56`; `oplog.rs:975`).
- **Project lookup.** The CLI finds a project by working-directory prefix (`crates/gitbutler-project/src/project.rs:204-231`). It refuses to register non-main worktrees (`crates/gitbutler-project/src/controller.rs:40-43`). Linked worktrees are handled as change sources inside the main project (`id/mod.rs:117-125`).

**Explanation.** There is one oplog per project, in the main repository's git dir. Every process, agent session, GUI window and user acting on that repository shares it. It is not scoped to a session, worktree or user. `but undo` returns the project to the state before the newest operation that has not been cancelled, whoever ran it. `but redo` reapplies it only if no other operation happened after the undo. `but oplog restore <sha>` moves the whole project (worktree, refs, metadata) to the state before that entry's operation, and can itself be reversed.

**Inference:** `but oplog snapshot` entries count as real operations. A `but undo` right after a manual snapshot restores that snapshot, which is roughly a no-op, instead of undoing the operation before it.

---

## Command classification (`rules/development/gitbutler-readonly.md`)

**Background sync.** Several commands start background work when they initialize (`crates/but/src/lib.rs:814-876`): `status`, `diff`, `show`, `branch` (all subcommands except `update`), `open`, `clean`, and every mutation. Two conditions must hold:
- the output is human or agent text, not `--json` (`setup.rs:280`), and `NO_BG_TASKS` is unset (`setup.rs:274`)
- the last fetch is older than `autoFetchIntervalMinutes`, which defaults to 15 (`but-settings/assets/defaults.jsonc:46`)

When both hold, the command runs `but refresh-remote-data --fetch --pr --ci --updates` in the background (`setup.rs:386-410`). That process runs `git fetch` on every remote, refreshes forge PR and CI data, and checks for app updates (`command/legacy/refresh.rs:25-66`). When an agent is detected, it runs without printing any message (`setup.rs:290`).

In the table, "+BG" marks commands with this behavior.

| Command / flag | Class | Evidence |
|---|---|---|
| `but status` `-f` `-v` `--upstream` | read-only, local (+BG) | no fetch in `command/legacy/status/mod.rs` |
| `but status -r/--refresh-prs` | read-only, network (forge) | `status/mod.rs:540-545` (`CacheConfig::NoCache`) |
| `but diff [one target]` | read-only, local (+BG) | `args/diff.rs:5-8` |
| `but show <id> [-v]` | read-only, local (+BG) | `lib.rs:851-876` |
| `but branch list` (+ filters, default merge check) | read-only, local (+BG) | merge check in memory, `command/legacy/branch/list.rs:420-465` |
| `but branch list --review`, `but branch show --review` | read-only, local (reads the forge **cache**) | `list.rs:35-39`, `show.rs:42-53`, `but-forge/src/review.rs:527-530` |
| `but branch show --check`, `-f` | read-only, local | `show.rs:127-165` (`clone_repo_for_merging_non_persisting`) |
| `but branch show --ai` | read-only, network (LLM) | `show.rs:411-457` |
| `but oplog`, `but oplog list` | read-only, local (no BG) | `lib.rs:840-849` |
| `but open --print [id]` | read-only, local (+BG) | `command/legacy/open.rs:105-107` |
| `but pull --check` (and hidden `but fetch`) | read-only network **and writes local refs/metadata** (fetch) | `command/legacy/pull/mod.rs:88-95`; `lib.rs:1121-1131` |
| `but push --dry-run` | read-only network **and writes local refs/metadata** (fetch) | `command/legacy/push.rs:165-176` |
| `but clean --dry-run` | read-only, local (+BG) | `command/legacy/clean.rs:61-88` |
| `but clean --dry-run --pull` | rewrites history (runs a real pull first) | `lib.rs:1134-1146` |
| `but branch new <name>` | writes local refs/metadata, plus an oplog entry | `branch/new.rs:207-233` |
| `but branch new --switch` | modifies the working tree (checkout) | `branch/new.rs:68-74, 235-237` |
| `but oplog snapshot -m` | writes local refs/metadata | `gitbutler-oplog/src/oplog.rs:940-975`; `reflog.rs:56-100` |
| `but push` | publishes (force-push by default) | `args/push.rs:5-7` (`with_force` defaults to true) |
| `but pr` / `pr new` (aliases `mr`, `review`) | publishes | `args/mod.rs:469-481`; `args/forge.rs:12-46` |
| `but pr auto-merge` / `set-draft` / `set-ready` | publishes (changes forge state) | `args/forge.rs:47-88` |
| `but land` | publishes and deletes refs (the remote branch) | `args/mod.rs:316-326`; `command/legacy/land/messaging.rs:40-46, 249-251` |
| `but discard` | modifies the working tree, rewrites history or deletes refs, depending on the selector; undoable | `args/discard.rs:9-14` |
| `but branch delete` / `-d` | deletes refs | `args/branch.rs:31-40` |
| `but clean` | deletes refs (empty branches); undoable | `clean.rs:91-103`; `args/mod.rs:691-692` |
| `but uncommit` | rewrites history; deletes branch refs when given branches | `crates/but/tests/but/command/uncommit.rs:283-340` |
| `but worktree remove [--force]` | deletes data (the worktree directory; keeps the branch) | `args/worktree.rs:39-49` |
| `but squash` / `amend` / `move` / `reword` / `pick` | rewrites history (`reword <branch>` renames a ref) | `args/squash.rs:7-17`, `args/move.rs:3-25`, `args/pick.rs:7-9`, `args/mod.rs:513-522` |
| `but pull` | network, then rewrites history and modifies the working tree for **every** applied branch | `args/mod.rs:450-453`; `pull/mod.rs:266` |
| `but apply` / `unapply` | modifies the working tree and metadata | `args/apply.rs:7-13`, `args/unapply.rs:7-15` |
| `but undo` / `redo` / `oplog restore` | rewrites history, refs and the working tree, project-wide | §9 |
| `but setup` | writes refs and metadata, switches HEAD, installs hooks, registers the project globally | `args/mod.rs:585-592` |
| `but teardown` | modifies the working tree (checkout) and creates commits (cherry-picks) | `args/mod.rs:617-626` |
| `but config` setters | writes local config and metadata; `forge auth` also uses the network | `args/config.rs:41-514` |
| `but update install` | installs software (network, outside the repo) | `args/update.rs:22-43` |
| `but skill install` | writes files outside the repo | `args/skill.rs:10-47` |
| `but resolve` | `status` and `conflicts` are read-only; `<commit>`, `apply`, `finish`, `--ai` and `--ours`/`--theirs` rewrite history; `cancel --force` discards | `args/resolve.rs:1-67`; `command/legacy/resolve.rs:270-300, 721-760` |
| `but commit` | rewrites history (creates commits, may create a branch) | `args/commit.rs:7-16` |

## Rule corrections

| Sentence in the rule | What the source shows | Suggested correction |
|---|---|---|
| "Inspection:" list (lines 16-24), presented as read-only | `status`, `diff`, `show`, `branch list/show` and `open` start the background sync described above. It fetches all remotes, which writes remote-tracking refs, and queries the forge. `--json` or `NO_BG_TASKS` suppresses it (`lib.rs:814-876`; `setup.rs:274-280, 386-410`). With the default `telemetry.appMetricsEnabled: true` (`defaults.jsonc:10`), every command also sends a usage event (`utils/metrics.rs:36-43`). | Say inspection commands may fetch and call the forge in the background, and require `NO_BG_TASKS=1` (or `--json`) to keep them local. |
| "`but status`, `but status -fv`, `but status --upstream`" | `-r/--refresh-prs` contacts the forge (`status/mod.rs:540-545`). | Add that `--refresh-prs` is a network call. |
| "Previews that report without changing anything: `but pull --check`" | It runs `fetch_from_remotes` first (`pull/mod.rs:88-95`), which updates remote-tracking refs and fetch metadata over the network. Hidden `but fetch` is the same command (`lib.rs:1121-1131`). | Move it out of "without changing anything" and call it a fetch that writes local refs. |
| "`but push --dry-run`" | It also fetches all remotes first (`push.rs:165-176`). | Same as `pull --check`. |
| "`but clean --dry-run`" | It is read-only only without `--pull`. `--dry-run --pull` performs a real `but pull` first (`lib.rs:1134-1146`). | "`but clean --dry-run` without `--pull`". |
| "Any `--ai` flag sends repository content to an external model provider." | The destination is whatever git config `gitbutler.aiModelProvider` names: OpenAI or Anthropic (own key or the GitButler proxy), OpenRouter, or a local Ollama or LM Studio (`but-llm/src/lib.rs:162-230`; `config.rs:6-13`). `branch show --ai` sends commit messages, SHAs, file paths and +/- counts (`show.rs:411-457`). `resolve --ai` sends conflict hunk content **and rewrites the commit** (`but-api/src/resolve/mod.rs:291-325, 507-525`). | "…sends repository data to the AI provider configured in git config, which may be the GitButler proxy; `resolve --ai` also rewrites history." |
| "`--review` and `--check` flags on branch listings contact the forge." | `--check` and the default merge check in `branch list` are local in-memory merges (`show.rs:127-165`; `list.rs:420-465`). `--review` reads only the local forge cache (`CacheConfig::CacheOnly`: `show.rs:42-53`, `list.rs:35-39`), even though the help text says "fetch". Real forge calls come from background sync or `status --refresh-prs`. | Remove the claim. Put the network warning on background sync and `--refresh-prs`. |
| "`but branch new <name>` — creates a ref; nothing is moved or removed" | It also writes workspace metadata (a new applied stack) and records a `CreateBranch` oplog entry (`branch/new.rs:207-233`), which becomes `but undo`'s target. `--switch` checks out the branch (`new.rs:235-237`). In single-branch mode it may set the base branch and enter the workspace (`new.rs:340-375`). **Inference:** a second applied stack makes a later untargeted `but commit` ambiguous (`commit.rs:506-540`). | "Creates a ref and workspace metadata, and adds an oplog entry. Never with `--switch`." |
| "`but oplog snapshot -m "<label>"` — creates a restore point" | It writes a snapshot commit, `.git/gitbutler/operations-log.toml`, and `refs/heads/gitbutler/target` if missing, plus its reflog (`oplog.rs:940-975`; `reflog.rs:56-100`). **Inference:** it becomes `but undo`'s next target (§9). | Add: "shifts what `but undo` restores." |
| "`but push` without `--dry-run`" | Force-push is on by default (`args/push.rs:5-7`). Only force-push protection guards it, and `-s` skips that. | Add the force-push default. |
| "`but pr new`, `but pr auto-merge`, `but pr set-draft`, `but pr set-ready`" | Bare `but pr` defaults to `pr new`, and `but mr` / `but review` are aliases (`args/mod.rs:475-480`). | Add `but pr` with no subcommand, and `but mr`, `but review`. |
| "`but discard` — permanent by design" | "The entire operation is recorded as a single oplog entry, so it can be undone with `but undo`" (`args/discard.rs:14`). It also accepts branches, commits and committed files (`discard.rs:9-12`), and it resolves IDs in the full namespace (§4). | "Destructive; recoverable only through the project-wide `but undo`. A stale file ID can resolve to a commit." |
| "Rewrites history: `but squash`, `but amend`, `but move`, `but reword`, `but pick`" | The list is incomplete. Missing: `but absorb` (`args/mod.rs:483-511`), `but branch update` / `-u` (`args/branch.rs:127-149`), `but resolve apply`, and the built-in aliases `c`→commit, `s`→squash, `m`→move (`alias.rs:13-21`). | Add them. |
| "`but oplog restore` — rolls the whole project back, discarding everything done since that snapshot" | It restores the state *before* that entry's operation and first records a before-restore snapshot, so later work can be recovered (`gitbutler-oplog/src/oplog.rs:1038-1048`; `operations-log.mdx:32-36`). There is no confirmation prompt (`command/legacy/oplog.rs:280-323`). | "…rolls the whole project back to before that operation, with no confirmation prompt; a later restore can reverse it." |
| "`but config <setting> <value>` — the setter form" | Setter syntax varies: `config target <branch>`, `push-remote <remote>`, `user set\|unset …`, `metrics enable\|disable`, `feature <flag> enable\|disable`, `ai <provider> …`, `forge auth\|forget\|github-stacks` (`args/config.rs:41-514`). `but alias add\|remove` also writes git config (`args/mod.rs:740-767`). | Allow only bare `but config` and `but config <section>` with no further arguments; treat everything else as a setter. |
| "`but update install`, `but skill install`" | Also writing: `but skill check --update`, the command AGENT ACTION REQUIRED asks for (`command/skill/freshness.rs:157-159`); `but agent setup`, which writes agent instruction files (`args/mod.rs:848-868`); `but worktree archive\|unarchive`; `but pr template`. | Add them. |
| "Every `but resolve` form" | `resolve status` and `resolve conflicts` are read-only. `status` can offer to finish when run in a terminal (`resolve.rs:270-300, 721-760`). | Fine as policy. If you keep it, note the two read-only forms. |
| "`but commit`. Given no IDs it commits every uncommitted change in the tree" | Confirmed (`args/commit.rs:9`; `commit.rs:242`). It covers the main worktree only (`ChangeSourceId::Head`). | Keep. Optionally add "main worktree". |
| "`but` runs `but-<word>` from `PATH` when `<word>` is not a built-in subcommand." | Aliases are expanded first (`lib.rs:412-500`). They come from git config `but.alias.<word>` or the built-in defaults `default`/`st`→status, `stf`, `c`→commit, `s`→squash, `m`→move, `wt`→worktree (`alias.rs:13-21, 39-70`). Only words that are neither built-ins nor aliases run `but-<word>`. This happens on Unix only, and the word must match `[a-zA-Z_-]` (`command/external.rs:41-63`). | "Do not use aliases or undocumented words. `but c`, `but s` and `but m` are commit, squash and move." |
| "…including any `AGENT ACTION REQUIRED` notice — report it…" | `command/skill/freshness.rs:142-190` emits it before non-interactive commands when two conditions hold: an agent is detected from environment variables (`CLAUDECODE`/`CLAUDE_CODE`, `utils/detect_agent.rs:231-236`), and `agentSkillNotices` is on (default true, `defaults.jsonc:7`; gate at `lib.rs:549-569`). It asks for `but skill install` followed by reading the printed SKILL.md, or `but skill check --update`. Separately, the CLI **silently overwrites** outdated global GitButler skills under `$HOME` (`freshness.rs:68-97`). It also rewrites one bullet in `~/.claude/rules/gitbutler.md`, `~/.codex/AGENTS.md` and similar files (`command/agent/cleanup.rs:39-66`; `command/agent/plan.rs:204-214`; `lib.rs:575-583`). | Keep "report it". Add that `but` itself writes to `$HOME` skill and instruction files whenever an agent runs it. **Inference:** `$HOME` is used, not `CLAUDE_CONFIG_DIR`, since `crates/but/src` never references that variable. |
| "Commas are not separators: `ab,cd` parses as one ID and fails to resolve." | This is true for positional IDs (`args/atoms/cli_id.rs:37-40`). But `but absorb` and the `but pr auto-merge\|set-draft\|set-ready` selectors split on commas and accept `a-b` file ranges (`id/parser.rs:85-97`). The retired form `but commit <branch> -c --changes a,b` is still translated and **executed** (`retired_syntax.rs:7-10, 149`). | "Commas are not separators for positional IDs; `absorb` and `pr` selectors, and the retired `--changes`, do split on commas." |
| "Branch short IDs belong to the snapshot that printed them." | The same applies to file IDs used with `diff` and `discard`, where a newer commit's change ID can shadow them (§4). | Extend the sentence to file IDs used with `discard` and `diff`. |
| (not in the rule) | With the `single_branch` feature flag on, every command's initialization registers the project and may set the target (`setup.rs:133-160`). | Optional note. |

## Unsettled

These points are settled from source, or unsettled only where marked. The scripts below confirm or cover the rest. They write to version control, so a human has to run them.

**A. Optional live confirmation of §7.** macOS `sed`. `but setup` registers the throwaway repo in GitButler's project list; remove it in the app afterwards.

```sh
export NO_BG_TASKS=1
repo="$(mktemp -d)/claim7"; mkdir -p "$repo"; cd "$repo"
git init -q -b main && seq 1 30 > f.txt && git add f.txt && git commit -qm base
but setup                          # expect: gb-local remote created; now on gitbutler/workspace
sed -i '' -e '3s/.*/X/' -e '27s/.*/Y/' f.txt
cp f.txt ../full.txt
but diff                           # expect: f.txt with two hunks: -3 +X and -27 +Y
sed -i '' -e '27s/.*/27/' f.txt    # file now holds only X
but diff                           # expect: one hunk: -3 +X
but commit -b A -m X f.txt         # expect: "Created commit … on new branch A"
but diff                           # expect: no hunks
cp ../full.txt f.txt
but diff                           # expect: one hunk: -27 +Y; no "+X" line
git diff HEAD --numstat            # expect: "1 1 f.txt"
```

For the adjacent case, use lines 3 and 5 instead of 3 and 27. The final `but diff` should show `X` as a context line (leading space) and `+Y`.

**B. Background sync from inspection commands.** In a GitButler project with a real remote whose last fetch is more than 15 minutes old:

```sh
unset NO_BG_TASKS CLAUDECODE CLAUDE_CODE
but status        # expect: "Last fetch was …m ago. Initiated a background sync..."
but status        # immediately again: no message (interval not elapsed)
```

Then, in a *different* project with a stale fetch:

```sh
NO_BG_TASKS=1 but status   # expect: no sync message
but status --json          # expect: no sync started
```

**C. `but` run inside a linked worktree (unsettled; the §9 scope conclusion depends on it).**

```sh
git worktree add ../wt-probe -b wt-probe && cd ../wt-probe
NO_BG_TASKS=1 but oplog
```

**Inference:** expect `Setup required: No GitButler project found at …`. Answer "no" if prompted. Running `but setup` there should fail with a non-main-worktree error (`controller.rs:40-43`). If `but oplog` instead lists entries, the oplog is reachable from linked worktrees, and §9 needs revisiting.

**D. Stale file ID resolving to a commit in `but discard` (§4 hazard).** This cannot be reproduced reliably: it needs a random change ID to collide with a 2-character prefix, roughly 1 in 256 per commit. The unit test `id/tests.rs:3202-3260` demonstrates it at the resolver level. It is not reproduced end-to-end.

---

## Live probe results (2026-09-21, `but` 0.22.3)

Two scripts run in a throwaway repository, `gitbutler-probe.sh` and `gitbutler-probe2.sh`.
Everything in this section is observed behaviour, not source reading.

| Question | Result |
|---|---|
| After committing only change X and restoring the full file, does `but diff` show only Y? | Yes. X appeared as unchanged context and only the Y hunk was listed. The file ID stayed `nk` while the hunk ID changed (`nk:e` → `nk:d`). |
| Does the commit command accept a plain repository-relative path as a change selector? | Yes. Passing `a.txt` created the commit and the branch. |
| Does `but oplog restore` delete an untracked file created after the checkpoint? | Yes, and silently. Nothing in the command output mentions it. |
| Does a `git stash` entry survive the restore? | Yes. One entry before, the same entry after. |
| Does the restore return the working tree to the checkpoint file set? | Yes. Identical file list, contents back to the checkpoint state. |
| Does a branch created after the checkpoint survive the restore? | Yes. The git ref stayed and `but branch list` showed it under "Unapplied Branches", one commit ahead. `but status` no longer showed it in the workspace. |
| Can that branch be brought back? | Yes, two ways. `but apply <branch>` returned it to the workspace, and `but pick <sha> --branch <new>` recreated the commit on a new branch. |
| Is the recovered content identical? | Yes. The recovered file had the same blob hash in both cases. |
| Does `git stash pop` apply after the restore moved the workspace commit? | Yes, cleanly. The stashed file was one the restore did not touch. |

**Not covered by these probes**

- Conflict behaviour when a recovered branch overlaps changes kept after the restore. Nothing in these runs conflicted.
- Anything involving a remote. `but setup` with no remote created a `gb-local` remote and set the target to `gb-local/main`. No network call was made.

**Agent detection, observed.** Every command printed the `AGENT ACTION REQUIRED` notice asking for a skill install, because the shell sets `CLAUDECODE`. No file was overwritten, because no GitButler skill was installed under `$HOME`.

### Dependency limits on fanning one file out (probes 3 and 4)

This is the constraint that shapes the sorting workflow, and it is stricter than the hunk-splitting
question that preceded it.

| Observation | Detail |
|---|---|
| Changes far apart split into separate hunks | Three changes 8 lines apart in a 20-line file produced three hunks (`ko:0`, `ko:23`, `ko:2f`). Adjacent changes one line apart produced a single hunk, because the default context is 3 lines. |
| Separate hunks can go to separate independent branches | Hunk 1 to one branch and hunk 3 to another, same file, both accepted. |
| Changes inside one hunk cannot | After the first scope landed, the rest were refused: `conflicts with commits on <branch> (edits touch the same file)`. Rewriting the file to isolate a scope does not help, because the remaining hunk still overlaps the committed lines. |
| A change to a line another branch introduced cannot either | `line 2 depends on <branch> (<commit>)`. |
| Both refusals are atomic | Nothing is committed and the target branch is not created. |
| Both name the fix | Create the branch above the owner, then repeat the same commit. Observed to work. |
| A second commit to the owning branch always works | No refusal when the dependent change goes to the branch that introduced the lines. |
| Hunk IDs outlive an intervening commit | An ID read before a commit still resolved afterwards, even though the displayed short ID had shortened from `ko:23` to `ko:2`. |
| `--anchor` is deprecated | GitButler's own error hint suggests `--anchor`, then warns that `--above` replaces it. |

**Consequence for the sorting workflow.** Scopes are separable only when they land in different
hunks. Scopes sharing a hunk belong on one branch, or on a stack.
