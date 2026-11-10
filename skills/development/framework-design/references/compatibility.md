# Compatibility

What each kind of change breaks, for whom, and the techniques that keep room to evolve. Classify a change per consumer role before writing it: most changes that are safe for callers are breaking for implementers, and the reverse.

## Contents

- Consumer roles
- Kinds of compatibility
- Change catalog
- Techniques that keep room to evolve
- Undocumented behavior
- Before 1.0

## Consumer roles

| Role | Depends on |
|---|---|
| Caller | The call surface: names, signatures, return values, errors, behavior |
| Implementer | An interface, trait, protocol, or callback shape it implements for the framework to call |
| Subclasser | A base class's overridable members, and when and how the framework calls them |
| Data producer or reader | File formats, configuration keys, serialized forms, environment variables, command-line flags |
| Output reader | Log formats, error codes, error messages, any text a tool parses |

Callers and implementers have opposite needs: a caller is helped when the framework accepts more and promises more; an implementer is broken when the framework demands more [desRivieres], [Tulach]. Keep the two surfaces separate so that each can evolve by its own rules.

## Kinds of compatibility

| Kind | Holds when |
|---|---|
| Source | Consumer code still compiles or type-checks against the new version. |
| Binary | Consumer code already compiled against the old version still links and runs. It matters most where consumers ship compiled artifacts (JVM, .NET, native libraries). |
| Behavioral | Consumer code observes the same behavior for the same use: results, errors, ordering, timing, defaults. |

A change can be source-compatible and binary-breaking, or the reverse; check each kind separately. The .NET change rules [DotNet-Rules] and the Eclipse guide [desRivieres] are the most detailed public catalogs; consult the one for your platform, or the closest one.

## Change catalog

| Change | Callers | Implementers and subclassers | Notes |
|---|---|---|---|
| Add a type or a function | Compatible | Compatible | A name clash is possible with wildcard imports or extension methods. |
| Add a member to an interface consumers implement | Compatible | **Breaking**, unless the language supplies a default implementation for the new member | Seal interfaces that are not meant to be implemented [RustAPI]; keep extension interfaces small. |
| Add a required parameter | **Breaking** | **Breaking** for overrides | Add an overload or a new operation instead. |
| Add an optional parameter | Usually source-compatible | Can break overrides | Binary-breaking where the language compiles default values into call sites or encodes parameters in the binary signature; the .NET rules list such cases `{.NET}` [DotNet-Rules]. Prefer overloads or an options object. |
| Add a value to an enumeration or union | Compatible for code that passes values | **Breaking** for consumers that match exhaustively, in languages that check exhaustiveness | Declare the type open from the start where the language allows it (`#[non_exhaustive]` `{Rust}`) and document that values may be added. |
| Add a field to a type consumers construct directly | **Breaking** for literal or positional construction | | Keep fields private and offer a constructor or builder [RustAPI]. |
| Add a field to returned data | Compatible in most languages | | Breaks strict deserializers and exact equality checks in consumer code [Hyrum]. |
| Accept more input (relax a precondition) | Compatible | **Breaking**: implementers must now handle more | Accretion and relaxation are the compatible directions for callers [Hickey-Spec]. |
| Promise more output (strengthen a guarantee) | Compatible | **Breaking**: implementers must now provide more | |
| Accept less input or promise less output | **Breaking** | Compatible | |
| Change a default value | **Behavioral break** | | Changing a security default is often necessary; see `constraints-by-default.md` for the rollout. |
| Throw a new error type, or stop throwing one | **Behavioral break** for code that catches | | `{Java}` Removing a checked exception from a signature can break callers' `catch` clauses at compile time. |
| Rename or move | **Breaking** | **Breaking** | Keep the old name as a deprecated alias or forwarder for at least one minor release. |
| Change error message text | **Behavioral break** for parsers | | Give errors stable machine-readable codes; document messages as free text. |
| Change callback order, frequency, or thread | Compatible | **Behavioral break** | Part of the inverted-control contract (problem-map A6). |
| Unseal a type | Compatible | Compatible | |
| Seal a type, or make a member non-overridable | Compatible | **Breaking** | |
| Change performance class (for example, constant to linear time, or synchronous to asynchronous) | **Behavioral break** | | |

## Techniques that keep room to evolve

Apply them before 1.0; most cannot be added later without a break.

- **Seal by default**: types, traits, and classes not designed for extension are closed [Bloch], [RustAPI].
- **Private fields with constructors or builders**, so that fields can be added [RustAPI].
- **Options objects or builders** instead of long positional parameter lists.
- **One argument object per callback**, so that information can be added without changing signatures [FDG].
- **Open enumerations**, where the language supports declaring that values may be added.
- **Factories that return interfaces or abstract types** where the concrete type may change [Bloch].
- **Separate call and extension surfaces**, versioned by their own rules [Tulach].
- **"May add" clauses in the documentation**: state which things may grow (fields, enumeration values, error types), so that consumers code for it.
- **Stable error codes, free-text messages.** Keep public status sets small and closed, and carry causes as stable, namespaced reason codes whose display labels the framework owns [Practice-2026-11-1].
- **Identity independent of layout.** Persisted identifiers (table, event, and key names; the identity of stored items) are computed from what is stable, never from code organization, position, or a dependency's version; an identifier used for matching across versions is surface, and changing it is breaking [Practice-2026-11-1].
- **Generated contracts are checked like hand-written ones.** When the published contract is derived from consumer declarations, diff it against the last release in CI; a consumer's rename is a break for that consumer's clients (problem-map A13).
- **Make unpromised behavior vary.** Go 1 defined map iteration order to be unpredictable, even across runs of the same loop, so that "code that depends on iteration order is very likely to break early" [Go1].
- **Restrict what can be imported**: language and package mechanisms that hide internals, such as package `exports` maps, module `exports`, `internal` visibility, and `internal` directories (`release.md`).

## Undocumented behavior

With enough consumers, every observable behavior is depended on [Hyrum]. Before changing behavior that was never promised:

1. Decide whether to promise it. If yes, document it and add a test that pins it.
2. If no, estimate how many consumers rely on it: search public code, ask, or run downstream consumers' test suites (Rust's crater runs a change against the published crate ecosystem [Crater]; a smaller project can run its known dependents' tests).
3. If many rely on it, treat the change as breaking.

## Before 1.0

Under SemVer, version 0.y.z is initial development: anything may change and the public API should not be considered stable [SemVer]. That freedom is the time to apply the techniques above and to remove speculative surface. Still state a policy for pre-1.0 changes (for example, breaking changes only in the minor number, listed in the changelog), because consumers arrive before 1.0.
