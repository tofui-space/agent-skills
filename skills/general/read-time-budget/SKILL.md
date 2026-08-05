---
name: read-time-budget
description: "Caps the reading time of a chat response. The user appends a tag to any prompt — @30s, @45sec, @2m30s, @1minute, @150w, @100words — and the response is written to fit that budget. A trailing ! makes the cap sticky across turns (@30s!); @0! clears it. Invoke whenever a prompt contains an @ followed by a number and a time or word unit, anywhere in the message, in any case. Also invoke when the user asks for a response sized to a reading time or a word count. Budget is met by dropping whole topics — never by truncating, compressing grammar, dropping the verdict, or omitting a decision-changing caveat. Correctness outranks completeness, which outranks brevity. Counts chat prose only: code, tool output, tables, diagrams, folder structures, and content the user asked to be written for use elsewhere do not count against it. Do not apply when no tag is present and no sticky cap is armed."
---

# Read-Time Budget

## Configuration

```
READING_SPEED = 230    # words per minute
                       # Measure your own and change this one value.
                       # Every budget below derives from it.
```

## Deriving the budget

```
@Ns  →  words = READING_SPEED / 60 × N
@Nm  →  words = READING_SPEED × N
@Nw  →  words = N          (a direct word budget; bypasses READING_SPEED)
```

Approximate is fine. This is a target, not an assertion.

## Tag syntax

```
@<number><unit>[!]
```

Units accepted, case-insensitive:

- Seconds — `s`, `sec`, `secs`, `second`, `seconds`
- Minutes — `m`, `min`, `mins`, `minute`, `minutes`
- Words — `w`, `word`, `words`

Compound time is valid: `@2m30s`.

Decimals are not: `@1.5m`. An invalid form is not a budget — answer without a cap and say in one line that the tag was not understood.

## Sticky caps

- `@30s` applies to that prompt only.
- `@30s!` stays active on later prompts.
- Any later tag without `!` clears sticky and applies to its own prompt only.
- `@0!` clears sticky explicitly.
- `!` works on word budgets too: `@150w!`.

No tag and no sticky cap armed means no limit. A request to reformulate or expand an earlier answer is a prompt like any other: untagged, it has no cap.

## What counts

**Counts:** chat prose addressed to the reader.

**Does not count:** code blocks, tool output, tables, diagrams, flow and tree representations, folder structures, and content the user asked to be written for use elsewhere.

Optional depth sections count. The reader perceives the size of the message when it opens, not the size of the required-reading part.

The exclusions exist because the budget measures linear reading time, and none of the excluded forms is read linearly. A table is scanned, code is consulted, a deliverable is taken away and read later. Charging them at prose rate would price durable, non-linear material as if it were transient prose.

## Structure by budget

| Budget | Structure |
|---|---|
| 15s and above | Full structure |
| 10s to 15s | No headers |
| Below 10s | No headers, no scope signals, no labels — plain prose |

Overhead is dropped in that order: headers, then scope signals, then labels. Labels go last, because they are what makes the remaining material skippable.

Both thresholds are expressed in seconds and are therefore tied to `READING_SPEED`. If you change the constant, retune 10s and 15s by hand.

## Fitting the budget

Drop in this order:

1. Optional depth — edge cases, alternatives, worked examples.
2. Supporting reasoning — why the answer is what it is.
3. Supporting points inside the answer, keeping the verdict.
4. Structural overhead, per the table above.

Drop whole topics, never parts of one. When a topic will not fit, name it in a compact list and offer it:

> Also: caching, retry policy.

Four words. Affordable at any cap.

## Never

- **Never truncate.** Do not stop mid-topic, mid-list, or mid-explanation.
- **Never compress grammar.** Full sentences at every cap value. Keep articles, pronouns and prepositions. Telegraphic writing raises reading effort, which defeats the point of a reading-time cap.
- **Never drop the verdict.**
- **Never drop a caveat that changes the decision.** It is not depth.
- **Never invent, guess, or round a fact to make it fit.**
- **Never state a claim more confidently than warranted** because the qualification costs words.

Priority: correctness, then completeness, then brevity. When the correct answer will not fit, say so in one line and give the complete shallow answer — never a partial deep one.

## Structural completeness

A cap reduces what is said *about* something, never the something itself.

Steps in a flow, items in a checklist, and stages in a process are content, not elaboration. An authentication flow keeps every step at any cap; what shrinks is the commentary around it. Dropping a verification step to save words produces a wrong answer, not a short one.

## User size specifications

When the user specifies a size for content they asked to be written — "in roughly 100 words", "a short paragraph" — that specification is authoritative for that content, and the cap never overrides it.

The two budgets are independent. A prompt can carry `@15s` for the surrounding explanation and "roughly 100 words" for the requested content. Both hold.

## Scope

Chat prose only.
