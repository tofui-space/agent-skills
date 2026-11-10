# Judgment memory

Distill the user's design judgment from their decisions, so that later sessions start from their preferences instead of from generic defaults; and research the user's past framework work, with every finding labeled by where it came from. A designer may build several frameworks precisely because the next one should differ from the last in some respects and not in others, so a preference is always a default to confirm, never a rule to apply.

## Contents

- What a preference is
- When to distill
- How to distill
- Where preferences are kept
- Researching past framework work
- A standards memory, when the user keeps one
- Using preferences and past work
- Keeping it honest

## What a preference is

A preference is a conditional rule observed across several decisions, stated with its scope and provenance:

```
### PREF-<n>: <prefers X over Y when C>

Scope: designer (all frameworks) | framework <name> | ecosystem <name>
Kind: stated (the user said it) | observed (inferred from choices)
Support: D-3 (<project>, <date>), D-7 (<project>, <date>), D-12 (<project>, <date>)
Counter-examples: D-9 (<project>, <date>): <why it went the other way>
Weight effect: <criterion> +1 in <context>, or none
Confirmed by the user: yes (<date>) | no
Revisit when: <condition>
```

Two kinds of preference are distilled:

- **Choice preferences**: which option the user picks for a kind of problem (a problem-map entry, a pattern, a benefit in the profile), and the reason they gave.
- **Weight preferences**: the changes the user made to the default weights or to the benefit profile (`tradeoffs.md`), and the sensitivity decisions they settled.

Preferences stay outside the skill. When one turns out to be knowledge rather than taste (its reason names forces, and outcomes support it, so it would hold for other designers), the user can bring it into the skill itself with the evolve invocation (`evolution.md`).

## When to distill

Distill once there is a critical mass of evidence, and not before:

- the design records hold at least ten decisions, or
- three or more decisions of the same kind point the same way, or
- a design session or retrospective ends, or
- the user asks.

A single decision is not a preference. A preference at designer scope needs support from at least two separate frameworks or design areas; until then it is scoped to the framework it came from. These thresholds are this skill's defaults; the user can change them.

## How to distill

1. **Collect** the decisions from the design records: the options, the choice, the reasons, the evidence kind, the weights used, and any weights the user changed.
2. **Group** them by kind: problem-map entry, criterion, benefit, pattern.
3. **For each group, look for a consistent direction.** Write it as a conditional rule ("prefers X over Y when C"), never as an absolute.
4. **List the counter-examples.** A counter-example with a stated reason usually refines the condition; one without a reason lowers confidence.
5. **Distill weight preferences** from weight changes that appear in at least two decisions.
6. **Show the distilled preferences to the user briefly**, one line each, and record which they confirm, reject, or rescope. An observed preference is a hypothesis until confirmed.
7. **Store them** with their provenance (below).

## Where preferences are kept

- **Framework scope**: in the framework's own repository, next to its design records (for example `docs/design/preferences.md`), because they are part of that framework's opinions.
- **Designer scope**: in the agent's persistent memory, if the environment provides one (for a standards memory, by the writing rules below), or in a file the user names outside any single framework's repository.
- **Never in published artifacts** (the framework's documentation, packages, or examples) unless the user asks: they describe the designer, not the framework.

## Researching past framework work

At method step 3, in addition to external research (`research.md`), look for the user's own earlier decisions, when the user agrees to the search and names or confirms where to look:

| Source | What to extract |
|---|---|
| The current project: design records, decision records, changelogs, migration guides, commit messages, a README's philosophy section | Decisions and their reasons; reversals; conventions in use |
| The user's other framework and library projects on the machine | The same, plus the patterns, layers, and conventions actually used in code |
| The agent's persistent memory and user-level configuration, if they exist | Stated preferences; earlier distilled preferences |
| A standards memory, when the user keeps one (next section) | Standing decisions, gates, lessons with their status and outcomes, project and stack notes |
| Session logs or transcripts the environment keeps, if the user permits | Decisions and reasons that never reached a record; corrections the user made |

Label every finding with its provenance: the source path or session, the project, the date, and whether it was **stated** (written as a decision or said by the user) or **inferred** (read from code or from a pattern of choices). Copy no content from these sources into the new framework's artifacts; extract decisions and reasons only.

Past research notes, findings documents, and design records are **derived** sources, often written by agents: their factual claims about tools and libraries are pointers to recheck against the primary source, and their code snippets are untested until run (`research.md`, Provenance and decay). What they record reliably is what the user decided and why, not whether the facts behind it were right.

## A standards memory, when the user keeps one

Some users keep a standards memory: a private store, often managed by its own skill, of lessons, standing decisions, gates, and notes per project and per stack. Where one exists, it is the richest record of the user's judgment, and this skill exchanges with it in both directions: it reads the memory's lessons as evidence, and it writes its own lessons back when certainty is high. Where none exists, skip this section; nothing else in the skill depends on it.

**Find it** from the skill that manages it, which states where the memory lives and how its entries are formatted, or ask the user once. Before reading or writing anything there, read the memory's own conventions (its skill and any conventions file it keeps): they are the authority for every format, and their rules win over this section wherever they differ.

### Reading: the memory to this skill

| Kind of entry | Take | Certainty |
|---|---|---|
| Standing decisions | Those that touch framework design | Stated: a confirmed preference at designer scope, unless the decision names a project |
| Gates | Those that apply to the change | The user's own non-negotiable rules: each applicable gate becomes gate G5 in `tradeoffs.md` |
| Lessons | Use the memory's index, if it has one, and open only the entries relevant to the task (design, naming and APIs, compatibility, developer experience, security defaults, review) | Processed or confirmed by the memory's own flow, or carrying a recorded outcome: high. Not yet processed: observed, a candidate only. Rejected: never use, and never infer the same preference again |
| Project notes | Context for the current project | Stated |
| Stack notes | Conventions for each stack in use | Stated |
| Deferred questions | Open decisions in the area being designed | Resurface them; do not settle them silently |

A recorded outcome states what reality settled; it outranks reasoning, so treat it as researched or measured evidence. A lesson's status says the user stands behind the rule, not that every fact in it is current: factual premises about tools and libraries inside a lesson are derived, and are rechecked like any other derived claim. Label every finding with the memory, the entry's date, and its project or global scope, and present it like any other past work: per aspect, as a default the user keeps or changes. A standards memory may name projects, organizations, and people; use it for reasoning only, and never copy its text into a framework's artifacts or into this skill.

### Writing: this skill to the memory, only when certainty is high

Write a lesson back only when one of these holds:

- the user stated it in this session;
- the user confirmed a distilled preference (How to distill, step 6);
- reality settled a decision: a retrospective shows it kept after use, or reversed with a stated reason;
- an Evolve lesson reached the grade "repeated" or "measured" (`evolution.md`).

Observed-only, reasoned-only, and single unconfirmed decisions stay in the design record or the preference file; they do not go to the memory.

1. **Check for an existing entry** with the same rule. Do not append a duplicate. If the new evidence settles an existing lesson, tell the user, because only the memory's own flow edits an existing entry.
2. **Append through the memory's own lesson command** when it has one, so the memory keeps its format and index. Otherwise append in the exact format its conventions define: a one-sentence conditional rule, the decision or outcome that produced it (design-record decision ID and date, with the evidence kind and provenance distance of what supports it), the status the memory gives new entries, and an index row where the memory keeps one.
3. **Write only lessons.** Never write gates (propose a gate to the user instead), and never edit standing decisions, engagement levels, or any existing entry.
4. **Report the append** in one line of the reply, with the lesson's text.
5. **Leave committing and syncing** the memory to the user and to the memory's own flow.

### With Evolve

Lessons in the memory that carry outcomes are evidence for Evolve candidates (`evolution.md`, kinds 1 and 3). The private link from a `[Practice-…]` tag back to the projects it came from can live in the memory's project notes, where the memory's conventions allow free edits.

## Using preferences and past work

- **Present inherited choices per aspect**, as defaults to keep or change: "the previous framework chose X for this (source, date); keep it for this one?" The user decides each aspect, because the new framework may deliberately differ to improve on the last one or to take a different opinionated approach.
- **Record the answer** in the new framework's design record, including deliberate differences and their reasons. A deliberate difference scopes the preference: it stops applying at designer scope for that aspect, or gains a condition.
- **In weighing**, apply confirmed weight preferences after the benefit profile and before explicit priorities stated in the session (`tradeoffs.md`), and list each one in the output with its provenance.
- **In generating options**, preferences shape the default option but never remove the alternatives: always include at least one option that departs from an observed preference, so that the session can find out whether the preference still holds.

## Keeping it honest

- An observed preference is not presented as the user's stated view.
- Preferences carry dates; a preference unused for a long time, or contradicted by recent decisions, is marked for review instead of being applied silently.
- When a new decision contradicts a confirmed preference, record the contradiction in the preference entry and raise it at the next distillation.
- Rejected preferences stay in the file, marked rejected, so that they are not inferred again from the same decisions.
