# Records, reviews, and issue reports

Main agent only.

## Review

After each step, write `<run-dir>/reviews/<step>-<agent-name>.md`:

```markdown
# Review: <agent name>, step <n>

verdict: accepted | rejected | accepted with notes

## observed
- spawned: <agent type, model, fork or fresh>
- provided: <paths in the brief>
- tool calls outside grant: none | <tool, path>
- artifacts written: <path> <sha256>

## stated
- decision record: present | missing
- exposure declared: <copy from decision record>
- relied-on citations checked: <D-number: holds | does not say that>

## findings
- <each problem, with the record that shows it>

hiding: intact | weak (<which record shows the violation>)
```

Checklist:

1. A decision record exists. Missing → `rejected`, write an issue report.
2. Every `relied on` citation points to something that exists and says what the
   decision claims. Spot-check at least the decisions that shape a contract.
3. Compare declared exposure with the `observed` tool calls. An undeclared read outside
   the grant → `hiding: weak`, write an issue report.
4. The artifact does what the brief asked, in the format the brief asked for.
5. Nothing in the artifact states a cause or rationale that its decision record does not
   contain.

## Observed layer

**Status: pending.** Format of `<run-dir>/observed/<step>-<agent-name>.jsonl`, one tool
call per line, once the extraction script exists:

```json
{"step": 2, "agent": "AI test generator", "tool": "Read", "path": "...", "in_grant": true}
```

## Issue report

One file per incident: `~/.claude/bento-code-reports/<date>-<project>-<run-id>-<n>.md`.

```markdown
# Issue: <trigger>

run: <project>/<run-id>
step: <n>, <agent name>
trigger: hiding violation | review rejected | check failed | decision record missing | user reported

## pattern
- pipeline: <name>
- grant: <context / artifacts / tools>
- hiding method: ordering | tool-less | redacted | instruction
- failure kind: <general terms, no project content>
- cause: inferred: <cause, with the record that shows it> | unknown

## case evidence
<excerpts copied in: tool log lines, decision record, check output, the user's words.
Copy, do not link: the run directory may be cleaned later.>
```

The pattern section must be readable without the case evidence and must contain no names,
paths, or code from the project. It is the only part that may be used to change this
skill.
