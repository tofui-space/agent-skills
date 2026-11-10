# Language cultures

Each language community has its own idea of what good code looks like: how long names are, how deep namespaces go, how much is explicit, how errors travel, how options are passed, how much is borrowed from dependencies. These are not style trivia. A framework is read and called in its platform's idiom, and a surface that fights the idiom costs every consumer on every call (P12; "do what is customary", mimicking the patterns of the core APIs and the language [Bloch]). The differences change API decisions directly.

## Contents

- The axes
- Per language
- Designing across languages
- Applying guidelines from another culture

## The axes

| Axis | One end | Other end | What it changes in a framework's surface |
|---|---|---|---|
| Name length | Short, growing with distance from the declaration: "the further from its declaration that a name is used, the more descriptive the name must be" `{Go}` [Go-CRC]; "Make the length of a name roughly proportional to the length of its scope" `{C++}` [CppCore] | Descriptive, without abbreviations: "DO NOT use abbreviations or contractions as part of identifier names" `{.NET}` [FDG-Naming]; "Clarity is more important than brevity" `{Swift}` [Swift-API] | Type and member names; how much the package or namespace name carries |
| Namespace depth | Flat: lowercase, single-word packages, no stutter (`bufio.Reader`, not `BufReader`) `{Go}` [Go-PkgNames]; "Flat is better than nested" `{Python}` [PEP20]; a flat public root re-exported with `pub use` over a deeper private layout `{Rust}` [Rust-Book-Reexport] | Hierarchical: reversed Internet domain names `{Java}` [JLS-6.1]; `Company.Product[.Feature][.Subnamespace]` `{.NET}` [FDG-Naming] | Package layout, import paths, and whether names repeat the package |
| Explicitness | Explicit: "Explicit is better than implicit" `{Python}` [PEP20]; "Clear is better than clever", "Reflection is never clear" `{Go}` [Go-Proverbs]; explicit API mode requiring visibility modifiers and types on public declarations `{Kotlin}` [Kotlin-ExplicitAPI] | Convention: convention over configuration in Rails [Rails-Doctrine]; Ruby lets users "freely alter its parts" `{Ruby}` [Ruby-About] | Annotations, reflection, code generation, auto-wiring, and how much happens without a visible call |
| Error idiom | Values: an extra `error` return `{Go}` [Go-CRC]; `Result<T, E>` `{Rust}`; `{:ok, _}` / `{:error, _}` tuples with a raising `!` variant `{Elixir}` [Elixir-Guides] | Exceptions: never error codes, with Tester-Doer and Try variants `{.NET}` [FDG]; checked when the caller can recover `{Java}` [Java-Exceptions]; all unchecked, with `OrNull` variants `{Kotlin}` [Kotlin-Conventions]; `throws` on the declaration and `try` at the call `{Swift}`; easier to ask forgiveness than permission `{Python}` | Problem-map C4; the error types in the surface; paired variants |
| Configuration idiom | Functional options: "Functional options let you write APIs that can grow over time" `{Go}` [Go-FuncOpts]; builders `{Rust}` [RustAPI] | Keyword-only arguments with defaults `{Python}`; default and named parameters instead of overloads `{Kotlin}` `{Swift}`; an options object `{TS/JS}` [Google-TS-Style]; `services.AddX(options => …)` on the dependency-injection container `{.NET}` [DotNet-Options] | Problem-map A5, C1, C6: how options are passed, defaulted, and grown |
| Dependency attitude | "A little copying is better than a little dependency" `{Go}` [Go-Proverbs] | Prefer the standard library `{C++}` [CppCore]; "batteries included" `{Python}` | K10 in `tradeoffs.md`; whether to depend on a helper library or copy a small function |
| Formatting | One formatter, no debate: "Gofmt's style is no one's favorite, yet gofmt is everyone's favorite" `{Go}` [Go-Proverbs]; Prettier exists "to stop all the ongoing debates over styles" `{TS/JS}` [Prettier]; the Rust style guide `{Rust}` [Rust-Style] | Project-specific style guides | Ship examples and generated code in the community formatter's output |
| Paired variants | `x` and `x!` for the mutating or "dangerous" variant `{Ruby}` [Ruby-Methods]; `f` and raising `f!` `{Elixir}` [Elixir-Guides] | `TryX` `{.NET}`; `xOrNull` `{Kotlin}`; `sort` and `sorted` `{Kotlin}`, `-ed` and `-ing` forms for non-mutating versions `{Swift}` [Swift-API] | How the safe and the throwing or mutating forms of one operation are told apart |

## Per language

The consequence column is reasoned from the other columns and from the sources cited there; no single source states it.

| Language | Naming | Packages | Errors | Options | A framework's surface there (reasoned) |
|---|---|---|---|---|---|
| Go | Short, scope-proportional; no `Get` on getters | Single lowercase word; no `util` or `common` | Returned `error`; no panic for normal errors | Functional options | `pkg.New(opts ...Option)`; types read as `pkg.Server`; errors returned, never panicked across the API |
| Rust | RFC 430 casing; `as_`, `to_`, `into_` by conversion cost; no `get_` [RustAPI] | Flat crate root through `pub use` | `Result`; a crate-specific error type implementing `Error` | Builders | Flat re-exported root; one error type per crate; enumerations instead of boolean flags |
| Python | `snake_case` functions, `CapWords` classes, `…Error` exceptions [PEP8] | Short lowercase modules; `__all__`; `_` for internals | Exceptions; errors never pass silently | Keyword-only arguments | Options as keyword-only parameters with defaults; `__all__` declared |
| Java | Classes as nouns, methods as verbs | Reversed domain | Checked for recoverable failures, unchecked otherwise | (no official builder rule found) | A package under an owned domain; checked exceptions only where callers can recover |
| Kotlin | Avoid `Manager`, `Wrapper`; acronyms as words (`XmlFormatter`) | Lowercase, no underscores | Unchecked; `@Throws` for Java callers; `OrNull` variants | Default and named parameters | Ship with explicit API mode; named parameters for booleans; `xOrNull` variants |
| C# / .NET | No abbreviations; readability over brevity | `Company.Product[.Feature]` | Exceptions; `TryX` | `AddX` on the service collection with an options callback | `services.AddFoo(o => …)`; `TryX` methods; the library's own namespace |
| TypeScript / JavaScript | Descriptive, no ambiguous abbreviations (Google's guide; the TypeScript team publishes no community naming guide) [Google-TS-Style], [TS-Team] | ES modules, not namespaces [TS-Namespaces] | Throw `Error` instances | One options object | Named exports; one options-object parameter |
| Swift | Clarity at the point of use; omit needless words [Swift-API] | | `throws` and `try` | Defaulted trailing parameters | Calls that read as phrases; defaulted trailing parameters |
| Ruby | `?` for predicates, `!` for the dangerous variant | | | | `x` and `x!` pairs |
| C++ | Scope-proportional names; `underscore_style` by default | Nothing non-standard in `std` | Throw when a function cannot do its task | | Strongly typed parameters; standard-library types in interfaces [CppCore] |
| Elixir | `snake_case`; `!` raises, `?` returns a boolean | CamelCase modules | Tagged tuples plus `!`; let it crash [Armstrong] | Function parameters, not application environment | Options as arguments; `f` and `f!` pairs |

## Designing across languages

A framework or SDK offered in several languages shares concepts and scenarios, not spellings:

- **Keep the same scenarios, concepts, and guarantees** in every language; the scenario set (`scenarios.md`) is the cross-language specification.
- **Let names, packages, errors, and options follow each language's culture**: functional options in Go, a builder in Rust, keyword-only arguments in Python, an options callback on the service collection in .NET, an options object in TypeScript. A surface transliterated from one language into another is foreign everywhere but its origin.
- **Keep one glossary** of concept names, translated into each language's casing and vocabulary, so documentation and support can map between them.
- **Compare the consumer code per language** for the top scenario in a prototype (`prototyping.md`): the line and concept counts should be close, while the shapes differ.

## Applying guidelines from another culture

- **Check the axis position before applying a guideline.** A rule from a descriptive-names culture ("never abbreviate") is wrong in a short-names culture, and the reverse; a rule from an exceptions culture ("never return error codes") does not transfer to a values culture. Label it with its scope and say whether it transfers (`cheat-sheet.md`).
- **Departing from the platform's culture is a benefit-profile decision**, not a style preference: record it in the design record with its reason, and score the cost to familiarity (K6 in `tradeoffs.md`).
- **Ship with the community formatter and linter defaults**, and generate code and examples in their output, so consumers never have to reformat what the framework gives them.
