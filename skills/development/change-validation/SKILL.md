---
name: change-validation
description: Establish whether changes actually landed, by walking the user through checking each one and recording the verdicts. After making changes the user must check by hand — GUI tweaks, layout, audio, interaction, anything Claude cannot observe — confirm the user is running the current build, list what to check, ask about each change with options drawn from that change's plausible failure modes, then write the outcomes back into the project's task or plan file. Use whenever the user asks to validate, verify, check, sign off, or QA changes; on phrases like "quiz me", "quiz me on the changes", "did these land", "I ran it, let's go through them", "validation pass"; and whenever CLAUDE.md or a project instruction requires validation after implementing. Do not use it to review a plan or to fish for general feedback.
---

# Change Validation

Claude cannot see the UI render, hear the audio, or feel whether an interaction is right. The user can. This skill is the handover: it turns "did my changes land?" into a per-change verdict with a diagnosis attached, and leaves the task file holding what was tried and what happened.

The value is in the *shape* of the answers, not in asking. A change that fails with "nothing happens" points somewhere different than one that fails with "wrong direction". Design the checks so the user's answer narrows the cause.

Run this when the user asks or a project instruction requires it. It is a checkpoint, not a reflex after every edit.

## Step 1 — Confirm the user is on the current build

Every later answer is worthless if the user is looking at a stale build. Establish this first, before any behaviour question.

Use whatever marker the project has: a build number or commit hash stamped in the UI, a version line in the log, a startup banner. If there is none and the changes are visual, add one — a build counter in a corner is a few lines and it rules out cache, stale bundle, and wrong-window confusion in a single question.

If the marker cannot be confirmed, stop and fix that first. Do not proceed on "probably".

```
Bottom-left tag should read 32. Does it?
  → Yes  /  It reads something else  /  I don't see a tag
```

## Step 2 — List what to check

One item per **user-observable change**, not per file and not per commit. A three-file refactor producing one visible behaviour is one item. One file changing three behaviours is three items.

Sources: what Claude did this session, then `git diff` for anything the session log missed, then the task file if the work was driven by one.

Leave out pure internal changes with no observable effect. If a test proves them, run it and report the result rather than asking.

If nothing observable changed, say so and stop.

## Step 3 — Derive the options from the failure modes

This is the part that carries the diagnosis. For each item, work out how that specific change could plausibly fail, and make those the options. Generic verdict scales ("works / partially / broken") throw away the information.

Example — a quantity stepper where tapping "+" should increase the count by one:

```
Tap the + button on the quantity stepper. What happens?
  → Count goes up by 1
  → Nothing happens
  → It goes up, but by the wrong amount
  → It goes down instead
```

Each option maps to a different cause: correct; the tap never reaches the handler; step size wrong; sign inverted. One answer eliminates three hypotheses.

Include **control checks** — cases where the correct outcome is that nothing changes. Tapping "+" while already at the maximum should do nothing; asking about it catches an over-eager fix that now fires everywhere. A change that "works" and a control that also fires means the boundary check is missing.

Options are verdicts on observed behaviour, never opinions about Claude's work. No "(Recommended)" marks: there is no correct answer to a validation question. Always leave the user a way to say they did not check — silence is not a pass.

## Step 4 — Print the checks before asking

The question dialog is small and the user may be reading it away from the terminal. Print the checks as text first, one line each: what changed, where to look, the exact interaction, the expected outcome.

```
1. Build tag — bottom-left of the toolbar, should read 32.
2. Stepper + — tap the + button. Count increases by 1.
3. Stepper − − tap the − button. Count decreases by 1.
4. Stepper at max — increase to the maximum, then tap + again. Nothing should change.
```

Without a stated expected outcome, the user can only feel unsure, not fail an item.

## Step 5 — Collect the verdicts

Judge the rendering per case:

- **One question per item** when items are few, or when the failure modes differ per item and the distinction matters. This is the default for interaction and GUI work.
- **One multi-select checklist** when items are many and each is genuinely binary. Ticked means validated.
- **A numbered list answered in one message** when the interface offers no structured input.

Batch questions in as few rounds as the interface allows; if a batch is rejected as too large, split it by area rather than dropping items.

An unticked checkbox is ambiguous — broken or not looked at. Follow up on the unticked items only, separating the two. Do not assume.

## Step 6 — Diagnose before touching code

Read the answers as a set, not one at a time. The pattern across items usually identifies the cause faster than any single answer.

From the example above: + does nothing, − does nothing, the max-boundary control correctly does nothing. Three "nothing"s in a row is not three bugs — the stepper is not receiving taps at all. Chasing the increment arithmetic would waste the round.

State the hypothesis before editing. If the answers do not distinguish between two causes, ask one more targeted question rather than guessing.

## Step 7 — Record the verdicts

Find the project's task or plan file — `PLAN.md`, `TASKS.md`, `tasks.md`, `TODO.md`, or whatever the repository uses. Check `CLAUDE.md` first if it names one.

For each failed or partial item, reopen its task and **append** an attempt entry. Never rewrite or delete earlier attempts: the history is what stops attempt 3 from repeating what failed in attempt 1.

```markdown
- [ ] Quantity stepper tap-to-increment
  - Attempt 1 (2026-07-26): added onTap handler with increment/decrement split.
    Validation: build 32 confirmed; no response on +, −, or the max-boundary control.
    Diagnosis: taps are not reaching the stepper at all, not a sign or step error.
    Next: check whether the parent view is intercepting the touch event.
```

Three things per entry: what was changed, what the user reported, the next hypothesis. Tick validated items; they need no entry.

If the repository has no task or plan file, keep the same structure in the session and say explicitly that it is not persisted.

## Step 8 — Summarise and stop

Counts, then the failures, then wait. Do not start fixing unless the user asks or CLAUDE.md says to.

```
Build 32 confirmed. 1 of 3 validated.
Failed: stepper +, stepper − — taps not reaching the handler.
Logged to TASKS.md.
```

## What this is not

- Not a feedback survey. Never ask "does this look good?" or anything answerable without having looked.
- Not a substitute for tests. Automate what can be automated; ask the human only about what a human must judge.
- Not a plan review. Approving an approach happens before implementation, not here.
- Not self-certification. Claude's own verification never marks an item validated.
