---
name: concise-docs
description: "Write or revise documentation files — specs, API designs, data models, ADRs, READMEs, design docs, closure records — so they are concise, accessible to non-native English readers, and reviewable fast, without losing any technical content. Use this skill EVERY time the task is to create a documentation file, rewrite one for clarity or length, run an editorial pass, add summaries, normalize language, or make a document 'reviewable in X time'. Trigger on phrases like 'write the docs', 'make this reviewable', 'tighten this document', 'editorial pass', 'accessible language', 'plain English version', 'add summaries', or any request to produce a versioned design/spec document. Do NOT use for chat responses, code comments, or marketing copy."
---

# Concise Docs

Produce documentation that a reviewer can check fast and a non-native English reader can parse without re-reading. Concision is achieved by structure and sentence shape, never by deleting technical content.

## Non-negotiable invariant

**Meaning is never lost.** Every rule, constraint, default, enum value, negative decision, exclusion, and deferred item in the source (or in the author's intent) survives into the output. If a sentence cannot be shortened without dropping a decision, keep it long and split it instead.

## Structure

- **Summary line under dense sections.** Any section whose body is long enough that a reviewer benefits from a verdict before the detail gets one line directly under its heading, in the fixed form `**Summary:** …`. The summary states the section's decisive rules, not its topic. A reader must be able to accept the summary and skip the body.
  - Do not add a summary to short sections. A summary restating a three-line section is decoration.
  - A summary must not overclaim. It may only state what the body actually establishes. Watch for these traps: unconditional claims about conditional behavior ("creates X" when only *accepted* requests create X), scope inflation ("every" when the body covers "all current"), and mechanism inflation ("is the erasure mechanism" when it is one step of erasure).
- **One idea per unit.** One rule per sentence. One rule per bullet. Split any sentence that chains independent decisions with semicolons.
- **Prose sections state their own connections.** In narrative or rationale prose — not itemized rules — state the relationship between adjacent related facts with an ordinary connective ("because", "so", "which", "since") instead of leaving bare declarative sentences for the reader to infer the link between. The same applies at paragraph scale: a paragraph's opening sentence must connect explicitly to what came before it, not restart as if unrelated. Does not apply to itemized rules or bullets, where one idea per sentence stays absolute.
- **Formatting matches content shape.** Column definitions, enums, and comparisons stay tables. Flows and hierarchies stay diagrams. Rule sets become bullet lists. Reasoning stays prose. Never convert a table to prose to "save space".
- **Announce size only for ordered procedures** ("in this order (6 steps):"). Plain rule lists use an uncounted label ("Constraints:", "Rules:") — counts on unordered lists go stale and add review burden.
- **Negative decisions stay explicit and separate.** "The following do not exist:" followed by one bullet per exclusion. Never compress several exclusions back into one dense sentence, and never delete one because it feels implied.

## Language

- **One English variant, applied consistently.** Default to international/US spelling in prose (organization, behavior, artifact, catalog, canceled, localization, enrollment, normalized).
- **Keyboard-typable symbols only.** Every character must be reproducible by a reviewer typing on a standard keyboard, with no compose key or special input method. Use straight quotes, a three-dot ellipsis, a plain hyphen, and a regular space. Never an em dash, en dash, curly quote, ellipsis character, or non-breaking space.
- **Never respell what code depends on.** Identifiers, enum literals, paths, table and column names, and established domain entity names keep their exact spelling everywhere, including when British-spelled (`organisation_id`, `cancelled`, `OrganisationWebhook`). Anything in backticks or code fences is untouchable.
- **Plain lookupable vocabulary.** No idioms, no coined terms, no figurative phrasing a reader must infer from context. Where a literal phrasing exists at equal length, use it. Name database and API operations literally ("rows are not updated or deleted", not "rows are never touched").
- **Front-load sentences.** Key noun or verdict first, qualifiers after. Short sentences, full grammar — cut content-free words, never articles or pronouns.
- **Cross-reference instead of restating.** Refer to the section that owns a rule ("follows the retention rules in §11") rather than paraphrasing it in place. Paraphrases drift; references cannot.

## Code and examples

- **Language-tag every fenced code block.** No fence without a language identifier.
- **Fake values look fake and stay pasteable.** Token and credential placeholders use descriptive `snake_case` text a reader can double-click to select (`your_access_token_here`), never `<TOKEN>`, `xxx`, or generic `ALL_CAPS`. Placeholder numbers count up in an obviously fake sequence (`1234567890123`).

## Review economy

- **Remove duplicated traceability when a mapping exists elsewhere.** Inline requirement tags and spec citations multiply review volume. If the project keeps a separate requirements mapping, drop per-bullet tags. If it does not, keep them — provenance beats brevity.
- **Wording-only passes say so.** When an edit changes phrasing but not the contract, state it in the header ("vX.Y changes wording only; the contract is identical to vX.Z"). This lets a reviewer diff instead of re-read.
- **Version on every change, and never let a claim of wording-only change become false.** Any edit that changes the meaning removes or updates that claim.

## Editorial passes on existing documents

When revising rather than authoring:

1. Preserve section order, tables, diagrams, endpoint lists, and overall structure.
2. Do not add, remove, merge, or reinterpret any technical element (endpoints, entities, columns, constraints, enums, defaults, deferrals).
3. Apply the Structure and Language rules above to prose only.
4. Verify mechanically before finishing: search for the old spellings outside backticks, for leftover semicolon-chained rule sentences, for counted unordered lists, and for em dashes, curly quotes, or ellipsis characters outside backticks. A claimed cleanup that greps dirty is not done.

## Self-check before delivering

- Does every dense section have a Summary line, and does every Summary hold up if the reader stops there?
- Can any Summary be falsified by its own section body? (Fix the Summary, not the body.)
- Is any decision, exclusion, or deferral from the source missing?
- Any semicolon chaining two independent rules?
- Any respelled identifier, enum, or path?
- Any idiom or coined term a non-native reader would need to infer?
- Any character that is not keyboard-typable (em dash, curly quote, ellipsis character, non-breaking space)?
- Read each prose section once at pace: can you name the subject, the action, and the consequence without re-reading?
- Any fenced code block missing a language tag, or any placeholder that is not a descriptive, obviously fake value?
