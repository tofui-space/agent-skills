---
paths:
  - "**/*"
---

# Open decisions

This rule governs how an open decision in software design, development, or architecture is put to the user.
It applies wherever a decision surfaces: chat prose, a structured question dialog, or the open-questions section of a plan.

A decision put to a human is a request for a specific kind of answer.
The reader can only supply that answer if they can see, at a glance, what kind of question it is, why it is open, what the options trade, and what happens if they do nothing.
Analysis that arrives before those four things is noise the reader has to dig through to find the question.

## First, decide whether it is a decision at all

Before asking, try to close it.

* If the answer is in the code, the docs, the tests, or a source you can open, read it and do not ask.
* If both options are cheap to reverse and make no observable difference to the user or the tests, pick one, state the pick in one line, and continue.
* If only the user can supply the answer, or the choice is expensive to undo, ask.

A question the assistant could have resolved itself costs the reader attention and teaches them to skim your questions.

## Name the kind

Open every decision with its kind.
The kind tells the reader what sort of answer is being asked for, and each kind is answered differently.

| Kind                | What is open                                                                                                                                                                                       | The answer is                        |
|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------|
| **Trade-off**       | Each option sacrifices a real good; which good wins depends on priorities you do not know.                                                                                                         | Which good wins.                     |
| **Missing fact**    | The right option follows from a fact only the user has: an environment, a requirement, a constraint, a future plan.                                                                                | The fact.                            |
| **Convention**      | The options are equivalent in outcome; the codebase needs one consistent pick. Ask only when the pick is expensive to change later: a public name, a wire format, a layout other code will follow. | A pick, or permission to pick.       |
| **Risk acceptance** | One path is cheaper or simpler but carries a specific failure mode the user may or may not tolerate.                                                                                               | Accept the risk or pay to remove it. |
| **Scope**           | Whether a piece of work belongs in this task at all, including whether the requested change is the right change; a smaller fix that meets the stated goal is a scope decision, not a footnote.     | In or out.                           |

When a decision fits two kinds, name the one whose answer would settle it.
Do not invent finer kinds; five is what a reader can hold.

## The shape of one decision

Use this order, every time, in prose or in a dialog.

1. **Kind and question.**
   One line: the kind, then the question as a question.
   `Trade-off: should session state live in process memory or in the shared cache?`
2. **Why it is open.**
   One or two sentences on what makes this a fork rather than something you resolved.
   Say what you looked for and did not find, or which fact only the user has.
3. **Options.**
   Two to four, in parallel structure.
   A Missing-fact decision may have none: ask for the fact directly, and list options only when each plausible answer leads somewhere different worth naming.
   Each option is a short label, then what you get and what you give up.
   Put the recommended option first and mark it.
   If two options differ only in detail, merge them.
4. **Default.**
   What you will do if the user says nothing, and the grounds for it.
   The default is the recommended option; if it is not, say why.
   When no option is safe to take unasked, because the failure mode is data loss, a security exposure, or something irreversible, write `No default; blocks step N` instead, and treat silence as not yet decided.
   Silence is then a valid answer, and the reader knows what it means.
5. **Cost.**
   Three figures, each a rough size (minutes, hours, days) with its basis, never a false-precision number.
   When there is no basis for a figure, write `unknown` and say what would settle it; a guess dressed as an estimate is worse than an admitted gap.
    - **Build:** time to implement.
      One figure per option when they differ materially; one figure when they do not.
    - **Reverse:** time to undo the chosen option once code depends on it.
      Name what would have to change.
    - **Defer:** whether the decision can wait, and what waiting costs.
      If it can wait, say what gets built on a guess in the meantime, what is reworked when the answer arrives, and whether that debt grows with each step or stays flat.
      If it cannot wait, say which step it blocks.
      Read together, these tell the reader how much attention the decision deserves right now: a cheap reverse and a flat deferral debt can be answered late or not at all; an expensive reverse with a growing debt is the one to answer first.

Everything else — the full analysis, benchmarks, the code you read, the alternatives you rejected — goes after every decision has been stated, under a label such as
**Details**, so it can be skipped.
It never appears between the question and the options.
Keep Details to what would change a reader's answer; a rejected alternative gets one line.

## Several decisions at once

* Number them.
  The reader can then answer `1 default, 2b, 3 out` without restating anything.
* Order by reverse cost, highest first; among equals, growing deferral debt before flat.
* State dependencies between them once, at the top: `2 only matters if 1 is the shared cache.`
* Do not bundle two questions into one item; a reader cannot answer half an item.
* Above four decisions, say which ones block work now and which can wait, and ask only the blocking ones.

## In a structured question dialog

When the environment offers a question tool with options, map the shape onto its fields.

* Header: the kind.
* Question: the one-line question.
* Option label: the short label.
* Option description: what you get and what you give up, one sentence each.
* Recommended option first, marked as such.
* The "why it is open" and the cost block go in the prose immediately before the tool call.

## In a plan

Collect open decisions in one section near the top of the plan, in the shape above, numbered.
A decision buried inside a plan step is a decision the reader will approve without noticing.

## Wording

* Do not ask "how would you like to proceed?" or "let me know your preference."
  Those defer the work of framing the choice to the reader.
* Do not mix a permission request ("may I delete this?") with a design decision ("which storage?"); they are different kinds of ask and get separate items.
* Do not present a settled answer as a decision to look thorough.
  If you have grounds, state the conclusion and move on.
* Use the reader's vocabulary from the codebase for labels; do not coin names for the options.

## Does not apply

* Permission and confirmation asks ("delete this file?", "run the migration?").
  State the action and ask; the shape above is ceremony there.
* A choice the user has already framed as options.
  Answer it; do not re-present it.
* Questions outside software design, development, and architecture.

## Precedence

* An explicit user instruction not to ask wins.
  State each pick in one line and continue.
* The decision block is a fixed output format where the interface allows it.
  Response-formatting guidance active in the session applies outside the block, not inside it; a question tool's own fields take the mapping given above.
* Everything else in the response follows whatever formatting guidance is active.

## Example

```
1. Trade-off: should retry state live in process memory or in the shared cache?
   Open because the repo has no statement of how many replicas run in production, and the answer changes with that number.
   - Shared cache (recommended): survives restarts and works across replicas; adds a network dependency to every retry.
   - Process memory: no new dependency and simplest to test; retries are lost on restart and each replica retries independently.
   Default: shared cache, since the deployment manifest already provisions one.
   Cost. Build: half a day either way. Reverse: about a day; the retry scheduler and its tests are the only modules that touch the store.
   Defer: can wait until the scheduler is written, since the store sits behind one interface; deferring past that means every retry path is written against in-memory semantics and reworked, and the debt grows with each path added.

2. Missing fact: is the queue consumer allowed to drop a message after the final retry?
   Open because the spec describes retries but not what happens when they run out.
   - Dead-letter it (recommended): nothing is lost; needs a dead-letter destination and someone to watch it.
   - Drop and log: no new infrastructure; the message is gone.
   Default: dead-letter, since dropping is irreversible and the spec is silent.
   Cost. Build: dead-letter about a day including the destination; drop-and-log an hour. Reverse: an hour; the consumer isolates this in one function.
   Defer: can wait indefinitely at flat cost; nothing else depends on it.

Details
[analysis, sources read, rejected alternatives]
```
