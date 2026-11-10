# Session style

How to behave and write during framework work: when to work tactically, how to run a long strategic design session, how much to put in each chat reply, and how to keep the design record.

## Contents

- Tactical and strategic work
- Tactical work with this skill
- Strategic design sessions: behavior
- Chat volume in a design session
- The design record
- Writing style for design artifacts

## Tactical and strategic work

| | Tactical | Strategic design session |
|---|---|---|
| Goal | Ship a working change quickly | Decide something that is expensive to reverse |
| Signals | A bug fix or internal change; a spike or throwaway; "quick", "just make it work"; a deadline | A new or changed published surface, default, extension point, stack layer, or codebase convention; the user asks for options, a design, or an architecture |
| Pace | Act, then report | Explore with the user, then converge |

Decisions that are expensive to reverse get the strategic session; decisions that are cheap to reverse get tactical speed [Bezos]. Tactical here means less process, not less care: Ousterhout's case against tactical programming still holds for the code itself, which keeps receiving small, continual design investments in either mode [APOSD]. The user's explicit word sets the mode. When the mode is not obvious from the request, state the one you are using in one line.

**Scale the process to the change.** When the affected surface is readable in a few files, one consolidated round, with the design delivered alongside the work, serves better than a session of separate decisions; the full session is for changes that cannot be read at once. Ask, or follow the user's stated preference, when it is not clear [Practice-2026-11-5].

**Choices the user owns.** Some working choices belong to the user, not to this skill: where design records live (in the repository, or kept out of it), whether to write documentation files at all without being asked, whether scenarios become tests or checklists for whoever writes the tests, and how decisions are paced. Take them from the user's stated preferences (`judgment-memory.md`), or ask once and record the answer; never write files into a repository that the user did not ask for.

## Tactical work with this skill

- Run method step 1 (locate) only.
- If the change touches no published surface, default, extension point, or constraint, continue tactically without the rest of the method.
- If it does, flag it in one line as hard to reverse: what becomes surface, and the cheapest way to keep it reversible (keep it internal, mark it experimental, add beside instead of changing). Then do what the user asked.
- Do not open a design session the user did not ask for.

## Strategic design sessions: behavior

- **Explore before converging.** Keep at least two options alive until the scenario walkthrough and the weighing have run. Do not settle on the first option that works.
- **No product code during the session** unless the user asks. Prototypes are evidence and live outside the product (`prototyping.md`).
- **Keep the design record** (below) and update it at every decision. It is the session's memory across a long conversation, across context compaction, and across later sessions. Keep its current-state block (`record-check.md`, The current-state block) updated at each decision, and supersede decisions instead of editing them, so the record never needs the conversation to be read correctly.
- **One decision in focus at a time.** Batch only small, related decisions, as a numbered list.
- **Reopen explicitly.** When new evidence contradicts an earlier decision, name the decision and the evidence and propose reopening it. Never let a decision drift silently.
- **Stable vocabulary.** Keep a glossary in the record, one name per concept, and reuse the user's names for their ideas.
- **Park tangents** in the record's parking lot instead of following them.
- **Label every claim's evidence**: measured, researched, reasoned, or assumed.
- **Record who decided.** Each decision records the user's own words and date when the user made it; a decision made without asking names the source that binds it (a standing decision, a gate, a standard); never record a decision from an answer the user did not give. Each open decision carries a recommendation [Practice-2026-11-5].
- **One author per proposal; condensing carries every open decision across.** When a long proposal is condensed or replaced, list its open decisions and carry each one into the new version explicitly; condensing silently closes them otherwise [Practice-2026-11-5].
- **IDs are never reused or renumbered**; if renumbering is forced, keep a mapping.
- **Judge a proposal by what it simplifies or adds**; code that is not built is "not implemented", not a tradeoff.
- **List deviations from the reference**: when a design departs from the current code, the target design, or a predecessor, keep a list of the differences and why.

## Chat volume in a design session

Early in a design, most decisions cannot be certain yet. Attaching a lot of context, background, and reading to each decision makes an uncertain decision look settled, and it slows the person evaluating it. In a design session, keep each reply small so that the person can explore quickly, and let them pull detail when they want it.

- **One decision per reply**: the question; two to four options, one line each (what it is and its main consequence); your current lean, with its confidence and the one fact that would change it; and what you need from the person.
- **Detail goes into the design record**, and the reply points to the section.
- **State uncertainty as what would settle it** ("unknown until the prototype measures allocation per move"), not as paragraphs of hedging.
- **Show options as consumer code** of a few lines where possible; it is the fastest thing to evaluate.
- **Do not pre-answer follow-ups.** The person asks "expand B" or "why" when they want more.
- **Answer a what-if directly.** When the person explores ("what if", "could we"), answer in a few lines and name the scenario or decision it affects; do not rerun the whole analysis.
- **No literature summaries in chat.** Cite the source tag; the principle is in the record or in this skill's references.
- **Converging is different.** When the person asks to decide, or the record shows every input is in, the full comparison table is appropriate: it goes into the record, and the reply carries the verdict and the deciding criterion.
- **Explicit instructions win.** The person's instructions and any rules they set for reply length govern; this section never asks for longer replies than those allow.

## The design record

**Location**: where the user keeps design records (Choices the user owns, above). If the project already has a place for them (a decision-record directory, `docs/design/`) and the user uses it, write there; otherwise propose a location, which may be outside the repository, because some keep decision records out of the code they ship. An exploratory session may keep the record in the scratch directory until the user decides.

**Structure**: start from `assets/templates/design-record.md`: question and context, benefit profile, consumers and top scenarios, glossary, options, scenario walkthrough, evidence, weighing, decisions, open decisions for the user, parking lot. Keep a task log beside it (`assets/templates/task-log.md`) for long sessions.

**Each decision** carries the fields of an architecture decision record [Nygard]: title, context, decision, status, consequences. Add the evidence kind and a "revisit when" line: the condition that would reopen it.

## Writing style for design artifacts

- **Scannable**: a heading per area; tables for comparisons; stable IDs for scenarios, options, and decisions; consumer code in code blocks; one idea per paragraph; a Contents list after the title once a file passes 50 lines, kept current as sections are added.
- **Self-contained**: a decision reads correctly without the conversation that produced it.
- **Plain**: problems stated as what a consumer runs into, not in review jargon.
- **Honest**: every claim carries its evidence kind; an unknown is written as unknown, with what would settle it.
