---
name: interaction-case-sweep
description: Before implementing or changing UI behavior, infer every user-interaction case the request does not mention — cancelled gestures, keyboard and screen-reader paths, conflicting existing behaviors, boundary states, WCAG-required alternatives — and record them in a persistent per-feature ledger under docs/interaction-cases/ so nothing is silently dropped. Use this skill EVERY time the task adds, removes, or meaningfully changes how a user action produces an effect in a UI — gestures (drag, swipe, pinch, long-press), keyboard shortcuts, focus behavior, selection, hover or click handlers, form interaction, navigation transitions, undo, or drag-and-drop. Trigger on phrases like "add a gesture", "make X draggable", "when the user clicks/swipes/holds", "change how X behaves", "add a shortcut", and on any request to sweep or audit existing UI for uncovered interaction cases. Do NOT trigger for pure styling changes that leave interaction semantics untouched.
---

# Interaction Case Sweep

A described UI behavior is almost always one path through a much larger interaction space. "Swipe left to delete" says nothing about what happens when the swipe is abandoned halfway, when the row is already in an error state, when two rows are swiped at once, when the user has no pointer at all, or when the app's existing back-swipe navigation claims the same gesture.

The purpose of this skill is not to make you implement all of those. It is to make sure none of them disappear silently. You enumerate the cases, implement the requested behavior plus a narrow class of safe additions, and write everything else down where the user can find it later.

## When this applies

Apply the sweep when the change alters **when** or **how** a user action produces an effect. That covers new gestures, new shortcuts, changed click or focus handling, drag-and-drop, selection models, form submission behavior, navigation transitions, and undo.

Skip it for changes that leave interaction semantics untouched — colors, typography, copy, spacing. Styling does pull the sweep back in when it changes hit area, focus visibility, or motion, because those are interaction surfaces wearing a style costume.

## Workflow

### 1. Sweep

Read `references/sweep-checklist.md` and walk it against the requested change. The checklist is a prompt for your own reasoning, not a form to fill in — most dimensions will produce nothing for any given change, and that is expected. What matters is that you considered them rather than only the happy path the user described.

Read the surrounding code before deciding what conflicts. Existing handlers, existing shortcuts, and existing gesture regions are where exceptions and incompatibilities hide, and you cannot infer them from the request text alone.

### 2. Classify

Give every case exactly one type:

| Type | Meaning |
| --- | --- |
| **omission** | The described behavior does not say what happens here. |
| **exception** | The change breaks an existing behavior. |
| **incompatibility** | An existing behavior must be adjusted to coexist with the change. |
| **conditional** | Behavior should differ by state or context, and the rule is undecided. |
| **accessibility gap** | A required alternative path is missing. Name the WCAG success criterion. |

### 3. Decide what to implement now

Implement the requested behavior. Then implement an additional case **only if every one of these holds**:

- Its type is **omission** or **accessibility gap**. Exceptions and incompatibilities touch behavior the user already relies on, so they always go to the user as a question.
- Exactly one reasonable resolution exists. If you find yourself weighing two defensible options, that is a product decision and it is not yours.
- It stays inside the files the requested change already touches.
- It adds no dependency, no new visible affordance, and no user-facing copy that someone would want to word differently.
- It does not alter the semantics of what the user asked for.

Everything else is recorded as `open` and reported. When you are unsure whether a case clears the bar, it does not clear the bar — the cost of an unwanted question is far lower than the cost of an unrequested behavior change the user discovers three weeks later.

### 4. Record

Write to `docs/interaction-cases/<feature-slug>.md`, creating the directory if it does not exist. One file per feature, not per change: a second change to the same feature appends to and updates the existing file rather than starting a new one.

```markdown
# Interaction cases — Timeline drag-to-reorder

Feature: drag-to-reorder of clips in the region timeline
Last swept: 2026-07-26

## IC-001 — Drag cancelled by Escape mid-drag
Type: omission
Status: done
Resolution: revert to origin index, no state commit. `TimelineTrack.tsx`.

## IC-002 — Keyboard alternative to drag-reorder
Type: accessibility gap — WCAG 2.5.7 Dragging Movements (AA)
Status: open
Notes: needs a key binding decision; Alt+Arrow collides with the existing zoom shortcut.

## IC-003 — Drag begun while a clip is mid-animation from a previous move
Type: conditional
Status: wontfix
Resolution: animations are under 120 ms; user accepts the race. Revisit if durations grow.
```

Statuses are `open` (no decision yet), `decided` (resolution agreed, not built), `done`, and `wontfix` (deliberately not covered, with the reason).

IDs are stable and permanent. Never renumber and never delete an entry — a case that turns out not to apply becomes `wontfix` with the reason. The ledger's value is that it is a complete record of what was considered, and deletion destroys that.

### 5. Report

End the turn with the open cases, grouped by type, one line each. Say plainly which ones you implemented beyond the request and why they cleared the bar. Do not bury either list inside a longer narrative — the user needs to see the open cases without hunting for them.

## Review mode

When the user asks you to sweep, audit, or check existing UI for uncovered cases without requesting a change, run steps 1, 2, 4 and 5 and implement nothing at all. Every entry lands as `open`. If a ledger file already exists for that feature, update it in place: refresh the `Last swept` date, add newly found cases, and leave existing decisions alone.

## Calibration

The failure mode on one side is a wall of speculative cases that buries the two that matter. The failure mode on the other side is a ledger that only restates the request.

Aim for cases a competent reviewer would agree are real: reachable by a real user, in this codebase, given how the feature is actually used. A case that requires a physically impossible input sequence is noise. A case that requires only a slightly impatient user is not.

Prefer few, specific, and verifiable over many and generic. "What happens on error" is not a case. "The row is in the retry-pending state when the swipe completes, and the delete request would race the retry" is a case.
