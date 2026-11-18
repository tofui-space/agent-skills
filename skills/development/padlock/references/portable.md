# Portable controls

Use this interface when the Claude Code plugin is unavailable, or when implementing a host adapter.
Keep the distinction between an explicit user policy request and routine agent work.

## Establish the session

On the user's first padlock request in a session, run:

```text
python <skill-dir>/scripts/padlock.py operator start
```

Retain the returned `session` and `turn` values in that conversation's private context.
Starting a session creates no keys and changes no branch policy. Checked: read in source code.
Do not recover identities from another session or the shared status output.

## Apply an explicit user request

Translate `/padlock:on work/example` into:

```text
python <skill-dir>/scripts/padlock.py --session <session> --turn <turn> operator command on work/example
```

The `command` action accepts the same policy actions and arguments as the slash interface, including `anchor`, `off`, `sessionkey`, `turnkey`, `release`, `rule`, and `masterkey`. Checked: read in source code.
Omitted branches still require an unambiguous current branch.
Use `operator command masterkey` for two turns, `operator command masterkey 5` for five, and `operator command masterkey <request>` for one turn with a task.
The invoking turn counts as the first.

Run policy commands only for an explicit user instruction naming that policy change, or through a trusted host's direct-user command handler.
Never interpret “finish the task” as authorization to mint a key.
The operator CLI cannot authenticate who launched it; this authority boundary is agent policy or host enforcement. Checked: read in source code.
The Claude Code tool gate rejects agent use of `operator`; use its direct-user plugin commands there. Checked: read in source code.

## Perform ordinary work

After the user grants a branch key, an agent may toggle and work within its scope:

```text
python <skill-dir>/scripts/padlock.py --session <session> --turn <turn> toggle off work/example
python <skill-dir>/scripts/padlock.py --session <session> --turn <turn> run -- but commit -b work/example -m "Update" <file>
python <skill-dir>/scripts/padlock.py --session <session> --turn <turn> release work/example
```

Use the repository's required version-control tool.
The runner checks persisted locks, anchors, custom rules and the supplied current identities before starting a supported mutation. Checked: read in source code; ran simulated-execution tests.

## Advance and end actual turns

Before responding at the end of a turn, run `operator end` with its current identities.
At the start of the next actual turn, run `operator next` with the preceding identities, then retain the newly returned turn value.
Use `operator close` when the session ends, including cancellation when cleanup can run.

```text
python <skill-dir>/scripts/padlock.py --session <session> --turn <turn> operator end
python <skill-dir>/scripts/padlock.py --session <session> --turn <turn> operator next
python <skill-dir>/scripts/padlock.py --session <session> --turn <new-turn> operator close
```

Only the actual conversation lifecycle authorizes these transitions; do not invent turns to reactivate or consume a grant.
Advancing rejects the old turn identity, ends old turn keys, and consumes one reserved master-key turn; closure revokes all remaining grants for the session. Checked: read in source code; ran lifecycle tests.

Without host integration, report “manual lifecycle control” and perform these transitions explicitly.
An interruption that prevents cleanup can leave the last turn active until `next` or `close`; this mode does not enforce expiry automatically. Checked: read in source code.
To automate it, the host must retain identities outside agent control, call these lifecycle actions at actual boundaries, authorize policy commands only from direct user input, and validate identities at its tool gate.
No adapter for another named runtime is installed by this interface. Checked: read in source code.
