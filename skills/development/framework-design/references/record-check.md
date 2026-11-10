# Design record check

A user-invoked check that the record of a framework design effort still says what was decided: which decisions are in force, which were replaced, what is still open, and on what evidence. Long explorations with many rounds of feedback leave decisions superseded without being marked, decisions made in chat that never reached the record, and terms whose meaning drifted. This check repairs the record, not the conversation: the conversation's own length, compaction, noise, and the move to a fresh session belong to a dedicated context skill, if one is installed.

## Contents

- Invocation
- Invariants the record keeps
- Procedure
- Mechanical checks
- Repairs that keep the record small
- Approval and application
- The current-state block

## Invocation

Run only when the user asks: "design record check", "/framework-design record-check", "check the design record", or an equivalent request. Suggest it, in one line and at most once per session, when a decision made in chat is not in the record, when a later accepted decision appears to contradict an earlier one, or when a record has passed about thirty decisions without a current-state block.

## Invariants the record keeps

These hold during normal work (`session-style.md`); the check verifies them.

1. Accepted decisions are never rewritten; a change is a new decision that supersedes the old one, whose status then reads "superseded by D-n" [Nygard].
2. Each decision records its status, who decided (the user's words and date, or the source that binds it), its evidence kind and provenance distance, and a "revisit when" condition.
3. IDs of scenarios, options, and decisions are never reused or renumbered; a forced renumbering keeps a mapping.
4. Every open decision survives each condensing or rewrite of the record.
5. The current-state block (below) lists the decisions in force.
6. Each glossary term has one meaning.
7. The record agrees with the API specification and, where they exist, with the API report and the code.

## Procedure

1. **Inventory** the effort's working files: design record, API specification, PRD, task log, research findings, and any preference file this skill wrote, with their line counts.
2. **Rebuild the decision ledger from the conversation**: every design decision, correction, and stated preference about the design visible in the current context, in order, one line each, numbered; mark each one a later one replaced. Where only a summary of an earlier span is visible, mark its items "derived".
3. **Compare the ledger with the records** and classify every difference:
   - **missing**: decided in chat, not in the record;
   - **contradicted**: recorded, then reversed in chat without the record changing;
   - **drifted**: recorded with a meaning different from what the user said;
   - **duplicate**: the same decision in two places, possibly worded differently;
   - **orphaned**: in the record with no trace in chat or in an earlier record, and no stated reason.
4. **Run the mechanical checks** below.
5. **Report** one row per finding, findings that change a decision first:

   | ID | Kind | Where | What | Proposed action | Needs approval |
   |---|---|---|---|---|---|

6. **Apply** as described under "Approval and application", then update the current-state block.

## Mechanical checks

IDs referenced but never defined, and IDs defined more than once (read-only; adjust the file name and the ID prefixes to the project):

```sh
f=docs/design/<topic>.md
ids='(SC|O|D|MS|PREF)-[0-9]+'
# referenced, not defined
comm -23 <(grep -oE "\b$ids" "$f" | sort -u) <(grep -oE "^#{2,4} $ids" "$f" | grep -oE "$ids" | sort -u)
# defined more than once
grep -oE "^#{2,4} $ids" "$f" | grep -oE "$ids" | sort | uniq -d
```

These need a shell with process substitution (bash or zsh); they were run on a sample record when this skill was written. Run the same commands across the record and the API specification together when scenario IDs live in the specification.

Then check, per decision, the fields of invariant 2; that no accepted decision is contradicted by a later accepted one without a "superseded by" link; that every claim deciding something expensive to reverse is at provenance distance "primary, here" or "cited, not reopened" (`research.md`); and that the surface table in the API specification matches the API report or the code.

## Repairs that keep the record small

Move, do not delete:

| Action | When | How |
|---|---|---|
| Mark superseded | A decision was replaced | Set its status to "superseded by D-n"; leave its text as it was |
| Archive | Superseded decisions, rejected options, closed parking-lot items, research rows whose conclusion is recorded | Move them verbatim to `<topic>.history.md` beside the record, leaving a one-line pointer |
| Merge duplicates | The same decision appears twice | Keep the earlier ID, mark the later "duplicate of D-n", archive it |
| Close answered questions | An open decision was answered in chat | Record the answer as a decision dated by the chat instruction; remove it from the open list |
| Normalize terms | A concept has two names | Keep one in the glossary, list the other as "not to be used", replace it in the current-state text, leave archived text unchanged |
| Relabel | Decisions lack evidence kind or provenance distance | Add the labels; a claim that cannot be traced becomes "unknown" |

## Approval and application

- **Apply directly**, and list in the report: repairs that change no meaning (a dangling reference fixed to its evident target, labels, Contents lists, moving already-superseded or closed material to the archive).
- **Ask first**, as one batched, numbered list: anything that changes what a decision says, marks a decision superseded, closes an open question, merges two differently worded decisions, or resolves a contradiction between chat and record. Propose the latest explicit statement by the user as the default answer; the user confirms it.
- Never edit another system's memory in place; where a standards memory holds a contradicted entry, report it and follow that memory's own rules (`judgment-memory.md`).

## The current-state block

Keep this block at the top of the design record (`assets/templates/design-record.md`), and rewrite it at the end of every check:

```
## Current state (<date>)

Benefit profile: <…>
Accepted decisions in force: D-<n> <one line>, …
Open decisions for the user: <IDs>
Constraints and gates in play: <…>
Next steps: <numbered>
Not to be confused: <terms with their one meaning>
```

Keep it under about 40 lines, so that a later session can resume the design from the block and the files it links, without the conversation.
