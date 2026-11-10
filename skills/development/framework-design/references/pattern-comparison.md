# Idiomatic patterns: search, document, compare, present

When a problem has established solutions on the platform, find them, write each one up in the same short form, compare them on the same rows, and present the result verdict first. The aim is that a reader can scan the comparison in a minute and see which pattern fits under which condition.

## Contents

- Search
- Document: one card per pattern
- Compare: one table, same rows
- Present

## Search

1. **Name the problem as consumers meet it**, not by a pattern name: "consumers need to retry failed calls with their own policy", not "strategy pattern".
2. **Find the platform's idiom first**: the official API design guidelines for the language or platform (`research.md` lists them).
3. **Find two or three mature frameworks on the same platform that solve the problem.** Mature means released past 1.0, maintained, widely used. Read their reference documentation for the surface and, for the decisive detail, their source.
4. **Find the rationale**: their design records, RFCs, issue threads, changelogs, and migration guides. A deprecation or reversal with a stated reason is the most valuable evidence there is.
5. **Record the version and date** of every source; patterns change between majors.

Useful queries: `<platform> idiomatic <problem>`, `<framework> <feature> API reference`, `<framework> RFC <feature>`, `<platform> API guidelines <topic>`, `why <framework> deprecated <feature>`, `<framework> <feature> migration guide`.

## Document: one card per pattern

```
### <Pattern name, as the ecosystem names it> (aliases)

Used by: <framework> <version> (link) · <framework> <version> (link)
Shape:
  <consumer code, at most ten lines, solving the shared scenario>
Optimizes: <one line>
Costs: <one line>
Wins when: <condition>
Evolution: <what can be added later without breaking consumers; what cannot>
Constraints: <how defaults and constraint enforcement work with it>
Sources: <tags or links, with provenance distance>
Shape tested: yes (<command>, <date>) | no
```

Rules for cards:

- **Every card solves the same scenario**, so that the consumer code compares line by line.
- **The shape is marked tested only after it type-checked and ran** in a scratch project in this session; a shape copied from documentation or an earlier note is untested, however plausible (`research.md`, Provenance and decay).
- **Use the ecosystem's own name** for the pattern, with known aliases, so the reader can look it up.
- **Every card names at least one real framework that uses the pattern.** A pattern without one is labeled "novel", which is itself information.
- **Do what is customary on the platform.** A pattern carried over from another platform is rewritten in this platform's idiom, mimicking the patterns of its core APIs and language [Bloch], or it is labeled as foreign. Give it the scope label of its origin (`cheat-sheet.md`).
- **Name the lineage** when one pattern is a variant of another, so that the reader does not count one idea twice.

## Compare: one table, same rows

| | Pattern A | Pattern B | Pattern C |
|---|---|---|---|
| Consumer code: lines / concepts | | | |
| Idiomatic on this platform | | | |
| Evolvability | | | |
| Misuse resistance | | | |
| Advanced reach | | | |
| Runtime cost | | | |
| Used by | | | |

Fill cells with short values (a count, yes or no, one phrase), not sentences. When a decision is due, score the patterns with the weights in `tradeoffs.md` and add the result below the table.

## Present

- **Verdict first**: which pattern fits, and under what condition, in one or two sentences.
- **Then the table**, then the cards. In a design session, the cards go into the design record and the chat carries the verdict and the table, or only the verdict (`session-style.md`).
- **Mark disagreement.** Where mature frameworks chose differently, the disagreement is the finding: state the condition under which each choice wins.
- **Mark staleness.** Facts from sources older than the current major version of the framework are labeled with their version.
