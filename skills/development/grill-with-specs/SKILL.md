---
name: grill-with-specs
description: "Requirements discovery interview for the start of a software project, repository, or feature: grills the user in short numbered rounds (open questions, multiple choice, and include/exclude yes/no items) and writes only confirmed answers into concise spec documents under docs/spec/. Runs research rounds first so generic requirements arrive as pre-researched candidates with sources instead of being typed one by one. Never adds an item the user has not confirmed. Use this skill whenever the user wants to write a spec, PRD, requirements, user stories, acceptance criteria, or constraints for something new; says 'grill me on the requirements', 'spec this out', 'what are we missing', 'discovery', 'kickoff', 'scope this feature', 'write the user stories'; or starts a project or feature with no spec in the repo. Also use it when a spec exists but the user wants gaps found. Do NOT use for implementation planning, task breakdown, code review, or stress-testing an existing decision without producing documents."
---

# Grill With Specs

An interview that turns a vague start ("we need a booking feature", "new repo for the catalog service") into a small set of spec documents the next session can build from. The user answers; the skill asks, researches, and writes down only what was confirmed.

## Why it works this way

Specs written by hand start with what the author already knows and stop when they get tired. The items that hurt later are the generic ones nobody thought to write down: how errors are reported, what happens on a duplicate submit, which accessibility level applies, how long data is kept. Most of these are not new problems. Standards, framework conventions, and industry checklists already answer them. So the skill does the reading first and brings candidates to the user as include/exclude items, and the user spends attention on deciding, not on recalling.

Two costs shape every round:

- **The user's attention is the scarce resource.** Every question costs cognitive effort. A round is short, each item is one line, and each item has a recommended answer so the cheapest reply is "all defaults".
- **Nothing lands unconfirmed.** A model-generated requirement that nobody approved is worse than a missing one, because it reads with the same authority as the real ones. Only confirmed items are written.

## Invariants

- Write to the spec documents only after the user has confirmed an item in the current session. Never write an item because it "obviously applies".
- Ask before creating `docs/spec/` or any file in it. After the first confirmation, write incrementally after every round, so a stopped session still leaves a usable document.
- Facts that can be read from the repository (stack, package manager, existing docs, existing tests, CI config) are looked up, never asked.
- Every research-sourced candidate carries its source. A candidate without a source is a guess and is labeled as one.
- Stop when the user says stop, or when a round produces no new confirmed items and no open questions remain. Say which of the two happened.

## The session, in order (5 phases)

### Phase 1: situate (no questions yet)

Read before asking. In this order:

1. `docs/spec/` if it exists: existing items, their IDs, and the research note's declined list. Continue numbering from the highest ID.
2. Any existing README, CONTEXT.md, ADRs, or planning documents. Treat their contents as claims to confirm, not facts.
3. The stack: manifest files, lockfiles, framework config, CI config, test layout. This decides which research checklists apply.
4. Whether the subject is a **new project**, a **new repository in an existing system**, or a **feature in an existing codebase**. A feature inherits the constraints already recorded; only its deltas are asked.

Report what was found in at most five lines, then open Phase 2.

### Phase 2: framing round (open questions)

One round of at most five open questions that fix the shape of everything after. Typical set:

1. What is being built, in one sentence, and for whom.
2. What must be true for the first release to count as done.
3. What is explicitly out of scope.
4. Who the actors are (end users, admins, other systems, operators).
5. What already exists that this must fit into or replace.

Ask these in a single numbered message. If `grilling` is installed (under any name prefix) and the user wants to go deep on one of these answers, invoke it for that thread and return here when a shared understanding is reached; otherwise ask follow-ups one at a time until the answer is concrete enough to write a user story from.

Write the confirmed framing as the first user stories and the first constraints, then run Phase 3.

### Phase 3: research rounds (candidates, not questions)

Research is what lets the user say yes or no instead of write. For each area that the framing and the stack make relevant, find what the standard, the framework documentation, or the established industry checklist says, and turn it into candidate items.

- Read `references/research-areas.md` for the list of generic requirement areas, what to look for in each, and which source classes count. Do not skip areas because they seem obvious; the obvious ones are the ones hand-written specs omit.
- Prefer primary sources: the standard's own text, the framework's official documentation, the vendor's reference. A blog post is a lead to the primary source, not a source.
- Run research in the background where the environment allows subagents, one per area, while the user answers the current round. Otherwise research inline, one area per round, and say which area is next.
- Each candidate is one line: proposed item text, source, and a recommended verdict (include or exclude) with a five-word reason.
- Group candidates by area and cap a round at ten items. More than that and the user starts skimming, and skimmed confirmations are worth nothing.

Candidates that duplicate a confirmed item are dropped silently. Candidates that contradict a confirmed item are raised as a conflict, not proposed as a new item.

### Phase 4: confirmation rounds (numbered, mixed kinds)

Every round is one numbered list, at most ten items, mixing three kinds. Mark each item with its kind so the user knows what shape of answer is wanted.

| Kind | Marker | Shape of the item | Answer |
|---|---|---|---|
| Open | `Q` | A question that needs a sentence. | Free text. |
| Choose | `C` | Two to four labeled options, recommended one first and marked. | A letter, or "default". |
| Include | `I` | A candidate requirement, story, or constraint with a source and a recommended verdict. | `yes`, `no`, or an edit. |

Round format:

```markdown
Round 3 (security, error handling). Reply like: 1 yes, 2 b, 3 no, 4 default, 5 all yes.

1. I  Sessions expire after 30 minutes idle. Source: OWASP ASVS 4.0.3, 3.3.2. Recommended: yes.
2. C  Error response format: a) RFC 9457 problem details (recommended) b) custom envelope c) plain message.
3. I  Duplicate form submits are idempotent for 24h. Source: framework docs on idempotency keys. Recommended: yes.
4. Q  Which roles can delete a record?
5. I  Audit log for admin actions. Source: industry practice, no standard cited. Recommended: no for first release.
```

Rules for a round:

- Items in one round belong to at most two areas. Mixing six areas costs the user a context switch per line.
- An `I` item is written exactly as it would appear in the document, so a "yes" needs no rewording.
- A "no" is recorded in the research note under declined, with the user's reason if they gave one.
- An edit is written as edited, not as proposed.
- After the reply, write every confirmed item to its document, then state in one line what was written and what the next round covers.
- Do not re-ask a declined item in a later round unless the user reopens it.

### Phase 5: close

When the user stops, or a round yields nothing new:

1. List open questions that were asked and not answered, as a numbered list in `docs/spec/requirements.md` under an "Open" heading.
2. Update the research note with every declined candidate and every area that was researched, so the next session starts from the same place.
3. State in at most five lines: how many items of each kind were confirmed, which areas were not researched, and what the next session should open with.

## The documents

Five files under `docs/spec/`, created lazily, one item per line, stable IDs. Full templates and ID rules are in `references/spec-documents.md`; read it before the first write.

| File | Holds | ID prefix |
|---|---|---|
| `user-stories.md` | Actor, goal, reason; acceptance criteria as bullets | `US-` |
| `requirements.md` | Functional and non-functional requirements in EARS form ("When X, the system shall Y"); open questions at the end | `REQ-` |
| `constraints.md` | Standards adopted, stack decisions, limits, things out of scope | `CON-` |
| `glossary.md` | Domain terms with one-line definitions, added when a term is first confirmed | none |
| `research.md` | Per area: sources consulted, candidates declined and why, areas not yet researched | none |

Writing rules for all five:

- If `concise-docs` is installed (under any name prefix), apply it to every write. Otherwise: one rule per line, keyboard-typable characters only, front-loaded sentences, no idioms, language-tagged code fences, negative decisions listed explicitly and separately.
- Each `REQ-` and `CON-` item that came from research ends with its source in parentheses.
- Items are never deleted. A superseded item is marked `(superseded by REQ-042)` in place, so IDs stay stable for anything that already cites them.
- No implementation detail in requirements or stories. "Use Redis" is a constraint or a later decision, not a requirement.

## Sources and the user's own checking

Research-sourced items are only as good as the reading behind them, and the user should be able to check the ones that matter without redoing the research. If `stay-sharp` is installed (under any name prefix), let it append its footer after a round that introduces standard-based candidates. Otherwise, end such a round with one line per standard cited: its name, the exact section, and a link to the primary source, so the user can open it in under a minute.

## Scaling the interview

| Subject | Rounds to expect | What to skip |
|---|---|---|
| Small feature in a mature codebase | 2 to 3 | Areas already covered by existing constraints |
| New service in an existing system | 4 to 6 | Areas the system-wide constraints already decide |
| New project | 6 to 10 | Nothing; every area is open |

If the user says "just the essentials", run the framing round, one research round on the three areas most likely to hurt (data handling, error handling, security), and close.

## What this skill does not do

- It does not plan implementation, break work into tasks, or estimate effort.
- It does not write code, tests, or ADRs. A decision that needs an ADR is noted as a constraint with "decision pending" and left for the user.
- It does not resolve trade-offs for the user. It recommends, once, per item.
- It does not run unattended. If asked to "just fill in the spec", explain that unconfirmed items are the failure it exists to prevent, and offer the essentials path instead.

## Worked example, abbreviated

User: "New feature: members can reserve a book that is currently on loan."

Phase 1 finds a web application with an existing `docs/spec/` holding 14 requirements, a session-timeout constraint, and a glossary defining Member and Loan.

Phase 2, one message:

```markdown
Framing (5 questions).
1. Who can place a reservation: any Member, or only Members in good standing?
2. What counts as done for the first release?
3. Out of scope for now?
4. Does a reservation expire, and who is told when the book comes back?
5. Anything this replaces (a paper waiting list, an email process)?
```

Phase 3 researches notifications, concurrency on shared state, and data retention for the stack found, and brings back six candidates.

Phase 4, round 2:

```markdown
Round 2 (concurrency, notifications). Reply like: 1 yes, 2 a, 3 no.

1. I  Two Members reserving the same copy in the same second results in exactly one reservation. Source: framework docs on unique constraints. Recommended: yes.
2. C  Notification channel when the book returns: a) email (recommended, already configured) b) in-app only c) both.
3. I  Reservation notifications are kept for 90 days then deleted. Source: existing CON-004 retention rule. Recommended: yes.
4. Q  How long does a Member have to collect the book after notification?
```

After "1 yes, 2 a, 3 yes, 4 three days", the skill writes REQ-015 to REQ-017 and US-006, adds "Reservation" to the glossary, and opens round 3.
