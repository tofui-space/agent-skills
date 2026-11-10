# Principle catalog

Each principle has a statement, the reason it holds for frameworks, its sources (tags expanded in `sources.md`), the problem-map entries it serves, and its alternate directions: works that refine or contradict it, each with the condition under which the alternate wins. Report the condition, not a slogan.

## Contents

| ID | Principle |
|---|---|
| P1 | Design from scenarios |
| P2 | The common case is simple; power stays reachable |
| P3 | A small, deep surface |
| P4 | Hide by default; everything observable is surface |
| P5 | Pull complexity down |
| P6 | General-purpose interface, today's implementation |
| P7 | Different layer, different abstraction |
| P8 | Extend by composition; seal the rest |
| P9 | Inverted control is a contract |
| P10 | Define errors away, or report them early |
| P11 | Types carry meaning |
| P12 | One name per concept; consistency over local improvement |
| P13 | Documentation is part of the design |
| P14 | Design it twice |
| P15 | Evolve by addition |
| P16 | Constraints hold by default |
| P17 | Enforce at the earliest reliable stage |
| P18 | Consolidate after expansion |
| P19 | Usability is measured, not argued |
| P20 | Spend novelty where it pays |
| P21 | Structure by what changes together |
| P22 | Match the investment to the reversibility of the decision |

---

### P1 Design from scenarios

**Statement**: write the consumer code for the top scenarios first, then design the types that make that code work.

**Why**: a surface designed from its object model fits the designer's mental model; consumers meet it through tasks. Writing the task code first exposes concept count, ceremony, and naming problems before they are published.

**Sources**: [FDG] scenario-driven design; [Bloch] write to the API early and often; [Myers-Stylos].

**Serves**: A3, A11, E5, and every Design task.

**Alternate directions**: none contradicts it. [Robillard] refines it: developers learn APIs mainly through examples and documentation of intent, so the scenario code is also the first documentation.

### P2 The common case is simple; power stays reachable

**Statement**: the top scenario works with defaults and few concepts; less common scenarios are served by a lower layer that remains publicly reachable.

**Why**: most consumers live in the common case, and every concept they must learn there is paid on every use. Power users who cannot reach what they need fork or reflect into internals, which pins the internals.

**Sources**: [APOSD] the common case should be simple, defaults; [FDG] low barrier to entry, layered architecture, progressive framework; [Lampson] "Don't hide power".

**Serves**: A3, A4, A8.

**Alternate directions**:

- [Hickey-SME]: easy (familiar, close at hand) is not simple (not entangled). When the easiest first example requires entangling concerns, prefer the simple design for long-lived surfaces.
- [Kiczales]: when consumers need to influence the implementation strategy for performance, a separate meta-level control surface beats both full hiding and full exposure.
- [Least-Power]: give consumers the least expressive mechanism that does the job (a declarative option over a callback, a callback over a subclass), so that their input stays analyzable by the framework.

### P3 A small, deep surface

**Statement**: a module's surface should be much smaller than the functionality it provides. When in doubt, leave it out.

**Why**: everything published is kept for the life of the major version; anything left out can be added later. Conceptual weight, not member count, is what consumers pay.

**Sources**: [APOSD] modules should be deep; [Bloch] "when in doubt, leave it out", conceptual weight; [Parnas79] minimal subsets and minimal extensions.

**Serves**: A12, E5, and the surface-reduction sweep in `retrospective.md`.

**Alternate directions**: [Ousterhout-Martin]: the public discussion between Ousterhout and Robert C. Martin disagrees on method length and decomposition. For a framework, depth matters most at the published surface, because consumers pay for that surface; shallow internals do not cost consumers, but they still cost the framework's own maintainers, so internal depth stays a concern for the team, judged with the same reasoning.

### P4 Hide by default; everything observable is surface

**Statement**: publish deliberately; everything else is internal. Treat every observable behavior (ordering, timing, error text, defaults) as something consumers will depend on.

**Why**: what consumers cannot see, the framework can change. Hyrum's law says the contract alone does not protect you: with enough consumers, every observable behavior is depended on.

**Sources**: [Parnas72] hide design decisions likely to change; [APOSD] information hiding and leakage; [Tulach] do not expose more than you want, the broad definition of an API; [Bloch] minimize accessibility; [Hyrum].

**Serves**: A4, A6, A10, C3, C9, E3.

**Alternate directions**:

- [Lampson] "Don't hide power": hiding that removes a capability consumers need is not information hiding, it is a missing feature.
- [Acton] data-oriented design: when performance is the requirement, design around data layout and access patterns, and expose them, instead of hiding representation.
- [Rails-Doctrine] "Provide sharp knives": a framework for experienced application developers may expose powerful tools and trust consumers with them; the cost is a weaker compatibility position on everything exposed.
- [Miller-Ocap] refines hiding into hiding authority: a component gets only the capabilities it is handed.

### P5 Pull complexity down

**Statement**: when complexity is unavoidable, put it in the framework's implementation, not in its surface. It is more important for a module to have a simple interface than a simple implementation.

**Why**: the framework's team pays implementation complexity once; consumers pay surface complexity on every use.

**Sources**: [APOSD] pull complexity downwards, configuration parameters; [Bloch] don't make the client do anything the module could do.

**Serves**: A2, A3, A5, C4.

**Alternate directions**:

- [E2E] end-to-end argument: a function that can be implemented completely and correctly only with knowledge that the consumer holds does not belong in the lower layer, except as a performance enhancement. [Lampson] "Leave it to the client" says the same for interfaces.
- [Gabriel] worse is better: the New Jersey approach puts implementation simplicity above interface simplicity, and such systems spread and survive. Condition: when time to availability and portability dominate, and consumers will tolerate rough edges.
- [Bernhardt] functional core, imperative shell: push effects out to the edges rather than down into the core.

### P6 General-purpose interface, today's implementation

**Statement**: give the interface the general shape of the concept, implement only what current scenarios need, and publish extension points only after real implementations exist. A test double that exercises the whole contract, or a named consumer committed with a date, can count as one; a one-provider slot is a different mechanism (problem-map A2).

**Why**: a general interface survives new scenarios without breaking; a speculative extension point is a published promise nobody has tested.

**Sources**: [APOSD] somewhat general-purpose modules; [Roberts-Johnson] Three Examples; [FDG] no abstractions without several concrete implementations; [Bloch] write several plug-ins before release.

**Serves**: A2, E4, E5, and the generalization sweep in `retrospective.md`.

**Alternate directions**:

- [Metz] duplication is far cheaper than the wrong abstraction: unify only when the instances change for the same reason.
- [Lampson] "Don't generalize; generalizations are generally wrong."
- [Least-Power] refines: a general mechanism can still accept least-power input.

### P7 Different layer, different abstraction

**Statement**: adjacent layers offer different abstractions; a layer whose surface mirrors the one below adds surface and hides nothing.

**Sources**: [APOSD] different layer, different abstraction, pass-through methods; [FDG] layered architecture.

**Serves**: A1, A4, A10, A12.

**Alternate directions**: [Evans] anti-corruption layer: a thin translating layer earns its place when it keeps a foreign model out of your own.

### P8 Extend by composition; seal the rest

**Statement**: prefer extension through values, functions, and small interfaces over subclassing; seal or close what is not designed for extension; keep the call surface and the extension surface separate.

**Why**: subclassing couples the extension to the base class's implementation; callers and implementers have opposite compatibility needs, so one surface cannot serve both well.

**Sources**: [Johnson-Foote] white-box and black-box frameworks; [Roberts-Johnson]; [Bloch] design and document for inheritance or else prohibit it; [RustAPI] sealed traits; [Tulach] separate APIs for clients and providers; [APOSD] on implementation inheritance.

**Serves**: A2, E1.

**Alternate directions**: white-box frameworks are the normal early stage [Roberts-Johnson]; inheritance is acceptable while consumers are few and the abstraction is still forming, with a planned move to composition.

### P9 Inverted control is a contract

**Statement**: when the framework calls consumer code, when, how often, in what order, on which thread, and with what failure handling are all part of the surface.

**Sources**: [Fowler-IoC]; [Tulach] runtime aspects of APIs, deadlocks.

**Serves**: A1, A6, A7, C10.

**Alternate directions**:

- [Petricek]: build libraries rather than frameworks, because frameworks do not compose and are hard to explore. Condition: consumers compose your component with others.
- [Cockburn-Hex] ports and adapters: the application is the host and frameworks are adapters at its edge.

### P10 Define errors away, or report them early

**Statement**: remove an error by redefining the operation when the consumer does not need to know about it; otherwise report it as early as possible, with a message that tells the consumer what to do.

**Sources**: [APOSD] define errors out of existence, including its warning against taking it too far; [Bloch] fail fast, ideally at compile time; [FDG] exception design, Tester-Doer and Try patterns; [RFC9413].

**Serves**: A5, A8, A9, C2, C3, C4.

**Alternate directions**: the robustness principle ("be liberal in what you accept") is no longer considered best practice in all cases [RFC9413]: tolerated input becomes de facto surface.

### P11 Types carry meaning

**Statement**: use types to make invalid inputs and states unrepresentable; parse at the boundary instead of validating at each use.

**Sources**: [Bloch] parameter and return types; [RustAPI] arguments convey meaning through types, builders; [Minsky]; [King].

**Serves**: C1, C2, C7, C9, S2.

**Alternate directions**: rich types turn into type gymnastics where the language lacks the features to express them; apply them at boundaries and on the published surface, and keep internals plain where the types would obscure more than they protect.

### P12 One name per concept; consistency over local improvement

**Statement**: one name for each concept across the whole surface; follow the platform's conventions; a new member follows the established pattern even when another would be better in isolation.

**Why**: every second pattern for one concept is permanent surface weight and a choice consumers must make on every use.

**Sources**: [APOSD] choosing names, consistency; [FDG] naming guidelines; [Bloch] API must coexist peacefully with the platform.

**Serves**: A9, C1, C5, C6.

### P13 Documentation is part of the design

**Statement**: write the interface comment before the implementation; an element that is hard to describe is badly designed. Every top scenario has a sample. The comment describes the abstraction (what the element is for and promises), not what its code does step by step; "self-documenting code" can show the steps, never the abstraction.

**Sources**: [APOSD] write the comments first; [FDG]; [Bloch] document religiously.

**Serves**: A8, C5, C11.

### P14 Design it twice

**Statement**: produce at least two options that differ in kind before choosing.

**Sources**: [APOSD] design it twice.

**Serves**: every Design and Change task (method step 4).

### P15 Evolve by addition

**Statement**: add beside, deprecate, and remove only in a major version with a migration path; keep a stable place to stand for consumers during the move.

**Sources**: [SemVer]; [Hickey-Spec] accretion, relaxation, and fixation instead of breakage, and a new name for anything that would break; [Tulach]; [Lampson] keep basic interfaces stable, keep a place to stand; [Fowler-Published].

**Serves**: C6, C8, C10, E1, E2, E4, E5.

**Alternate directions**: [Rails-Doctrine] "Progress over stability": a fast-moving framework may break more often when it ships migration tooling and its consumers accept regular upgrades. The cost lands on every consumer at every upgrade.

### P16 Constraints hold by default

**Statement**: business constraints are enforced by the framework at a choke point, on by default, failing closed, with an opt-out that is explicit, narrow, and named for its risk.

**Sources**: [Saltzer-Schroeder] fail-safe defaults, complete mediation, psychological acceptability; [PitOfSuccess]; [Kern]; [BSRS] frameworks to enforce security and reliability; [Wang-Bangert-Kern]; [CISA-SbD]; [OWASP-PC] secure-by-default configurations.

**Serves**: A1, S1, S2, S3.

**Alternate directions**: [Rails-Doctrine] "Provide sharp knives" accepts more consumer risk for more power; [Miller-Ocap] refines enforcement: authority passed explicitly as references needs fewer checks than ambient authority.

### P17 Enforce at the earliest reliable stage

**Statement**: a rule that matters is checked by the type system, a shipped analyzer or lint rule, a build check, an architecture test, or a startup check, at the earliest stage that can decide it without false alarms.

**Sources**: [Bloch] report errors as soon as possible, ideally at compile time; [Ford-Parsons-Kua] fitness functions; [Wang-Bangert-Kern] if it's not secure, it should not compile.

**Serves**: S1, S2, and `enforcement.md`.

### P18 Consolidate after expansion

**Statement**: framework design is iterative: periods of adding scenarios are followed by periods of consolidation, in which duplication is merged, special cases are generalized, and surface is reduced.

**Sources**: [Foote-Opdyke] prototype, expansion, and consolidation phases; [Opdyke] refactoring object-oriented frameworks; [Roberts-Johnson]; [APOSD] strategic programming, modifying existing code; [Fowler-Refactoring].

**Serves**: T4 and `retrospective.md`.

**Alternate directions**: [Metz] the wrong abstraction; [Brooks] the second-system effect: a consolidation that adds every deferred idea at once produces an overdesigned successor.

### P19 Usability is measured, not argued

**Statement**: where guidelines disagree about usability, prefer evidence from consumers using the surface (studies, prototypes with real scenario code) over the guideline.

**Sources**: [Clarke-CD] cognitive dimensions for APIs; [Myers-Stylos]; [Stylos-Clarke] required constructor parameters; [Ellis] factories; [Robillard].

**Serves**: C7, C8, and `prototyping.md`.

### P20 Spend novelty where it pays

**Statement**: choose well-understood layers for everything that is not the product's distinguishing value; each new technology costs learning, operations, and failure modes that are not yet known.

**Sources**: [McKinley] innovation tokens; [Rails-Doctrine] the menu is omakase, value integrated systems; [Fowler-MonolithFirst].

**Serves**: T1 and `stacks.md`.

### P21 Structure by what changes together

**Statement**: draw module and directory boundaries around knowledge that changes together, not around technical role or execution order.

**Sources**: [Parnas72]; [APOSD] temporal decomposition; [Bogard] vertical slices; [Tornhill] change coupling; [Khononov-Coupling]; [Conway]; [Team-Topologies].

**Serves**: T3 and `conventions-fit.md`.

### P22 Match the investment to the reversibility of the decision

**Statement**: decisions that are expensive to reverse (published surface, defaults, extension points, stack layers) get a strategic design session; decisions that are cheap to reverse (internal code, prototypes) get less process. Less process is not less care: the code itself keeps receiving small, continual design investments.

**Sources**: [Bezos] one-way and two-way doors, for the amount of process; [APOSD] strategic versus tactical programming, for the continual investment in the code itself.

**Serves**: the session style in `session-style.md`.
