# Report and brief templates

Version 2026-11-06

Two files per audit, written outside any repository in the same directory: the report, and the handoff brief when one is due (see SKILL.md, "The current conversation and the handoff brief").

Both are read by someone who has not seen the files under audit. Write each finding so it can be acted on without opening anything: what the entry says, what the evidence shows, why that matters, and the literal text to change. Use plain words; the verdict and grade names from SKILL.md are the only labels.

## Contents

- Report template
- Writing a finding
- Example finding
- Handoff brief template

## Report template

```markdown
# Context audit: <project>, <YYYY-MM-DD HH:MM>

Produced by optimize-context <metadata.version from SKILL.md> · model <model ID> · <agent and its version>

## Scope

| Location | What it is | Checkouts and branch | Read when | Audited |
|---|---|---|---|---|
| <absolute path> | <instruction file / memory / decision records / notes / transcript store / …> | <worktree paths, branch> | <every session / directory tree / on demand / never> | <yes / no: reason> |

Commit per checkout: <worktree>: <short sha>, <clean / N uncommitted files>.
Sessions searched: <count>, <first date> to <last date>, <agents>.
Earlier reports read: <paths, or none>.

## Summary

<Count per verdict, one line.> Highest finding: <one sentence, with where it is read>.

## Findings

| ID | Severity | Verdict | Where | Problem | Proposed change | Status |
|---|---|---|---|---|---|---|
| F1 | High | Stale | `<path>:<line>` | <one sentence> | <one phrase> | proposed |

### F1 <short title>

- **Entry:** "<quote>" (`<path>:<line>`, <checkout>)
- **Problem:** <what the entry says, what the evidence shows, and what that will cause>.
- **Provenance:** <grade>. <Origin: session file and timestamp, or commit and date, or "no record found">.
- **Evidence:** <run: the command and what it printed | read: `<path>:<line>` | source: <URL>, read <date>>.
- **Change:**
  - old: `<exact text>`
  - new: `<exact text>` (or: delete)
- **Status:** proposed | applied <date> | declined: <reason> | deferred

## Noise and plain errors

Approve as one group, or by ID. Each row is unambiguous by the test in SKILL.md, Step 6.

| ID | Where | Text | Why it is safe to remove or correct |
|---|---|---|---|
| N1 | `<path>:<line>` | "<quote>" | <nothing refers to it; carries no entry kind> / <contradicted by: command or source> |

## Questions

1. <Question that only the user can answer, with the options and what each changes.>

## Not established

| Entry | Where | What is missing |
|---|---|---|

## Declined earlier, not raised again

| Finding | Report | Entry unchanged since |
|---|---|---|
```

## Writing a finding

- One finding per entry. When one wrong fact is copied into four files, that is one finding with four locations in its Change list, not four findings.
- The problem sentence says what the entry will cause if left: a session that runs a command that does not exist, a decision applied that the user reversed, a fact repeated to the next reviewer.
- A finding about something the user said quotes them exactly and gives the date. It states what the evidence shows and stops there.
- Evidence is something the reader can repeat: a command, a `path:line`, a URL. "Checked" is not evidence.

## Example finding

The project in this example is invented.

```markdown
### F3 Cache lifetime in CLAUDE.md is wrong

- **Entry:** "Search results are cached for 24 hours, so stale results after an import are expected." (`/srv/library-catalog/CLAUDE.md:41`, main worktree)
- **Problem:** The cache lifetime is one hour, not 24. Every session reads this line, so a session debugging stale search results after an import will treat a real bug as expected behaviour.
- **Provenance:** Assistant-inferred. Written in session 2025-05-12 14:03; the transcript shows the assistant concluding it from a comment in the old cache module, and the user replying "ok" to a message with six other items (Bulk-acknowledged at most).
- **Evidence:** read: `src/search/cache.ts:12` sets `ttlSeconds: 3600`; `git log -S 'ttlSeconds' -- src/search/cache.ts` shows it was changed from 86400 on 2025-06-02.
- **Change:**
  - old: `Search results are cached for 24 hours, so stale results after an import are expected.`
  - new: `Search results are cached for one hour (src/search/cache.ts, ttlSeconds).`
- **Status:** proposed
```

## Handoff brief template

The brief lets a new session start from verified context instead of the accumulated one. It holds only entries the audit confirmed, plus open questions. Every line is something the new session can act on.

```markdown
# Brief: <project>, <YYYY-MM-DD>

From the context audit at <report path>. Every item below was confirmed there; anything unconfirmed is under Open questions.

Produced by optimize-context <metadata.version from SKILL.md> · model <model ID> · <agent and its version>

## Goal

<What the work is for, in the user's words where they stated it.>

## Where things are

| Checkout | Branch | Commit | Uncommitted |
|---|---|---|---|

<Key files, stores and documents, one line each, with absolute paths.>

## Decisions in force

- <Decision.> (<User-stated or User-confirmed>, <date>)

## Facts relied on

- <Fact.> (<evidence: command, path:line, or source URL>)

## Status

- Done: <…>
- In progress: <…>
- Next: <…>

## Open questions

1. <Question, and who answers it.>

## Corrections

- <The correct statement.> (An earlier session believed otherwise; listed only because a new session would likely adopt the old belief again.)
```
