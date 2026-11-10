# Evolving this skill from practice

Frameworks can be pioneering work. A designer may settle questions the literature has not settled, or strengthen practices this skill states only weakly. This file describes the **evolve** invocation: in a mature project, on the user's request, turn what the project's own record shows into changes to this skill's weights, knowledge, and defaults, labeled as practice rather than literature.

Evolve changes the skill itself. It is different from Distill (`judgment-memory.md`), which records the user's preferences outside the skill. A preference is taste: it holds for this designer. A lesson is knowledge: it would hold for another designer facing the same forces. Only lessons enter the skill.

## Contents

- Invocation
- Maturity check
- Evidence to collect
- Finding candidate lessons
- Preference or lesson
- Checking the literature
- Writing the change
- Proposing and applying
- Grades and provenance
- Guarding against overfitting

## Invocation

Run only when the user asks: "evolve the framework-design skill", "/framework-design evolve", "teach the skill from this project", or an equivalent request to improve the skill's weights, knowledge base, or defaults from their own work. Never on the session's own initiative.

## Maturity check

A project is mature enough when its record shows outcomes, not only intentions:

- at least one release of the framework;
- design records with at least ten decisions that carry reasons;
- at least one retrospective log (`retrospective.md`), so that some decisions have been revisited after use.

These thresholds are this skill's defaults; the user can lower them, for example for a pioneering project with few but well-documented decisions. If the project falls short, say which records are missing and stop.

## Evidence to collect

- Decisions with their options, weights, sensitivity results, and reasons (design records).
- Outcomes: decisions later kept, reversed, or superseded, and why; retrospective candidates and their classifications.
- Distilled preferences and their counter-examples (`judgment-memory.md`).
- Scenario sets and walkthrough results, prototype findings and measurements.
- Compatibility incidents: breaks that reached consumers, deprecations that had to be extended.
- Enforcement data: checks added, checks suppressed often, checks that caught real violations.
- Method friction: steps of this skill that were skipped without harm, and missing steps whose absence caused rework (the task log shows both).

## Finding candidate lessons

Look for five kinds of evidence:

1. **A default that lost.** The skill's default or weight ranked an option first; the user chose another; the outcome confirmed the user's choice. Evidence that a weight, gate, or default is wrong under some condition.
2. **A recurring problem with no entry.** The same kind of problem came up at least three times, and the problem map had no entry for it.
3. **A recurring weight change with good outcomes.** The user adjusted the same weight the same way in several decisions, and the outcomes held. Consistency alone is a preference; consistency with confirmed outcomes may be a lesson.
4. **An invented pattern.** The user devised a solution to a class of problems that the literature and the pattern research (`pattern-comparison.md`) did not offer, and it held up in use.
5. **Method friction.** A step that never paid off, or a missing step that caused rework.

## Preference or lesson

For each candidate, state its condition and ask whether it would hold for a different designer, team, or domain facing the same forces:

| Signal | Classify as |
|---|---|
| The reason given is about the designer's taste or habits, or no outcome supports it | Preference: record it with `judgment-memory.md`, not in the skill |
| The reason names forces (consumers, change patterns, platform features, constraints) and an outcome supports it | Lesson candidate |
| It contradicts a literature-backed entry and an outcome supports it | Lesson candidate, recorded as an alternate direction with its condition, beside the literature entry |

## Checking the literature

Before writing a lesson, research whether it is already known, possibly under another name (`research.md`). If it is, cite the existing source and strengthen the entry instead of adding a new one. If it contradicts the literature, keep the literature's position in place and add the lesson as an alternate direction with the condition under which it won and the outcome evidence. Never delete a literature-backed entry because one project went the other way.

## Writing the change

The skill is reusable and may be shared, so a lesson enters it in generic form:

- **A conditional rule**: "prefer X over Y when C", with the forces it resolves, never an absolute.
- **No identifiers from the project**: no project, product, team, or person names, no paths, no domain-specific terms that would let a reader recognize the project.
- **Examples re-domained** into a neutral domain unrelated to the project.
- **Placed where the method will find it**: a weight or gate change in `tradeoffs.md`; a new problem-map entry, or a new alternative under an existing one; a principle in `principles.md`; a red flag in `cheat-sheet.md`; a section in `domains.md`, `language-cultures.md`, `stacks.md`, or `ui-frameworks.md`; a template field in `assets/templates/`; a method step in `SKILL.md`.
- **Consistent**: a promise added to one file is kept everywhere it is referenced, the description still matches the body, and every file longer than 50 lines has a current Contents list.

## Proposing and applying

1. Present the proposed changes as a list: the file, the entry, the change, the evidence, and the grade. Keep each to one or two lines; the full evidence goes into the evolution log.
2. Apply only the changes the user approves, one decision per change.
3. Edit the skill's source, not an installed copy: an installed copy is overwritten on the next install. If the source cannot be found, write the approved changes as a patch file and give the user its path.
4. Record each applied change in `evolution-log.md`.
5. Check: every source tag used is defined in `sources.md`, every referenced file exists, and nothing written names the project. Run the privacy check the skill's catalog provides, if any.

## Grades and provenance

Each practice-derived entry carries a source tag of the form `[Practice-YYYY-MM-n]`, defined in `sources.md` with its grade and a one-line generic description, and an evidence kind from the ladder in `SKILL.md`:

| Grade | Meaning |
|---|---|
| Candidate | Seen in one project; recorded in `evolution-log.md` only, not yet in the main files |
| Repeated | Seen in at least two projects, or in at least three decisions of one project with outcomes; may enter the main files |
| Promoted | Entered the main files on the designer's explicit decision, ahead of repetition, for pioneering work; labeled as such |
| Measured | Supported by before-and-after measurements, for example change locality, surface size, or breaking changes per release, whose commands and outputs are recorded or were rerun in this session; a measurement known only from a summary is "derived" and does not earn this grade |

The link from a practice tag back to the actual projects and decisions is private: keep it outside the skill, in the user's own memory (the project notes of a standards memory, `judgment-memory.md`) or a file the user names, so that the skill can be shared without disclosing the work it learned from. Lessons that reach "repeated" or "measured" also go to the standards memory as described there.

## Guarding against overfitting

- One project is one sample. Candidates wait for repetition unless the user promotes them.
- A lesson that only fits one domain goes into that domain's section, not into the general defaults.
- When a later project contradicts a practice entry, record the contradiction in the evolution log and narrow the entry's condition; demote it to candidate if the contradiction stands.
- Re-run the worked example and the sensitivity check in `tradeoffs.md` after any weight change, and report whether earlier recorded decisions would now rank differently.
