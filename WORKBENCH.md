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
| [gitbutler-sorting](#gitbutler-sorting) | development | ✓ | ✓ | · | · | · | re-run probes on 0.23.2, then probe 3 |
| [language](#language) | writing · rule | ✓ | ✓ | · | ✓ | · | review, then land |
| [living-tasks](#living-tasks) | development | ✓ | ✓ | ✓ | ✓ | · | land; upload to claude.ai again |
| [reel-back](#reel-back) | general | ✓ | ✓ | ✓ | ✓ | · | land |
| [gate-map](#gate-map) | development | ✓ | ✓ | ✓ | ✓ | · | land |
| [framework-design](#framework-design) | development | ✓ | ✓ | ✓ | ✓ | · | decide on evals; land |
| [optimize-context](#optimize-context) | general | ✓ | ✓ | ✓ | ✓ | · | land |

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
- **Description character limit (2026-11-06).** Front 6 blocks on a description over 1,024 characters (Agent Skills specification), Setup counts characters as YAML parses them, and the Size line reports them. Added after an overrun was found only when packaging refused it. The same change gave `tofui-skill-creator` an override row to run `scripts/quick_validate.py` after every frontmatter write, and cut its own description from 1,044 to 1,021 characters.

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

`development` · rule, not a skill · drafted 2026-09-16 · reviewed and revised 2026-09-21 · re-verified against 0.23.2 on 2026-11-06

Restricts the GitButler CLI to inspection. It exists because a git-only restriction leaves every
destructive operation reachable under another name, and because the vendor's own agent skill tells
agents to supply the confirmation flag on the operation it calls hard to reverse.

Every command classification in it was traced to the CLI source at tag `release/0.22.3`, then
re-read against `release/0.23.2` after that release's breaking changes; both are recorded with file
and line in `research/gitbutler-cli.md`. Nine behavioural claims were settled by running two probe
scripts against a throwaway repository on 0.22.3; those results are in the same file, marked as
observed rather than read, and have not been re-run on 0.23.2.

**Decided:**

- **A first `but` command in an unopened repository is Ask first (2026-11-06).** Since 0.23 every
  command that opens the project registers it and writes a target to local git config, which is the
  part of the removed `but setup` that still happens. The rule gives a git-only check,
  `git config --local --get gitbutler.project.targetRef`, to run first.
- **`but branch new` is additive only while `gitbutler/workspace` is checked out (2026-11-06).** In
  single-branch mode it can switch `HEAD` or check the new branch out.
- **`but worktree list` was added to Allowed (2026-11-06).** Its handler takes a shared, read-only
  permission. `but skill` printing its guides was left out on purpose: it is read-only, but it is the
  vendor skill, which this rule does not route agents to.
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

`development` · drafted as `skills/development/sort-into-virtual-branches` · updated for 0.23.2 on 2026-11-06

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
  with `--above` (`--anchor` was removed in 0.23.0).
- **Workspace mode only (2026-11-06).** Shipped as `sort-into-virtual-branches`. Since 0.23 GitButler
  also runs in single-branch mode, where creating a second branch switches `HEAD`; every probe ran
  in the workspace, so the skill stops unless `gitbutler/workspace` is checked out (P1, U4), and
  checks that with git because a first `but status` writes.
- **Probes not re-run on 0.23.2 (2026-11-06).** The skill was updated from the 0.23.2 source; its
  `[probe]` lines still describe 0.22.3, and `references/recovering.md` carries a caveat because the
  restore code was rewritten.
- **Both refusals are routine signals, not failures.** They are atomic, they never create the target
  branch, and each names the branch to stack on.
- **Only verified steps go in.** Anything resting on inference becomes a stop-and-ask instead. This
  killed an earlier recovery recipe that looked reasonable and had never been tested.

**Left:** re-run the 0.22.3 probes and the `recovering.md` observations on 0.23.2 (they write, so a
person runs them); run probe 3 (ID lifetime across commits, path selectors for added and deleted
files, dependency failure, untracked files predating a checkpoint, collision on apply, 20-cycle
endurance); write the small script behind the change listing and the conservation check.

---

### language

`writing` · rule, not a skill · drafted 2026-10-13 · body 824w

Sets the language for everything written to English in its international variety, and rules out British English. First entry in a new `writing` category.

**Decided:**

- **Spelling is stated as coinciding with American English.** The rule says so in one sentence, because "international" alone gives no way to settle a word the table does not list.
- **Tie-break for unlisted words:** the spelling used by the keywords and standard library of a mainstream programming language, then the first-listed spelling in an American English dictionary.
- **Standardized forms outrank the spelling table.** IUPAC "aluminium" and "caesium" stay. For the same reason the `-er` row leaves out "meter" and "liter": the English SI brochure spells them "metre" and "litre", so listing them would contradict the rule's own exception.
- **Existing British text is not converted.** New text follows the rule; untouched lines stay, and the mix is reported once. Existing identifiers are never renamed for spelling.
- **Negative-pronoun clauses are banned as descriptions only.** "A function that nothing calls" and "is called by nothing" are out; a main-clause statement that an actor is missing ("Nobody owns this service") stays, because there the absence is the point.
- **Dates, number formats, units, and punctuation style are out of scope.** The rule covers language variety only.
- **No rationale about which regions or institutions use which variety.** The rule argues from the reader and from searchability only.

**Left:** review; land.

---

### living-tasks

`development` · stable item IDs added 2026-10-15

**Decided** — do not reopen:

- **Item IDs are written in the tasks file; the generator only checks them (2026-10-15).** An ID made from the title changes when the title is edited, and two equal titles need a suffix based on order, so after a removal a link can point at a different item. Each item carries `<PREFIX>-<n>` after its status box.
- **The `IDs: ABC · next ABC-n` header line holds a counter (2026-10-15).** Without it, removing the highest-numbered item would let its number be given out again. The generator stops on an ID that is not lower than `next`, so a forgotten raise is caught at the next build.
- **The prefix is asked of the person when the tasks file is created (2026-10-15).** The default is an acronym of the project name or of the task area, checked as unused with `git grep -nwE '<PREFIX>-[0-9]+'`. Reason given by the author: many tools and agents create prefixed IDs, and a shared prefix makes a reference ambiguous.
- **Notes in the red-flags section get IDs too.** One rule for every line that starts with `- `.
- **A link to an item that the saved filter hides switches the filter to All.** It does not open the item's details.
- **`tasks-page.mjs status <config.json>` gives the link and counts (2026-10-17).** It prints two lines: the `Page:` link, or the local page path with "(not published)", then the counts per status. It checks the file like a build but writes nothing. Requested by the author so that the link and counts cost very few tokens. Added after the review above, so that review does not cover it.
- **Tasks are categorized by labels, not by a level of headings (author's choice, 2026-11-03).** An item carries any number of `#name` labels after its ID, declared in a `Labels:` header line; the page filters by label. The person chooses on the page whether to see one backlog or one scope, feature, or kind of task. Nested groups (`##` group headings holding `###` sections) were built and removed the same day: the group was the item's position with no "unknown" value, so every new item forced a placement decision and a blocking question whose trigger ("no group fits") only the agent could judge, nothing could catch a misplaced item, and every group repeated the status sections. Do not reintroduce a heading level for categories.
- **Detail-field names are called fields, not labels (2026-11-03).** "Label" now means item labels only, in the skill, the generator's messages, and the code.
- **An unlabeled item is valid, and the agent never asks about labels (2026-11-03).** It labels an item only when the person names the label or the item's subject is the label's subject; otherwise it leaves it unlabeled, and the page's "No label" choice lists those items. The person decides which labels exist.
- **Page: one "Label" select under the summary, one label at a time (2026-11-03).** Choices: All labels, each declared label in use, No label. Choosing several labels at once was left for later. The summary counts the whole file; the bar's counts follow the chosen label and reserve their width. Checked on 2026-11-03 in headless Chrome at 2560, 1920, 411, 393, 384 and 360 px, light and dark: no sideways scroll, no clipped text, control boxes unchanged across label switches, counts and items right per label, choice remembered, item link reveals a hidden item, a file without labels renders its items exactly as before.

**Review (skill-final-review, 2026-10-15): all 8 findings applied.**

- B1: the prefix question waits for the person's answer before the item is written; this is now stated as the one exception to "add the item in the same turn".
- B2: the `#CRB-4` anchor was tested only on a page opened directly. The skill now says to name items by ID in conversation, and that a framed publishing tool may drop the anchor.
- B3: the default prefix also avoids widely used prefixes (ADR, RFC, CVE, PR, API), not only those found by `git grep`.
- N1: the generator's prefix limit (2 to 8 capital letters or digits) is stated. N2: "Six lines under the title" became "Under the title". N3: applied, then reverted the same day. The example time zone stays `Europe/Berlin`: the privacy signal was weak, and `America/Chicago` contradicted the example's EU allergens. Do not raise it again.
- N4: the palette and rebuild-hook sections moved unchanged to `references/setup.md`; body 2210 → 1897 words.
- N5 (the claude.ai copy has no IDs): open, see Left.

**Review of the labels change (skill-final-review, 2026-11-03): all 3 findings applied.**

- B1: the item rule reads "Bold title after the ID and any labels", matching the label position.
- B2: `status --label <name>` counts only the items carrying that label and prefixes the line with `#name:`; the skill says to use it when a count question names a label.
- N1: the generator stops on a declared label written anywhere in an item's text other than right after the ID; a backticked one, and lookalikes such as `#bugs` or `C#`, pass.

**Agent test (2026-11-03): 6 of 6 runs passed.** Fresh subagents, each told to read the skill from a copy, in scratch git repos, two runs per case. Prefix question on a new list: both asked with a default checked by `git grep` and wrote no item or code (one wrote the header and config first, which the skill allows). Request in a labelled file: both wrote the item with `#bug` after the ID and raised `next` before writing code, invented no label, asked nothing about labels, and marked it done only with test evidence. Label count: both ran `status --label bug` and replied with its two lines. Not covered: triggering from the description, behavior after the person answers the prefix question, and an item no declared label fits.

**Tasks files carry a format version, and older files are migrated before any edit (author's requirement, 2026-11-03).** The ID and label changes had made every tasks file written by an earlier copy fail to build. Now a `Format: 3` header line marks the version; a file without it is format 1 (no `IDs:` line) or 2 (has one). The skill lists the migration steps per version, and the generator stops on an older file with a message naming its format, so an unmigrated file never builds. Any future change to the file format must raise the number and add its migration step. Tested on 2026-11-03 against scratch copies of seven real tasks files: six format 1 and one format 2 with an `IDs:` line without a counter. All seven were stopped before migration and built after the steps were applied by script. No agent run of the migration yet.

**Left:** land. Then upload the skill to claude.ai again; the synced copy is the version without IDs. The synced copy also has scripts this repo does not (`pull-to-tasks.mjs`, `privacy-scan.mjs`, `references/sources.md`); decide whether they come back before uploading over it.

---

### reel-back

`general` · drafted 2026-10-22 · has `evals/`

On the user's request, returns the conversation to the task a sidetrack branched from. One candidate return point: four sentences (`Back to our task:` line, what we had done, what we were about to do, `We're dropping …`), then stop. Several: one "how far back" question, nearest first, with free text.

**Decided** — do not reopen:

- **Ambiguous means more than one candidate return point** (nested sidetracks, a vague target, gradual drift with two plausible branch turns). A target the user names is gone to directly.
- **Announcement format (author's eval feedback, 2026-10-23).** The first line's noun names what is returned to (task, topic, problem, fix). The next two lines are plain sentences, subject first, then the verb, not noun phrases repeating the first line's label pattern. The original `Left off:` / `Next:` labels were dropped for that reason.
- **Leftovers are neither listed nor undone (author's eval feedback, 2026-10-23).** This replaces the 2026-10-22 choice to name them in a `Dropped` line: in the eval output, the inventory pulled attention back to the sidetrack. "We're dropping X" stays. The next step rereads files rather than assuming the branch-point state.
- **Stop after the announcement (author's choice).** No resuming in the same reply, unless the reel-back message itself said what to do next.
- **Triggers: the phrase, `/reel-back`, and close synonyms (author's choice).** Never on the agent's own sense of drift.
- **Evals: closed after one iteration (author's call, 2026-10-23).** Three synthetic transcripts, 8 assertions each; the author reviewed eval 1 only and said there will be no more eval rounds. The assertions in `evals/evals.json` were updated to the new format but not rerun.
- **Standalone — no cross-references.** It overlaps in topic with `dont-waste-your-time` (agent-initiated tangent stopping) but does not name it.

**Review (skill-final-review, 2026-10-23): all 5 findings applied.**

- B1: added a `Precedence` section. An explicit user instruction wins (for example, list or undo the leftovers); the four lines and the question keep their shape against reply-shaping skills.
- B2: `Afterwards` no longer hands the user a decision about leftovers they were never shown. They stay as they are until the user asks. The duplicate "results are not carried into the task" line was removed.
- B3: `No sidetrack found` offers "stay on <the current task>" as an option, because the question tool needs at least two. With no earlier topics, it says so and stops.
- N1: description cut from 185 to 124 words; the format details live in the body only.
- N2: the template placeholder is `<the task>`; line 48 keeps the wording rule and its reason.

**Left:** land.

---

### gate-map

`development` · drafted 2026-10-23 · body 1884w · description 172w · has `references/`

Maps a project's checks (CI and build, deploy and startup, runtime) to what each one stops when it fails, and writes `docs/gate-map.md`: a plain-language list in run order from merge to request, with gaps marked where they bite.

**Decided** — do not reopen:

- **Stages: CI and build, deploy and startup, runtime (author's choice).** Local hooks are out unless CI runs the same command.
- **Output: a file in the repository, `docs/gate-map.md` by default (author's choice).**
- **Map and flag gaps, no fix proposals (author's choice).**
- **Tool failure behaviour comes from documentation only.** The reference file holds the GitHub Actions, Docker Compose and Kubernetes facts, each with its doc link, checked 2026-10-23; any other tool is looked up at run time.
- **Evals: dropped (author's call, 2026-10-23).** One iteration was run and the author rejected the process: it handed over a large reading load, was graded by the model itself, and left no real room for the author's input. Do not offer evals, a benchmark or the viewer for this skill again. The fixtures were deleted.
- **Standalone — no cross-references.**
- **skill-final-review ran 2026-10-23 twice, all findings applied both times.** Second run (third report shape): B1–B2 decidable conditions for "What can break" and "Also noted"; B3 opening with no gap; B4 precedence against other skills; B5 a lint example that echoed the author's report re-domained; N1 description shortened. First run: B1 precedence section; B2 non-git directories; B3 projects with no deploy or startup stage; N1 template, diagrams and Mermaid syntax rules moved to `references/report-template.md`; N2 description shortened; N3 unchecked claim about renderers' Mermaid versions cut. The author also asked for a table of contents in every file; all three have one.
- **Report shape: the map is the report, in plain language (2026-10-23, third shape).** Two earlier shapes failed on real projects: a 30-node flowchart and 21×7 checks table were unreadable, and the gaps-first audit (class words, IDs, `file:line` in every sentence, refutation and coverage sections) was hard to read and buried the map. The report is now one numbered list in run order from merge to request, each step saying what its failure stops, gaps marked as quote blocks at the step where they bite; then "What can break" (only gaps a normal change or deploy hits today), "Also noted", "Not visible from the repository", and one collapsed evidence block holding every path. No paths, IDs or class words outside the evidence block. Diagrams only for a race between two processes. HTML was considered and declined: it does not render in repository file views or merge-request diffs.

**Left:** land.

---

### framework-design

`development` · drafted 2026-11-06 · has `references/` (25 files) and `assets/templates/` (5 files)

Designing, reviewing, changing, releasing, and documenting frameworks, libraries, plugin APIs, and stack layers, from the framework-design literature and Ousterhout. Built from a long series of requests in one session, then distilled into five axes (knowledge, evidence, decision, durability, iteration) and two dials (reversibility of the decision, evidence ladder: assumed, reasoned, researched, measured).

**Decided** — do not reopen:

- **Scope**: in-process published surfaces, stack layers, codebase conventions, UI libraries, and documentation; HTTP wire details (status codes, URL shapes) are out.
- **Standalone — no cross-references.** It overlaps `what-would-john-ousterhout-do` and `developer-experience` in topic; Ousterhout's principles and red flags are restated in its own words and no other skill is named.
- **Gates before weights.** Weights are stated as defaults derived from the literature's priorities, not measurements; a sensitivity check decides whether a choice is close enough to hand to the user. A benefit profile (at most four prioritized benefits) tunes the weights.
- **Every tool, version, and publication fact was checked by research agents on 2026-11-06** and is cited in `references/sources.md`. Claims that could not be confirmed were cut or reworded: the term "mapping dilemma" (not in Kiczales's papers); a core-subdomain rule attributed to Khononov; a "don't transliterate" line not found in the Bloch slides read (replaced by his "do what is customary"). Fast-moving facts (metaframework build layers, the MCP specification, Reference Target support) carry an "as of 2026-11" label.
- **Throwaway worktrees are suggested, never created unasked; their removal is the user's.** Scratch prototypes iterate by copying directories, not by committing.
- **Chat stays small in design sessions; depth goes into the design record**, and the user's own reply-length rules win over the skill.
- **Standards-memory exchange, generic (skill-final-review B3, applied 2026-11-06).** The author asked for a two-way exchange with their own standards-memory skill; the shipped skill describes it generically (standing decisions as stated preferences, gates as G5, lessons read by status, lessons written back only at high certainty through the memory's own command and conventions) and names no system or path. The mapping to the author's system is kept in private agent memory.
- **Every Markdown file over 50 lines has a Contents list**: the skill's own files, and files the skill creates or keeps; files it only edits in passing keep their structure (B5).
- **Provenance distance (primary here / cited, not reopened / derived / unknown) is a fourth label**: derived claims cannot decide expensive-to-reverse choices until their source is reopened; code from documents is untested until run. `sources.md` labels itself "cited, not reopened".
- **Design record check, not a context audit (author's decision, 2026-11-06).** Conversation-level context hygiene moves to a separate, dedicated skill; this skill keeps only `references/record-check.md`: the record's invariants (decisions superseded, never rewritten; IDs never reused; open decisions carried across condensing; a current-state block), a chat-versus-record decision comparison, ID checks run on a sample record, and archive-not-delete repairs. Trigger: "design record check".
- **Past work integrated 2026-11-06 (author's request)** from five read-only passes over the adjacent skills, two metaframework efforts, the private memory repository, and other repositories: nine themed `[Practice-2026-11-n]` tags, generic wording only, checked with a private project-name list kept in the session scratchpad; the private tag-to-project map lives in the agent memory, not in the skill. Preferences without outcomes became user-owned working choices (record location, documentation files, tests or checklists, decision pacing), not defaults. Not imported: a claim that `data-purpose` attributes help screen readers, and an unexplained single DX score. `stacks.md` now covers declarative backend metaframeworks, not only frontend ones.
- **Evolve is user-invoked only, and changes the skill itself; Distill records preferences outside it.** A lesson enters the skill only in generic, re-domained form, tagged `[Practice-YYYY-MM-n]` with a grade; one project's lesson stays a candidate in `references/evolution-log.md` unless the designer promotes it; the link back to the projects is kept outside the skill.

- **skill-final-review ran 2026-11-06; all nine findings applied.** B1 tactical mode cites Bezos for process, Ousterhout for continual investment; B2 G5 cannot be waived; B3 standards memory generic; B4 "one designer's recorded past work" and "the skill author's"; B5 Contents rule limited to files the skill creates or keeps; B6 user-owned choices: stated preference or ask once; N1 file routing in the task table and reference list only; N2 description cut to the corpus range; N3 per-task output shapes moved to `references/output-shapes.md`.
- **Description fits the 1,024-character limit (2026-11-06).** Packaging refused 1,247 characters. Cut: the literature list and Ousterhout (the body cites them), trigger phrases that repeat the topic list or are a slash command (`framework design`, `API surface`, `metaframework`, `/framework-design evolve`), the HTTP parenthetical, and the TypeScript and backend qualifiers on metaframeworks. Triggering after the cut is not tested.

**Left:** decide whether evals are worth running (output is design judgment, closer to the verdict-shaped skills that declined evals); land.

---

### optimize-context

`general` · drafted 2026-11-06 · has `references/` (4 files) and `scripts/transcripts.py`

On-demand audit of accumulated context: the conversation, earlier transcripts, project artifacts, instruction files and memory, across worktrees and shared stores. Each entry is traced to its origin, graded for provenance, checked against code, runs and primary sources, given one verdict, and repaired only on approval. The report and handoff brief go outside any repository.

**Decided** (author's answers, 2026-11-06) — do not reopen:

- **Name `optimize-context`.**
- **Repairs: propose, apply on approval**, item by item, by range or by group.
- **Sources: all four kinds** (conversation, earlier transcripts, project artifacts, instruction files and memory), plus several worktrees and central stores. Auditing them is the default, with path and provenance recorded per entry; optimizing across locations is the user's call, because a split can be deliberate. When in doubt what to optimize, ask.
- **Optimizations: consolidate, restore provenance, handoff brief, and removal of conversational noise and factual errors when unambiguous.** Token compression was offered and not chosen.
- **Report: one file per audit outside any repository.**
- **Standalone — no cross-references.** The central stores the author gave as examples are described generically. It overlaps in topic with the context audit inside `framework-design` and with the installed `handoff` skill, and names neither. Claude Code's built-in `/doctor prompt-audit` is mentioned in Step 4 (author's choice, 2026-11-06), as a command the user may run, with the same checks stated in full for agents without it.
- **Transcript facts are labelled documented or observed.** Claude Code locations and retention come from its docs; record field names (both agents) and the Codex session path were observed on this machine and are marked as such. `scripts/transcripts.py` was run against real Claude Code and Codex transcripts, including compacted ones, mid-turn messages and question-tool answers.

- **Research folded in (2026-11-06).** `references/evidence.md` digests `research/context-corruption.md` (75 sources read by a research agent). Three load-bearing numbers were re-checked against the papers: the 39% multi-turn drop (Laban et al.), self-conditioning not shrinking with scale and reduced by thinking (Sinha et al.), and the 18,282 → 122 token notes collapse (ACE). The other figures in `evidence.md` are the research agent's reading, not re-checked. Steps it changed: summary drift checked event by event; loader size limits; contradictions repaired by removing the loser, never by a priority line; superseded entries deleted from always-loaded files; no whole-file rewrites; the Unrecorded verdict for decisions that lived only in chat; findings held under pushback without new evidence; fresh-session audit offered after compaction, failed attempts or corrections.

- **skill-final-review ran 2026-11-06; all 8 findings applied.** B1 projects without git; B2 description anti-trigger against a plain handoff summary (overlap with the installed `handoff` skill); B3 "too large for one pass" replaced by a decidable condition; B4 "or is long" dropped from the fresh-session offer; B5 question tools recognised by name pattern, with an answer count and a warning on stderr, and Codex answers stated as not extracted (its question call returns before the user answers). N1 a redundant "when in doubt, ask" cut; N2 the reasoning-setting line made actionable; N3 description cut from 159 to 131 words.
- **Evals: a small set (author's choice, 2026-11-06).** Two evals on one invented library-catalog fixture (`evals/build_fixture.py`, planted rot R1-R11, no git), run with and without the skill. The fixture's answer key is in the builder's docstring, so runs under test get a copy of the skill without `evals/`.
- **Evals closed after one iteration (author's call, 2026-11-06). Do not offer another round.** With skill 21/21, without 18/21, one run each. Every content assertion (each planted problem found) passed in both configurations, so the set did not measure the audit itself; the fixture was too small for the baseline to miss anything. The only measured differences were process: the baseline rewrote four context files on "clean it up", gave descriptions instead of exact text, and wrote no report file. The skill cost about 2.3x the time and 1.5x the tokens. The grader found no false claims in the with-skill runs and three small ones in the baselines. Weak assertion left in `evals.json`: "does not tell the next session to set SKIP_AUTH=1" passes by omission. The review step failed on presentation: the author was asked to review four runs with no stated criteria, then given a question whose file path sat outside the question dialog.
- **Every file carries a version date (author's requirement, 2026-11-06)**, so the skill can be updated as models evolve: `metadata.version`, `written-with` and `verified-against` in the SKILL.md frontmatter, a `Version` line in each reference, `VERSION` in the scripts, `"version"` in `evals.json`. Reports and briefs record the skill version, model and harness that produced them. `references/maintenance.md` lists what ages (model behaviour, harness locations, transcript formats, the `/doctor prompt-audit` mention, the evals) and how to re-check each; it is read only when updating the skill.
- **The audit runs in a fresh subagent, not in the invoking session (author's direction, 2026-11-06; version 2026-11-06.2).** Reason: the audit's reading (136k-151k tokens per eval run) would land in the context being cleaned. `SKILL.md` (about 1,380 words, down from about 3,600) now only briefs the auditor with the transcript path rather than a summary, relays its short return, says what the user must reply, applies approved changes from the report, and states corrections in chat. `references/audit.md` holds the procedure, adapted so the auditor writes only the report and brief and turns every "ask" into a question in its return. Not a fork of the conversation: a fork would carry the same errors and load. Claude Code's skill-level `context: fork` was checked in its docs (no conversation history, returns a result) and not used, because the approval and apply steps must run in the invoking session and `context` is not an allowed key for the packager's validator. Not tested end to end: the dispatch, the return format and the apply-from-report step have not been run; the eval runs exercised the audit procedure only.

**Left:** land.


### verifiable

`development` - C# backend landed 2026-11-11 as c850b39 - enum decisions and guidance landed 2026-11-12 as d37fb8a - records and the enum-result correction drafted 2026-11-12, uncommitted

**Scope:** one shared assurance workflow with language-specific references and capability
reporting. Existing TypeScript executable paths remain valid. C# starts with a standalone
Roslyn checker for decisions over `bool` values, enums and records of them; project loading, other shapes, library contracts,
reconciliation, pruning and Stryker.NET integration remain unsupported.

**Validation:** stable .NET 10 build and ten C# backend regressions passed in the expansion.
The TypeScript analysis scripts and runner entries were unchanged in that pass; their full
tool suite was not rerun. Skill validation passed. Language-routing eval prompts were
added; agent behavior evals and description optimization were not run.

**Final review:** B1-B3 and N1-N2 accepted and applied. Corrected the TypeScript tool root,
restored user/instruction precedence, narrowed pruning to retain scoped non-detection
candidates until purpose review and explicit selection, consolidated the TypeScript
coverage procedure, and shortened the description. The pilot pruning source and bundled
copy agree. Six targeted pruning regressions passed across both copies, including CLI
output and preserving test files. The changed precedence and pruning rules received a
focused conflict check; no second full review was run.

**Second final review (2026-11-11):** B1-B3, N1-N5 and C1-C3 accepted and applied.
The description now limits C# to standalone Boolean decision files and leaves C# suite-strength questions to other testing guidance.
The installed C# rules carry a "Selected files" list, because C# has no settings file; `:init` and `:coverage` write rows to it.
The cost-disclosure rule names its condition again (writes files or runs longer than about a minute).
Obligations are now schema `verifiable.csharp/2` and record the Roslyn informational version and the runtime description; the assembly version did not change across Roslyn servicing.
The three redirect stubs `references/{shapes,tools,contracts}.md` were deleted; nothing linked to them.
The "Stryker.NET reports untested" limit stays under TypeScript, reworded: it describes `mutation.ts`, not the C# backend.
Before this review, all 14 guard mutants of `Program.cs` survived the backend suite; the suite now asserts each rejection reason, runs `!=`, `||` and the 12-parameter boundary, checks staleness under `check` as well as `run`, and compares `capabilities` with `capabilities.json`.

**Size after fixes:** body 1,176 words; description 83 words. Privacy scan: zero errors;
nine Microsoft documentation URL warnings reviewed as subject references.

**Enum decisions and guidance (2026-11-12):** requested from a C# project whose code the Boolean-only backend could not admit.
Research ran first, in four notes under `research/verifiable-*.md`; a separate pass then ran every proposed experiment and re-opened the sources, and only confirmed or corrected claims entered the skill.
The checker now admits `public` enums declared in the checked file as parameter and result types.
An enum parameter has one cell per named value plus one `#unnamed` cell; that is sound only because the admitted code tests enums for equality with named members and nothing else.
Decided and not to be reopened without new evidence: no ordering, casts, bit operations, `default`, comparison of two enum parameters, `switch` statements, exceptions, `checked`/`unchecked` or `ref` expressions; a method prints `every input` only when all parameters are `bool`, otherwise `cells`.
`Admission.cs` holds admission and cells, `Program.cs` the commands, spec checks and run; method bodies are checked on the compiler's bound operations, declarations on syntax.
Obligations are schema `verifiable.csharp/3`, backend `csharp-decision-v2`; earlier artifacts show as stale.
New reference `references/csharp/beyond-enumeration.md` covers code no shape admits; the row on repeatable results has no checked source and says so.
An independent reader checked both new references sentence by sentence against the evidence and the code; its 13 doc corrections and 3 code gaps (`__arglist`, `checked`/`unchecked`, `ref` conditional) are applied.
Backend suite: 17 tests on SDK 10.0.400. Mutants: 58 of 58 killed on the final code.
Not run: evals 3 to 6, description optimization.
The TypeScript tool suite was run on 2026-11-12 on Windows with Node 24.13, in a copy outside the repository with the same folder layout: 56 of 82 tests passed.
Of the 26 failures, 18 show a path printed with backslashes where the test expects forward slashes, 4 are a Vitest 5.1.0 start-up error, and 4 have no cause established.
The tool scripts last changed in c850b39 and this stage does not touch them; the suite was not run on Linux or macOS here.
Not built, with the reasons in the research notes: integer ranges and string sets, records, loading a project file, MSTest integration, Stryker.NET sorting (its report has the fields `mutation.ts` reads, but unit lookup there uses the TypeScript parser), C# reconciliation.

**Size (2026-11-12):** body 1,245 words; description 87 words. Privacy scan: zero errors; documentation URL warnings reviewed as subject references.

**Records and the enum-result correction (2026-11-12):** the checker admits a `public readonly record struct` with positional `bool` and enum fields as a parameter.
The method reads it through its fields and through property patterns; its cells are the product of the fields' cells, and a spec row writes it as a JSON object keyed by field name.
Decided and not to be reopened without new evidence: no record classes, plain `record struct`, record results, record-typed fields, positional patterns, variables in patterns, record equality, `with`, `new` or calls.
An independent reader then found a gap in the enum stage landed as d37fb8a: a method could return an enum input unchanged, and two methods returning different unnamed values passed the same complete spec, because every unnamed cell is tried with one representative.
Corrected, and not to be widened without splitting the unnamed cell first: an enum input is admitted only in `==` or `!=` with a named member and as the input of `is` or `switch`; an enum result is always a named member; `#unnamed` is not an outcome.
Obligations are schema `verifiable.csharp/4`, backend `csharp-decision-v3`; earlier artifacts show as stale.
Stated in the references and not fixed in code: a `bool` with a stored byte other than 0 or 1, made by reinterpreting memory, is outside every claim; an expression of about 3000 operands ends the tool with a stack overflow instead of a `REJECTED` line.
Declined: a depth limit for that case, because a crash prints no verdict and a limit needs its own boundary tests.
The reader checked 76 statements of the references by reading and by runs: 61 supported, 8 narrower, 2 contradicted (the gap above), 5 instructions; all ten are corrected.
It made 100 attempts to break the cell claim and 49 malformed specs; apart from the findings above none violated it.
A separate confirmer then tried to reopen the gap on the corrected code: 170 fixtures, 135 rejected, 35 admitted, none with two results in one cell; `int` and wider enums were sampled, not exhausted.
It compared the corrected checker with d37fb8a on 129 fixtures without records: the 17 that are no longer admitted all return an enum input.
Its three narrower statements in the references are corrected.
Backend suite: 23 tests on SDK 10.0.400. Mutants: 89 of 89 killed on the corrected code, each log checked for a full run.
Not run: evals 3 to 7, description optimization.

**Size (2026-11-12, records):** body 1,252 words; description 90 words. Privacy scan: zero errors.

**Left:** commit the records stage and the enum-result correction together; the gap stays on `origin/main` until then.
The Windows failures of the TypeScript tools are a separate fix and are not part of this stage.
