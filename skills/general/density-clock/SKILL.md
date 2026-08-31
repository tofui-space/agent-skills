---
name: density-clock
description: Proactively scales the information density of chat responses to the local time of day, protecting the reader's finite daily cognitive budget — full explanatory depth in the fresh morning hours, answer-first by midday, essentials-only in the saturated late afternoon, minimal-but-complete in the evening. Invoke on the FIRST turn of EVERY session and keep it active every later turn, without being asked and without re-deciding per turn. Also invoke immediately on "density-clock" or "/density-clock" — including "/density-clock on" and "/density-clock off", the session-scoped toggle — or on any remark that the reader is tired, saturated, fried, overloaded, or has had a long day. Reads the clock from timestamps already in context or from the `date` command; personal phase boundaries come from a local config file that never leaves the machine. Any explicit user instruction about length or depth overrides the clock, in either direction, for as long as it stands. Shapes chat prose only — never code, file contents, commit messages, or documents written for use elsewhere — and never reduces correctness, verdicts, or decision-changing caveats.
---

# Density Clock

Scales how much a response *says* to how much the reader can still *absorb*. A knowledge
worker's capacity to take in new information is not flat across a day: it is high in the
morning, dips after midday, and by late afternoon most readers are past the point where
added context helps — every extra paragraph costs more than it delivers. This skill reads
the clock and adjusts prose density accordingly, so the reader does not have to notice
their own fatigue and ask to adjust the information density.

## Why this exists

A reader can tell an assistant to "keep it concise" — but the moment that request becomes
necessary is exactly the moment the reader is too depleted to notice it is necessary.
Cognitive saturation is invisible from the inside: comprehension quietly degrades,
re-reading increases, mistakes and mix-ups follow, and the reader keeps scrolling anyway
because stopping is not an option in the middle of a workday. The fix has to be
proactive. The clock is a crude but honest proxy for accumulated load: nobody at 17:30
has read *less* than they had at 09:00.

The skill is asymmetric on purpose. In the morning it changes almost nothing — extra
context read on a fresh brain is cheap and often compounds. Every reduction it applies
later in the day comes from the optional layers of a response, never from its substance.

## Reading the clock

Establish the current local time before shaping the first substantive response, in this
order of preference:

1. **Timestamps already in context.** Many environments inject the local time into
   system messages, hook output, or tool results. Use one from the current turn, or an
   older one only within the same ~30-minute staleness window that governs re-checks —
   it is free.
2. **The system clock.** Run `date '+%H:%M'` once. Do not run it again every turn:
   estimate drift from the conversation's own activity, and re-check only when the
   estimate is stale (roughly 30+ minutes of session activity) or close to a phase
   boundary.
3. **Unknown.** If no time can be obtained, behave as if it were morning — full density.
   Never guess a *reduced* mode: withholding depth from a fresh reader on a wrong guess
   is worse than giving a tired reader one verbose answer.

A long session crosses phases. When the clock moves into a later phase mid-session, the
next response adopts the new density.

## Phases

Defaults follow the widely observed alertness curve (morning peak, post-lunch dip,
afternoon slump, evening depletion). All boundaries are configurable — see the next
section.

| Phase     | Default start | Density                                                                                                  |
|-----------|---------------|----------------------------------------------------------------------------------------------------------|
| fresh     | 05:00         | **Full.** Normal answers plus relevant background, alternatives, and teaching where useful.              |
| steady    | 11:00         | **Standard.** Answer first; background only where it changes a decision.                                 |
| dip       | 13:30         | **Reduced.** Verdict plus minimum supporting reasoning; alternatives named, not explained.               |
| saturated | 15:00         | **Low.** Verdict plus decision-changing caveats only; everything optional collapses into one offer line. |
| overtime  | 19:00         | **Minimal.** The shortest complete correct answer; at most one line offering depth.                      |

`overtime` runs until `fresh` begins again. Someone genuinely working at 23:00 gets the
tersest competent help available.

## Personal configuration

Phase boundaries vary by person and by schedule (night workers exist). The skill reads an
optional config file at `$XDG_CONFIG_HOME/density-clock.json`, falling back to
`~/.config/density-clock.json`:

```json
{
  "phases": {
    "fresh": "06:00",
    "steady": "10:30",
    "dip": "13:00",
    "saturated": "14:30",
    "overtime": "18:00"
  },
  "notice": true
}
```

Every key is optional; missing keys keep their defaults. `notice` opts in to the
one-time mode notice described below; it is off by default.

This file is personal data and stays personal:

- Read it at most once per session, silently.
- Never quote, summarize, or restate its values in a response, a commit, a log, a memory
  file, or any generated document. Acknowledging that a config loaded is fine;
  reproducing what it says is not.
- Never copy it, or values derived from it, into anything that could be committed,
  published, or sent to an external service.
- Never write to it unless the user explicitly asks for their config to be updated.

## What each density level means

Density is a property of the prose, applied after the work is done. Concretely:

- **Full** — the complete answer, plus context that helps it stick: why it works,
  what the alternatives were, what to watch for later.
- **Standard** — the complete answer, led by the verdict. Background appears only where
  it would change what the reader does next.
- **Reduced** — verdict, then the single strongest supporting reason. Alternatives and
  edge cases are named in a compact list without elaboration.
- **Low** — verdict and any caveat that changes the decision. Everything else — trade-offs,
  history, alternatives, examples — collapses into one line: "More: trade-offs, edge
  cases — ask."
- **Minimal** — the shortest response that is still complete, correct, and in full
  sentences. One optional offer line at most.

Reduction always removes whole optional topics, in this order: teaching context first,
then alternatives, then supporting reasoning. Headers and labels stay at every level —
structure is what keeps material scannable and skippable, so cutting it raises reading
effort instead of lowering it. Reduction never removes parts of the substance.

## Overrides — the user always wins

Any explicit instruction about length, depth, or detail beats the clock, in either
direction, and holds until countermanded:

- "Explain this properly, take your time" at 17:00 → full density, regardless of phase.
- "Shorter" at 09:00 → tighter than the phase calls for.
- A stated reading-time or word budget → that budget governs; the clock stays out of it.

The clock is the default, never a ceiling the user has to argue with. If the user asks
why a response was short, say so plainly and re-answer at full density.

The clock is also the lowest-precedence layer among instructions: when any other active
instruction or skill governs the same prose — its structure, its clause density, an
explicit budget — that instruction wins over the clock on any point of direct conflict.

## Toggle

- `/density-clock off` — suspend all clock-driven shaping for the rest of the session;
  responses return to normal density.
- `/density-clock on` — re-arm the clock from the next response.
- `/density-clock` alone — answer in one line: whether the clock is on and the current
  phase.

The toggle is session-scoped and writes nothing anywhere — a new session always starts
with the clock on. Acknowledge a toggle in one short line, then move on.

## The mode notice

Off by default: the notice names the reason answers got terse, and a shared transcript
should not reveal the reader's schedule unless they chose that. When the config sets
`"notice": true`, prepend one short line, at most **once per session**, on the first
response shaped by a `saturated` or `overtime` phase:

> Low-density mode (late day) — keeping this brief; ask for depth anytime.

Then never mention it again that session. No repetition, no health commentary, no advice
to stop working — the reader knows their own constraints, and moralizing at a depleted
reader is itself an unwanted cognitive load.

## Floors — what never changes with the clock

- **The work itself.** Density shapes what is *said*, never what is *done*. Checks are
  still run, edge cases still considered, errors still investigated at full diligence at
  any hour. A terse report of thorough work — never thin work.
- **The verdict.** Every response still answers the question.
- **Decision-changing caveats, warnings, and error details.** These are substance, not
  depth.
- **Grammar.** Full sentences at every level. Telegraphic fragments raise reading
  effort, which defeats the point.
- **Accuracy.** Never round a fact, drop a qualifier, or overstate confidence to save a
  line.
- **Completeness of structures.** Steps in a procedure, items in a checklist, and stages
  in a flow are content; what shrinks is the commentary around them.

When a correct answer genuinely cannot be short, say so in one line and give it the
length it needs.

## Privacy

The clock reading, the config, and any inference about the reader's state exist for
formatting only, for this session only:

- Never record, log, or persist an assessment of the user's fatigue, schedule, or
  working hours anywhere.
- Never mention the time of day, the active phase, or the user's schedule in commits,
  documents, code comments, or anything leaving the session — the opt-in mode notice
  in chat is the single exception.
- Never send the time, the config, or anything derived from them to an external service.

## Scope

The one and only thing this skill shapes is **prose written into the chat for the reader
to read now**. Everything that outlives the chat message, executes, or is consumed by
anything other than the reader's eyes in this session is out of scope and identical at
every hour:

- code, code comments, tests, and error messages inside code
- file contents of any kind — source, config, documentation, README text
- commit messages, PR descriptions, issue text, changelog entries
- generated documents, reports, and anything the user asked to be written for use
  elsewhere
- tables, diagrams, and tool output reproduced for the reader

If a response mixes both — a paragraph of chat prose around a code block — the clock
shapes the paragraph and leaves the code block exactly as it would be at any other time.
If the user specifies a size for requested content ("about 200 words"), that
specification is authoritative for that content regardless of phase.
