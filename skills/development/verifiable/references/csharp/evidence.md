# C# evidence and extension boundaries

Official documentation below was read on 2026-11-10. The admission consequences are design
decisions for this backend, not claims that the documentation validates the checker.
Do not load this research for ordinary runs; use it when changing the C# profile.
The five rows on integers and strings were read on 2026-11-13, the C# standard at commit `02d1a90` of `dotnet/csharpstandard`.

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
| [Cancellation](https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads), [CA2016](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca2016) | Cancellation is cooperative; the analyzer checks forwarding from methods already taking a token | Token presence is not cancellation-path coverage |
| [Exception behavior](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions) | Task failures can emerge at await; cancellation can throw | Return types do not establish all exits; calls and async work need separate treatment |

## Executable evidence

`scripts/dotnet/test_backend.py` is the reproducible check of the initial subset. It builds
the real tool, executes the library-borrowing fixtures, plants wrong results on a named and on the unnamed enum cell of a parameter and of a record field,
moves each boundary and changes each constant of its integer and string fixtures,
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

Project loading, arithmetic and floating-point inputs, adapters and test-runner integration are separate
capabilities. Reconciliation requires observing and changing reached cells under individual
tests; a passing suite or mutation score cannot stand in for that mechanism.
