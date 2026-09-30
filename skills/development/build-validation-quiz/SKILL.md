---
name: build-validation-quiz
description: Turn "did my changes land?" into a structured validation pass. After Claude has made changes the user must check by hand, this skill builds a list of user-observable changes and asks about them with AskUserQuestion — one multiple-choice question per change, or a single multi-select checklist when there are many — then records the verdicts back into the project's task or plan file. Use this whenever the user asks to validate, verify, sign off, review, or QA a build or a set of changes; on phrases like "did these land", "quiz me on the changes", "validation pass", "checklist for what you changed", "I tested it, let's go through them"; and whenever CLAUDE.md or a project instruction tells Claude to run a validation quiz after implementing. Do not use it to ask whether a plan looks good, or to fish for general feedback.
---

# Build Validation Quiz

The user is the only one who can confirm that a change landed in the way they wanted. Claude can run tests and read diffs, but it cannot see the UI render, hear the audio, or feel whether the interaction is right. This skill makes that handover explicit: Claude states what to check, the user answers a structured question per change, and every failure is written back into the task file with what was tried, so the next attempt does not start from zero.

Run it only when the user asks for it or a project instruction requires it. It is a checkpoint, not a reflex after every edit.

## Step 1 — Build the change list

List one item per **user-observable change**, not per file and not per commit. A three-file refactor that produces one visible behaviour is one item. One file that changes three behaviours is three items.

Sources, in order:

1. What Claude did in this session (its own work log).
2. `git diff` / `git status` against the pre-session state, for anything the session log missed.
3. The task or plan file, if the work was driven by one.

Drop from the list:

- Pure internal refactors with no observable effect — unless a test or command proves them, in which case run it yourself and report the result instead of asking.
- Anything Claude has already verified end to end and the user cannot check more directly.

If nothing observable changed, say so and stop. Do not manufacture questions.

## Step 2 — Write the check instructions before asking

The AskUserQuestion dialog is small, and the user may be reading it away from the terminal. Print the checks as normal text **before** calling the tool, one line per item:

```
1. Consent banner — open http://localhost:5173 in a private window. Banner should appear bottom-left, focus trapped inside it.
2. Reject-all — click "Reject all". Banner closes, no `_cmp` cookie is written.
3. Keyboard — Tab through the banner. Every control reachable, visible focus ring, Esc does nothing.
```

Each line states: what changed, where to look, what "correct" looks like. Without the expected outcome the user cannot fail an item, only feel unsure.

## Step 3 — Pick the format

Judge per case. Two shapes:

**Per-change questions.** Use when items are few, independent, or need a verdict richer than yes/no — partial success, wrong-but-close, regression elsewhere.

```
AskUserQuestion, one question per change:
  header:   short label, e.g. "Consent banner"
  question: "Does the banner appear bottom-left with focus trapped inside it?"
  options:  "Landed" / "Partially — wrong position" / "Not landed" / "Didn't check"
```

**One multi-select checklist.** Use when items are many and each verdict is binary. One question, `multiSelect: true`, one option per change, ticked = validated.

```
AskUserQuestion, single question:
  question:    "Tick everything that works as described above."
  multiSelect: true
  options:     one per change, label = the item title from step 2
```

Tool limits: keep to at most 4 questions per call and 4 options per question. If a call is rejected as too large, split it into several calls grouped by area rather than dropping items. The user always gets an "Other" row for free text — never add one as an option.

Option-writing rules:

- Options are verdicts on the change, never opinions about Claude's work. "Not landed", not "needs improvement".
- Always include an explicit "Didn't check" in per-change questions. Silence is not a pass.
- No "(Recommended)" marks. There is no correct answer to a validation question.

## Step 4 — Resolve the ambiguous answers

An unticked checkbox is ambiguous: it can mean broken or not looked at. After a multi-select round, follow up on the unticked items only, with one question that separates the two ("Failed" / "Didn't check yet"). Do not assume.

For anything reported as failed or partial, ask for the specific symptom before touching code — what happened instead of the expected outcome. One question, or plain prose if the answer needs detail.

## Step 5 — Record the verdicts

Find the project's task or plan file: `PLAN.md`, `TASKS.md`, `tasks.md`, `TODO.md`, or whatever the repository actually uses. Check `CLAUDE.md` first if it names one.

For each **failed or partial** item, reopen its task and append an attempt entry. Append — never rewrite or delete earlier attempts. The history is the point: it stops the next attempt from repeating a fix that already failed.

```markdown
- [ ] Banner focus trap
  - Attempt 1 (2026-07-26): added `inert` to the page wrapper. Validation: focus
    still escapes to the header nav on Shift+Tab. Next: check whether the wrapper
    is an ancestor of the header.
```

Each entry states three things: what was changed, what the user reported, and the next hypothesis. Keep it to a few lines.

For **validated** items, tick the task. No attempt entry needed.

If the repository has no task or plan file, keep the same structure in the session context and say explicitly that it is not persisted.

## Step 6 — Summarise and stop

Report the counts and the failures, then wait for direction. Do not start fixing unless the user asks or CLAUDE.md says to.

```
4 of 6 validated. Failed: banner focus trap, reject-all cookie.
Logged both to TASKS.md with attempt notes.
```

## What this skill is not

- Not a feedback survey. Never ask "does this look good?", "are you happy with this?", or anything answerable without the user having actually looked.
- Not a substitute for tests. If a check can be automated, automate it and report the result; only ask the human about what a human must judge.
- Not a plan review. Use plan mode for approving an approach before implementation.
- Not self-certification. Claude's own verification never marks an item validated.
