# Mutation tools

Mutation testing is the only deterministic detector for Redundant, Pseudo-tested, and Tautological
tests. Use it whenever the project has it or the user agrees to add it. Adding a dev dependency is
the user's decision; propose it once with the exact command, then take the answer.

Rules that hold for every tool:

- Read the tool's own report file, never the agent's summary of the run. Self-reported scores have
  been observed to differ from the tool's output.
- Scope the first run to one module. Full runs are slow; nightly or on demand.
- Equivalent mutants (a change with no observable effect) show as survivors. Mark them
  `equivalent` with a one-line reason; do not write a test for them.
- A surviving mutant is untested logic, not a bug. Say "untested", not "vulnerable".

## TypeScript / JavaScript — Stryker

Verify the current version and config keys against https://stryker-mutator.io/docs/ before writing
config; do not write `stryker.config.*` from memory.

```
npm i -D @stryker-mutator/core
npx stryker init            # picks the test runner plugin
npx stryker run --reporters html,json,clear-text
```

- Per-test kill data: enable the `perTest` coverage analysis (`coverageAnalysis: "perTest"`) so the
  JSON report lists, for each mutant, which tests killed it. Redundant = a test that appears in no
  mutant's unique-killer set.
- Thresholds go in config under `thresholds` (`high`, `low`, `break`); `break` fails CI.
- Mutant states in the report: `Killed`, `Survived`, `NoCoverage`, `Timeout`, `RuntimeError`,
  `CompileError`. `NoCoverage` is a gap, not a decorative test.

## .NET — Stryker.NET

```
dotnet tool install -g dotnet-stryker
dotnet stryker --reporter html --reporter json
```

Same report semantics as Stryker JS. Verify flags against https://stryker-mutator.io/docs/stryker-net/.

## Python — mutmut (default) or cosmic-ray

```
pip install mutmut
mutmut run
mutmut results
```

mutmut reports per mutant, not per test, by default. For per-test data, run each suspected
Redundant test in isolation against the survivor list, or use cosmic-ray with its per-test config.
Verify commands against the project's docs before running.

## Pseudo-tested detection without a full campaign

Extreme mutation: replace a function body with `return <constant>` and run only the tests that
touch it. If all pass, every test touching that function is Pseudo-tested for that function. This is
cheap and needs no tool: do it by hand on the five functions the user cares most about.

## What mutation cannot tell you

- Whether the current code is correct. It measures whether tests detect changes to it.
- Whether a `convention` rule in the rules table is the right rule for this product.
- Anything about tests that never run (skipped) — those show as `NoCoverage` or not at all.
