# Tradeoff analysis

Gates first, then weights. A gate removes an option; a weight only ranks the options that remain. Mixing the two lets a large gain on one criterion buy a broken constraint, which is the failure this file exists to prevent.

## Contents

- Why frameworks need their own weights
- Gates
- Surface criteria and weights
- Stack criteria and weights
- Convention-fit criteria and weights
- Modifiers
- Benefit profile
- Procedure: weighted comparison against a datum
- Sensitivity check
- Worked example
- What the numbers are and are not

## Why frameworks need their own weights

Framework design changes who pays each cost and how often:

- Consumers pay the surface's cost (concepts to learn, code to write, failures to diagnose) on every use, for the life of the surface. The framework's team pays implementation cost once. [APOSD]
- A published surface cannot be changed cheaply, and every observable behavior becomes depended on. [Fowler-Published], [Hyrum]
- A defect in a default is copied into every application that keeps the default. [PitOfSuccess], [Kern]

So in every framework context, interface criteria outweigh implementation criteria, and the weights shift again between designing a new surface and changing an existing one.

## Gates

An option that fails a gate is out, whatever its score. A gate can be waived only by the user, explicitly; the output then names the waived gate and what the waiver exposes. G5 cannot be waived inside this skill at all: the user's own gates change only where the user keeps them.

| Gate | Passes when |
|---|---|
| G1 Constraints | Every declared business constraint holds by default on every path the option creates (`constraints-by-default.md`). |
| G2 Compatibility | Outside a major version, the option breaks no consumer role covered by the compatibility promise (`compatibility.md`). Before 1.0, the project's declared policy applies. |
| G3 Platform and legal | The option runs on every supported platform and runtime version, its dependencies' licenses are compatible, and every capability it needs exists. |
| G4 Ownership | The option changes only layers the user owns. For consumed layers it uses only: choose, configure, extend, wrap, replace, contribute upstream, pin and wait. |
| G5 The user's own gates | The option passes every gate the user has defined in their own standards memory that applies to the change (`judgment-memory.md`). |

## Surface criteria and weights

For decisions about a framework's surface: Design, Review, Change, and Retro tasks.

| ID | Criterion | What to look at |
|---|---|---|
| K1 | Common-case effort | Concepts first, then lines, in the consumer code for the top scenarios, weighted by how often consumers do each activity: reading and reviewing call sites (judge one call site read cold), writing, debugging a failure, testing, upgrading |
| K2 | Misuse resistance | How hard it is to use the surface wrongly; how visible the unsafe paths are |
| K3 | Evolvability | How many plausible future changes the option allows without breaking consumers |
| K4 | Surface weight | What must be kept for the life of the major version: types, members, behaviors, extension points |
| K5 | Advanced reach | Whether less common scenarios are possible without leaving the framework or reaching into internals |
| K6 | Consistency | Agreement with the platform's conventions and with the framework's existing surface |
| K7 | Runtime and build cost | The performance ceiling the surface's shape imposes (allocations, copies, round trips), and the build cost it imposes: heavy generics, macros, or code generation slow every consumer's build and edit loop |
| K8 | Consumer testability | Whether consumers can test their own code with public surface only |
| K9 | Build and maintenance cost | Implementation and maintenance effort for the framework's team |
| K10 | Dependency footprint | The transitive dependencies the option imposes on consumers: count, install size, version conflicts, licenses, maintenance health |

Weights from 0 (ignore) to 5 (dominant):

| Criterion | Design: new published surface | Engineering: change or fix in a published framework | Experimental or pre-1.0 surface | All consumers in one repository | Baseline: application-internal module |
|---|:-:|:-:|:-:|:-:|:-:|
| K1 Common-case effort | 5 | 4 | 5 | 4 | 3 |
| K2 Misuse resistance | 5 | 5 | 4 | 4 | 3 |
| K3 Evolvability | 4 | 5 | 2 | 2 | 2 |
| K4 Surface weight | 4 | 4 | 3 | 2 | 2 |
| K5 Advanced reach | 2 | 2 | 2 | 2 | 1 |
| K6 Consistency | 3 | 5 | 3 | 4 | 3 |
| K7 Runtime and build cost | 3 | 2 | 2 | 2 | 2 |
| K8 Consumer testability | 3 | 3 | 2 | 3 | 3 |
| K9 Build and maintenance cost | 1 | 2 | 3 | 3 | 4 |
| K10 Dependency footprint | 2 | 2 | 1 | 1 | 1 |

Reasons for the weights:

- **K1 and K2 at 5 for new surfaces.** Every consumer pays K1 on every use. A K2 failure is replicated into every application built on the framework.
- **K3 rises to 5 for engineering work on a published framework.** The surface already has consumers, so the main risk of a change is closing off future options or breaking current ones.
- **K6 rises to 5 for engineering work.** A second pattern for one concept is permanent surface weight and a choice every consumer must make. [APOSD], [FDG]
- **K7 at 3 for new surfaces, 2 for changes.** The shape of a surface fixes its performance ceiling; the implementation behind a fixed shape can be optimized later, the shape cannot. [Bloch]
- **K9 at 1 for new surfaces.** Implementation cost is paid once, by the team. It is not 0: an implementation the team cannot maintain reaches consumers as defects and slow releases, and [Gabriel] shows that implementation simplicity helps systems spread and survive.
- **Experimental and pre-1.0 surfaces lower K3 and K4.** Breaking is allowed, so evolvability matters less than learning fast; K9 rises because team speed decides how many scenarios get tried.
- **All consumers in one repository lowers K3 and K4.** The surface is public but not published: every consumer can be changed in the same commit.
- **The baseline column is for contrast only.** It shows how far the framework columns move away from ordinary application weights. Use it for throwaway or short-lived code.
- **K10 at 2 for published surfaces.** Every dependency of a library is a liability of the library and of its consumers [JLBP-1]; consumers inherit its updates, vulnerabilities, and version conflicts.

## Stack criteria and weights

For choosing or layering a stack, as author or consumer of its layers (Stack tasks, `stacks.md`).

| ID | Criterion | What to look at |
|---|---|---|
| L1 | Time to scenario | Time to the first working top scenario, and to each next one |
| L2 | Contract safety | Whether types or schemas are shared or generated across every boundary and checked at build time |
| L3 | Team fit | Languages and tools the team already knows; hiring |
| L4 | Ecosystem fit | Whether mature libraries exist for the hard concerns: identity, payments, data, machine learning, search |
| L5 | Operational cost | Runtimes, build pipelines, deploy targets, and observability added per extra language or layer |
| L6 | Exit cost | How much application code depends on one layer's proprietary features; the escape hatches |
| L7 | Layer health | Maintenance activity, release cadence, breaking-change history, governance, license; whether a piece on the critical path is in maintenance mode; the supply-chain controls available when consuming it |
| L8 | Constraint defaults | Constraints the layer enforces by default: escaping, request-forgery protection, security headers, input validation |
| L9 | Runtime fit | Performance, latency, rendering modes, and runtime APIs the scenarios need |

| Criterion | Small team, new product | Several teams, long-lived platform | Prototype or spike | Specialized compute (ML, heavy data, low latency) |
|---|:-:|:-:|:-:|:-:|
| L1 Time to scenario | 5 | 3 | 5 | 3 |
| L2 Contract safety | 4 | 5 | 2 | 4 |
| L3 Team fit | 5 | 4 | 5 | 4 |
| L4 Ecosystem fit | 4 | 4 | 3 | 5 |
| L5 Operational cost | 4 | 4 | 1 | 3 |
| L6 Exit cost | 2 | 4 | 1 | 3 |
| L7 Layer health | 4 | 5 | 2 | 4 |
| L8 Constraint defaults | 4 | 5 | 2 | 4 |
| L9 Runtime fit | 2 | 3 | 1 | 5 |

Reasons: every added language or novel layer costs learning, operations, and unknown failure modes [McKinley]; contract safety and layer health dominate when many teams depend on the stack for years; exit cost is low-weighted for a small new product because finding product fit comes first [Fowler-MonolithFirst], and high-weighted for platforms, whose consumers inherit any lock-in.

## Convention-fit criteria and weights

For judging codebase conventions (Fit tasks, `conventions-fit.md`).

| ID | Criterion | What to look at |
|---|---|---|
| F1 | Change locality | Directories or modules a typical change touches, measured from history |
| F2 | Domain fit | Complexity of the domain logic against the ceremony the convention demands |
| F3 | Ownership fit | Whether boundaries match team boundaries [Conway] |
| F4 | Onboarding | How quickly a new developer finds where code goes |
| F5 | Enforceability | Whether checks can keep the convention (`enforcement.md`) |
| F6 | Migration cost | Effort and risk of moving from the current convention |
| F7 | Stack consistency | Agreement with the conventions the stack's layers impose, such as file-based routing |

| Criterion | One team, small codebase | Several teams | Large existing codebase |
|---|:-:|:-:|:-:|
| F1 Change locality | 5 | 5 | 5 |
| F2 Domain fit | 4 | 4 | 4 |
| F3 Ownership fit | 2 | 5 | 4 |
| F4 Onboarding | 3 | 4 | 3 |
| F5 Enforceability | 3 | 5 | 4 |
| F6 Migration cost | 2 | 3 | 5 |
| F7 Stack consistency | 4 | 4 | 4 |

## Modifiers

Apply after the benefit profile (next section); cap every weight at 5 and floor it at 0.

| Condition | Adjustment |
|---|---|
| The surface sits on a hot path | K7 +2; L9 +1 |
| Callers are hard real-time or safety-certified | Paths with no allocation, no locks, and deterministic timing become part of gate G1, not a weight |
| The area handles money, health data, identity, credentials, or personal data | Move the relevant misuse cases from K2 into gate G1 |
| Public package with a large, unknown audience | K3 +1, K4 +1 |
| Consumers are themselves framework or platform authors | K5 +2, K1 −1 |
| The code is short-lived (spike, prototype, migration scaffold) | Use the baseline column |
| The user states priorities | Use them, and list each changed weight in the output |

## Benefit profile

A framework is defined as much by the benefits it chooses to stand for as by its features. Ask the user, or take from `judgment-memory.md` with its provenance, which benefits this framework prioritizes, and tune the weights with the table below.

Rules:

- **Prioritize at most four benefits.** A profile that prioritizes everything prioritizes nothing, and the tensions below make some combinations contradictory.
- **Opinionated and unopinionated exclude each other**; choose one or neither. Depth and breadth can coexist, but choose which one wins when they conflict.
- **Name the tensions you accept**: for each pair of prioritized benefits listed as in tension, write one line in the design record on how the design resolves it.
- **Benefits deprioritized on purpose are recorded too**, so that a later session does not "fix" them.

| Benefit | Means | Raise | Lower | Also adds | In tension with |
|---|---|---|---|---|---|
| Security by design | Constraints hold by default; unsafe paths are named and narrow | K2 +1, L8 +1; move misuse cases into G1 | K5 −1 | Constraint catalog review; complete-mediation test (`constraints-by-default.md`) | Flexibility, Unopinionated |
| Pit of success | The easiest path is the correct one | K1 +1, K2 +1 | K5 −1 | Review of defaults, starter template, and first examples | Flexibility |
| Fail early | Misuse is reported at the earliest stage | K2 +1 | | Stage review in `enforcement.md`; must-not-compile fixtures | Ease of learning, Familiarity in dynamically typed ecosystems |
| Developer experience (inner loop) | Fast feedback, clear errors, and little ceremony while writing, running, and debugging; upgrade friction is covered by Stable APIs | K1 +1, K8 +1, L1 +1 | | Error-message review; time to first working scenario, measured in a prototype | Stable APIs, when an improvement needs a break |
| Familiarity | Looks and behaves like the platform and its well-known frameworks | K6 +2 | | Pattern comparison against the ecosystem's idiom (`pattern-comparison.md`) | Opinionated designs that depart from the idiom; Fail early in dynamically typed ecosystems |
| Flexibility | Consumers can replace or extend most parts | K5 +2 | K4 −1 | Extension scenarios for every replaceable part | Pit of success, Security by design, Stable APIs |
| Opinionated | One way to do each thing; conventions instead of options | K1 +1, F7 +1 | K5 −1 | Generators and lint rules that encode the conventions | Flexibility, Unopinionated |
| Unopinionated | Consumers choose structure and companion tools | K5 +1, K6 +1 | K1 −1 | Integration scenarios with several companion tools | Pit of success, Opinionated |
| Stable APIs | Upgrades rarely require consumer changes | K3 +1, K4 +1; G2 covers behavioral breaks too | | Compatibility checker and downstream tests in CI (`release.md`) | Developer experience improvements that need breaks; "progress over stability" |
| Depth | Few concepts, much functionality behind each | K1 +1, K4 +1 | | Surface measurements (`prototyping.md`) | Breadth |
| Breadth | Many concerns covered in the box | L1 +1 | K4 −1, K10 −1 | A consistency review across the included concerns | Depth, Small dependency graph |
| Boundaries | Module and layer boundaries are explicit and checked | F1 +1, F5 +2 | | Architecture tests shipped with the framework (`enforcement.md`) | Ease of learning, Flexibility |
| Ease of learning | Newcomers succeed quickly | K1 +1, F4 +1, L3 +1 | | Newcomer scenarios; concept counts | Flexibility, Fail early, Boundaries |
| Small dependency graph | Few transitive dependencies imposed on consumers | K10 +2 | | Dependency audit: count, licenses, maintenance | Breadth |

Apply the adjustments in this order, capping every weight at 5 and flooring it at 0: the context column, then the benefit profile, then the modifiers, then any priorities the user states explicitly. List every adjusted weight in the output with its reason.

## Procedure: weighted comparison against a datum

This is a weighted form of Pugh's concept-selection matrix: each option is scored relative to one reference option, which avoids pretending to measure absolute quality.

1. **Choose the datum**: the current state for Change, Fit, and Retro tasks; the simplest option for Design tasks.
2. **Score each other option per criterion** as −1, 0, or +1 relative to the datum. Use −2 or +2 only with a measurement: prototype numbers, change-coupling data, a published empirical study (not an opinion or a design guideline).
3. **Give every non-zero cell one line of evidence**, labeled by kind: measured (a run in this session), researched (a cited source), or reasoned (an argument not yet tested).
4. **Compute** each option's score as the sum of weight × cell.
5. **Run the sensitivity check** below.
6. **Present** the table, the scores, the evidence lines, and the sensitivity result. In a design session, the table goes into the design record and the chat carries the verdict and the deciding criterion (`session-style.md`).

## Sensitivity check

For each criterion, raise and lower its weight by 1 and recompute; then drop each criterion once and recompute. If the winner never changes, the decision is robust: say so in one line. If it changes, the decision is close:

- name the criterion whose weight decides it;
- if that criterion depends on product intent, audience, schedule, or risk appetite, present the decision to the user with both options and what each changes;
- if it depends on a fact, get the fact: research it or prototype it.

A close decision settled by "reasoned" cells alone is a candidate for a prototype (`prototyping.md`).

## Worked example

A board-game engine lets game authors plug in their rules. Context: Design, new published surface; consumers are hobbyist game authors. The cell values below are illustrative.

- **Option A (datum)**: game authors subclass an abstract `Game` and override `legalMoves`, `applyMove`, and `isOver`.
- **Option B**: game authors call `defineGame({ legalMoves, applyMove, isOver })` with plain functions over an immutable game state.

| Criterion | Weight | B vs A | Evidence |
|---|:-:|:-:|---|
| K1 Common-case effort | 5 | +1 | reasoned: no base-class lifecycle to learn |
| K2 Misuse resistance | 5 | +1 | reasoned: rules cannot mutate engine state mid-move |
| K3 Evolvability | 4 | +1 | researched: adding an optional function to a definition object does not break existing games; adding an abstract method breaks every subclass [desRivieres] |
| K4 Surface weight | 4 | 0 | |
| K5 Advanced reach | 2 | −1 | reasoned: subclasses can override engine internals; plain functions cannot |
| K6 Consistency | 3 | 0 | |
| K7 Runtime cost | 3 | −1 | reasoned: a new state per move; a prototype would settle it |
| K8 Consumer testability | 3 | +1 | reasoned: rules are testable without the engine |
| K9 Build cost | 1 | 0 | |

Score of B against A: 5 + 5 + 4 − 2 − 3 + 3 = +12. Moving any single weight by one point leaves B ahead, so the decision is robust. The K7 cell is reasoned only; a scratch prototype measuring a long game would turn it into evidence before the surface is published.

## What the numbers are and are not

The weights are this skill's defaults, derived from the priorities the literature states: who pays which cost, how often, and for how long. They are not measured. The gates and the sensitivity check carry more of the decision than the exact numbers. When the user states priorities, adjust the weights to match and list the changes in the output.
