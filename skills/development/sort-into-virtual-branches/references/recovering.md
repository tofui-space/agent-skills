# Recovering from a bad sort

Read this before undoing anything. Every statement here was observed by running the commands, not
inferred from documentation.

## A commit landed on the wrong branch

Nothing is lost, and a snapshot restore is the wrong tool for it. The commit is on a branch; move
it, or move the file out of it. Restoring rolls back everything since the checkpoint, including the
commits that went where they should have.

## What a snapshot restore does

`but oplog restore <snapshot>` returns the whole project to its state just before that snapshot's
operation. It saves a snapshot of the current state first, so the restore itself can be reversed.

**It resets:**

* Every virtual branch and the workspace branch, back to where they pointed.
* Tracked files, back to the snapshot's contents. Edits made since, committed or not, are replaced.
* The staging area and conflict state.

**It leaves alone:**

* Anything already pushed.
* Untracked files that existed when the snapshot was taken.
* Untracked files above GitButler's size limit, which snapshots never hold.

**It deletes, without naming them in its output:**

* Untracked files created after the snapshot. This is why parked work goes outside the working tree.

**It has no confirmation prompt**, and it acts on the whole project, including operations from other
sessions.

## Only restore when everything since the checkpoint should go

The condition is not "one operation happened". It is: every operation since the snapshot, from any
session, and every uncommitted edit to tracked files, should be undone. Read `but oplog list` first
and confirm the whole list is unwanted.

When exactly one operation is trailing, `but undo` does the same job one step back.

## Committed work survives a restore

A branch created after the snapshot keeps its git ref. It disappears from `but status` but appears
under `but branch list` as an unapplied branch. Two ways back:

```
but apply <branch>                      # returns the whole branch to the workspace
but pick <sha> --branch <new-branch>    # recreates the commit on another branch
```

Both were observed to restore byte-identical content.

`but apply` refuses, changing nothing, when an uncommitted change would be overwritten:
`Uncommitted files would be overwritten by checkout`. Commit or park that change first.

## Parking uncommitted work across a restore

Two options, both observed to survive.

**A patch outside the working tree.** Creating one changes nothing in the repository:

```
git diff --binary HEAD -- <paths> > <folder outside the repo>/keep.patch
git ls-files -z -o --exclude-standard -- <paths> | tar --null -T - -cf <folder>/new.tar
```

`git diff` alone misses new files, which is what the archive is for, and it needs `HEAD` so it
compares against the workspace commit rather than the staging area. Use a unique folder: a fixed
path is shared by every session.

After the restore:

```
git apply --check <folder>/keep.patch && git apply <folder>/keep.patch
tar -xf <folder>/new.tar
```

Limit the patch to the paths you mean to keep. Uncommitted changes that already existed at the
checkpoint come back with the restore on their own, and a patch containing them will be rejected.

**A stash.** `git stash push -u -m "<label>"` survives a restore too, and popping it afterwards
worked cleanly. It handles new and binary files without extra steps, but it is a write: it resets
the stashed files and adds an entry to a stash list shared by every session in the repository.

## Order of operations

1. Park what should survive, outside the working tree.
2. Read `but oplog list` and confirm every entry after the checkpoint should go.
3. Restore.
4. Compare the working tree against the parked copy. Do not assume the restore did what it says.
5. Bring back every branch you still want with `but apply`. The patch was cut against the
   workspace commit, which included those branches, so their files must be back before it applies.
6. Reapply the parked work, `git apply --check` first. A hunk that fails the check touches a file
   whose branch was not brought back.
