# Scenario testing of designs

Test a design at the conceptual level, before code: walk each use-case scenario through each design option and see whether the option accommodates it, needs a change for it, or collides with it. This is how a design meets its consumers before it has any.

The method combines scenario-based architecture evaluation [SAAM], [ATAM], use cases and misuse cases [Cockburn-UC], [Sindre-Opdahl], specification by example [Adzic], and scenario-driven API design [FDG].

## Contents

1. Collect scenarios
2. Generate scenarios along fixed axes
3. Prioritize
4. Write them as scenario-based specs
5. Walk every scenario through every option
6. Read the matrix
7. Keep and reuse the scenario set

## 1. Collect scenarios

Start from what exists:

- scenarios the request names;
- tasks visible in the project: issues, questions, examples, the consumer code of existing users;
- tasks that comparable frameworks document: their guides and tutorials list what consumers actually do (`research.md`).

## 2. Generate scenarios along fixed axes

Collected scenarios cluster around the happy path. Generate the rest systematically, one or more per axis. The examples use a library that reads bus timetables.

| Axis | Ask | Example |
|---|---|---|
| Consumer kinds | What does a newcomer, an everyday user, a power user, an extender, an operator, and a tester each need? | A tester needs timetables without network access. |
| Consumer activities | How often does each consumer read or review a call site, write one, debug a failure, test, and upgrade? Weight scenarios by that frequency; trading a frequent activity for a rare one is the most common error. | Call sites are read far more often than written. |
| Common use | What are the three to five tasks most consumers do? | Next departures from one stop. |
| Advanced use | What do a minority need that the common surface hides? | Custom ranking of connections. |
| Extension | What does a new implementation of each extension point look like? A third-party plugin? | A second timetable data source. |
| Change | Which changes in requirements, platform, or dependencies are likely in the next years? | A second timezone; a new feed format. |
| Quality attributes | What must hold for performance, availability, security, observability? Write each in six parts: source of stimulus, stimulus, artifact, environment, response, response measure [Bass-SAP]. | 500 concurrent lookups return within 200 ms on one instance. |
| Misuse and abuse | What does a consumer do wrong by accident? What does an attacker try? [Sindre-Opdahl] | A stop identifier from user input is passed unchecked. |
| Failure | What happens when a dependency is down, slow, or returns garbage, or consumer code throws? | The feed times out mid-update. |
| Lifecycle and upgrade | Startup, shutdown, reload, upgrade from the previous major, two versions in one process, client and server deployed at different versions. | A consumer upgrades with deprecated calls still in place. |
| Scale and boundaries | Zero, one, many, very many; empty input; limits. | A stop with no departures today. |
| Concurrency | Two operations at once; re-entry from a callback; cancellation. | Two refreshes of the same feed overlap. |
| Composition | Two extensions together; the framework inside another framework; inside a test. | Two data sources disagree on a departure. |
| Constraints | One scenario per business constraint, phrased as the attempt it must stop. | An anonymous consumer requests another operator's private feed. |

## 3. Prioritize

Rank each scenario by importance (high, medium, low) and by expected difficulty for the design (high, medium, low), as in the utility tree of [ATAM]. Walk every high-importance scenario and every high-difficulty scenario. For a design session, 15 to 30 scenarios is usually enough; past that, merge scenarios that touch the same elements in the same way.

## 4. Write them as scenario-based specs

Give each scenario a stable ID (SC-1, SC-2, …) and one of three forms:

- **Consumer code**, for scenarios about the surface: the code the consumer would write. It exposes concept count and ceremony.
- **Given / when / then**, for behavior: one precondition, one action, one observable outcome.
- **Six-part quality scenario**, for quality attributes, so that the response measure is a number, not an adjective.

Keep the set in the design record (`session-style.md`), not only in chat: it is reused by later Change and Retro tasks.

When the design may be reimplemented, or must outlive its dependencies, state each requirement at an observable boundary (the wire contract, the stored schema, the behavior at build and startup) and name no implementation library; implementation choices then sit in a separate, replaceable mapping [Practice-2026-11-1]. A proposed mechanism that no scenario needs is parked with its date, and reopened only when a scenario does [Practice-2026-11-5].

## 5. Walk every scenario through every option

For each scenario and option, trace the surface elements and internal parts the scenario touches, then classify:

| Result | Meaning |
|---|---|
| **Accommodated** | Works with the option as designed, with no surface change (a "direct" scenario in [SAAM]). |
| **Needs change** | Works after a named change to the surface (an "indirect" scenario); say whether the change is compatible or breaking (`compatibility.md`). |
| **Collides** | Contradicts a decision of the option or fails a gate (`tradeoffs.md`); name which. |

Record the result as a matrix, scenario by option, with the touched elements:

| Scenario | Option A | Option B |
|---|---|---|
| SC-1 Next departures | Accommodated: `Timetable.next` | Accommodated: `query().next` |
| SC-4 Second data source | Needs change, breaking: new abstract member on `Source` | Accommodated: register a function |
| SC-9 Anonymous private feed | Collides: no authorization hook before the fetch | Accommodated: policy runs in the pipeline |

A walkthrough is reasoning, not measurement. Label its cells "reasoned" in the evidence, and promote a cell to "measured" by building the scenario in a scratch project (`prototyping.md`).

## 6. Read the matrix

- **A high-importance scenario that collides** removes the option or forces its redesign.
- **Counts of "needs change" on change scenarios** are the evidence for evolvability (K3 in `tradeoffs.md`).
- **An element touched by many unrelated scenarios** is likely to change for many reasons. Scenario interaction measures how well the architecture separates concerns [SAAM]; high interaction on one element is a sign that it mixes them.
- **A published element touched by no scenario** is a candidate to make internal or remove (surface reduction).
- **Options that accommodate everything** are separated by the weights, not by the walkthrough.

## 7. Keep and reuse the scenario set

The scenario set is a specification at the conceptual level:

- Rerun the walkthrough on every Change task and every Retro, with the new option or the current design.
- Turn the checkable scenarios into prototype checks: consumer code that must type-check and run, misuse code that must fail to compile.
- Turn them later into the framework's own tests and documentation samples, so that the scenarios the design was chosen for keep being checked; or, where the user writes the tests, hand over the scenarios as a checklist for whoever writes them (`session-style.md`, Choices the user owns).
