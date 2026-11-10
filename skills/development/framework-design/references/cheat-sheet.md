# Cheat sheet

Red flags, rules, do's and don'ts, and lessons from the influential literature on frameworks and metaframeworks, in a form to scan during a review or a design session. Each line points to the problem-map entry or principle that explains it.

## Contents

- Scope labels
- Language features that change a guideline
- Red flags from A Philosophy of Software Design, as they appear in frameworks
- Framework red flags
- Do and don't, by source
- Metaframeworks: do and don't
- Lessons in one line

## Scope labels

A guideline that depends on a language or ecosystem carries a scope label in braces, here and in every output of this skill: `{.NET}`, `{Java}`, `{JVM}`, `{Rust}`, `{Go}`, `{Python}`, `{TS/JS}`, `{React-based}`, `{web}`; any other language or framework uses its own name, such as `{Swift}` or `{Angular}`. An unlabeled guideline is meant to hold across ecosystems.

Code-quality cultures also differ by language (name length, namespace depth, explicitness, error and configuration idioms); `language-cultures.md` maps them and what each changes in a surface. Many classic guidelines come from one platform: Framework Design Guidelines from .NET; Bloch, Tulach, and the Eclipse guide from Java; the Rust API Guidelines from Rust. When applying one elsewhere, say whether it **transfers**, **transfers with change**, or **does not transfer**, and name the language feature it depends on. Languages give frameworks different strengths and weaknesses, and a design must respond to the ones of its own platform rather than to those of the guideline's origin.

## Language features that change a guideline

| Feature | Differs across | Guideline it changes |
|---|---|---|
| Error mechanism | Exceptions `{.NET}` `{Java}` `{Python}` `{TS/JS}`; error values `{Go}`; result types `{Rust}` | "Do not return error codes" and the Try and Tester-Doer patterns `{.NET}` transfer with change: in Go and Rust, returned errors are the idiom (problem-map C4) |
| Checked exceptions | `{Java}` only | Removing a checked exception from a signature can break callers' `catch` clauses at compile time |
| Nominal or structural typing | Structural `{TS/JS}`, implicit interfaces `{Go}`; nominal elsewhere | `{TS/JS}`: adding an optional member to an interface does not break implementers, a required one does. `{Go}`: adding a method to an interface breaks every type that implemented it, because implementation is implicit |
| Default implementations in interfaces | `{Java}` 8+, `{.NET}` C# 8+, `{Rust}` traits | A new member with a default does not break implementers; without one it does (`compatibility.md`) |
| Exhaustiveness checks | `{Rust}` `match`, `{TS/JS}` `never` checks, and other languages with checked matches | Adding an enumeration value breaks exhaustive matches; `{Rust}` `#[non_exhaustive]` declares a type open |
| Binary distribution | `{JVM}` `{.NET}` and native libraries; source distribution `{TS/JS}` `{Python}` | Binary compatibility matters where consumers ship compiled artifacts |
| Default values compiled into call sites | `{.NET}` C# optional parameters | Prefer overloads on published surface (problem-map C6) |
| Resource ownership | Garbage collection with disposal idioms `{.NET}` `IDisposable`, `{Java}` `AutoCloseable`, `{Python}` context managers; ownership `{Rust}` | Who releases a resource is expressed by the platform's idiom (problem-map A8) |
| Dynamic typing | `{Python}` `{TS/JS}` at run time | Fail-early checks shift to declaration files or type stubs, boundary validation, and lint (`enforcement.md`) |
| Visibility mechanisms | `{TS/JS}` package `exports`, `{Java}` module `exports`, Kotlin `internal`, `{Rust}` `pub(crate)`, `{.NET}` `internal`, `{Go}` `internal/` directories | The tool for declaring the published surface (`release.md`) |

## Red flags from A Philosophy of Software Design, as they appear in frameworks

The names are Ousterhout's [APOSD]; the right column is how each shows up in a framework's surface.

| Red flag | In a framework |
|---|---|
| Shallow Module | A wrapper type whose surface mirrors what it wraps; a facade that adds no defaults |
| Information Leakage | One format or rule known by both the framework and every consumer; a lower layer's concepts in the higher layer's surface |
| Temporal Decomposition | Packages named after execution steps (load, parse, render), each knowing the same format |
| Overexposure | The top scenario forces the consumer to learn rare options |
| Pass-Through Method | Framework methods that only forward to a dependency with the same signature |
| Pass-Through Variable (discussed in the chapter on layers, not in the book's red-flag summary) | One request or session value threaded through every extension signature; fix it with one documented context argument (problem-map C10) |
| Repetition | Every consumer writes the same setup or error-handling block |
| Special-General Mixture | General extension machinery entangled with one built-in feature's special cases |
| Conjoined Methods | Two operations consumers must always call together, in order |
| Comment Repeats Code | Reference documentation that restates signatures |
| Implementation Documentation Contaminates Interface | Public documentation describing internals consumers must not rely on, which then becomes surface |
| Vague Name | Manager, Helper, Util in public type names; a context type is fine when its contents are documented, since it is the fix for Pass-Through Variable |
| Hard to Pick Name | A public element whose name needs "and" or "or" |
| Hard to Describe | An extension point whose contract needs a page of caveats |
| Nonobvious Code | Inverted control with no documented order or threading; behavior that depends on registration order |

## Framework red flags

| Red flag | Signal | See |
|---|---|---|
| Speculative Extension Point | A published extension point with fewer than two real implementations | A2, P6 |
| Exported Decision | An option the framework could compute itself | A5, P5 |
| Leaked Dependency | A third-party type or exception in the public surface | A10 |
| Error From Below | A lower layer's exception reaches consumers untranslated | C4 |
| Boolean Trap | Boolean or mode-flag parameters | C1 |
| Stringly Data | Data available only inside strings | C3 |
| Required Init Step | An object unusable until a separate initialization call | A8 |
| Global Framework State | Mutable singletons; tests interfering through them | A8 |
| Lock Across Callback | Consumer code called while the framework holds a lock | A6 |
| Unspecified Callback Contract | No documented timing, order, thread, or failure handling for an extension point | A6 |
| Accidentally Open | A type consumers can subclass or implement that was not designed for it | P8 |
| Two Patterns, One Concept | Two ways to do one thing on the surface | P12 |
| Silent Default Change | A default changed in a minor or patch release | E2, `compatibility.md` |
| Unpinned Promise | Observable behavior that is neither documented and tested nor deliberately varied | E3 |
| Scattered Constraint | A business check repeated in handlers instead of enforced at a choke point | S1 |
| Unnamed Escape Hatch | An opt-out from a protection that is global, or not named for its risk | S3 |
| Doc-Only Rule | A rule stated in documentation and enforced by no check | P17 |
| Declaration-Only Gate | A protection declared in the published contract with no check behind it | `constraints-by-default.md` |
| Unchecked Data API | The in-process data API consumers' code calls skips the access rules the generated endpoints apply | `constraints-by-default.md` rule 9 |
| Duplicate Enforcement | A wrapped library enforces its own copy of a constraint beside the framework's | `constraints-by-default.md` rule 11 |
| Silent Truncation | A list or query stops at a fixed size without reporting it, so consumers pass huge limits to be safe | `constraints-by-default.md` (Limits) |
| Destructive Sync | A development schema sync drops what a declaration no longer mentions | A13 |
| String References | Declarations refer to each other by string name instead of by reference | A7, C2 |
| Ambient Transaction | Code joins a transaction it cannot see | A8 |
| Mirror Wrapper | An application wrapper that mirrors a metaframework's routing or data model | `stacks.md` |
| Unguarded Server Function `{React-based}` | A server function that does not validate its arguments or authorize the caller | `stacks.md` |
| Bundled Server Code `{web}` | A server-only module reachable from the client bundle | `stacks.md` |

## Do and don't, by source

**Framework Design Guidelines** [FDG] `{.NET}`; the principles transfer, the member-level rules transfer with change.

- Do design from scenarios: write the code samples for the main scenarios first, then the object model.
- Do keep a low barrier to entry, and layer the framework so advanced scenarios have their own surface.
- Don't provide abstractions unless several concrete implementations and consuming APIs have tested them.
- Do report failures by throwing exceptions; don't return error codes `{.NET}`. Consider the Tester-Doer and Try patterns where failure is common.

**How to Design a Good API and Why it Matters** [Bloch] `{Java}`; nearly all transfers.

- "When in doubt leave it out."
- Write multiple plug-ins before release: one probably won't support another, two will with difficulty, three will work fine.
- "Don't Make the Client Do Anything the Module Could Do."
- "Provide Programmatic Access to All Data Available in String Form."
- "Design and Document for Inheritance or Else Prohibit it."
- "Fail Fast": report errors as soon as possible after they occur; "Compile time is best."
- Return an empty collection or zero-length array, not null.

**Practical API Design** [Tulach] `{Java}`; transfers.

- Separate the API for clients from the API for providers.
- An API is more than signatures: file layouts, property files, command-line options, protocols, and localized messages are API too.
- "Never hold a lock when calling a foreign code!"

**A Philosophy of Software Design** [APOSD]; general.

- Modules should be deep; the common case should be simple.
- A simple interface matters more than a simple implementation: pull complexity down.
- Define errors out of existence, but not errors the caller needs to know about.
- Different layer, different abstraction. Design it twice. Write the comments first.

**Hints for Computer System Design** [Lampson]; general.

- Don't hide power. Use procedure arguments to provide flexibility in an interface. Leave it to the client.
- Keep basic interfaces stable; keep a place to stand if you do have to change interfaces.
- Don't generalize; generalizations are generally wrong.

**Designing Reusable Classes** and **Patterns for Evolving Frameworks** [Johnson-Foote], [Roberts-Johnson]; general for object-oriented frameworks.

- Start from three examples; generalize from real applications, not from imagined ones.
- Frameworks start white-box (inheritance) and become black-box (composition) as they mature: "A framework becomes more reusable as the relationship between its parts is defined in terms of a protocol, instead of using inheritance."

**Fowler** [Fowler-Published], [Fowler-IoC]; general.

- "Publish as little as you can as late as you can."
- Inversion of control is what makes a framework different from a library.

**Spec-ulation** [Hickey-Spec]; from Clojure, transfers.

- Grow by accretion (provide more), relaxation (require less), and fixation (fix bugs).
- "If you are going to break somebody, use a new name."

**Security** [Saltzer-Schroeder], [BSRS], [Kern], [PitOfSuccess]; general, with web examples.

- Base access decisions on permission rather than exclusion.
- Make the vulnerable code impossible to write through the API's types.
- Make the winning practice the one consumers fall into.

**Rust API Guidelines** [RustAPI] `{Rust}`; the ideas transfer where the language has the feature.

- Arguments convey meaning through types, not bool or Option.
- Structs have private fields; sealed traits protect against downstream implementations.
- Builders enable construction of complex values; functions validate their arguments.

## Metaframeworks: do and don't

`{TS/JS}` throughout; `{React-based}` where marked. Recheck against the current major (`stacks.md`).

- Do know which layer owns each behavior before fixing it: UI library, metaframework, build tool, server engine, or platform.
- Do keep server-only modules out of client bundles with the framework's build-time check (`server-only` in Next.js `{React-based}`).
- Do treat every server function as a public endpoint: validate its arguments and authorize inside it `{React-based}`.
- Do decide the rendering mode and caching per route deliberately; defaults are policy.
- Do check how the framework handles version skew between deployed client and server code.
- Don't wrap the metaframework's routing or data model in your own mirror of it.
- Don't spread platform-specific features through application code without recording the exit cost.
- Don't rely on a build-tool or adapter detail from an older major; these layers change often.

## Lessons in one line

- Every observable behavior will be depended on [Hyrum].
- You can add surface later; you cannot remove it cheaply [Bloch].
- Frameworks do not compose with other frameworks that also want control [Petricek].
- The simple interface spreads when the simple implementation ships first [Gabriel]; know which one you are trading.
- Guidelines that seemed obvious failed in usability studies: required constructor parameters and factories both slowed programmers down [Stylos-Clarke], [Ellis].
- Tolerating malformed input creates surface you never meant to publish [RFC9413].
- Each new technology spends a scarce innovation token [McKinley].
- Organizations produce designs that copy their communication structures [Conway].
- Duplication is cheaper than the wrong abstraction [Metz].
