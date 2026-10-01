# Workbench

Skills that are started but not landed, and the decisions already made about them.

Git already knows which skills exist and which are committed. What it cannot tell you is how far a
half-finished skill got, and — more importantly — **what was already decided about it**, so a session
picking it back up does not relitigate a choice, re-run a review, or re-grind a description that was
deliberately left as it is. That is what this file is for.

Only in-flight work belongs here. When a skill lands, delete its section; the catalog is the record
from then on.

## Stages

| Stage | Done when |
|---|---|
| **Scope** | Purpose and trigger set are settled — frontmatter carries a real description, not a placeholder. |
| **Draft** | Body written and consistent with the description: nothing promised in the frontmatter is missing from the body. |
| **Review** | `skill-final-review` has run and every finding is applied or explicitly declined — recorded below either way. |
| **Seal** | `python -m scripts.privacy_scan <skill-dir>` exits 0 (run from the `tofui-skill-creator` directory) and the seal report was given. |
| **Land** | Committed. `git ls-files skills/<category>/<name>` finds it. |

Off the critical path, both opt-in: **evals** (test runs, benchmark, viewer) and **description
optimization** (`python -m scripts.sealed run-loop`). Recording a *no* for these is as useful as a
yes — it stops the question being asked again.

## In flight

`✓` done · `·` not done · `?` unknown, needs checking

| Skill | Cat | Scope | Draft | Review | Seal | Land | Next |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| [skill-final-review](#skill-final-review) | tofui | ✓ | ✓ | ? | ? | · | land it first — see note |
| [dont-waste-your-time](#dont-waste-your-time) | general | ✓ | ✓ | ✓ | ✓ | · | commit |
| [context-starvation](#context-starvation) | general | ✓ | ✓ | ? | ? | · | land with its paired rule |
| [stop-fucking-around](#stop-fucking-around) | general | ✓ | ✓ | ? | ? | · | review; description is long |
| [take-my-word-for-it](#take-my-word-for-it) | general | ✓ | ✓ | ? | ? | · | review, seal, land |
| [unconvinced-review](#unconvinced-review) | development | ✓ | ✓ | ? | ? | · | delete stray build artifact; review |
| [comment-driven-development](#comment-driven-development) | development | ✓ | ✓ | · | ✓ | · | review; decide on evals; land |
| [grill-with-specs](#grill-with-specs) | development | ✓ | ✓ | ✓ | ✓ | · | land |
| [gitbutler-readonly](#gitbutler-readonly) | development · rule | ✓ | ✓ | ✓ | ✓ | · | land; two findings deferred on purpose |
| [gitbutler-sorting](#gitbutler-sorting) | development | ✓ | · | · | · | · | run probe 3, then draft |

The `?` marks were inferred from the filesystem on 2026-09-13, not from records. Treat them as "no
evidence either way" and check rather than assume.

---

### skill-final-review

`tofui` · drafted 2026-08-31 · body 2036w · description 98w

Highest leverage of the batch: it is not installed anywhere, so any session wanting it has to find it
in this repo and follow it by hand. Landing and installing it makes the Review stage above cheap for
every other entry here.

It has also never been run on itself.

**Decided** — do not reopen:

- **Report format is rendered markdown with numbered findings (2026-09-21).** The claude.ai-synced copy
  under `<config>/skills/synced/` carried an older draft: one code fence, no IDs, each finding a
  single dash-joined line, which a terminal clips rather than wraps. The repo format (B1/N1 IDs,
  Risk/Fix bullets, ten-word quote cap) was tightened further: the quote cap also applies to the
  counterpart cited in a conflict finding, Risk and Fix are one or two sentences, front labels are
  the six front names only. The synced copy was overwritten with the repo file so it takes effect
  now, but the next sync from claude.ai reverts it until the skill is re-uploaded there.

**Left:** re-upload to claude.ai, run it on itself, seal, land, install.

### dont-waste-your-time

`general` · drafted 2026-09-08 · body 2077w · description 174w

**Decided** — do not reopen:

- **Evals: declined.** The output is a verdict call, not a verifiable artifact; assertions would
  measure whether it fired, not whether firing was *right*, and the same for staying quiet.
- **Stop-vs-ask splits by whose idea the work was.** Self-generated tangents get stopped unilaterally
  and reported in one line; work the user asked for gets a four-line verdict and hands the decision
  back. Bounded by whether dropping it changes what the user receives.
- **Description accepted at 174w** against a corpus max of 157w. It carries two anti-trigger classes
  plus the "stays quiet when there is no cheaper route" condition, which is routing information and
  cannot move to the body.
- **Review findings B1, B2, N1, N3 applied** — tangent-branch boundary, precedence section,
  unattended-run clause, merged the two premature-work tells.

**Left:** commit. Nothing else.

### context-starvation

`general` · drafted 2026-09-01 · body 1828w · description 192w · has `evals/`

Paired with `rules/general/context-starvation.md`, which **is** staged while the skill is not — so a
commit right now would land the rule without the skill it belongs to. Land them together.

An `evals/` directory exists, so eval work was started; whether it was finished or abandoned is not
recorded.

**Decided:** nothing recorded.

**Left:** check the state of `evals/`; review; seal; land skill and rule in one commit.

### stop-fucking-around

`general` · drafted 2026-09-08 · body 1493w · description 200w

Description is the longest in the catalog and well over the corpus maximum — expect a token-cost
finding on the description, which loads into every session whether or not the skill fires.

**Decided:** nothing recorded.

**Left:** review, seal, land.

### take-my-word-for-it

`general` · drafted 2026-09-08 · body 969w · description 123w

Tightest of the batch on both counts. Likely the cheapest to finish.

**Decided:** nothing recorded.

**Left:** review, seal, land.

### unconvinced-review

`development` · drafted 2026-09-09 · body 1590w · description 82w · has `references/`

`skills/development/unconvinced-review.skill` is a packaged build output sitting in the catalog
directory. Delete it before committing, or it lands as 10KB of stale duplicate; add `*.skill` to
`.gitignore` if packaging here is going to be routine.

**Decided:** nothing recorded.

**Left:** remove the stray `.skill` file; review; seal; land.

---

## Keeping this current

Update the row when a stage closes, and write the *reason* into **Decided** whenever a choice is made
that a later session would otherwise have to make again — a declined finding, an accepted overage, a
rejected approach. A checkbox says what happened; the reason is what stops the work being redone.
### comment-driven-development

`development` · drafted 2026-09-13 · body 1879w · description 161w · has `references/`

Inverts generation: the user hand-writes the interface comment, the agent derives signature and
implementation from it. Grounded in the argument that a comment written after the code describes the
implementation, while one written before it can only describe the abstraction — and that when tests
and review are themselves model-produced, the human-authored comment is the only independent
specification in the loop.

**Decided** — do not reopen:

- **Scope: new behavior units**, including functions added to existing files, because that is where
  most design actually lands. Exempt: renames, moves, extractions, formatting, config, generated
  files, edits introducing no new abstraction, and the agent's own scratch scripts.
- **Interface ownership: the comment decides.** The scaffold carries a provisional name, no
  parameters, no return type, no method list. One documented exception in the reference file — a unit
  implementing an existing interface gets the required signature, flagged as not provisional.
- **The placeholder is a question, never a draft.** The load-bearing rule: plausible draft prose gets
  approved rather than designed, which collapses the loop back into reviewing the agent's work.
- **The agent never writes its own rationale into a file.** It stubs `TODO(cdd)` and offers the
  reasoning in chat, so no justification lands that nobody stands behind.
- **Console mode kept; in-file is the default**, because the comment's final home is the file and
  prose reads differently there.
- **Standalone — no cross-references.** Neither `what-would-john-ousterhout-do` nor
  `rules/development/comments.md` is named; the comment-quality criteria are restated in the skill's
  own words so it works installed alone.

**Open:** description is 161w against a corpus max of 157. At the edge and not obviously trimmable —
the trigger list and the exempt list are both routing information that cannot move to the body.

**Left:** review; decide whether evals are worth it (the output is a file transform with an
objectively checkable property — no parameters in the scaffold, no prose in the stub — so unlike the
verdict-shaped skills this one is a plausible eval candidate); land.

### grill-with-specs

`development` · drafted 2026-09-21 · body 2005w · description 156w · has `references/`, `evals/`

Requirements-discovery interview inspired by grill-with-docs (which is only a composition of
`grilling` + `domain-modeling`). Five phases: situate, framing round, research rounds, numbered
confirmation rounds (Q / C / I kinds, cap ten), close. Writes only confirmed items.

**Decided** - do not reopen:

- **Documents: `docs/spec/` split by kind** (user-stories, requirements, constraints, glossary,
  research note) with stable `US-`/`REQ-`/`CON-` IDs. Single SPEC.md and "match repo convention"
  were offered and declined.
- **Questions batched per round, numbered**, not one at a time. Grilling-style single questions
  were declined as too slow for generic requirements.
- **Research note kept in the repo** (`docs/spec/research.md`): declined candidates and unresearched
  areas are the skill's cross-session memory.
- **Cross-references approved: `grilling`, `concise-docs`, `stay-sharp`**, each written with an
  in-full fallback. `domain-modeling` and `research` were offered and declined.
- **Description accepted at 174w**; the anti-trigger list (planning, task breakdown, review,
  decision stress-testing) is routing information.

- **Evals: declined.** The interview needs a human reply per round; subagent runs could only check
  phase 1 and the first round's shape. Judged by use instead. `evals/evals.json` stays as prompts.

- **skill-final-review ran 2026-09-21.** Three conflict findings declined by the user, do not re-raise:
  (1) `C` items vs the long decision shape in `rules/general/open-decisions.md`; (2) writing confirmed
  answers to `docs/spec/` vs the no-echo ban in `rules/general/context-starvation.md`; (3) no
  precedence section for "just write it". Housekeeping applied: ASVS citations versioned, three
  duplicate sentences cut, "under any name prefix" on skill-name checks, two lists trimmed from the
  description.

**Left:** land.

---

### gitbutler-readonly

`development` · rule, not a skill · drafted 2026-09-16 · reviewed and revised 2026-09-21 · body 1717w

Restricts the GitButler CLI to inspection. It exists because a git-only restriction leaves every
destructive operation reachable under another name, and because the vendor's own agent skill tells
agents to supply the confirmation flag on the operation it calls hard to reverse.

Every command classification in it is traced to the CLI source at tag `release/0.22.3`, recorded with
file and line in `research/gitbutler-cli.md`. Nine behavioural claims were settled by running two
probe scripts against a throwaway repository; those results are in the same file, marked as observed
rather than read.

**Decided:**

- **Not derived from the vendor skill.** That skill was treated as the thing under test, never as a
  source. Do not re-import wording from it.
- **Previews stay in "Ask first", not "Never run".** `pull --check` and `push --dry-run` fetch every
  remote, but they only move remote-tracking refs.
- **The commit command is excluded even in its explicit-ID form.** With no IDs it sweeps the whole
  tree, and the rule is read-only by name.
- **The escape hatch is a verbatim copy of the one in `git-readonly.md`.** Declined for now:
  cross-referencing another rule breaks if the catalog is installed piecemeal, and the question of
  whether this rule may name a sibling is still open with the author.
- **"Reading `but` output correctly" and "Reading the workspace model" (382w) stay in the rule for
  now.** They belong in the sorting skill, but there is no skill to move them into yet.
- **The claim that repointing the target is never the fix was removed.** It came only from the vendor
  skill, and the source check did not confirm it.

**Left:** move the two reading sections once the sorting skill exists; settle the cross-reference
question; land.

---

### gitbutler-sorting

`development` · name undecided · design only, no SKILL.md yet

Fans a large body of uncommitted work, or one oversized commit, out into virtual branches by scope,
with one inbox branch for anything that cannot be placed confidently.

**Decided:**

- **Compare content, not operations.** The working tree already holds every applied branch plus the
  uncommitted edits, so whether a change was committed stops mattering. The skill diffs the files at
  a checkpoint against the files now, instead of reconstructing what happened.
- **The agent prepares, the user runs the writes.** A local hook owns version-control writes, so the
  skill produces a reviewed script rather than executing anything itself.
- **Work is parked outside the working tree.** A restore deletes untracked files created after the
  checkpoint, silently — observed, not inferred.
- **Committed work needs no parking.** It survives a restore as an unapplied branch and comes back
  with `but apply`. An earlier stop-and-hand-over rule for that case was dropped once this was
  observed.
- **A patch is the default park, not a stash.** Both survive a restore, but creating a patch changes
  nothing, so the agent can do it unattended.
- **Scopes are separable only when they land in different hunks.** Probe 4 settled this: two hunks of
  one file went to two independent branches, but scopes sharing a hunk were refused with `conflicts
  with commits on <branch>`. Rewriting the file does not get around it, because the remaining hunk
  still overlaps the committed lines. Scopes sharing a hunk go on one branch or on a stack, created
  with `--above` (`--anchor` is deprecated).
- **Both refusals are routine signals, not failures.** They are atomic, they never create the target
  branch, and each names the branch to stack on.
- **Only verified steps go in.** Anything resting on inference becomes a stop-and-ask instead. This
  killed an earlier recovery recipe that looked reasonable and had never been tested.

**Left:** run probe 3 (ID lifetime across commits, path selectors for added and deleted files,
dependency failure, untracked files predating a checkpoint, collision on apply, 20-cycle endurance);
write the SKILL.md; write the small script behind the change listing and the conservation check;
name the skill.
