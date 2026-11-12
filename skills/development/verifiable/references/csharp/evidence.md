# C# evidence and extension boundaries

Official documentation below was read on 2026-11-10. The admission consequences are design
decisions for this backend, not claims that the documentation validates the checker.
Do not load this research for ordinary runs; use it when changing the C# profile.

| Topic and primary source | Documented behavior | Consequence |
|---|---|---|
| [Roslyn semantics](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-semantics) | Binding needs a compilation with options and references; syntax alone cannot resolve names | Bind parameter symbols and actual Boolean types; do not claim to load application settings |
| [Enum values, C# specification](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/enums#206-enum-values-and-operations) | Enum values include the underlying integral domain | Named members alone are not an exhaustive runtime domain; the checker adds one cell for all unnamed values and admits only equality tests against named members |
| [Struct defaults](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct) | `default(T)` and array initialization bypass an explicit parameterless constructor | Constructor validation does not establish every value's invariant; wrappers are unsupported |
| [Nullable references](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/null-safety/nullable-reference-types) | Annotations provide analysis without changing runtime behavior | An annotation is not an input guard; reference inputs are unsupported |
| [Checked arithmetic](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/checked-and-unchecked) | Checked context is lexical, not inherited by a called method | A numeric model must account for operation and compilation context |
| [Arithmetic operators](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/arithmetic-operators) | Integral, floating-point and decimal arithmetic have different exceptional behavior | Numeric classifiers require their own domains and semantics |
| [Cancellation](https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads), [CA2016](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca2016) | Cancellation is cooperative; the analyzer checks forwarding from methods already taking a token | Token presence is not cancellation-path coverage |
| [Exception behavior](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions) | Task failures can emerge at await; cancellation can throw | Return types do not establish all exits; calls and async work need separate treatment |

## Executable evidence

`scripts/dotnet/test_backend.py` is the reproducible check of the initial subset. It builds
the real tool, executes the library-borrowing fixtures, plants wrong results on a named and on the unnamed enum cell,
changes source/spec/artifacts to check staleness, and exercises rejection of unsupported
code and invalid specs. Report the SDK version and observed result when running it.
It is neither a proof of the checker nor evidence for any unimplemented shape.

This profile relies on the primary links above and the bundled regressions.
Preview language features are outside the C# 14 admission vocabulary.

## Before expanding support

1. Define the new domain, exceptional outcomes and compiler/runtime settings explicitly.
2. Add accepted and rejected executable fixtures, including boundary/default values.
3. Plant faults and show which computed obligations detect them; preserve unknown results.
4. Update the implementation, capabilities, language reference and scope statement together.

Project loading, numeric classifiers, adapters and test-runner integration are separate
capabilities. Reconciliation requires observing and changing reached cells under individual
tests; a passing suite or mutation score cannot stand in for that mechanism.
