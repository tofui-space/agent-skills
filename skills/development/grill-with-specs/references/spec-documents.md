# Spec documents: templates and ID rules

Read this before the first write to `docs/spec/`. The templates are small on purpose: a spec that is read is one that fits on a screen per section.

## Shared rules

- **IDs are stable.** `US-`, `REQ-`, `CON-` followed by three digits, zero-padded, assigned in confirmation order. Never renumber. Never reuse a number, even after a supersede.
- **One item per line**, starting with its ID. Sub-bullets are allowed only for acceptance criteria under a story.
- **Status is in the text, not in a column.** A superseded item keeps its line and gains `(superseded by REQ-042)`. An item still under discussion is not in the file at all; it is in the round.
- **Sources in parentheses at the end** of any item that came from research: `(OWASP ASVS 4.0.3, 3.3.2)`, `(framework docs: idempotency keys)`, `(existing CON-004)`. Items the user stated themselves carry no source.
- **Header line on every file**: `Last round: N, <date>` so a reader knows how current the file is without opening history.
- **Keyboard-typable characters only.** Straight quotes, plain hyphens, three-dot ellipsis.

## user-stories.md

```markdown
# User stories

Last round: 4, 2026-01-15

## Actors

- Member: a registered library user who can borrow items.
- Librarian: staff who manage the catalog and loans.

## Stories

- US-001 As a Member, I want to reserve a book that is on loan, so that I get it before it goes back on the shelf.
  - Given the book is on loan, when I reserve it, then I see my position in the queue.
  - Given I already hold a reservation for this book, when I reserve again, then I am told I already have one.
- US-002 As a Librarian, I want to see all reservations for a copy, so that I can hand it to the right Member on return.
```

Story rules:

- Actor names come from the Actors list and the glossary. Do not introduce an actor in a story without adding it to Actors.
- Acceptance criteria use Given/When/Then, one bullet per case. Two to four bullets; a story needing more is two stories.
- "So that" states a benefit to the actor, not a system behavior. "So that the system updates the queue" is not a benefit.

## requirements.md

```markdown
# Requirements

Last round: 4, 2026-01-15

## Functional

- REQ-001 When a Member reserves a book on loan, the system shall append the Member to that book's reservation queue.
- REQ-002 When two reservations for the same copy arrive concurrently, the system shall record exactly one per Member. (framework docs: unique constraints)

## Non-functional

- REQ-010 The system shall return a response to a reservation request within 500 ms at the 95th percentile.
- REQ-011 When an API request fails, the system shall respond with RFC 9457 problem details. (RFC 9457)

## Open

1. How long does a Member have to collect a reserved book after notification? (asked round 2, unanswered)
```

Requirement rules, using EARS patterns:

| Pattern | Form |
|---|---|
| Ubiquitous | The system shall ... |
| Event-driven | When <trigger>, the system shall ... |
| State-driven | While <state>, the system shall ... |
| Unwanted behavior | If <condition>, then the system shall ... |
| Optional feature | Where <feature is present>, the system shall ... |

- One "shall" per item. Two shalls is two items.
- Measurable where a number exists. "Fast" is not a requirement; "within 500 ms at p95" is.
- The Open section is a numbered list of questions with the round they were asked in. Answered questions move into items and are removed from Open.

## constraints.md

```markdown
# Constraints

Last round: 4, 2026-01-15

## Standards adopted

- CON-001 Accessibility: WCAG 2.2 level AA for all Member-facing pages. (W3C WCAG 2.2)
- CON-002 API errors follow RFC 9457. (RFC 9457)

## Stack and environment

- CON-010 Single relational database; no second data store for the first release.
- CON-011 Deployed as one service; background jobs run in-process.

## Limits

- CON-020 Maximum 5 active reservations per Member.

## Out of scope

- CON-030 Reservation of items that are not books (media, equipment).
- CON-031 Notification by SMS.
```

Constraint rules:

- A standard is adopted at a named version and level. "WCAG" alone is not a constraint.
- Out-of-scope items are constraints because they bound the work. One line each, never merged into a sentence.
- A decision the user has not made yet is written as `CON-0xx <topic>: decision pending` so it is visible, and is listed in the close summary.

## glossary.md

```markdown
# Glossary

Last round: 4, 2026-01-15

- Copy: one physical instance of a book. A book may have several copies.
- Loan: a copy checked out to a Member, with a due date.
- Member: a registered library user who can borrow items.
- Reservation: a Member's claim on the next available copy of a book.
```

Glossary rules:

- Alphabetical. One line per term. A definition that needs two sentences is a sign the term is two terms.
- Add a term the first time it appears in a confirmed item, and use it with that spelling everywhere after.
- If a `CONTEXT.md` glossary already exists in the repository, do not create this file; add terms there in its format instead, and say so in the close summary.

## research.md

```markdown
# Research note

Last round: 4, 2026-01-15

## Areas researched

| Area | Round | Sources |
|---|---|---|
| Security: sessions and auth | 2 | OWASP ASVS 4.0.3 chapter 3 |
| Error handling: API responses | 2 | RFC 9457; framework error-handling docs |
| Notifications | 3 | framework mail docs |

## Declined candidates

- Audit log for admin actions. Round 2. Reason: not needed for first release; revisit at multi-admin.
- SMS notification channel. Round 3. Reason: cost; email is enough.

## Not yet researched

- Internationalization
- Observability and logging
- Data retention beyond notifications
```

Research note rules:

- The declined list is the skill's memory across sessions. A candidate on it is not proposed again unless the user asks.
- "Not yet researched" is copied from the area list in `research-areas.md` minus what was done, so the next session sees the gap without recomputing it.
- Sources are named precisely enough to reopen: standard, version, chapter or section; or the documentation page title.
