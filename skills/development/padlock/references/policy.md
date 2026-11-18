# Padlock policy

## Contents

- [Branch protections](#branch-protections)
- [Identity and affected branches](#identity-and-affected-branches)
- [Keys](#keys)
- [Master key turn budgets](#master-key-turn-budgets)
- [Custom rules](#custom-rules)
- [Changes to the policy](#changes-to-the-policy)

These are padlock's policy definitions, not claims about native Git protections.

## Branch protections

Treat a lock and an anchor as independent protections. A branch starts unlocked and unanchored.
An unlocked branch can still have an anchor or custom restrictions.
When several protections apply, satisfy all of them.

| Operation | Unlocked, unanchored | Locked | Anchored only |
|---|---|---|---|
| Inspect history, status, or diffs | Allow | Allow | Allow |
| Check out for inspection | Allow | Allow | Allow |
| Create a new branch from it, leaving the source unchanged | Allow | Allow | Allow |
| Commit, amend, or create a fixup on it | Allow | Deny | Allow |
| Push it, including force push | Allow | Deny | Deny |
| Pull into it, including fast-forward-only pull | Allow | Deny | Deny |
| Merge it or merge into it, including fast-forward and squash merge | Allow | Deny | Deny |
| Rebase it, including autosquash | Allow | Deny | Deny |
| Delete it locally or remotely | Allow | Deny | Deny |
| Rename it, move it, or change its stack placement | Allow | Deny | Deny |
| Reset, uncommit, or otherwise replace its history | Allow | Deny | Deny |

Allow means padlock adds no restriction; it does not authorize work that the user has not requested.
Explicit user policy changes override padlock defaults through supported controls; independent repository and other-skill restrictions still apply, including during a master-key grant.
File editing is outside this branch policy. Checking out a protected branch does not grant permission to commit there.
Creating a child does not inherit the parent's protections unless a matching custom rule says otherwise.

An anchor permits an amend or fixup confined to the branch, including the internal replay needed to perform that amend.
It does not permit a separate rebase, moving commits across branch boundaries, or changing another protected branch as a side effect.
A fixup commit and a later autosquash are two operations: the first may be allowed while the second is denied.
Do not use an amend, reset, direct ref update, renamed alias, or another tool to reproduce a forbidden operation.

Treat merging a protected branch as a source as restricted even when the source ref would remain unchanged.
Reading its commits or creating a child from its tip is still allowed.
This distinction preserves the ability to build from protected work without implicitly authorizing its integration.

## Identity and affected branches

Resolve a branch to its full ref in the actual repository before deciding.
Use the shared Git directory as repository identity so linked worktrees consult the same policy.
Distinguish local refs from remote destinations; a remote destination includes the remote and full destination ref.
Require an explicit push refspec when checking a protected repository.
Apply a branch-name protection to matching destination names on every remote, as well as to the actual source branch.
Refuse publishing commands whose remote destination mappings cannot be resolved by the adapter.
Check protections on both the source branch and the remote destination of a push.

Do not use the checked-out workspace ref, an abbreviated command selector, or a commit hash as the permanent identity of a GitButler virtual branch.
Resolve selectors against fresh tool output and inspect the stack containing the requested target.
For a multi-branch command, evaluate every branch it would publish, integrate, rewrite, delete, rename, or move.
If one branch is denied or the affected set is unknown, stop before starting the command.
Do not execute the allowed part of a batch unless the user has authorized a separate operation with that narrower scope.

Treat aliases, shell functions, GUI actions, remote APIs, helper scripts, and direct ref edits by their effects.
For an unfamiliar command, establish its effects from the installed version's documentation, help, or source before deciding.
Do not assume that a command called preview, check, or dry-run has no side effects.

## Keys

A key is a temporary exception for one identified session. It does not turn a shared lock off.
Other sessions continue to see the branch as locked while the holder works.
Do not inherit a key from a parent agent, another terminal, the working directory, or a copied state record.
The supplied host adapter does not delegate keys; do not invent a delegation mechanism to work around this boundary.

Record these fields before using a key:

- The owner session and exact branch ref, which together identify the key.
- The branch protection's generation.
- Whether the holder has temporarily unlocked, locked, or retained the shared lock state.
- Lifetime: this turn or this session, with the originating prompt ID.

Use a direct user command to issue the key.
The saved key's exception covers lock denials only; ordinary task authorization still limits which work may be performed.
Represent release or expiry by removing the key, and revocation by removing it or changing its protection generation.

Use the runtime session and prompt IDs supplied by the hook, or the fresh identities returned by the portable operator interface.
Recover identity only from that session's own trusted context, never by adopting an owner ID found in the shared ledger.
If continuity cannot be established, do not use an existing key or claim that automatic expiry is active.

Interpret a key to a lock as overriding that lock only.
It does not lift an anchor or custom denial; those require a master key or a direct user policy change.
An all-branches key covers the current matching locks in this repository; record the expanded set.
Do not extend it to other repositories, later locks, or newly tightened rules without authorization.
A new generation of a protection invalidates keys issued for its old generation.

Permit one active holder per protection by default.
If a grant would overlap another holder, report the overlap and require the user to authorize transfer or concurrent access.
Do not revoke another session's key to make room on your own.
A key permits session-local lock toggling within its scope; it never permits issuing more keys or changing the shared policy itself.

Release a key when its authorized task finishes early, including failure or cancellation.
Release a turn-bound key before the final response, and reject it in every later turn even if cleanup was interrupted.
A session-bound key can span turns, but ends when the session closes, the user revokes it, or its stated task finishes.
An abandoned key grants no rights to another session. Do not infer transfer from elapsed time alone.
Wall-clock expiry is not implemented; do not translate a timed grant into an unbounded session key.

Keep the underlying lock in place throughout this lifecycle.
When work ends, remove the exception; do not replay an old policy snapshot over more recent changes.
Use permanent unlock only when the user explicitly requests a lasting policy change.
Unlock removes the lock; unanchor removes the anchor. Neither removes custom rules.

### Master key turn budgets

Treat an explicit `/padlock:masterkey` request as a temporary bypass of all padlock branch protections in the current repository.
With no argument, grant two turns; with a positive whole number alone, grant that many turns; with request text, grant one turn and perform that request immediately.
Always include the command turn in the count. A number followed by request text is a one-turn request.
Include locks, anchors, and custom denials, but do not erase or edit them.
Keep ordinary task authorization, tool permissions, and sandbox restrictions in force.
The master key does not authorize permanent policy changes or the creation of longer-lived keys.

Bind it to the requesting session, the current host prompt ID, and a count of reserved future turns.
Do not grant it to unrelated sessions sharing the repository.
Do not pass this adapter's master key to subagents or background jobs.
Recheck the turn at each guarded operation; a copied environment variable alone is not evidence that the turn is still active.

For automatic executable expiry, require trusted turn-start/turn-end integration.
The portable operator interface supports explicit turn advancement and closure; without a host adapter, describe this as manual lifecycle control.
Deactivate the current turn's grant at its end; activate and consume a reserved turn only when the host supplies a new prompt ID or the portable operator explicitly starts the next actual turn.
With no reserved turns left, a new prompt does not inherit the bypass.
Also revoke on session shutdown, and use the host prompt ID to reject a later turn even if cleanup did not run.
An already admitted operation may finish after an interruption; do not claim the key cancels or undoes it.
When a required lifecycle signal or identity is unavailable, refuse to claim automatic one-turn expiry; report the unsupported integration.
Use the slash spelling as the requested interface, and register it through the host's supported command mechanism before describing it as installed.

## Custom rules

Express a custom rule as an exact ref, denied operations, and a generation.
Patterns are not accepted by the current command interface; ask for an exact branch instead of guessing a match.
Default to cumulative denials: a broad allowance does not silently cancel a narrower protection.
Represent an exception as an explicit key or an authorized edit to the particular rule.

Examples of useful custom rules are a push-only prohibition and a branch that permits commits but denies amends.
Do not equate the absence of a custom denial with permission to override a lock or anchor.
Treat an invalid rule, unknown operation, ambiguous target, unreadable state, or unsupported state version as unresolved.
Keep inspection available and stop the affected mutation until the ambiguity is resolved.

## Changes to the policy

Persist explicit lock, unlock, anchor, unanchor, key, and custom-rule requests before reporting success.
Perform ordinary authorized work without asking again for every command covered by a valid key.
A generic request to finish, fix, commit, or publish does not silently remove an existing protection.
When a request conflicts with a protection, identify the blocked operation and branch and ask for the smallest needed policy change.

Preserve protections across an authorized rename or move, and invalidate affected keys before re-identifying the branch.
Keep a protection for a deleted name until the user explicitly removes it, so recreating that name does not silently shed the policy.
Never clear a malformed ledger or delete the policy directory as a recovery shortcut.

Report policy changes briefly: branch, lock/anchor status, key holder and scope when relevant, and expiry boundary.
After temporary work, report that the key was released and the original protection remains in force.
