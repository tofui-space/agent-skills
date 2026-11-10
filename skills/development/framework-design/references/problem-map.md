# Problem map

Problems indexed by the signal you see, each mapped to the forces in tension, the default resolution with its condition, the alternatives and when they win, the principles behind it (IDs from `principles.md`), and how to verify the result. Source tags are expanded in `sources.md`.

Find entries by signal, not by name: a real problem usually matches two or three entries, and their combined forces are the forces of the decision. The defaults are where the literature agrees; the alternatives are where it disagrees, and each carries the condition under which it wins.

## Contents

| ID | Problem | Level |
|---|---|---|
| A1 | Framework or library: who holds control | Architecture |
| A2 | Consumers need to customize a behavior | Architecture |
| A3 | The common case takes too much setup | Architecture |
| A4 | Power users need what the high-level surface hides | Architecture |
| A5 | Configuration options keep multiplying | Architecture |
| A6 | The framework calls consumer code | Architecture |
| A7 | Several extensions must work together | Architecture |
| A8 | State, lifecycle, and resource ownership | Architecture |
| A9 | Concurrency, async, cancellation, and timeouts | Architecture |
| A10 | Third-party types leak into the surface | Architecture |
| A11 | Consumers cannot test their own code | Architecture |
| A12 | Layers repeat each other | Architecture |
| A13 | The framework generates surface from consumer declarations | Architecture |
| C1 | Many parameters, flags, or same-typed parameters | Code |
| C2 | Values need validation or meaning | Code |
| C3 | Returning nothing, or data only as text | Code |
| C4 | Errors | Code |
| C5 | A name is hard to choose | Code |
| C6 | Overloads, optional parameters, and builders | Code |
| C7 | Mutable setup objects or immutable values | Code |
| C8 | Constructors or factories | Code |
| C9 | Exposing collections and internal state | Code |
| C10 | Callback and event signatures | Code |
| C11 | Member documentation | Code |
| S1 | A business constraint must hold in every application | Constraint |
| S2 | Consumers keep skipping a required step | Constraint |
| S3 | An unsafe operation must stay possible | Constraint |
| E1 | Adding to a published surface | Evolution |
| E2 | Changing or removing published behavior | Evolution |
| E3 | Consumers depend on undocumented behavior | Evolution |
| E4 | A feature is not ready for the compatibility promise | Evolution |
| E5 | Deciding what goes into 1.0 | Evolution |
| T1 | Choosing or layering a stack | Structure |
| T2 | The cause lies in a layer you do not own | Structure |
| T3 | Choosing or judging a codebase convention | Structure |
| T4 | Finished areas have accumulated duplication and special cases | Structure |
| T5 | A design question needs evidence | Structure |

---

## Architecture

### A1 Framework or library: who holds control

**Signals**: consumers must organize their whole application around the component; they ask how to use it inside another framework; their tests need the framework running; "how do I call this from my own main loop?"

**Forces**: holding control lets the framework supply structure, lifecycle, and defaults, including constraints by default. Consumers who already run inside another framework need a component they call, not one that calls them. Two frameworks that both want control do not compose.

**Default**: build a library core that consumers call, and build the framework (the part that holds control) as a layer on top of it that uses only the library's public surface. Consumers who need control use the library; the rest get the framework.

**Alternatives**: framework-only wins when the framework's value is the control itself (lifecycle, scheduling, request dispatch, rendering) and when constraints must be enforced at a choke point that a called library cannot own. Library-only wins when most consumers already live inside another framework. [Petricek] argues for library-only in general; take that as the condition "consumers compose you with other things", not as a rule.

**Principles**: P9, P7, P16. [Fowler-IoC], [Petricek], [FDG]

**Verify**: write scenario code for "use it inside another framework's request handler" and "test the consumer's logic without starting anything". Both should work against the library layer.

### A2 Consumers need to customize a behavior

**Signals**: requests for one more flag per variation; consumers copy framework code to change one step; consumers subclass and override internals.

**Forces**: every customization point is surface in both directions: consumers depend on being called, and the framework depends on what their code does. Fewer points keep the framework free to change; too few force consumers to fork.

**Default**: choose the narrowest mechanism that covers the scenarios, preferring earlier entries in this list, because each step down adds coupling the framework must keep:

1. a value: an option, or a better default;
2. a function or strategy object passed in;
3. a handler registered in an ordered pipeline (middleware, event, hook);
4. an interface the consumer implements;
5. a base class designed and documented for subclassing.

Publish a mechanism only after at least two real, different implementations exist, preferably three. Until then keep it internal, or mark it experimental. What counts as an implementation: a second real implementation; a test double that exercises the whole contract; a named consumer committed with a date. For an internal extension point, a slot shaped after established prior art may be built before its second implementation, as long as it is not published [Practice-2026-11-3].

Two shapes are different mechanisms and earn their place differently: a **one-provider slot** (a capability exactly one extension provides, such as the authentication provider: a required interface, checked at startup for exactly one provider) and a **collected field** (something every extension contributes, merged by the framework). Check the interface, not the provider [Practice-2026-11-3].

While the framework's own options fix the order of a flow, prefer one function of named calls that reads top to bottom over a loop of registered steps, and record that outside extenders will need a second mechanism; the registration loop hides the order and pays off only once outside extenders exist [Practice-2026-11-3]. A mechanism only one consumer needs is opt-in, so that consumers who do not use it pay nothing [Practice-2026-11-3].

**Alternatives**: subclassing (a white-box framework) is acceptable early, while the abstraction is still forming and consumers are few and close; plan to move to composition (black-box) as implementations accumulate [Roberts-Johnson]. A full plugin system with its own discovery and versioning wins when third parties ship extensions on their own release cycle.

**Principles**: P8, P6, P5. [Johnson-Foote], [Roberts-Johnson], [FDG], [Bloch], [APOSD]

**Verify**: walk the extension scenarios (`scenarios.md`); build two different implementations of the extension in a scratch project (`prototyping.md`) before publishing it; when adding a member to an extension interface, compile every implementer against it, test doubles included.

### A3 The common case takes too much setup

**Signals**: the first example in the documentation needs many lines or many concepts; consumers paste the same setup block everywhere; required parameters that most callers pass identically.

**Forces**: a low barrier to entry against control for advanced consumers; defaults hide decisions that some consumers need to see.

**Default**: make the top scenario work with defaults and the fewest concepts. Layer the surface: a high-level part for common scenarios on top of a low-level part for the rest, each a distinct abstraction. Choose defaults that are safe and correct for most consumers, and document them as part of the contract, because changing a default later is a behavioral break.

**Alternatives**: when consumers are experts who build on you (framework authors, platform teams), an explicit low-level surface first can be right [Lampson]. When ease and simplicity conflict on a long-lived surface, prefer the design that keeps concerns separate even if the first example gets longer [Hickey-SME]: an API that is easy because it entangles concerns is cheap on the first day and expensive after.

**Principles**: P2, P1, P5. [APOSD], [FDG], [Lampson], [Hickey-SME]

**Verify**: count the concepts (distinct imported names and types) and lines in the top-scenario consumer code for each option; prototype if the counts are close.

### A4 Power users need what the high-level surface hides

**Signals**: forks; reflection into internals; requests to "just make this public"; consumers reimplementing parts of the framework.

**Forces**: hiding keeps the framework free to change; refusing capabilities that consumers legitimately need pushes them into fragile workarounds.

**Default**: expose the lower layer as its own deliberate surface rather than opening holes in the high-level one. Build the high-level layer only on the low-level public surface, so every high-level capability stays reachable by power users.

**Alternatives**: when the need is to choose the implementation strategy (for performance, memory, or consistency), offer a small, separate control surface over the strategy instead of exposing internals [Kiczales]. When few consumers need a capability and it is risky, offer a named escape hatch that is excluded from the compatibility promise and visible to lint. An opinionated framework may refuse raw access to the layers beneath it, to keep guarantees that raw access would break; it then resolves a consumer's conflict in this order: redesign the application, change the constraint, add a general mechanism, and only last an escape hatch. The cost is pressure to fork; record it.

**Principles**: P2, P4, P7. [Lampson], [Kiczales], [FDG]

**Verify**: list the advanced scenarios; each is reachable through a public layer without reflection or internal imports.

### A5 Configuration options keep multiplying

**Signals**: dozens of options; options that interact; most consumers set the same values; options that exist to work around a defect.

**Forces**: options let consumers adapt without code; each option exports a decision to someone with less context than the framework, and combinations multiply the states to test.

**Default**: before adding an option, ask whether consumers will be able to choose a better value than the framework can determine itself. If not, compute the value inside the framework. Group the options that remain into one options object with defaults; validate the whole configuration at startup, and fail with a message that names the key and the fix.

- **Design what omitting each setting does.** Absence never means "no check"; a setting with no safe value gets no default and is required.
- **One consequence per setting.** When a short option implies several consequences (optionality and delete behavior, for example), give each consequence its own setting and default, and make the destructive one default to refuse [Practice-2026-11-1].
- **Sharing options across many declarations**: plain spreading first, then named, mergeable units; give each option a merge rule, fail at startup on a conflict naming both sources, and provide a command that prints the effective configuration with the source of each value [Practice-2026-11-1].

**Alternatives**: convention over configuration, with no option at all, wins for fast-development frameworks whose consumers value uniformity across applications [Rails-Doctrine]. An option per variation wins only where consumers know better by nature: hosts, credentials, limits, environment-specific values.

**Principles**: P5, P10. [APOSD], [Rails-Doctrine]

**Verify**: for each option, name the scenario in which a consumer must change it. An option with no such scenario is pulled into the framework. The retrospective sweep looks for options that every consumer sets the same way.

### A6 The framework calls consumer code

**Signals**: questions about when a callback runs, on which thread, in what order; deadlocks; reentrancy bugs; an exception in consumer code that leaves the framework in a broken state.

**Forces**: consumers need predictable rules; the framework needs freedom to change its scheduling.

**Default**: for each extension point, document and keep stable: when it is called and how often; its order relative to other extension points; the thread or event loop it runs on; the state visible to it; whether it may call back into the framework; and what happens when consumer code throws, blocks, or is slow. Never call consumer code while holding a lock. Isolate failures in consumer code so that one extension cannot corrupt the framework's state.

**Alternatives**: if the order must stay free to change, document it as unspecified, and where it is cheap, vary it in development builds so that no consumer comes to depend on one order.

**Principles**: P9, P4. [Tulach], [Fowler-IoC], [Hyrum]

**Verify**: walk the concurrency and failure scenarios; add tests that throw from, block in, and re-enter from each extension point.

### A7 Several extensions must work together

**Signals**: middleware order bugs; two plugins changing the same thing; "works alone, breaks together".

**Forces**: extensions are written independently but share resources and ordering.

**Default**: make composition explicit: an ordered pipeline with documented position semantics, or declared dependencies between extensions. Give each extension its own namespace for configuration keys and state. Detect conflicts at startup, in one pre-check over the whole list that reports every problem in one error.

- **Derive safety-relevant order from declarations**, instead of trusting each author to declare it: an extension's routes must not become reachable before the authentication they depend on is active, whatever the author wrote [Practice-2026-11-3].
- **An extension never names another extension**; the application declares the links between them.
- **One registration path**: an opaque handle that only the registration step can unwrap makes registering around the list impossible.
- **Declarations that refer to each other** hold references (values from framework factories), not string names, and the framework validates all references in one generic pass by reference kind [Practice-2026-11-3]. Compile-time ordering checks over typed lists hit type-depth limits and fail on names that are not literals `{TS/JS}`; check at startup instead.

**Alternatives**: if all extensions come from one team, a fixed order in configuration is enough.

**Principles**: P9, P10. [Tulach]

**Verify**: composition scenarios: two extensions touching the same resource; a startup with conflicting extensions fails with a message naming both.

### A8 State, lifecycle, and resource ownership

**Signals**: leaks; "you must call init first"; global singletons; disposal order bugs; tests that interfere through global state.

**Forces**: globals are convenient; explicit instances are testable and allow several configurations side by side.

**Default**: no global mutable state. An explicit instance (client, application, context) owns its resources and releases them through the platform's disposal idiom. Construction leaves the object usable, with no separate initialization step. The ownership of every resource passed across the surface is documented: who closes it, and when.

**Alternatives**: a default instance for the common case is acceptable as a convenience on top of explicit instances, never instead of them.

Two lifecycle traps: an ambient transaction hides which code joins it, so pass an explicit transaction handle; and a swappable implementation behind a facade needs an explicit lifecycle (replacing it unsubscribes from the old one and subscribes to the new one), never a binding made at module load [Practice-2026-11-3].

**Principles**: P2, P10, P13. [Bloch], [FDG]

**Verify**: scenarios: two instances with different configurations in one process; tests running in parallel; shutdown under load.

### A9 Concurrency, async, cancellation, and timeouts

**Signals**: synchronous and asynchronous variants that drift apart; blocking calls inside async code; cancellation that is ignored; operations that can wait forever.

**Forces**: the platform's idiom against the framework's convenience.

**Default**: follow the platform's async model. Every operation that can wait accepts cancellation and has a finite default timeout. Document the thread-safety of each type.

**Alternatives**: offer both synchronous and asynchronous variants only when the platform has both idioms and consumers need both; otherwise offer one.

**Principles**: P12, P10. [FDG], [Bloch]

**Verify**: scenarios: cancel mid-operation; time out; use one instance from several threads or tasks at once.

### A10 Third-party types leak into the surface

**Signals**: consumers must depend on a library they never use directly; upgrading that dependency is a breaking change for the framework; the dependency's exceptions reach consumers.

**Forces**: reuse against tying every consumer to the framework's dependency choices.

**Default**: keep dependency types out of the surface: wrap them in your own types or translate at the boundary, translate errors into your own error types while keeping the cause, and keep dependencies few. When the surface must share a type with an ecosystem, use the ecosystem's standard type and declare it the way the package manager provides for shared dependencies (for example, npm `peerDependencies`) with a broad version range.

**Alternatives**: re-exporting a dependency is acceptable when the framework is an integration of that dependency and is versioned in step with it. A framework may also adopt a dependency's types as its own declaration language (a schema library for field definitions, for example); that is a deliberate coupling, not a leak: document it, treat the dependency's majors as the framework's own, and test the re-exported surface like any other.

**Principles**: P4, P7. [Bloch], [JLBP-1], [npm-peer]

**Verify**: the API report (`release.md`) contains no dependency types; a major upgrade of a dependency changes no public signature.

### A11 Consumers cannot test their own code

**Signals**: consumers mock framework internals; their tests need a network or the real clock; flaky tests that involve framework timing.

**Forces**: realism against isolation.

**Default**: ship test support with the framework: in-memory or fake implementations of the extension surfaces, a controllable clock, a test host. Make time, randomness, and I/O replaceable through the surface wherever consumer logic depends on them.

**Alternatives**: a small framework of pure functions needs no test support.

**Principles**: P1. [Tulach]

**Verify**: for each top scenario, a "test the consumer's code" scenario written against public surface only.

### A12 Layers repeat each other

**Signals**: pass-through methods; a wrapper whose surface mirrors the one it wraps; one change needs an edit in every layer.

**Forces**: layers provide abstraction; shallow layers add surface without hiding anything.

**Default**: each layer offers a different abstraction from the layer below it. Merge or deepen layers whose surfaces look alike.

**Alternatives**: a thin wrapper earns its place when it isolates a dependency that may be replaced, or translates a foreign model into the framework's own (an anti-corruption layer [Evans]).

**Principles**: P7, P3. [APOSD], [Evans]

**Verify**: for each layer, name the knowledge it hides. A layer that hides nothing is a merge candidate.

### A13 The framework generates surface from consumer declarations

**Signals**: a declarative framework derives tables, routes, validation, access control, a published contract, or clients from what consumers declare.

**Forces**: generation gives every application the same checked behavior for free; it also turns each consumer declaration into published surface for that consumer's own clients, and makes the generator the place where constraints and compatibility succeed or fail.

**Default** [Practice-2026-11-1]:

- **Build the model from the declarations alone at startup**, so that startup, migration, inspection, and tests report the same errors, each naming the module and declaration at fault.
- **Infer types from declarations** where the language can, instead of generating a type file that goes stale and repeats the shape; keep an explicit annotation as a fallback, and pin the inference with type tests at the public boundary.
- **Make silent widening a compile error** whose message names the fix, rather than letting a widened declaration quietly narrow or drop what is derived `{TS/JS}`.
- **Require an output schema on every endpoint**, and serialize responses through it, so output works as an allowlist.
- **No declaration, no surface**: an operation without an access rule gets no endpoint and no client method, rather than an endpoint that denies. Check this against the whole generated contract, not only the routes written by hand.
- **Treat a consumer's rename as a contract break** for that consumer's clients: diff the generated contract against the last release in CI, and keep a minimum client version as the fallback (`compatibility.md`).
- **Keep persisted identifiers apart from the code's organization**: a table, event, or key name derived from a module path breaks when the code is reorganized; give persisted identity its own stable name, and reserve a framework prefix for generated storage names, rejecting collisions at startup.
- **Development schema sync only adds**: it stops startup and names every statement that would lose data, instead of dropping what a declaration no longer mentions.
- **Show the effective model**: a command that prints each resolved declaration and option with its source.

**Principles**: P5, P10, P16, P17. Problem-map E1, S1.

**Verify**: scenarios for a rename, a removed field, a declaration without an access rule, and a widened type; each fails early with a message that names the fix.

---

## Code

### C1 Many parameters, flags, or same-typed parameters

**Signals**: more than about three parameters; boolean arguments; adjacent parameters of the same type; call sites such as `f(x, null, null, true)`.

**Forces**: explicitness against readable call sites and room to evolve.

**Default**: replace booleans and mode flags with an enumeration or separate operations; group optional parameters into an options object or a builder; give adjacent values of the same primitive type distinct types; keep parameter order consistent across the whole surface.

**Alternatives**: short positional lists are fine for one to three required parameters of distinct types.

**Principles**: P11, P12. [Bloch], [RustAPI]

**Verify**: the call site reads correctly without the documentation.

### C2 Values need validation or meaning

**Signals**: strings and integers for identifiers, amounts of money, units, and paths; the same validation repeated at each use; invalid states that the types allow.

**Forces**: primitives are convenient; typed values are safe.

**Default**: parse at the boundary into types that can hold only valid values, and pass those inward. Accept the most specific type that fits. Never represent money as floating point. Where declarations point at each other, use object or function references instead of string names. When two parsers in different languages read the same format, both validate from untyped input to the same standard and share one fixture corpus that includes invalid inputs [Practice-2026-11-6].

**Alternatives**: plain primitives for values that carry no invariant and are only passed through.

**Principles**: P11, P10. [Minsky], [King], [Bloch]

**Verify**: in the prototype, the misuse scenarios fail to type-check.

### C3 Returning nothing, or data only as text

**Signals**: null returns; consumers parse strings the framework produces; display text used as data.

**Default**: return an empty collection, not null. Use the platform's optional type where absence carries meaning. Give programmatic access to every piece of data that appears in a string, so that no consumer parses text the framework is free to reword.

**Principles**: P10, P4. [Bloch]

**Verify**: scenarios with empty input; no consumer scenario parses framework text.

### C4 Errors

**Signals**: consumers catch and ignore; catch-all handlers; messages that do not say what to do; implementation exceptions (driver, I/O, parser) reaching consumers.

**Forces**: errors are part of the surface, and each error type adds work in every consumer.

**Default**, in this order:

1. Redefine the operation so the error cannot occur, when the consumer does not need to know: deleting a missing entry succeeds, closing twice is harmless.
2. Handle it inside the framework when that is safe, for example a retry of an idempotent operation.
3. Report programming errors immediately and as early as possible (a type error, then a construction-time error, then a call-time error), with a message that names the argument, what was received, and the fix.
4. For failures that are expected in normal operation, offer a variant that does not throw, or a result type, following the platform's idiom.
5. Translate lower-layer errors into the framework's own error types, keeping the original as the cause.
6. When a message echoes the received value, redact data marked as personal or secret, and never expose internals in production responses (`constraints-by-default.md`).
7. If every caller only rethrows an error, aggregate it or mask it inside the framework.

**Alternatives**: do not define away an error that the consumer needs to act on; that only hides bugs [APOSD]. Do not accept malformed input liberally: tolerated input becomes surface that consumers depend on [RFC9413]. Be strict by default.

**Principles**: P10. [APOSD], [Bloch], [FDG], [RFC9413]

**Verify**: misuse scenarios produce early, actionable errors; failure scenarios leave the framework usable.

### C5 A name is hard to choose

**Signals**: names ending in Manager, Helper, or Util; several names for one concept; documentation that explains what the name means.

**Default**: one name per concept across the whole surface, following the platform's naming conventions. A name that is hard to choose signals an element that does more than one thing or an abstraction that is not yet clear: fix the design first, then the name.

**Principles**: P12, P13. [APOSD], [FDG]

**Verify**: write the element's interface comment. If it needs "and" or "or" to describe what the element is, split or rethink the element.

### C6 Overloads, optional parameters, and builders

**Signals**: overloads that differ in meaning; many optional parameters; telescoping constructors.

**Default**: overload only for the same operation on different inputs, with the same meaning and a consistent parameter order. Use an options object or builder for many optional settings. Before adding optional parameters to a published surface, check how the language compiles default values (`compatibility.md`): in some languages, adding one breaks already-compiled consumers (C# optional parameters `{.NET}`).

**Principles**: P12, P15. [FDG], [Bloch], [RustAPI]

### C7 Mutable setup objects or immutable values

**Signals**: objects that are valid only after several setter calls; thread-safety questions; defensive copies everywhere.

**Forces**: in usability studies, programmers were more effective with create-set-call than with required constructor parameters [Stylos-Clarke]; immutable values keep invariants and are safe to share between threads [Bloch].

**Default**: immutable values for data that is shared or crosses threads. For configuration, a builder or options object that is validated once and produces an immutable result, which keeps the discoverability of create-set-call while the result stays immutable.

**Alternatives**: plain create-set-call for frameworks whose tooling depends on settable properties, such as visual designers and serializers.

**Principles**: P19, P11. [Stylos-Clarke], [Bloch], [FDG]

**Verify**: prototype both shapes for the top scenario and compare the consumer code.

### C8 Constructors or factories

**Signals**: the returned type may vary; construction has a meaning worth naming; instances are cached or pooled.

**Default**: constructors for plain types, because in a usability study factories slowed programmers down compared with constructors [Ellis]. Static factories when the returned type may vary, when the construction needs a meaningful name, or when instances are cached [Bloch].

**Principles**: P19, P15. [Ellis], [Bloch]

### C9 Exposing collections and internal state

**Signals**: methods returning internal mutable collections; consumers modifying them; defensive copies at every call.

**Default**: return read-only views or immutable copies. Accept the most general collection type that the operation needs as input; return a specific, read-only type.

**Principles**: P4, P11. [Bloch], [FDG]

### C10 Callback and event signatures

**Signals**: adding information to a callback would need a new signature; several overloads of one hook.

**Default**: pass callbacks one argument object, so that fields can be added later without breaking implementers. Its fields are read-only unless the callback is meant to change them.

**Principles**: P15, P9. [FDG]

### C11 Member documentation

**Signals**: comments that restate the signature; a missing contract: units, ownership, nullability, thread-safety, errors.

**Default**: write the interface comment before the implementation: the abstraction (what the element is for, not the steps of its implementation), the contract, and everything the signature does not show. At the feature-area level, provide a sample for each top scenario.

**Verify**: for each "must" the contract states about caller input, run a violation; if nothing reports it, the contract is unenforced, and that is a defect to raise.

**Principles**: P13. [APOSD], [FDG], [Bloch]

---

## Constraint

### S1 A business constraint must hold in every application

**Signals**: the same check repeated in many handlers; incidents caused by one forgotten check; an audit asking whether a rule is enforced everywhere.

**Default**: the framework enforces the constraint at a choke point that every request or operation passes, on by default, failing closed, with an opt-out that is explicit, narrow, and named for its risk. Read `constraints-by-default.md`.

**Principles**: P16, P17. [Saltzer-Schroeder], [Kern], [BSRS]

### S2 Consumers keep skipping a required step

**Signals**: documentation that says "always call X before Y"; recurring reports of the same omission.

**Default**: make the step impossible to skip: fold it into the operation, make the input of Y obtainable only from X, or verify it at startup. Where none of these is possible, ship a lint rule or analyzer (`enforcement.md`).

**Principles**: P16, P17, P11. [Bloch], [Kern]

### S3 An unsafe operation must stay possible

**Default**: keep it separate, narrow (per call, not global), named for its risk, easy to search for, visible to lint, and absent from default examples. Where values carry safety (escaped markup, constant query text), give the safe values their own types, and make the unsafe constructor of those types the opt-out.

**Principles**: P16. [Kern], [BSRS]

---

## Evolution

### E1 Adding to a published surface

**Signals**: a new member, parameter, field, enumeration value, or callback argument on a surface with consumers.

**Default**: an addition is compatible for callers in most cases and breaking for implementers in many. Classify it per consumer role with the catalog in `compatibility.md` before writing it.

**Principles**: P15. [desRivieres], [DotNet-Rules], [SemVer]

### E2 Changing or removing published behavior

**Default**: add the new behavior beside the old one under a new name; deprecate the old one with the replacement named; keep it for at least one minor release; remove it only in a major version, with migration steps and, where the change is mechanical, a codemod. Read `compatibility.md` and `release.md`.

**Alternatives**: never remove, only add under new names [Hickey-Spec]; this suits ecosystems where many libraries depend on each other and upgrades cannot be coordinated.

**Principles**: P15. [SemVer], [Hickey-Spec], [Tulach]

### E3 Consumers depend on undocumented behavior

**Signals**: a fix or optimization breaks consumers; bug reports quote behavior the documentation never promised.

**Default**: decide whether to promise the behavior. If yes, document and test it. If no, hide or vary it so that new dependence does not form, and treat the change as breaking if many consumers already rely on it. Before changing it, run downstream consumers' tests where you can.

**Principles**: P4, P15. [Hyrum], [Tulach]

### E4 A feature is not ready for the compatibility promise

**Default**: mark it with the platform's opt-in mechanism for experimental surface, exclude it from the compatibility promise in writing, and set a review date by which it is stabilized or removed (`release.md`).

**Principles**: P15, P6. [Fowler-Published]

### E5 Deciding what goes into 1.0

**Default**: the smallest surface that covers the top scenarios; everything else internal or experimental. Each extension point has its implementations. Every element in the surface table has a reason to be published.

**Principles**: P3, P6, P15. [Bloch], [Fowler-Published]

**Verify**: scenario walkthrough: every published element is touched by at least one scenario.

---

## Structure

### T1 Choosing or layering a stack

Read `stacks.md`; weigh with the stack criteria in `tradeoffs.md`.

### T2 The cause lies in a layer you do not own

Read the layer model in `stacks.md`. Fix at the lowest layer you own; for layers you consume, choose among configure, extend, wrap, replace, contribute upstream, or pin and wait.

### T3 Choosing or judging a codebase convention

Read `conventions-fit.md`; weigh with the fit criteria in `tradeoffs.md`.

### T4 Finished areas have accumulated duplication and special cases

Read `retrospective.md`.

### T5 A design question needs evidence

Read `prototyping.md`: a scratch project for questions about a surface, a throwaway worktree for questions that need the whole repository.
