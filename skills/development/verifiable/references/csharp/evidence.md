# C# evidence and extension boundaries

Official documentation below was read on 2026-11-10. The admission consequences are design
decisions for this backend, not claims that the documentation validates the checker.
Do not load this research for ordinary runs; use it when changing the C# profile.
The five rows on integers and strings were read on 2026-11-13, the C# standard at commit `02d1a90` of `dotnet/csharpstandard`.
The five rows on `double` and on arithmetic were read on 2026-11-14, the C# standard at commit `d2e3ec5` (branch `draft-v8`).

| Topic and primary source | Documented behavior | Consequence |
|---|---|---|
| [Roslyn semantics](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-semantics) | Binding needs a compilation with options and references; syntax alone cannot resolve names | Bind parameter symbols and actual Boolean types; do not claim to load application settings |
| [Enum values, C# specification](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/enums#206-enum-values-and-operations) | Enum values include the underlying integral domain | Named members alone are not an exhaustive runtime domain; the checker adds one cell for all unnamed values and admits only equality tests against named members |
| [Struct defaults](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct) | `default(T)` and array initialization bypass an explicit parameterless constructor | Constructor validation does not establish every value's invariant; wrappers are unsupported. An admitted record struct has no constructor body, and its zero value is one of its field combinations |
| [Nullable references](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/null-safety/nullable-reference-types) | Annotations provide analysis without changing runtime behavior | An annotation is not an input guard; reference inputs are unsupported |
| [Checked arithmetic](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/checked-and-unchecked) | Checked context is lexical, not inherited by a called method | A numeric model must account for operation and compilation context |
| [Arithmetic operators](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/arithmetic-operators) | Integral, floating-point and decimal arithmetic have different exceptional behavior | Arithmetic on an input is rejected; a shape that admits it requires its own domains and semantics |
| [Integer comparison, C# standard 12.12.2](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md#12122-integer-comparison-operators) | The operators are defined for `int`, `uint`, `long` and `ulong` and compare the numeric values of the operands | Between two neighbouring constants every value answers every admitted comparison alike, so the constants are the only boundaries |
| [Implicit numeric conversions, C# standard 10.2.3](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/conversions.md#1023-implicit-numeric-conversions) | A conversion from one integer type to a wider one never loses information; precision can be lost only towards `float` and `double` | The widening the compiler puts around a narrower integer operand is looked through; an input converted to a floating-point type or `decimal` is rejected |
| [String equality, C# standard 12.12.8](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md#12128-string-equality-operators) | Two strings are equal when both are `null`, or both have the same length and the same character in each position | `==` with a constant tells that constant from every other string, and `null` from every string; `#null` is a cell of every string input |
| [Constant pattern, C# standard 11.2.3](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/patterns.md#1123-constant-pattern), [String.Equals](https://learn.microsoft.com/en-us/dotnet/api/system.string.equals) | An integer input matches when `e == v`; any other input matches when `object.Equals(e, v)`. The `String.Equals` overloads without a comparison option are documented as ordinal | A constant pattern on an integer or a string tells apart exactly what `==` does |
| [Relational patterns, C# 9 proposal](https://github.com/dotnet/csharplang/blob/main/proposals/csharp-9.0/patterns3.md#relational-patterns) | The pattern means the built-in relational operator with the input on the left and the constant on the right | A relational pattern cuts an integer where the same operator would |
| [Floating-point comparison, C# standard 12.14.3](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/expressions.md#12143-floating-point-comparison-operators) | With a NaN operand every operator gives `false` except `!=`. Without NaN the values are in one order from negative to positive infinity, and the two zeros are equal | A `double` compared with constants is cut at the constants like an integer; NaN is a cell of its own; no comparison tells the two zeros apart, so both are tried where zero is tried |
| [Constant pattern, C# standard 11.2.2](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/patterns.md#1122-constant-pattern) | For an input that is no integer and no enum, the pattern matches when `object.Equals(e, v)` is true | A constant pattern on a `double` is not `==`: `x is double.NaN` matches NaN, and `x == double.NaN` never holds. The tool does not model either; it runs the code at NaN |
| [Real literals, C# standard 6.4.5.4](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/lexical-structure.md#6454-real-literals) | A real literal without suffix is a `double`, rounded to nearest with ties to even; a literal too large for its type is an error | A number in a spec is read by the compiler's own parser, so a range end is the same double as the code's constant with the same digits |
| [Floating-point types, C# standard 8.3.7](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/types.md#837-floating-point-types) | The result of an operation is rounded to the nearest representable value. The next paragraph allows an operation to be performed with higher precision than its type | The tool computes each operation of a formula on its own and expects equal bits. Whether a runtime may fuse a multiply and an add is not settled by the standard; see below |
| [Implicit numeric conversions, C# standard 10.2.3](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/conversions.md#1023-implicit-numeric-conversions) | `int` to `long` and `int` to `double` lose nothing; `long` to `double` can lose precision, never magnitude | The three conversions are admitted in a result; the tool converts with the same runtime operation as the code, so a `long` above 2^53 rounds the same way in both |
| [Cancellation](https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads), [CA2016](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca2016) | Cancellation is cooperative; the analyzer checks forwarding from methods already taking a token | Token presence is not cancellation-path coverage |
| [Exception behavior](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions) | Task failures can emerge at await; cancellation can throw | Return types do not establish all exits; calls and async work need separate treatment |

## Executable evidence

`scripts/dotnet/test_backend.py` is the reproducible check of the initial subset. It builds
the real tool, executes the library-borrowing fixtures, plants wrong results on a named and on the unnamed enum cell of a parameter and of a record field,
moves each boundary and changes each constant of its number and string fixtures,
compares the expected value of every check of its computed results with a second evaluation written in Python, changes each operator, operand and grouping of those fixtures,
changes source/spec/artifacts to check staleness, and exercises rejection of unsupported
code and invalid specs. Report the SDK version and observed result when running it.
It is neither a proof of the checker nor evidence for any unimplemented shape.

This profile relies on the primary links above and the bundled regressions.

## What checking inside a project rests on

The tool builds the project, compiles it again from the compiler command line of that build, and accepts its own compilation only when the program the build wrote has the same code.
Observed in runs on Windows with SDK 10.0.400 on 2026-11-14, on sample projects without package references:

- After a plain `dotnet build`, `dotnet msbuild <project> -t:BeforeBuild;Compile -p:ProvideCommandLineArgs=true -p:SkipCompilerExecution=true -p:NonExistentFile=<a path that does not exist> -p:BuildProjectReferences=false -getItem:CscCommandLineArgs -getProperty:TargetPath` returned the compiler's command line and the path of the built program on every run, and compiled nothing.
  Without `NonExistentFile` it returned no argument once the output was up to date, because the compile step was skipped.
- `CSharpCommandLineParser.Default.Parse`, from the compiler assembly the SDK ships, read that command line without an error.
- The tool's compilation had the same listing as the built program for a library, a program with an entry point, a signed library, a `Release` build, and two projects that use the generators for regular expressions and JSON that ship with .NET.
  For that, the tool has to write debug information where the build does, has to give its generator run the folder the compiler would write generated files to, because that folder goes into the names of generated types, and has to read the files it hands to generators with the checksum the build names.
  The standard templates for a web application with Razor pages and for a Windows Forms application compared equal as well, and so did builds with a path mapping.
- The listings differed, and the tool refused, when a build step rewrote a source file while the compiler ran, when a step replaced the assembly after the compiler, and when the project reported a compiler option the compiler never got.

Three earlier designs of this option were broken by independent checks on 2026-11-14.
The first asked the build only for its command line and compiled nothing for real; the second built for real and trusted its own second compilation without looking at the built program.
The third compared with the built program, but built it with properties of its own and with the target `Build` only, and left the headers of methods out of the listing; a third check got a passing run from a project whose build runs one more target, from a project that tests for the tool's property, and from a rewritten method header.
Together the three gave a passing run in eighteen situations where the built program behaved otherwise, among them a build step that changes a setting, generated code, an outdated referenced project, an unsigned compilation of a signed project, and a package version changed without a restore.
With the present design, each of those reproductions is read as the built program behaves, or refused.

`NonExistentFile` is a property of the build's own targets: the compiler platform's project loader notes that setting `BuildingInsideVisualStudio` sets it indirectly, in [ProjectBuildManager.cs](https://github.com/dotnet/roslyn/blob/f1160585559cf85088006e09be844e7ff224ecae/src/Workspaces/MSBuild/BuildHost/Build/ProjectBuildManager.cs), read on 2026-11-14.
No documentation page that states this property as a supported interface was found.
Properties and events are in the listing with the methods they name, since a program whose properties name each other's getters had the same methods and the same instructions as its source.
Not established: whether two programs can have the same listing and compute differently through something the listing leaves out (attributes, resources, data that instructions point to); whether a project that deliberately tells the tool another output path than the one it ships can be told apart; how often the tool's compiler and a project's compiler write different instructions; projects with package references, F# or Visual Basic projects, projects of the old non-SDK format; and whether a released .NET 11 SDK behaves as its release candidate did.
The one run on .NET Framework that was compared: a 32-bit `net472` program returned `1E+308` for `x * 10.0 / 10.0` at `1e308`, where .NET 10 returns infinity; this is why the tool does not run code that targets .NET Framework.

## What a computed result rests on

The claim for a computed result is that the code computes the spec's formula for every value of a cell.
It is an inference from three things, and the tool proves none of them.

- The tool's reading of a result expression is the compiler's.
  The comparison of values on every input tried checks this; a wrong reading that the tried inputs do not show would go unnoticed.
- Exchanging the two operands of `+` or of `*` does not change the result.
  For integers this is arithmetic.
  For doubles it follows from the rule that an operation gives the exact result rounded; in a run of 4,000,000 sampled pairs, random bit patterns included, no pair differed, with every NaN counted as the same NaN.
- The compiled code rounds each `double` operation on its own.
  Observed on x64 with .NET 10.0.11 in an optimised build, on a processor with fused instructions: in 20,000,000 cases chosen so that `Math.FusedMultiplyAdd` gives another result, `a * b + c` gave the result of the two separate operations every time.
  Not established: Arm64, a 32-bit process, other runtime versions.
  The C# standard allows higher precision (row above), and no first-party sentence that rules out fusing was found in the sources read on 2026-11-13.
  On a platform that fuses, a check fails only where the values tried happen to round differently, so a pass there would not carry the claim.
Preview language features are outside the C# 14 admission vocabulary.

## Before expanding support

1. Define the new domain, exceptional outcomes and compiler/runtime settings explicitly.
2. Add accepted and rejected executable fixtures, including boundary/default values.
3. Plant faults and show which computed obligations detect them; preserve unknown results.
4. Update the implementation, capabilities, language reference and scope statement together.

Solution loading, `Math` functions, tolerances, `float` and `decimal`, adapters and test-runner integration are separate
capabilities. Reconciliation requires observing and changing reached cells under individual
tests; a passing suite or mutation score cannot stand in for that mechanism.
