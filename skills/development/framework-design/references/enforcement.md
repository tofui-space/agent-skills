# Enforcement: build checks, analyzers, lint rules, and architecture tests

A design rule that no check enforces decays: consumers copy what compiles, and the framework's own code drifts. Frameworks keep consumers in the pit of success by shipping checks with the framework, and a project keeps its own conventions with architecture tests. Building Evolutionary Architectures calls such checks fitness functions: objective assessments of an architectural characteristic [Ford-Parsons-Kua].

## Contents

- Stages, earliest first
- Designing a check
- What a framework can ship to its consumers
- Architecture tests for a project's own conventions
- Common rules
- Testing the checks

## Stages, earliest first

| Stage | Example | Catches |
|---|---|---|
| Type system | Distinct types for safe values; parsed input types; `exactOptionalPropertyTypes` in TypeScript | Misuse that the types can express |
| Analyzers and lint rules shipped with the framework | Roslyn analyzers inside a NuGet package; `eslint-plugin-react-hooks` for the rules of hooks | Misuse the types cannot express: call order, forbidden calls, missing arguments |
| Framework build checks | Next.js raises a build error when a module that imports `server-only` is imported into a client component; Angular's strict template type checking | Violations of the framework's own model |
| Architecture tests | ArchUnit, dependency-cruiser, import-linter | Dependency direction, module boundaries, naming by role |
| Development-mode runtime checks | Warnings and double invocation in development builds | Behavior only observable at run time |
| Startup validation | Configuration, routes, policies checked before serving | Incomplete or conflicting setup |
| Production guards | Limits, policy checks, assertions | What escaped every earlier stage |

Put each rule at the earliest stage that can decide it without false alarms. Errors are cheapest to fix when they are reported as soon as possible after they occur; "compile time is best" [Bloch].

## Designing a check

- **The message names the rule, the location, and the fix**, and links to the rule's documentation.
- **Stable rule IDs**, so that suppressions and documentation stay valid across versions.
- **Suppression per site, with a reason**, never one global switch; suppressions can be counted, and a rule that is suppressed often is either wrong or pointing at a design problem (`retrospective.md`).
- **Auto-fix where the fix is mechanical and safe.**
- **Versioned with the framework.** A new rule at error level breaks consumer builds: introduce it as a warning in a minor release and raise it to an error in the next major, like any other behavioral break (`compatibility.md`). A warning gates nothing (many linters exit successfully on warnings), so during the warning phase run the rule at error level in the framework's own CI and in the starter template, and treat the warning only as a migration aid for existing consumer projects [Practice-2026-11-1].
- **Low false-alarm rate.** A check that fires on correct code teaches consumers to suppress it.

## What a framework can ship to its consumers

| Mechanism | Platform |
|---|---|
| Analyzers packaged inside the library's NuGet package, under `analyzers/dotnet/<language>/`, run in consumers' builds | .NET [Roslyn-NuGet] |
| An ESLint plugin, and a shareable configuration that enables it | JavaScript and TypeScript |
| Compiler lint levels set in the consumer's manifest, such as Cargo's `[lints]` table (Rust 1.74 and later), and clippy | Rust |
| Build-time checks in the framework's own build step | Metaframeworks and build-tool-based frameworks |
| Startup validation and development-mode warnings | Every framework that owns a startup path |
| Test helpers that consumers call from their own test suites, for example "every route declares a policy" | Every framework with a test-support package |

Enable the checks in the starter template and in generated projects, so that new consumers get them without knowing they exist.

## Architecture tests for a project's own conventions

| Platform | Tool | Enforces |
|---|---|---|
| Java | ArchUnit | Dependencies, layers, naming, annotations, as unit tests |
| .NET | ArchUnitNET, NetArchTest | Architecture rules as unit tests |
| Kotlin | Konsist | Structure and layer dependencies, as tests |
| Python | import-linter | Import contracts: forbidden, layers, independence, and others |
| JavaScript and TypeScript | dependency-cruiser | Dependency rules (`forbidden`, `allowed`, `required`) |
| JavaScript and TypeScript | eslint-plugin-boundaries | Dependencies between declared element types (`boundaries/dependencies`) |
| Nx workspaces | `@nx/enforce-module-boundaries` | Imports between projects, by tags |
| Go | depguard (in golangci-lint) | Allowed and denied imports |
| Frontend projects using Feature-Sliced Design | Steiger | The methodology's layer and import rules |

## Common rules

- **Dependency direction**: inner layers do not import outer layers; the domain imports no framework or infrastructure module.
- **Slice or feature isolation**: features do not import each other's internals; shared code goes through a declared shared module.
- **Public entry points only**: other modules import a module through its declared entry point.
- **Forbidden calls outside their owner**: raw queries outside the data module; network calls outside the client module; reading the clock or randomness outside the provider that tests replace.
- **Constraint coverage**: every route, handler, or server function declares a policy (`constraints-by-default.md`).
- **Surface control**: the API report is current (`release.md`).
- **Storage names**: generated table, event, and key names carry the framework's reserved prefix, and a collision stops startup.
- **The invariant watch-set**: list every invariant the type system or the storage layer cannot express, with the write path that enforces it and the test that pins it; that list is what reviews watch [Practice-2026-11-2].
- **Properties of output**: when an output must have a property (no summarizing, no unapproved content, a fixed shape), check it structurally, and include a deliberately violating fake that must fail the check.
- **Real-time safety**: where a path must not allocate or block, assert it mechanically, for example with an allocation counter around the real-time path in tests [Practice-2026-11-6].

## Testing the checks

Each check gets at least one fixture that violates the rule and one that complies with it, and the check must flag the first and pass the second; ESLint's `RuleTester`, with its `valid` and `invalid` cases, is the model. A check that is never seen failing may be checking nothing.

Type-level checks follow the same rule, and ship with the framework's own tests, not only with prototypes: negative type tests (code that must not compile) for every misuse the types are meant to reject, and, for a published composite value, a check that its declared type is the precise one (`satisfies` rather than a wide annotation `{TS/JS}`), proven by a compiled probe plus a negative control [Practice-2026-11-1].
