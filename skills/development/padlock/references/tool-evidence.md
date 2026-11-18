# Tool evidence

Read this when deciding which branches a command may affect or explaining the enforcement boundary.
The policy choices in `policy.md` are definitions; the claims below describe external tools.

- `git rev-parse --path-format=absolute --git-common-dir` reports the shared Git directory using an absolute path. Checked: read in [vendor documentation](https://git-scm.com/docs/git-rev-parse), options for files.
- Git worktrees share most refs while retaining worktree-specific state such as `HEAD`. Checked: read in [vendor documentation](https://git-scm.com/docs/git-worktree), refs and details.
- Git's pre-commit hook can reject a commit, but `--no-verify` bypasses it. Checked: read in [vendor documentation](https://git-scm.com/docs/githooks), pre-commit.
- Git's pre-merge-commit hook runs after an automatic merge and is bypassable; it is not a universal gate before every merge effect. Checked: read in [vendor documentation](https://git-scm.com/docs/githooks), pre-merge-commit.
- GitButler's documented `but push` behavior without a target in a non-interactive session is to push every branch with unpushed commits. Checked: read in [vendor documentation](https://docs.gitbutler.com/commands/but-push).
- The vendor's CLI reference describes `but push <branch>` as pushing the selected branch and its ancestors. Checked: read in [vendor documentation](https://github.com/gitbutlerapp/gitbutler/blob/master/crates/but/skill/references/reference.md), remote operations.
- `but pr new` pushes before creating a review, and selecting the top of a stack publishes the stack. Checked: read in [vendor documentation](https://docs.gitbutler.com/cli-guides/cli-tutorial/forges), create a pull or merge request.
- `but pull` fetches and rebases all applied branches onto the target. Checked: read in [vendor documentation](https://docs.gitbutler.com/commands/but-pull).
- `but move` can move commits, committed changes, or a branch, and some forms create a branch or commit. Checked: read in [vendor documentation](https://docs.gitbutler.com/commands/but-move).
- `but reword <branch> -m <new-name>` is the documented way to rename an applied branch. Checked: read in [vendor documentation](https://docs.gitbutler.com/commands/but-branch).
- `but amend` can target a branch tip or an explicitly selected commit below the tip. Checked: read in [vendor documentation](https://docs.gitbutler.com/commands/but-amend).
- GitButler 0.23.4's push preview returns `branches` with `branchName`, `remote`, and `remoteRef`; the installed output encoded `remoteRef` as UTF-8 bytes. Checked: ran `but push --dry-run --json` and read [vendor source code](https://github.com/gitbutlerapp/gitbutler/blob/91ae22de07d183c706ea6651b43156f0af136e95/crates/but/src/command/legacy/push.rs).
- That preview fetches remote information and resolves the selected branch and its push ancestors before printing their destinations. Checked: read in vendor source code, linked above.
- GitButler stores its configured local target in `gitbutler.project.targetRef`. Checked: read in [vendor source code](https://github.com/gitbutlerapp/gitbutler/blob/91ae22de07d183c706ea6651b43156f0af136e95/crates/but-core/src/ref_metadata.rs) and ran installed configuration inspection.
- `but pull` also updates linked worktrees; `but merge` reconciles remaining work onto the moved target and can publish to that target's upstream. Checked: read in installed CLI help and [vendor documentation](https://docs.gitbutler.com/commands/but-merge).
- Complete coverage of every Git and GitButler mutation by a common set of Git hooks has not been established here. Checked: not verified.
- Claude Code supplies session and prompt identities to hooks, and its direct user-command expansion event identifies the command and arguments. Checked: read in [vendor documentation](https://code.claude.com/docs/en/hooks).
- Claude Code's `Stop` event does not fire on user interruption. Checked: read in [vendor documentation](https://code.claude.com/docs/en/hooks#stop).
- Claude Code documents `onFailure: "block"` from version 2.1.295 and exec-form hook commands with argument arrays. Checked: read in [vendor documentation](https://code.claude.com/docs/en/hooks).
- Plugin command files use the plugin's namespace, and a plugin directory can be loaded with `--plugin-dir`. Checked: read in [vendor documentation](https://code.claude.com/docs/en/plugins).

Recheck installed-version behavior before supporting a command whose affected branches cannot be established from these descriptions.
