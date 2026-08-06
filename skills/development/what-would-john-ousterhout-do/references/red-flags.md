# Red-flag catalog (APOSD, 2nd ed.)

Each entry: what it is, how to detect it in code, and the standard fix direction. Flag names are Ousterhout's — use them verbatim in findings so the user can look them up.

## Shallow Module
Interface complexity is comparable to (or exceeds) the functionality provided. The module doesn't hide enough to pay for the cost of learning its interface.
- **Detect**: wrapper classes that mostly forward; interfaces where reading the signature teaches you nearly everything the implementation does; "manager"/"helper" classes with one trivial method each.
- **Fix**: merge into the caller or into an adjacent module; or deepen — absorb responsibilities the callers currently handle themselves.

## Information Leakage
The same knowledge (a format, a protocol, an ordering, a business rule) is used in multiple modules, so a change to that knowledge touches all of them — even without any direct call between them.
- **Detect**: ask "if X changed, which files change?" for each design decision X. More than one answer = leakage. Common carriers: shared file formats, wire formats, DB schemas read in several places, duplicated validation rules.
- **Fix**: introduce one module that owns the knowledge and exposes a higher-level interface; or merge the leaking modules.

## Temporal Decomposition
Module structure mirrors execution order (read → parse → process → write as four modules) instead of knowledge. Steps that share knowledge get separated, causing leakage.
- **Detect**: module names that are verbs in a sequence; two modules that both understand the same format because one produces and one consumes it.
- **Fix**: structure around knowledge — one module owns the format and does both read and write.

## Overexposure
The API for common cases forces callers to learn about rare cases.
- **Detect**: mandatory parameters that 90% of call sites pass identically; setup steps required before the common operation.
- **Fix**: defaults; split rare-case knobs into separate optional methods.

## Pass-Through Method
A method that does little but call another method with a similar signature. Adds an interface without adding functionality; blurs responsibility between classes.
- **Detect**: body is a single delegation; signatures nearly identical across layers.
- **Exception**: dispatchers, interfaces-with-multiple-implementations, and deliberate boundary layers (anti-corruption layers, adapters isolating a third-party API) are not this flag — they exist to hide a dependency, which is functionality.
- **Fix**: expose the lower class directly, redistribute responsibilities, or merge the classes.

## Pass-Through Variable
A variable threaded through many method signatures that most intermediates don't use.
- **Detect**: same parameter appearing in long call chains untouched.
- **Fix**: context object (used sparingly — it creates a global-ish dependency; document its contents and treat additions as design decisions).

## Repetition
The same nontrivial snippet appears repeatedly.
- **Detect**: copy-paste blocks; parallel switch/if chains over the same discriminant in several places.
- **Fix**: usually signals a missing abstraction — factor the repeated knowledge into one place; reordering code so the snippet is needed once also counts.

## Special-General Mixture
A general-purpose mechanism contains code for a specific use case.
- **Detect**: a core class that knows the name/behavior of one particular caller or feature; `if (isSpecialCase)` inside general code.
- **Fix**: push the special case up into the caller; keep the lower layer general.

## Conjoined Methods
Two methods that can only be understood together.
- **Detect**: you must read method B to know what method A did to shared state; hidden ordering contracts between calls.
- **Fix**: merge them, or redraw the split so each is independently understandable.

## Comment Repeats Code
The comment restates what the code says at the same level of detail.
- **Detect**: comment uses the same words as the identifiers; deleting it loses nothing.
- **Fix**: rewrite at a different level — higher (intent, abstraction) or lower (precise units, boundary conditions, invariants).

## Implementation Documentation Contaminates Interface
Interface comments describe implementation details callers don't need.
- **Detect**: docstrings mentioning internal data structures, algorithms, private helpers.
- **Fix**: interface comment states only what callers need: behavior, arguments, return, side effects, exceptions/contract. Implementation notes move inside.

## Vague Name
A name so broad it carries no information (`data`, `info`, `manage`, `process`, `handle`, `util`).
- **Detect**: the name would fit dozens of unrelated things in the codebase.
- **Fix**: rename to the specific thing; if no specific name exists, that's the next flag.

## Hard to Pick Name
No precise name exists for the entity — a design signal, not a thesaurus problem. The entity likely has a murky identity or mixed responsibilities.
- **Detect**: naming discussion stalls; every candidate name is wrong for part of the behavior.
- **Fix**: split or redefine the entity until a natural name appears.

## Hard to Describe
The comment needed to fully describe a method or variable is long.
- **Detect**: interface docstring needs many paragraphs, multiple "however"/"unless" clauses, or a state-machine explanation.
- **Fix**: the interface is too complex — simplify the contract, not the comment.

## Nonobvious Code
The behavior or meaning of code can't be understood from a quick read.
- **Detect**: relies on distant invariants, event ordering, or generic containers (tuples/dicts as records) whose meaning isn't local; clever expressions needing mental execution.
- **Fix**: make meaning local — named types instead of generic containers, explicit structure, or a comment stating the invariant.

---

# Decision heuristics used across flags

- **Depth test**: benefit = functionality provided − cost of learning the interface. Negative or near-zero → shallow.
- **Change test**: enumerate the 2–3 most plausible future changes; count files each would touch. Amplification >1 module for one logical change → leakage somewhere.
- **Caller test**: read a call site cold. Everything the reader must look up elsewhere is cognitive load charged by the interface.
- **Exception test**: for each raised error, ask "could semantics be redefined so this isn't an error?" and "does any caller handle this distinctly, or do they all wrap-and-rethrow?" All-rethrow → aggregate or mask.
