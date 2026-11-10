# Retrospective review of finished design and code

Framework design is a long iterative process. Each new scenario shows opportunities in areas already finished: knowledge duplicated across features, special cases that have become a family, extension points nobody implements, options every consumer sets the same way. A framework evolves through phases of prototyping, expansion, and consolidation [Foote-Opdyke]; refactoring itself was first formalized for frameworks [Opdyke]. This file is the consolidation phase, run deliberately.

## Contents

- When to run a retrospective
- Inputs
- Sweeps
- Guarding against the wrong abstraction
- Keep, fix, or rewrite
- Classifying candidates
- Prioritizing
- The retrospective log

## When to run a retrospective

- After each release.
- When the third similar implementation of something lands [Roberts-Johnson], [Fowler-Refactoring].
- Before 1.0, and before each major version: the windows in which surface can change.
- When a hotspot appears (below).
- When the user asks.

## Inputs

- The design records and their decisions, with "revisit when" conditions (`session-style.md`).
- The API report difference since the last retrospective (`release.md`).
- Version-control history since the last retrospective.
- Consumers' questions, issues, and workarounds; their code where visible.
- The scenario set (`scenarios.md`) and the scratch prototypes recorded in the design records.
- The previous retrospective log, including declined candidates.

## Sweeps

Each sweep finds candidates; it does not decide them.

| # | Sweep | Signal | Evidence | Candidate action |
|---|---|---|---|---|
| 1 | Duplicated knowledge | The same decision (a format, a rule, an ordering) encoded in several places | Search for the decision's constants and shapes; change coupling between their files | One owner module for that knowledge [APOSD] |
| 2 | Shallow accretion | Pass-through methods, wrappers that mirror what they wrap, options that are forwarded unchanged | Read the surface and one layer below | Merge or deepen (problem-map A12) |
| 3 | A family of special cases | Three or more special-purpose members doing variants of one thing | The API report | One general mechanism; keep the special members as thin conveniences or deprecate them (general-purposification, P6) |
| 4 | Unearned extension points | Extension points with zero or one implementation | Search consumers and the framework for implementations | Make internal (pre-1.0, or in the next major), or freeze and document |
| 5 | Repeated consumer workarounds | Three or more consumers working around the framework the same way; before there are three, one real consumer's friction counted by file and line (string lookups, casts, magic limits, comments explaining framework behavior) | Issues, questions, consumer code | A built-in feature or a new extension point [Practice-2026-11-1] |
| 6 | Dead options | Options always set to the same value, or never changed from the default | Consumer configuration where visible; issues | Pull the decision into the framework; deprecate the option (problem-map A5) |
| 7 | Uniform error handling | Errors that every consumer handles the same way | Consumer code, issues | Define the error away or handle it inside (problem-map C4) |
| 8 | Hotspots | Files changed most often since the last retrospective; read the counts together with each file's size or complexity [Tornhill] | Command below | Redesign candidates |
| 9 | Misplaced boundaries | Modules that change together | Change-coupling command in `conventions-fit.md` | Move the boundary |
| 10 | Two patterns, one concept | Two ways to do the same thing on the surface | The API report; documentation | Converge in the next major, with migration |
| 11 | Overdue removals and experiments | Deprecated surface past its removal version; experimental surface past its review date | Deprecation markers; experimental markers | Remove in the next major; stabilize or remove |
| 12 | Suppressed checks | Lint rules or analyzers suppressed often | Count suppressions per rule ID | The rule is wrong, or the design it guards is (`enforcement.md`) |
| 13 | Surface reduction | Published elements touched by no scenario | Scenario walkthrough rerun on the current design | Make internal or remove; measure the reduction in a prototype |

Hotspots since the last retrospective:

```sh
git log --no-merges --since=<date of last retrospective> --name-only --format= \
| grep -v '^$' | sort | uniq -c | sort -rn | head -30
```

## Guarding against the wrong abstraction

- **Unify only what changes for the same reason.** Two pieces of code that look alike but answer to different rules will diverge again, and the shared abstraction will grow parameters to serve both. Duplication is far cheaper than the wrong abstraction [Metz].
- **Wait for the third instance** before generalizing a surface [Roberts-Johnson], [Fowler-Refactoring].
- **Do not consolidate everything at once.** A consolidation that adds every deferred idea produces an overdesigned successor [Brooks].
- **Measure.** For a refactor or a surface reduction, measure before and after in a scratch project or a throwaway worktree (`prototyping.md`): surface size, consumer code per scenario, change cost.

## Keep, fix, or rewrite

When a subsystem's problems are large enough that rewriting it is on the table, record one decision per subsystem: keep, fix, or rewrite. Each record states the acceptance criteria any outcome must meet, the evidence for each verdict, a comparison of the options against the same outcome (including the review effort each needs), a provisional verdict, the unknown that could change it, and a "reconsider if" condition. A rewrite of a framework, or a port to another platform, starts by turning its predecessor's review findings into a list of known pitfalls, each settled before consumer code depends on it [Practice-2026-11-1].

Replace a subsystem in steps that can each be reviewed alone: add the new part unwired, wire it, unwire the old part, migrate, then delete; never mix creations, edits, and deletions in one step [Practice-2026-11-5].

## Classifying candidates

| Class | Surface effect | When it can ship |
|---|---|---|
| Internal | No change to the published surface | Any time, behind tests that pin the promised behavior |
| Additive | New surface, compatible | A minor release |
| Breaking | Changes or removes published surface | Batched for the next major, with migration steps |
| Retraction | Removes surface no consumer should depend on | Before 1.0, or in a major |

## Prioritizing

Score candidates with the engineering weights in `tradeoffs.md`. Do internal refactors that make a later surface change easy before the surface change itself: "make the change easy (warning: this may be hard), then make the easy change" [Beck-Tweet]. Keep structural changes and behavioral changes in separate steps, so that each can be reviewed and reverted on its own.

## The retrospective log

Record every candidate, including the declined ones, so that the next retrospective does not raise them again without new evidence:

| ID | Finding | Evidence | Class | Decision | Reason | Revisit when |
|---|---|---|---|---|---|---|

Keep the log next to the design records. A declined candidate is reopened only when its "revisit when" condition is met or new evidence appears; say which.
