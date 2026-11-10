---
name: framework-design
description: Design, review, change, and release frameworks, libraries, SDKs, plugin APIs, and the framework layers of a stack. Use it whenever a task shapes code other developers build on - public API or package surfaces; extension points, hooks, callbacks, plugins; what to expose; backward compatibility, deprecation, versioning, releases; security and business constraints by default; lint rules, build checks, architecture tests; choosing or layering single- or multi-language stacks and metaframeworks; whether DDD, vertical slices, or feature folders fit; comparing idiomatic patterns; scenario tests and prototypes of design options; retrospectives on finished framework work; distilling the user's design preferences. Also on 'breaking change', 'semver', 'pit of success', and 'design record check'. Not for HTTP wire details, or for naming, layout, or refactoring of code whose callers all live in one repository, unless choosing its conventions.
---

# Framework design

## Contents

- Why framework design is its own discipline
- Axes, dials, and labels
- Terms
- Tasks and the references they need
- Method
  1. Locate the problem
  2. Map the problem to principles
  3. Research
  4. Design it twice
  5. Test the options against scenarios
  6. Prototype what the walkthrough cannot decide
  7. Gate, then weigh
  8. Make the decision hold
  9. Record and report
- Positions
- Precedence
- Output
- Reference files

## Why framework design is its own discipline

A framework is code that other developers build on and cannot change. In a framework, as opposed to a library, control is also inverted: the framework calls the consumer's code. Three facts follow, and every rule in this skill derives from one of them.

1. **The surface is published.** Its consumers are many, mostly unknown, and not yours to edit. A mistake in the interface is paid by every consumer for as long as the surface exists; a mistake in the implementation is paid once, by the framework's own team. This is why interface quality outweighs implementation simplicity throughout this skill.
2. **Everything observable becomes surface.** With enough consumers, someone depends on every behavior, documented or not: ordering, timing, error text, defaults. What you do not hide, you will have to keep.
3. **Defaults are policy.** Most consumers keep the defaults and copy the first example they find. What the framework does by default is what most applications built on it do. A constraint the business needs in every application, such as access control, output escaping, audit logging, or limits, costs least when the framework provides it by default and makes the unsafe path the one that takes effort.

A fourth fact governs the process: frameworks are built iteratively, and each new consumer scenario shows design opportunities in areas already finished. Design work therefore includes going back over finished work, deliberately and on a schedule, and it remembers the judgment the user showed along the way.

## Axes, dials, and labels

Everything in this skill sits on one of five axes. Use them to place a request; a request that touches several axes runs the method once, reading the reference files the task table names for each task involved.

| Axis | Question it answers |
|---|---|
| Knowledge | What does the literature say, for this kind of problem, platform, and domain? |
| Evidence | How does a claim become trustworthy enough to decide on? |
| Decision | How is one option chosen over the others, and by whom? |
| Durability | What keeps the decision true after the work ends? |
| Iteration | How do the design, its record, and this skill improve over time without losing what was decided? |

Two dials set how much of the method a decision gets:

- **Reversibility.** A decision that is expensive to reverse (published surface, a default, an extension point, a stack layer, a codebase convention) gets the strategic mode, strict gates, and strong evidence; a cheap one gets less process [Bezos], never less care for the code [APOSD].
- **Evidence.** Claims climb a ladder: **assumed** (not checked), **reasoned** (an argument), **researched** (a cited source), **measured** (a run in this session, such as a prototype or a command). A decision that is expensive to reverse needs its deciding criteria at least researched and preferably measured; a cheap one may rest on reasoning. Research and prototypes exist to move the deciding claims up the ladder, not to decorate the output.

Evidence kind and provenance distance together give finer classes where they are needed: "researched" at distance "primary, here" means the source or code was read; at "cited, not reopened" it means a quote from documentation or a secondary source. For weighing, a published empirical study counts for more than consensus guidance, and consensus for more than one author's opinion; `sources.md` notes which of its sources are studies.

Every claim in an output carries up to four labels: its **evidence kind** from the ladder; its **provenance distance** (below); its **scope label** when it depends on a language or ecosystem (`cheat-sheet.md`); and its **source**: a tag from `sources.md`, a link, or, for the user's own past work, the project, date, and whether it was stated or inferred (`judgment-memory.md`).

**Provenance distance** guards against knowledge that degrades as it is copied: a summary of a summary, an untested snippet in an old research note, a document an agent wrote that reads like a primary source. Distances, nearest first:

- **primary, here**: the specification, official documentation, or source code was read in this session, or the code was run;
- **cited, not reopened**: a document quotes and links a primary source that was not reopened;
- **derived**: a restatement without a checkable citation, including past research notes, agent reports, design records, memory entries, and this skill's own earlier outputs;
- **unknown**: no traceable origin.

Rules: never raise a claim's evidence kind by reading it again in a derived source; agreement between documents counts once per independent primary origin, not once per document; a claim at "derived" or "unknown" distance cannot decide anything expensive to reverse until its primary source is reopened or its code is run; and code from any document counts as untested until it has type-checked and run in this session. The details are in `references/research.md`.

## Terms

One name per concept, used in every file of this skill.

- **Consumer**: a developer who writes code against the framework. Their code is **consumer code**.
- **Surface**: everything a consumer can observe and come to depend on: public types and members, signatures, behavior, defaults, error types and messages, callback order and threading, configuration keys, file formats, environment variables, command-line flags, log formats.
- **Call surface**: the part consumers call. **Extension surface**: the part consumers implement, override, or register for the framework to call (often called an SPI).
- **Published**: a surface whose consumers cannot be found and changed in the same commit as the surface. A public member used only inside one repository is public, not published.
- **Scenario**: a task a consumer wants done, written down as the consumer code they would write, or as a short given/when/then statement when code is premature.
- **Constraint**: a rule the business needs every application to obey: security, data protection, audit, tenancy isolation, limits, validation, accessibility; and the hard limits callers may impose, such as real-time deadlines, safety certification, and regulation, which become gates (`tradeoffs.md`).
- **Layer**: one framework or tool in a stack, with its own owner, release cycle, and surface: language and runtime, build tooling, UI library, metaframework, server engine and adapters, hosting platform, application libraries, application conventions.
- **Role**: **author** of a layer (you can change its surface) or **consumer** of it (you can choose, configure, extend, wrap, replace, or contribute upstream, but not change it).
- **Benefit profile**: the few benefits this framework chooses to stand for (security by design, pit of success, fail early, developer experience, familiarity, flexibility, opinionated or unopinionated, stable APIs, depth or breadth, boundaries, ease of learning, small dependency graph), which tune the weights.
- **Scope label**: a tag in braces, such as `{.NET}`, `{Rust}`, or `{TS/JS}`, on any guideline that depends on a language or ecosystem.
- **Scratch project**: a throwaway, self-contained project outside the product's repository, in which a design option is built far enough to type-check, lint, build, and run. **Throwaway worktree**: a git worktree on a throwaway branch, for prototypes that need the whole repository.
- **Design record**: the file that holds a design effort's scenarios, options, evidence, and decisions, with a current-state block at the top.
- **Preference**: a conditional rule distilled from several of the user's decisions, with its scope and provenance.
- **Standards memory**: a private store some users keep, often through its own skill, of lessons, standing decisions, gates, and project and stack notes (`judgment-memory.md`).

## Tasks and the references they need

The method below applies to every task. The task decides which reference files to read and which output shape to use (`references/output-shapes.md`). Every task also reads the matching section of `domains.md` at step 1, uses `scenarios.md` at step 5 and `prototyping.md` at step 6, and starts new documents from `assets/templates/` at step 9.

| Task | When | Read |
|---|---|---|
| Design | A new framework, layer, or published surface; a new feature area on an existing one | `problem-map.md`, `principles.md`, `tradeoffs.md`, `research.md`, `session-style.md` |
| Review | Judge an existing surface | `problem-map.md` (signals), `cheat-sheet.md`, `principles.md` |
| Change | Add to, alter, deprecate, or remove part of a published surface | `compatibility.md`, `tradeoffs.md` |
| Release | Prepare a release, or define how versions ship | `release.md`, `compatibility.md` |
| Constraints | Make a business constraint hold by default | `constraints-by-default.md`, `enforcement.md` |
| Enforce | Add lint rules, build checks, analyzers, or architecture tests that keep consumers on the intended path | `enforcement.md` |
| Stack | Choose, layer, or debug a stack; single- or multi-language; frontend and declarative backend metaframeworks | `stacks.md`, `language-cultures.md` |
| Fit | Judge whether a codebase convention (DDD, vertical slices, feature folders, layers, ports and adapters) fits the project | `conventions-fit.md` |
| Patterns | Find, document, and compare the idiomatic patterns for a problem | `pattern-comparison.md`, `research.md` |
| Document | Plan or review a framework's documentation, reference pages, error messages, and migration guides | `documentation.md` |
| UI | Design or review a component library, design system, or the UI side of a framework, including accessibility | `ui-frameworks.md`, `constraints-by-default.md` |
| Retro | Go back over finished design and code for duplication, simplification, generalization, surface reduction, and refactors | `retrospective.md` |
| Distill | Capture the user's design preferences once enough decisions exist, or research their past framework work, including a standards memory where the user keeps one | `judgment-memory.md` |
| Record check | Only on the user's request ("design record check", "/framework-design record-check"): verify that the design record still says what was decided, repair it, and rewrite its current-state block | `record-check.md` |
| Evolve | Only on the user's request ("evolve the framework-design skill", "/framework-design evolve"), in a mature project: turn lessons from the project's record into changes to this skill's weights, knowledge, and defaults | `evolution.md`, `evolution-log.md` |

A request often spans several tasks. Run them in this order: Retro, Review, or Fit find the problems; Design or Change resolve them; Constraints and Enforce harden the result; Release ships it; Distill runs at the end of a session or a retrospective once the record holds enough decisions.

## Method

### 1. Locate the problem

Before anything else, write down as working notes:

- **Session mode**: tactical or strategic (`session-style.md`). Anything that becomes published surface, a default, an extension point, a stack layer, or a codebase convention is expensive to reverse and gets the strategic mode; tactical work runs this step only and flags anything hard to reverse in one line.
- **Layer**: which layer the problem lives in, and which other layers it touches. When the stack has more than one framework, read the layer model in `references/stacks.md` first; a symptom often surfaces in one layer and originates in another.
- **Role**: author or consumer of that layer. Never propose changing a layer the user does not own. For a layer they consume, the options are: choose a different one, configure it, extend it through its extension surface, wrap it, replace it, contribute upstream, or pin a version and wait.
- **Consumers**: who writes code against the surface, roughly how many, how expert, and whether the surface is published.
- **Surface affected**: call, extension, or internal. Anything not deliberately published is internal by default.
- **Stage**: experimental or pre-1.0, stable, or deprecated. The stage decides what may still change freely.
- **Constraints in play**: the business constraints the area must uphold.
- **Domain**: the kind of application the framework serves; its section in `references/domains.md` names what the framework owns there and how the gates and weights shift.
- **Platform culture**: the language or languages the surface targets, and where each sits on the axes in `references/language-cultures.md` (name length, namespace depth, explicitness, error and configuration idioms).
- **Benefit profile**: the benefits this framework prioritizes (`tradeoffs.md`). Take them from the user, from the design record, or from confirmed preferences (`judgment-memory.md`), with provenance.

If one of these cannot be determined from the request and the code, state the assumption you are making in the output, and continue.

### 2. Map the problem to principles

Read `references/problem-map.md`. Find the entries whose signals match the problem; a real problem usually matches two or three. Each entry gives the forces in tension, the default resolution with its condition, the alternatives and when they win, the principles behind it, and how to verify the result. The combined forces of the matched entries are the forces of this decision.

If no entry matches, state the forces yourself, using the principle catalog in `references/principles.md`, and say that the problem map had no entry.

### 3. Research

Follow `references/research.md` for every Design, Change that adds or alters surface, Constraints, Stack, Fit, and Patterns task, and for each Review or Retro finding whose fix the problem map does not settle. It sets the order of sources: the platform's official design guidelines, two or three mature frameworks that solved the same problem, their maintainers' design records, the literature, and current security guidance. It also covers the user's own past framework work, labeled by provenance (`judgment-memory.md`), and how findings are recorded. Write up competing idiomatic patterns with `references/pattern-comparison.md`.

Research is evidence about consequences, not authority. Adopt a pattern from another framework only after it passes the same forces, scenarios, and gates as your own options. When mature frameworks disagree, the disagreement is the finding: it marks a real tradeoff, and both sides go into the comparison with their conditions.

Skip research only when the user says so or no web access exists. Say which in the output, and label every conclusion that rests on training data as not checked against current sources.

### 4. Design it twice

Produce at least two options that differ in kind, not in degree. Show each surface option as consumer code for the top scenarios, never as a type diagram alone: consumer code is what consumers will read and write, and it exposes concept count and ceremony that a diagram hides. Include "leave it out" when the need is not yet proven, and "use what a lower layer or an established framework already provides" when one does. When confirmed preferences shape the default option, still include one option that departs from them.

### 5. Test the options against scenarios

Follow `references/scenarios.md`. Collect the scenarios the request names, then generate more along fixed axes: consumer kinds and activities, common and advanced use, extension, likely future changes, quality attributes, misuse and abuse, failure, lifecycle and upgrade, scale, concurrency, composition with other extensions or frameworks, and one scenario per constraint. Walk every scenario through every option and classify it as **accommodated** (works with no surface change), **needs change** (works after a named surface change, compatible or breaking), or **collides** (contradicts a design decision or a gate).

Two counts come out of the walkthrough and feed the weighing: scenarios that need change or collide, per option; and surface elements touched by many unrelated scenarios (mixed concerns) or by none (candidates to remove).

### 6. Prototype what the walkthrough cannot decide

Follow `references/prototyping.md` whenever a question can be settled by running something: whether consumer code type-checks, what a misuse costs, how large each surface is, whether a refactor shrinks it, whether a direction fits the conditions the user prefers. This applies equally to accepted directions, directions being explored or revisited, refactor and surface-reduction candidates, and evidence-gathering for a single question.

Start with a scratch project per option, outside the product's repository, on the product's toolchain versions. When the open questions concern fit with the real code, or the evidence must come from the whole repository (integration, the real test suite, migration impact, cross-cutting refactors), suggest throwaway worktrees, one per option, so the user can explore each option across the full repository; create them only after the user agrees, and leave their removal to the user.

Prototype code is evidence, not product code. It goes into the product only through the same design review as any other change.

### 7. Gate, then weigh

Follow `references/tradeoffs.md`. Remove options that fail a gate: a constraint that does not hold by default, a break of the compatibility promise outside a major version, an unsupported platform or license, a change to a layer the user does not own, or one of the user's own gates. Choose the weight column for the task's context, tune it with the benefit profile, the modifiers, confirmed preferences, and priorities the user states, and list every adjusted weight. Score the remaining options against the datum. Then check sensitivity: if moving any single weight by one point changes the winner, the decision is close; name the criterion that decides it, and, if that criterion depends on product intent or audience, present it to the user as a decision with both options and what each changes.

### 8. Make the decision hold

For the chosen option, decide what keeps it true after the work ends: which default carries it, which type makes the wrong use fail to compile, which lint rule, build check, or architecture test catches drift, and which test pins the behavior consumers will depend on. Read `references/enforcement.md`, and `references/documentation.md` for the documentation the decision changes, since documentation is part of the surface. A design rule that no check enforces holds only until the first deadline.

### 9. Record and report

In a design session, write scenarios, options, evidence, and decisions into the design record as they happen, keep its current-state block current, and keep each chat reply to the decision in focus (`session-style.md`). Start new documents from `assets/templates/`: `prd.md`, `api-spec.md` (scenario-driven), `design-record.md`, `task-log.md`, `research-findings.md`; if the project already has templates for these, use the project's. At the end of a session or retrospective, if the record holds enough decisions, distill the user's preferences (`judgment-memory.md`). Then report with the output shape for the task (`references/output-shapes.md`).

## Positions

Where the literature agrees, this skill holds these positions. Each is stated in full, with its conditions and alternatives, in `references/principles.md`.

1. Design from scenarios: write the consumer code before the types. [FDG, Bloch]
2. The common case needs no configuration and few concepts; power comes from layers beneath it, which stay reachable. [APOSD, FDG, Lampson]
3. Keep the surface small and deep. When in doubt, leave it out: anything can be added later, nothing published can be removed cheaply. [APOSD, Bloch]
4. Hide by default and publish deliberately, because everything observable becomes surface. [Parnas72, APOSD, Tulach, Hyrum]
5. Extension points are earned by real implementations, at least two and preferably three, before they are published; a test double that exercises the whole contract or a committed consumer can count, and a one-provider slot is a different mechanism. [Roberts-Johnson, FDG, Bloch]
6. Define an error out of existence when the consumer does not need to know about it; otherwise report it early, preferably at compile time, with the fix in the message. [APOSD, Bloch]
7. Constraints hold by default, at one choke point per control (function-level checks at dispatch, object-level checks in the data-access layer, the in-process data API included), and the unsafe path is explicit, narrow, and named for its risk. [Saltzer-Schroeder, Kern, BSRS, OWASP-API]
8. Consistency with the platform and with the framework's own existing surface beats a locally better design. [Bloch, FDG, APOSD]
9. Evolve by addition. Break only in a major version, with a migration path and a deprecation period. [SemVer, Hickey-Spec, Tulach]
10. Checks make a design hold; put each at the earliest stage that can decide it without false alarms. [Bloch, Ford-Parsons-Kua]
11. Revisit finished areas as new scenarios arrive, and consolidate after each period of expansion. [Foote-Opdyke, Roberts-Johnson, APOSD]
12. Match the amount of process to the reversibility of the decision, and keep investing in the code itself either way. [Bezos, APOSD]

Where the literature disagrees, do not pick a side unconditionally. `references/principles.md` lists the alternate directions, such as Lampson on not hiding power, the end-to-end argument, worse-is-better, the usability studies on constructors and factories, and Hickey on simple versus easy, each with the condition under which it wins. Report the condition, not a slogan.

## Precedence

- An explicit instruction from the user overrides the method. If it waives a gate, the output says which gate was waived and what that exposes. G5, the user's own gates, is never waived here: those gates change only where the user keeps them.
- The platform's established conventions override this skill's generic defaults: naming, the error mechanism, the async model, package layout. Code that ignores its platform's conventions is harder for every consumer, whatever its local merits.
- An established pattern in the framework's own published surface overrides a locally better one, unless the change replaces the pattern everywhere in a planned major version. Two patterns for one concept are permanent surface weight.
- The project's existing decision records are inputs. If this skill's analysis contradicts one, name the record and the evidence; do not silently override it.
- Practice-derived entries (tagged `[Practice-…]`) and literature-backed entries stand side by side; where they disagree, the stated condition decides, not the source.
- Where the user keeps a standards memory, its standing decisions count as stated preferences and its applicable gates as gate G5; this skill reads its lessons as evidence and writes lessons back only when certainty is high, following the memory's own conventions (`judgment-memory.md`). Without one, nothing changes.
- Confirmed preferences are defaults, not rules: a new framework may deliberately differ from the user's previous ones, so inherited choices are offered per aspect for the user to keep or change.
- When another loaded skill covers developer friction or one author's review method, this skill contributes its gates, published-surface weights, and compatibility analysis, and leaves naming, file layout, and refactoring inside code whose callers all live in one repository to that skill, unless a codebase-wide convention is being chosen. When a review is requested in one author's terms (for example Ousterhout's), report that author's position as his, and add the condition under which an alternate direction wins.
- A dedicated context skill, where one is installed, owns the conversation's length, compaction, and noise; this skill owns the design record and what it says (`record-check.md`).
- Working choices the user owns (where records live, whether to write documentation files unasked, tests or test checklists, decision pacing) come from the user's stated preferences, or from asking once and recording the answer; never from this skill's defaults (`session-style.md`).
- Other skills and the user's own rules that shape chat replies govern the prose around the output, including its length. The output shapes govern the design artifacts themselves.

## Output

Lead with the verdict or recommendation in one or two sentences, then the parts listed for the task in `references/output-shapes.md`, with the labels described under "Axes, dials, and labels". In a design session the full parts go into the design record, and the chat carries the decision in focus, small enough to evaluate quickly (`session-style.md`). Outside a session, the parts go into the reply or a file, as the user prefers.

## Reference files

Read each when the method or the task table points to it, not all at once.

- `references/problem-map.md`: problems indexed by signal, at architecture, code, constraint, evolution, and structure level, each mapped to forces, defaults, alternatives, principles, and verification. Read at step 2 of every task.
- `references/principles.md`: the principle catalog with sources and alternate directions. Read when a problem-map entry cites a principle you need in full, or when no entry matches.
- `references/cheat-sheet.md`: scope labels, language features that change a guideline, red flags (Ousterhout's and framework-specific), do's and don'ts by source, metaframework do's and don'ts, one-line lessons. Read for Review, and whenever a guideline from one ecosystem is applied in another.
- `references/language-cultures.md`: how code-quality cultures differ across languages and what each changes in a framework's surface, including SDKs offered in several languages. Read at step 1 for the platform the surface targets, and whenever a guideline from one language is applied in another.
- `references/domains.md`: what frameworks own, and which forces dominate, per kind of application. Read the matching section at step 1.
- `references/stacks.md`: the layer model (frontend and declarative backend metaframeworks), single- versus multi-language stacks, fast-development frameworks, TypeScript full-stack metaframeworks. Read for Stack, and at step 1 whenever more than one framework is involved.
- `references/conventions-fit.md`: analyzing whether DDD, vertical slices, feature-based structure, layers, or ports and adapters fit a project. Read for Fit.
- `references/ui-frameworks.md`: component libraries, design systems, UI frameworks, interaction behavior, and accessibility. Read for UI tasks and for any frontend surface.
- `references/research.md`: when and how to research, source order, official guideline index, query patterns, the user's past work, provenance and decay, and the research log. Read at step 3.
- `references/pattern-comparison.md`: searching, documenting, comparing, and presenting idiomatic patterns. Read for Patterns, and at step 3 when several established patterns compete.
- `references/scenarios.md`: finding and generating use-case scenarios, writing them as scenario-based specs, and walking them through design options. Read at step 5.
- `references/prototyping.md`: scratch projects and throwaway worktrees: when to use each, layout, checks, measurements, and records. Read at step 6, and in Retro for surface-reduction and refactor measurements.
- `references/tradeoffs.md`: gates, criteria, weights per task context, the benefit profile, modifiers, the scoring procedure, and the sensitivity check. Read at step 7.
- `references/judgment-memory.md`: distilling the user's preferences with provenance, researching their past framework work, and exchanging lessons with a standards memory. Read for Distill, at step 3 when past work may exist, and at step 9.
- `references/constraints-by-default.md`: providing security and business constraints by default. Read for Constraints.
- `references/enforcement.md`: build checks, analyzers, lint rules, and architecture tests that frameworks ship to keep consumers on the intended path. Read at step 8 and for Enforce.
- `references/compatibility.md`: what each kind of change breaks, per consumer role, and the techniques that keep room to evolve. Read for Change and Release.
- `references/release.md`: release guidelines for frameworks and libraries. Read for Release.
- `references/documentation.md`: developer guidance and documentation for frameworks: documentation sites, tutorials and guides, reference pages, error messages, migration guides. Read for Document, and at step 8.
- `references/session-style.md`: tactical and strategic modes, behavior in long design sessions, chat volume, choices the user owns, the design record, and writing style. Read at step 1 when the session is strategic.
- `references/record-check.md`: the design record check: the record's invariants, the check procedure, mechanical checks, repairs, approval rules, and the current-state block. Read for a record check, or to suggest one when its signals appear.
- `references/retrospective.md`: the retrospective review of finished design and code, including keep, fix, or rewrite decisions. Read for Retro.
- `references/evolution.md`: the Evolve invocation: telling lessons from preferences, writing practice-derived knowledge into this skill in generic form, grades, and private provenance. Read only for Evolve. `references/evolution-log.md` records every change made that way.
- `references/output-shapes.md`: the parts each task's output contains, the labels, and when files get a Contents list. Read at step 9.
- `references/sources.md`: full citations for every source tag, including the practice entries.
- `assets/templates/`: Markdown templates for the PRD, scenario-driven API spec, design record, task log, and research findings. Use at step 9.
