# `double` cells and computed-result specs for the C# checker: primary-source research

Read and run on 2026-11-13.

## (a) Summary for a meeting

A `double` field that the code only compares with constants can be split into cells by sorting the constants, with no solver.
The cells are one cell for NaN, one cell per constant, and one cell per open interval between neighbouring constants and beyond the two ends.
The C# standard gives the ordering that makes this work, and the compiler itself uses the same model internally: a set of numeric intervals plus one flag for NaN.
An exhaustive run over all 4,294,967,296 `float` bit patterns found no value whose comparison results differ from the other values of its cell; for `double` the same statement is an inference from the standard, not a run.
NaN, the two zeros and the two infinities each need a stated rule, because operators, `Equals` and patterns do not agree: `x == double.NaN` is always false, `x is double.NaN` matches every NaN, and `x is 0.0` matches negative zero.
`Math.BitIncrement` and `Math.BitDecrement` give the neighbours of a constant from .NET Core 3.0; `double.Epsilon` is the neighbour of zero only.
The partition stops being complete as soon as two fields are compared with each other, arithmetic happens before the comparison, or a `Math` function is called; one run shows `x + 0.1 >= 0.3` changing its answer one step below 0.2, not at 0.2.
Z3 offers an IEEE floating-point theory through its .NET API, but it works by turning every operation into bits: proving that one `double` multiplication commutes took 40 seconds here, and converting a NaN model value back to bits gave the bits of zero.
On x64 with .NET 10.0.11 the JIT did not fuse `a * b + c` in any configuration tried, and the runtime team has written that doing so would need an explicit switch; the CLI standard nevertheless permits it, and `Math` functions other than the IEEE-required ones call the platform C library.
A spec for a computed result can be a table of literal values, a postcondition, a reference expression, a set of relations, a solver query or a proof; each form is listed in section (c) with what it needs and what it cannot show.
The TypeScript backend already uses the reference-expression form for its conversion shape: an `expected(...)` function in the same small vocabulary, compared with exact equality on inputs that a solver finds.
Nothing in this note recommends a design.

## Method and scope

Every row in section (b) carries one of four tags.
`cited` means the named source was opened in this session and the quoted words were found in it.
`run` means a probe was run in this session; the row gives the probe and the trimmed output, and section (d) gives the command and the source of every probe.
`read` means the lines were opened in this repository.
`inferred` means the claim is reasoning from the rows it names, and the same sentence says so.

Versions of every run:

- SDK 10.0.400, pinned by a `global.json` in the scratch folder; `dotnet --version` printed `10.0.400`. The skill's own `scripts/dotnet/global.json` asks for `10.0.100` with `rollForward: latestFeature` (read), which resolves to the same SDK on this machine.
- Runtime `.NET 10.0.11`, x64, Windows; core library product version `10.0.11-servicing.26373.116+e2f47b0110ed922f21a1522da67279133ce28f32` (read from the file's version resource).
- Language version 14 (`<LangVersion>14</LangVersion>` in every probe project, as in the skill's `Verifiable.csproj`).
- Compiler assemblies from the SDK folder, referenced by `HintPath` as `Verifiable.csproj` does: product version `5.9.0-1.26379.115+14fbf8d5271c98133561eb55185fdb05b286f578` (printed by probe P2).
- Packages restored from nuget.org into the scratch folder: `Microsoft.Z3` 4.12.2 and `Microsoft.CodeAnalysis.CSharp.Scripting` 5.9.0. Both restores succeeded.
- All probes were built with `-c Release` unless a row says otherwise. The scratch folder is outside every project tree, and no build file exists in any parent folder (each parent was listed).

Sources and the versions read:

- C# standard, `dotnet/csharpstandard`, branch `draft-v8` at commit `d2e3ec5c`, and branch `draft-v10` at commit `10b759be` for the relational pattern clause, which the `draft-v8` and `draft-v9` texts do not contain (their headings were listed).
- C# proposals, `dotnet/csharplang` at commit `68b7855d`.
- Compiler source at the commit named in the compiler's version resource (`dotnet/dotnet` commit `14fbf8d5`, folder `src/roslyn`).
- Runtime source at the commit named in the core library's version resource (`dotnet/dotnet` commit `e2f47b01`, folder `src/runtime`).
- Z3 source at tag `z3-4.12.2` (commit `e417f7d7`), the version of the package on nuget.org; the floating-point method signatures of `Context.cs` were compared with `master` at commit `de3ccca9` and are identical.
- FsCheck at `master` commit `1ef52cfc`, CsCheck at `master` commit `9288cc9c`, MSTest (`microsoft/testfx`) at `main` commit `8dd78e13`, Dafny at tag `v4.11.0`, Roslyn wiki sample at `dotnet/roslyn` commit `d31af711`. These are branch heads or tags, not the versions of any installed package.
- Pages on learn.microsoft.com were downloaded and searched after removing HTML tags. GitHub issues were read through the GitHub API, which also gives the author's association with the repository.
- Papers were downloaded as PDF or HTML from the publisher or an author's page and searched as text. One mirror of a paywalled paper was not used.

Coverage of the reading:

- Read in full: `skills/development/verifiable/scripts/conversion.ts` (404 lines), `references/csharp/shapes.md`, `references/csharp/beyond-enumeration.md`, the compiler file `ValueSetFactory.DoubleTC.cs` lines 14-95 and the class header of `ValueSetFactory.FloatingValueSet.cs` (lines 10-34), the Z3 file `qffp_tactic.cpp` lines 80-105.
- Read in part, around each quoted line: every standard clause, proposal, documentation page, issue and paper; `scripts/inventory.ts` lines 125-145, 494-520 and 560-690 (the working tree, which has uncommitted changes to this file); `scripts/driver.ts` lines 335-375; `scripts/branches.ts` lines 396-430.
- Reached only by text search: `PublicAPI.Shipped.txt`, `OperationInterfaces.xml` outside the three nodes quoted, the ECMA-335 PDF outside the two passages quoted.
- Not opened: the JIT source, any Arm64 or 32-bit run, Z3 5.x, the IEEE 754 standard itself.

What is already written and is not repeated here:

- `research/verifiable-csharp-domains.md` answers the compiler-API questions for enum, integer, string and record domains (rows Q2-06 to Q2-24), integer comparison and promotion (Q3-01 to Q3-27), records (Q5-01 to Q5-21) and the Z3 package and its platforms (Q6-01 to Q6-22, experiment E7). Its item 17 of section (c) says the floating-point types were not researched; this note fills that gap.
- `research/verifiable-beyond-enumeration.md` has the general floating-point statements (N1 to N17), the FsCheck and CsCheck claims (F1 to F11, K1 to K14), Code Contracts status (R10, R11) and Dafny's numeric types (D10 to D13). It leaves open the FsCheck `double` generator (its item 9), whether the JIT fuses `a * b + c` (item 2) and whether extra precision is used (item 3). Rows A7-01, A6-03 to A6-07 answer the first two in part; the third stays open.
- `research/verifiable-typescript-cell-model.md` lists `scripts/conversion.ts` lines 1-289 as never opened. Section B5 below reads that file in full.

## (b) Claims

### Question A1: comparison operators and patterns on `double`

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| A1-01 | The six operators follow IEC 60559. With a NaN operand every operator gives `false` except `!=`. `x != y` always equals `!(x == y)`, but `<` is not the negation of `>=` when a NaN is involved. | [C# standard draft-v8, expressions.md §12.14.3, lines 4494-4498](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/expressions.md?plain=1#L4494-L4498) | "If either operand is NaN, the result is `false` for all operators except `!=`, for which the result is `true`. For any two operands, `x != y` always produces the same result as `!(x == y)`." | cited |
| A1-02 | Without NaN the values are totally ordered, the two zeros are equal, and each infinity equals itself and lies beyond every other value. | [same file, lines 4500-4510](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/expressions.md?plain=1#L4500-L4510) | "`–∞ < –max < ... < –min < –0.0 == +0.0 < +min < ... < +max < +∞`" and "Negative and positive zeros are considered equal." | cited |
| A1-03 | Observed on run-time values (not constants): a NaN operand gives `F F F F F T` for `< <= > >= == !=` in all 11 pairs; `-0` against `+0` gives `F T F T T F`; `-inf` against `-inf` and `+inf` against `+inf` give `F T F T T F`. | Probe P1, section "A1 operators" | 36 rows printed; no row departs from A1-01 and A1-02 | run |
| A1-04 | The standard speaks of one NaN value. | [C# standard draft-v8, types.md §8.3.7, line 360](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/types.md?plain=1#L360) | "The ***Not-a-Number*** value, often abbreviated NaN." | cited |
| A1-05 | At run time there are many NaN bit patterns, and the language treats them alike: the patterns `FFF8000000000000`, `7FF8000000000000` and `7FF0000000000001` all match `is double.NaN`, `double.IsNaN` and `Equals(double.NaN)`. | Probe P1, line "other NaN payloads" | `7FF0000000000001 is double.NaN=T IsNaN=T Equals(double.NaN)=T; 7FF8000000000000 is double.NaN=T`; `0.0/0.0` at run time gave `FFF8000000000000` | run |
| A1-06 | A constant pattern on a `double` input does not use `==`. It matches when `object.Equals(e, v)` is true. | [C# standard draft-v8, patterns.md §11.2.2, lines 93-96](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/patterns.md?plain=1#L93-L96); the draft-v10 text has the same sentence at line 109 | "the pattern `P` *matches* the value *e* if `object.Equals(e, v)` returns `true`." | cited |
| A1-07 | `Double.Equals(double)` is `==` plus "both are NaN". So it treats NaN as equal to NaN and the two zeros as equal. | [runtime source, Double.cs lines 330-337](https://github.com/dotnet/dotnet/blob/e2f47b0110ed922f21a1522da67279133ce28f32/src/runtime/src/libraries/System.Private.CoreLib/src/System/Double.cs#L330-L337) | "`if (obj == m_value) { return true; } return IsNaN(obj) && IsNaN(m_value);`" | cited |
| A1-08 | Observed: `x is double.NaN` is true only for NaN. `x is 0.0` and `x is -0.0` are each true for both zeros. `x is double.PositiveInfinity` is true only for `+inf`. | Probe P1, section "A1 patterns" | NaN row: `T F F`; `-0` row: `F T T`; `+0` row: `F T T` | run |
| A1-09 | A relational pattern means the operator applied to the input and the constant. A NaN constant in a relational pattern is a compile-time error. | [C# standard draft-v10, patterns.md §11.2.9, lines 562-583](https://github.com/dotnet/csharpstandard/blob/10b759be7a313b39967444dd196098c49c662086/standard/patterns.md?plain=1#L562-L583); the proposal says the same at [patterns3.md lines 91-93](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-9.0/patterns3.md?plain=1#L91-L93) | "It is a compile-time error if the expression evaluates to `double.NaN`, `float.NaN`, or a null constant." and "the evaluation of that operator is taken as the meaning of the relational pattern." | cited |
| A1-10 | Observed: `x is < double.NaN` is rejected with error CS8782. | Probe P2, diagnostic d1 | `CS8782 Error: Relational patterns may not be used for a floating-point NaN.` | run |
| A1-11 | Observed: NaN matches no relational pattern, so the negated form matches it. For NaN, `x is > 0.5` and `x is <= 0.5` are both false, `x is < 0 or >= 0` is false, and `x is not > 0.5` is true. | Probe P1, section "A1 patterns", NaN row | `F F F T` in those four columns | run |
| A1-12 | The compiler knows that relational arms alone do not cover a `double`. `x switch { < 0.0 => 1, >= 0.0 => 2 }` gets warning CS8509 naming `double.NaN`, and `IsExhaustive` is false. Adding the arm `double.NaN => 3` removes the warning and makes `IsExhaustive` true. | Probe P2, diagnostics d2 and d3 | d2: `CS8509 Warning level=1 … the pattern 'double.NaN' is not covered`, `IsExhaustive=False`; d3: `no diagnostic`, `IsExhaustive=True` | run |
| A1-13 | The compiler also finds a single uncovered value between two relational arms, treats the two zeros as one value, and rejects a pattern that cannot match. | Probe P2, diagnostics d4, d5, d6, d12, d14, d16, d20 | d4 `{ < 0.5, > 0.5, double.NaN }`: `CS8509 … the pattern '0.5D' is not covered`; d5 `{ 0.0, -0.0, _ }`: `CS8510` (unreachable arm); d6 `x is > 0.5 and < 0.25`: `CS8518`; d14 `> double.PositiveInfinity`: `CS8510` | run |
| A1-14 | The compiler's own value set for `double` is a set of numeric intervals plus a NaN flag. Its successor function skips negative zero, and it treats all NaNs as equal. These types are internal and cannot be called. | [compiler source, ValueSetFactory.FloatingValueSet.cs lines 20-33](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Utilities/ValueSetFactory.FloatingValueSet.cs#L20-L33) and [ValueSetFactory.DoubleTC.cs lines 31-50 and 69](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Utilities/ValueSetFactory.DoubleTC.cs#L31-L69) | "`private readonly IConstantValueSet<TFloating> _numbers; private readonly bool _hasNaN;`", "`return 0.0; // skip negative zero`" and "`// for our purposes, NaNs are equal`" | cited |
| A1-15 | `x == double.NaN` compiles with no diagnostic of any severity, and is false for every input by A1-01. | Probe P2, diagnostic d7; probe P1 | d7: `no diagnostic` | run |
| A1-16 | The two zeros are told apart by `1 / x`, `double.IsNegative`, `ToString`, the bit pattern, and the result bits of `Math.Min` and `Math.Max`. They are not told apart by `==`, `<`, `Equals`, `object.Equals`, `GetHashCode`, `CompareTo` or a constant pattern. | Probe P1, line "signed zero told apart" and the operator table | `1/+0=∞ 1/-0=-∞ IsNegative(-0)=T ToString(-0)=-0 Equals(+0,-0)=T object.Equals=T GetHashCode equal=T Math.Min(+0,-0)=8000000000000000 Math.Max(-0,+0)=0000000000000000`; `CompareTo` printed `0` | run |
| A1-17 | `CompareTo` is a third relation: it puts NaN below every other value and gives 0 for NaN against NaN. | Probe P1, operator table, last column; see also row R15 of `research/verifiable-beyond-enumeration.md` | `NaN -inf … -1`, `-inf NaN … 1`, `NaN NaN … 0` | run |
| A1-18 | A `switch` expression over a `double` with no arm for NaN and no discard throws for NaN at run time. This is an inference from A1-12 and from row Q1-23 of `research/verifiable-csharp-domains.md`; no such switch was executed with a `double` input. | A1-12, Q1-23 | | inferred |

### Question A2: the nearest representable value above and below a constant

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| A2-01 | `Math.BitIncrement` returns the smallest value that compares greater than its argument, and `Math.BitDecrement` the largest value that compares less. | [API documentation source, Math.xml lines 1299-1386](https://github.com/dotnet/dotnet-api-docs/blob/a010100852b71f33d67d913d7a9ed69f83a639b1/xml/System/Math.xml#L1299-L1386) | "Returns the smallest value that compares greater than a specified value." and "Returns the largest value that compares less than a specified value." | cited |
| A2-02 | The implementation has three special cases each: NaN returns NaN; the infinity on the far side returns itself and the one on the near side returns the largest finite value of that sign; a zero of the "wrong" sign jumps over the other zero. | [runtime source, Math.cs lines 287-349](https://github.com/dotnet/dotnet/blob/e2f47b0110ed922f21a1522da67279133ce28f32/src/runtime/src/libraries/System.Private.CoreLib/src/System/Math.cs#L287-L349) | "`// -Infinity returns MinValue`", "`// +Infinity returns +Infinity`", "`// -0.0 returns Epsilon`", "`// +0.0 returns -double.Epsilon`" | cited |
| A2-03 | Observed values. `BitIncrement`: `+0` and `-0` give `5E-324`; `-5E-324` gives `-0` (bits `8000000000000000`); `MaxValue` gives `+inf`; `-inf` gives `MinValue`; `+inf` gives `+inf`; NaN gives NaN. `BitDecrement`: `+0` and `-0` give `-5E-324`; `5E-324` gives `+0`; `MinValue` gives `-inf`; `+inf` gives `MaxValue`; `-inf` gives `-inf`; NaN gives NaN. | Probe P1, section "A2 neighbours" | 13 lines, for example `0.5: … BitDecrement=3FDFFFFFFFFFFFFF (0.49999999999999994) BitIncrement=3FE0000000000001 (0.5000000000000001)` | run |
| A2-04 | The documentation page for `Math.BitIncrement` lists .NET Core 3.0 and 3.1 and .NET 5 to 11. It lists no .NET Framework and no .NET Standard version. | [learn: Math.BitIncrement](https://learn.microsoft.com/en-us/dotnet/api/system.math.bitincrement?view=net-10.0), `monikers` meta tags of the page | "`netcore-3.0`", "`netcore-3.1`", "`net-5.0`" … "`net-11.0`" | cited |
| A2-05 | The runtime team maps the IEEE 754:2019 operations `nextUp` and `nextDown` to these two methods. | [dotnet/runtime issue 1387](https://github.com/dotnet/runtime/issues/1387), opened 2020-01-07 by a repository member | "sourceFormat nextUp(source) … double Math.BitIncrement(double)" | cited |
| A2-06 | `double.Epsilon` is the smallest positive `double` (bits `0000000000000001`). It is not the distance between neighbouring values elsewhere. | [learn: Double.Epsilon](https://learn.microsoft.com/en-us/dotnet/api/system.double.epsilon?view=net-10.0) | "Represents the smallest positive Double value that is greater than zero." and "the Epsilon property is not a general measure of precision of the Double type" | cited |
| A2-07 | Observed: `0.5 + double.Epsilon == 0.5` is true. The step above 0.5 is `1.1102230246251565E-16` and the step below it is `5.551115123125783E-17`, so the two neighbours of a power of two are not at the same distance. | Probe P1, line "double.Epsilon" | `0.5+Epsilon==0.5: T; BitIncrement(0.5)-0.5=1.1102230246251565E-16; 0.5-BitDecrement(0.5)=5.551115123125783E-17` | run |
| A2-08 | The same documentation page says that `Epsilon` behaves as zero on ARM systems. This was not run; every run here was on x64. | [learn: Double.Epsilon](https://learn.microsoft.com/en-us/dotnet/api/system.double.epsilon?view=net-10.0) | "On ARM systems, the value of the Epsilon constant is too small to be detected, so it equates to zero." | cited |
| A2-09 | `MathF.BitIncrement`, `float.BitDecrement` and the static `double.BitIncrement` exist on .NET 10 and give the neighbouring bit pattern. | Probe P1, line "generic statics" | `double.BitIncrement(1)=3FF0000000000001 MathF.BitIncrement(1f)=3F800001 float.BitDecrement(1f)=3F7FFFFF` | run |
| A2-10 | Inference from A2-02 and A2-03: the neighbours of the zero cell are `-5E-324` and `5E-324` whichever zero is passed, and the two zeros are reached from different sides (`BitIncrement(-5E-324)` is `-0`, `BitDecrement(5E-324)` is `+0`). A tool that wants both zeros as inputs has to add the second one itself. | A2-02, A2-03 | | inferred |

### Question A3: literals, constants, mixed operand types, and what the compiler API returns

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| A3-01 | A real literal without a suffix is a `double`. Its value is the decimal number rounded to nearest, ties to even, with all digits significant. | [C# standard draft-v8, lexical-structure.md §6.4.5.4, lines 784 and 798](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/lexical-structure.md?plain=1#L784-L798) | "The value of a real literal of type `float` or `double` is determined by using the IEC 60559 “round to nearest” mode with ties broken to “even” (a value with the least-significant-bit zero), and all digits considered significant." | cited |
| A3-02 | A literal that is too large is a compile-time error, so a literal is never an infinity; a non-zero literal can round to zero. | [same file, lines 794-796](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/lexical-structure.md?plain=1#L794-L796) | "a *Real_Literal* will never produce a floating-point infinity. A non-zero *Real_Literal* may, however, be rounded to zero." | cited |
| A3-03 | Observed: `0.1` is `3FB999999999999A`, the same bits as `double.Parse("0.1")` at run time. `9007199254740993.0` (2^53 + 1, a tie) becomes `9007199254740992`. `1e400` is error CS0594. | Probe P1, section "A3"; probe P2, diagnostic d8 | `0.1=3FB999999999999A run-time parse 0.1=3FB999999999999A`; `9007199254740993.0 -> 4340000000000000`; d8: `CS0594 Error: Floating-point constant is outside the range of type 'double'` | run |
| A3-04 | A `const double` built from an expression is folded by the compiler with the same result as the run-time operation in the cases tried: `0.1 + 0.2` is `3FD3333333333334` both ways and is not equal to `0.3` (`3FD3333333333333`); `1.0 / 3.0` is `3FD5555555555555` both ways. | Probe P1, lines "const 0.1+0.2==0.3" and "const double 1.0/3.0" | `const sum bits=3FD3333333333334 run-time sum bits=3FD3333333333334 0.3=3FD3333333333333` | run |
| A3-05 | A constant can be an infinity or NaN although a literal cannot. `const double c = 1e308 * 10;` compiles with no diagnostic, and `const double c = 0.0 / 0.0;` can be used as a constant pattern. The library defines its own constants this way. | Probe P2, diagnostics d18 and d19; [runtime source, Double.cs lines 43-45](https://github.com/dotnet/dotnet/blob/e2f47b0110ed922f21a1522da67279133ce28f32/src/runtime/src/libraries/System.Private.CoreLib/src/System/Double.cs#L43-L45) | d18, d19: `no diagnostic`; "`public const double NaN = (double)0.0 / (double)0.0;`" | run, cited |
| A3-06 | When one operand of a comparison is `double`, the other is converted to `double`; otherwise when one is `float`, the other is converted to `float`. The subclause is marked informative. | [C# standard draft-v8, expressions.md §12.4.7.3, lines 304-311](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/expressions.md?plain=1#L304-L311) | "Otherwise, if either operand is of type `double`, the other operand is converted to type `double`." | cited |
| A3-07 | Only four implicit conversions to a floating type can lose precision: `int`, `uint`, `long`, `ulong` to `float`, and `long`, `ulong` to `double`. So `int` to `double` and `float` to `double` are exact. | [C# standard draft-v8, conversions.md §10.2.3, line 134](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/conversions.md?plain=1#L134) | "Conversions from `int`, `uint`, `long` or `ulong` to `float` and from `long` or `ulong` to `double` may cause a loss of precision, but will never cause a loss of magnitude. The other implicit numeric conversions never lose any information." | cited |
| A3-08 | A `float` field compared with a `double` constant is compared as `double`, and the constant is usually not a `float`. Observed: for the field value `0.1f`, `f < 0.1` is false, `f == 0.1` is false and `f > 0.1` is true, because `(double)0.1f` is `0.10000000149011612`. The largest `float` below the `double` 0.1 is `3DCCCCCC`. No `float` equals the `double` 0.1. | Probe P1, lines "float field" and "BitDecrement(0.1f)" | `f<0.1=F f==0.1=F f>0.1=T`; `(double)0.1f=3FB99999A0000000 (0.10000000149011612)`; `BitDecrement(0.1f)=3DCCCCCC as double 0.09999999403953552: <0.1 T` | run |
| A3-09 | Against the `float` constant `0.1f` the same field is equal: the boundary for `float` code is a different number from the boundary for `double` code written with the same digits. Converting the `double` 0.1 and both of its `double` neighbours to `float` gives the one `float` `3DCCCCCD`. | Probe P1, same lines | `f==0.1f=T`; `(float)BitDecrement(0.1)=3DCCCCCD (float)BitIncrement(0.1)=3DCCCCCD` | run |
| A3-10 | The operator accepts mixed types, the pattern does not. `f < 0.1` compiles; `f is > 0.1` on a `float` is error CS0664; `i is > 2.5` on an `int` is error CS0266; `x is > 1` on a `double` compiles, with the `int` constant converted. | Probe P2, diagnostics d17, d9, d10, d11 | d9: `CS0664 Error: Literal of type double cannot be implicitly converted to type 'float'`; d10: `CS0266` | run |
| A3-11 | An `int` field compared with a non-integer `double` constant has its boundary between two integers: `2 > 2.5` is false and `3 > 2.5` is true. | Probe P1, line "int against double 2.5" | `2>2.5=F 3>2.5=T` | run |
| A3-12 | A `long` field compared with a `double` constant is rounded first, so two different `long` values can fall on the constant. Observed: `9007199254740993L > 9007199254740992.0` is false and `==` is true; `long.MaxValue == 9223372036854775808.0` is true. | Probe P1, line "long 9007199254740993" | `n>c=F n==c=T (double)n=9007199254740992` | run |
| A3-13 | The compiler API reports a comparison as an `IBinaryOperation` with `OperatorKind` (`LessThan`, `GreaterThanOrEqual`, `Equals`, …) and a null `OperatorMethod`. A converted operand is an `IConversionOperation` that is implicit and numeric, around the original operand. | Probe P2, section "A3 operations" | `[loan.DaysLate > 2.5]: Binary OperatorKind=GreaterThan … OperatorMethod=null … left=Conversion[int->double implicit=True numeric=True … operand=PropertyReference[DaysLate:int]]`; `[loan.Rate < 0.1]: … left=Conversion[float->double …]` | run |
| A3-14 | `IOperation.ConstantValue` gives the folded constant as a boxed `System.Double` (or `System.Single` for a `float` constant), for a literal, a `const` field and a folded expression. | Probe P2 | `right=Literal[double] const=System.Double 0.1 bits=3FB999999999999A`; `right=FieldReference[Cap:double] const=System.Double 0.30000000000000004 bits=3FD3333333333334`; `right=FieldReference[FCap:float] const=System.Single 0.1 bits=3DCCCCCD` | run |
| A3-15 | `SemanticModel.GetConstantValue` on the syntax gives the constant before conversion. For `loan.Fine < 1` it returns `System.Int32 1` with `ConvertedType=double`, while the operation tree has a conversion whose `ConstantValue` is `System.Double 1`. A tool that reads boundaries from syntax gets the wrong type here. | Probe P2, line `[loan.Fine < 1]` | `right=Conversion[int->double … operand=Literal[int] const=System.Int32 1] const=System.Double 1`; `syntax right: GetConstantValue=System.Int32 1 Type=int ConvertedType=double` | run |
| A3-16 | A relational pattern is an `IRelationalPatternOperation` with `OperatorKind` and a constant `Value`; `and` is an `IBinaryPatternOperation`; a constant pattern is an `IConstantPatternOperation`, whose value for `double.NaN` is a field reference with constant bits `FFF8000000000000` and for `is 0` is a conversion with constant `System.Double 0`. | Probe P2, lines `[loan.Fine is …]` | `RelationalPattern OperatorKind=GreaterThan InputType=double … const=System.Double 0.25`; `ConstantPattern … value=FieldReference[NaN:double] const=System.Double NaN bits=FFF8000000000000` | run |
| A3-17 | These members are public: `SemanticModel.GetConstantValue`, `IOperation.ConstantValue`, `IBinaryOperation.OperatorKind` and `OperatorMethod`, `IConversionOperation.Conversion` and `OperatorMethod`, `IRelationalPatternOperation.OperatorKind` and `Value`. | [compiler source, PublicAPI.Shipped.txt lines 1560, 2069-2070, 2127, 2131, 2354-2356, 2578](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt) | "`Microsoft.CodeAnalysis.Operations.IRelationalPatternOperation.OperatorKind.get -> Microsoft.CodeAnalysis.Operations.BinaryOperatorKind`" | cited |

### Question A4: is a solver needed for one `double` field compared with constants

Every row in this table except A4-02 is an inference; the rows it rests on are named.

| ID | Claim | Rests on | Tag |
|---|---|---|---|
| A4-01 | Inference: if the code reads a `double` field `x` only through `<`, `<=`, `>`, `>=`, `==`, `!=`, constant patterns and relational patterns against constants, then every such test is a function of two facts: whether `x` is NaN, and where `x` lies relative to each constant in the ordering of A1-02. Two values that agree on both facts take the same path. | A1-01, A1-02, A1-06, A1-07, A1-09 | inferred |
| A4-02 | Run, for `float` in place of `double`: with the constants `-1.5f`, `0f`, `0.1f`, `2.5f`, a signature of 39 comparison results (six operators and `Equals` against each constant, four constant patterns, seven relational and combined patterns) was computed for all 4,294,967,296 bit patterns. The model of A4-03 has 10 cells; all 10 received values; 0 values had a signature different from the first value seen in their cell; the 10 cells have 10 different signatures. The NaN cell holds 16,777,214 patterns and the cell "at 0" holds 2. | Probe P6: `float bit patterns tried: 4294967296 of 4294967296`; `values whose signature differs from the first value seen in their cell: 0`; `distinct signatures across cells: 10` | run |
| A4-03 | Inference: for `n` distinct constants (after merging `0.0` with `-0.0`, and with a NaN constant counted only as "the code tests for NaN") the cells are: NaN; below the smallest constant; each constant; each open interval between neighbours; above the largest. That is `2n + 2` cells. The infinities are ordinary members of the two end cells unless they are constants themselves. A cell is empty when two constants are neighbours (`BitIncrement(c1) == c2`) or when a constant is an infinity. | A1-02, A2-03, A4-01, A4-02 | inferred |
| A4-04 | Inference: sorting must use the bound constants as `double` values (A3-14), after the conversions of A3-06, and not the source text: `0.1 + 0.2` and `0.3` are different boundaries (A3-04), `1` and `1.0` are the same boundary (A3-15), `0.0` and `-0.0` are the same boundary (A1-13). | A3-04, A3-14, A3-15, A1-13 | inferred |
| A4-05 | Inference: one representative per cell is enough to reach every branch. The extra inputs (the constant itself, its two neighbours from A2-01, both zeros, both infinities, NaN) add nothing to branch coverage in comparison-only code. They matter for the result, because the result expression may tell apart values that the guards cannot (A1-16). | A4-01, A1-16 | inferred |
| A4-06 | The compiler's exhaustiveness answer (`ISwitchExpressionOperation.IsExhaustive`, CS8509) is an independent check of the same partition for `switch` expressions, and it names the uncovered cell (`double.NaN`, `0.5D`). | A1-12, A1-13, A1-14 | inferred |
| A4-07 | Inference: when the field is a `float`, `int` or `long` and the constant a `double`, the cells live in the field's own type and the boundary is the pair of field values around the converted constant, not the constant. For `long` the conversion is not exact, so the cell "equal to the constant" can hold more than one value (A3-12). | A3-07 to A3-12 | inferred |

When it stops being complete:

| ID | Case | Evidence | Tag |
|---|---|---|---|
| A4-08 | Two fields compared with each other (`a < b`). The set of inputs that take a branch is no longer a product of per-field cells, so no choice of representatives per field is guaranteed to hit both sides. A solver finds a witness in milliseconds (row A5-12, query 7). | Inference from A4-01; probe P3 query 7 | inferred |
| A4-09 | Arithmetic before the comparison. The switch point is not where decimal algebra puts it. Observed: `x + 0.1 >= 0.3` is true for `x = 0.19999999999999998` and false for `x = 0.19999999999999996`, while `x >= 0.2` is already false for the first. `x + 1e16 > 1e16` is false for `x = 1` and true for `x = 1.5`. `x * 3.0 > 1.0` is false for `1.0 / 3.0` and for the next value up, and true two values up. | Probe P7, first nine lines | run |
| A4-10 | Arithmetic also creates the special values from ordinary inputs: `1e308 * 10` is `+inf`, the difference of two such products is NaN, `0.0 * (1.0 / 0.0)` is NaN, `-1.0 * 0.0` is `-0` (bits `8000000000000000`). | Probe P7 | run |
| A4-11 | A `Math` function before the comparison. Its boundary cannot be read from the constants, and for most functions the result is not fixed across platforms (rows A6-10, A6-11). | A6-10, A6-11 | inferred |
| A4-12 | Any operation that sees more than the ordering: `Equals`, `CompareTo`, `double.IsNegative`, `double.IsNaN` and its relatives, `BitConverter`, division by the field, a cast to an integer type. Each splits a cell (the zeros, the NaN sign, the infinities) or adds a boundary (the integer range; see row N15 of `research/verifiable-beyond-enumeration.md`). | A1-16, A1-17 | inferred |
| A4-13 | A comparison of the field with a non-constant: another parameter, a field of the step struct, a `static readonly` field. `static readonly` is not a constant for the compiler, so `ConstantValue` has no value. That last sentence is an inference from the C# rule that only `const` gives a constant; it was not run. | A3-14 | inferred |

### Question A5: Z3's floating-point theory through the .NET API

`research/verifiable-csharp-domains.md` rows Q6-01 to Q6-16 and its experiment E7 cover the package, its platforms and that it loads on .NET 10; none of that is repeated.

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| A5-01 | The API has a floating-point sort with named sizes; `MkFPSortDouble()` is the 64-bit sort. Observed: 11 exponent bits and 53 significand bits. | [Z3 source, Context.cs lines 4219-4226](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/api/dotnet/Context.cs#L4219-L4226); probe P3 | "Create the double-precision (64-bit) FloatingPoint sort."; `MkFPSortDouble: ebits=11 sbits=53` | cited, run |
| A5-02 | Five rounding modes exist, each under a long and a short name: nearest ties to even (`MkFPRoundNearestTiesToEven`, `MkFPRNE`), nearest ties to away, toward positive, toward negative, toward zero. Each arithmetic operation takes the mode as its first argument. | [Context.cs lines 4099-4171 and 4419-4477](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/api/dotnet/Context.cs#L4099-L4477) | "`public FPExpr MkFPMul(FPRMExpr rm, FPExpr t1, FPExpr t2)`" | cited |
| A5-03 | Operations present: `MkFPAbs`, `MkFPNeg`, `MkFPAdd`, `MkFPSub`, `MkFPMul`, `MkFPDiv`, `MkFPFMA`, `MkFPSqrt`, `MkFPRem`, `MkFPRoundToIntegral`, `MkFPMin`, `MkFPMax`. The list of `MkFP…` methods contains no sine, exponential, logarithm or power. The second sentence is a search of the method list, not a statement in the source. | [Context.cs lines 4399-4518](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/api/dotnet/Context.cs#L4399-L4518) | 12 method signatures | cited |
| A5-04 | Predicates present: `MkFPLEq`, `MkFPLt`, `MkFPGEq`, `MkFPGt`, `MkFPEq`, `MkFPIsNormal`, `MkFPIsSubnormal`, `MkFPIsZero`, `MkFPIsInfinite`, `MkFPIsNaN`, `MkFPIsNegative`, `MkFPIsPositive`. | [Context.cs lines 4528-4634](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/api/dotnet/Context.cs#L4528-L4634) | 12 method signatures | cited |
| A5-05 | There are two equalities. `MkFPEq` is IEEE equality (the C# `==`). The general `MkEq` is identity of values, under which NaN equals NaN and the two zeros differ. | [Context.cs lines 4563-4571](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/api/dotnet/Context.cs#L4563-L4571); [SMT-LIB FloatingPoint theory](https://smt-lib.org/theories-FloatingPoint.shtml) | "Note that this is IEEE 754 equality (as opposed to standard =)."; "(fp.eq x y) evaluates to true if x evaluates to -zero and y to +zero, or vice versa." | cited |
| A5-06 | Observed: `fp.eq(x, +0)` together with `not (x = +0)` is satisfiable with `x = -0`; `x = NaN` together with `fp.eq(x, x)` is unsatisfiable; "neither `x < 0.5` nor `x >= 0.5`" is satisfiable and the model is NaN. | Probe P3, queries 2, 3, 4 | `3 …: SATISFIABLE … bits=8000000000000000 … IsZero=True IsNegative=True`; `4 …: UNSATISFIABLE`; `2 …: SATISFIABLE … IsNaN=True` | run |
| A5-07 | The theory has exactly one NaN. NaN payloads and signalling NaNs cannot be expressed. | [SMT-LIB FloatingPoint theory](https://smt-lib.org/theories-FloatingPoint.shtml), notes on `(_ NaN eb sb)` | "there is exactly one NaN in the set denoted by (_ FloatingPoint eb sb)" and "There is no distinction in this theory between a ``quiet'' and a ``signaling'' NaN." | cited |
| A5-08 | A .NET `double` goes in with `MkFP(double, FPSort)`; NaN, the infinities and the zeros also have their own constructors. Observed: `MkFP(double.NaN, …)`, `MkFP(double.Epsilon, …)` and `MkFP(double.MaxValue, …)` give terms with `IsNaN`, `IsSubnormal` and the right bits. | [Context.cs lines 4259-4353](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/api/dotnet/Context.cs#L4259-L4353); probe P3b | `Epsilon: to_ieee_bv simplified = 1 … IsSubnormal=True`; `MaxValue: to_ieee_bv simplified = 9218868437227405311` | cited, run |
| A5-09 | A model value comes out as an `FPNum` with `Sign`, `SignificandUInt64`, `ExponentInt64(biased)`, `IsNaN`, `IsInf`, `IsZero`, `IsNormal`, `IsSubnormal`, `IsPositive`, `IsNegative`. There is no member that returns a `double`. | [Z3 source, FPNum.cs lines 27-171](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/api/dotnet/FPNum.cs#L27-L171) | "This function extracts the significand bits, without the hidden bit or normalization." | cited |
| A5-10 | `MkFPToIEEEBV` gives the 64 bits as a bit-vector term, and evaluating it in the model gave the right `double` for finite values, both infinities, negative zero and the smallest subnormal. | [Context.cs lines 4781-4791](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/api/dotnet/Context.cs#L4781-L4791); probes P3 and P3b | `-0: to_ieee_bv simplified = 9223372036854775808`; `-inf: … 18442240474082181120`; query 6 model `bits=3FE0000000000001` | cited, run |
| A5-11 | For NaN that conversion is a trap in 4.12.2. `to_ieee_bv(NaN)` does not simplify to a number, and evaluating it in a model where `x` is NaN returned 0, which is the bit pattern of `+0.0`. A caller has to test `FPNum.IsNaN` before using the bits. The SMT-LIB text explains why the standard theory has no such function. | Probe P3b; probe P3 query 2; [SMT-LIB FloatingPoint theory](https://smt-lib.org/theories-FloatingPoint.shtml) | `NaN: to_ieee_bv simplified = (fp.to_ieee_bv (_ NaN 11 53)) (BitVecExpr)`; `Eval(to_ieee_bv(x), completion) = 0`; "All fp.to_* functions are unspecified for NaN and infinity input values." | run, cited |
| A5-12 | `FPNum.ToString()` of the 4.12.2 .NET API is not a readable number: `0.1` prints as `(/ 3602879701896397 36028797018963968)`, and `-inf` and `-0` both print as `0`. | Probe P3, last lines | `MkFPInf(neg): 0; MkFPZero(neg): 0` | run |
| A5-13 | Z3 decides floating-point formulas by rewriting them to bit-vectors and then to a propositional problem. | [Z3 source, qffp_tactic.cpp lines 80-105](https://github.com/Z3Prover/z3/blob/e417f7d78509b2d0c9ebc911fee7632e6ef546b6/src/tactic/fpa/qffp_tactic.cpp#L80-L105) | "`mk_fpa2bv_tactic(m, p),`" followed by "`mk_bit_blaster_tactic(m, p),`" | cited |
| A5-14 | Observed cost on one machine, Z3 4.12.2, timeout 60 s. Comparisons of one or two variables with constants: 4 to 11 ms each (queries 1 to 7). One multiplication or addition with a constant: 24 and 28 ms (queries 8, 9). A witness that `x*y+z` differs from the fused form on [1, 2]: 9.8 s (query 10). A witness that `x/y*y` differs from `x` on [1, 1000]: 17.9 s (query 13). A proof that `x*y` equals `y*x` for all values: 39.9 s (query 11). A witness that addition is not associative: 0.4 s (query 12). | Probe P3 | `11 x*y == y*x for all (expect UNSAT of the negation): UNSATISFIABLE in 39890 ms` | run |
| A5-15 | The witnesses agree with .NET arithmetic in the cases checked: `0.19999999999999998 + 0.1 == 0.3` is true, `0.3334197985568594 * 3.0 > 1.0` is true, `1000.0 / y * y == 1000.0` is false for the `y` Z3 gave, the two groupings of the associativity witness give different bits, and Z3's `x, y, z` for query 10 give `400E276666047CCE` for `a * b + c` and `400E276666047CCF` for `Math.FusedMultiplyAdd`. | Probe P4, last two lines and the first line | `Z3 models checked in .NET: … True; … True; … False` | run |
| A5-16 | The TypeScript backend uses Z3 (`z3-solver` 5.3.3) through SMT-LIB text, with a per-query timeout and a cache keyed on the solver version, and declares conversion inputs as `Int`. It does not use the floating-point theory. | `skills/development/verifiable/scripts/package.json` line 8; `scripts/branches.ts` lines 396-430; `scripts/conversion.ts` line 327 | "`(declare-const v${i} Int)`" | read |

### Question A6: how repeatable .NET `double` arithmetic is

`research/verifiable-beyond-enumeration.md` rows N1 to N17 and its experiment X6 already give: the C# permission for higher precision (N2), the CLI standard's implementation-dependent internal representation and fixed rounding mode (N3, N4), the documented platform differences (N9 to N13), and the observation that a loop of `+`, `-` and `*` was bit-identical in every configuration tried while `Math.Sin` differed between a 32-bit and a 64-bit process.
The rows below add what that note left open.

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| A6-01 | The C# standard requires each operation's result to be rounded to nearest in the destination format, and in the next paragraph allows higher precision. | [C# standard draft-v8, types.md §8.3.7, lines 371 and 377](https://github.com/dotnet/csharpstandard/blob/d2e3ec5c5000a5851284281a5f398317cfcab73a/standard/types.md?plain=1#L371-L377) | "The result of a floating-point operation is rounded to the nearest representable value in the destination format." and "Floating-point operations may be performed with higher precision than the result type of the operation." | cited |
| A6-02 | The CLI standard permits contraction, that is, fusing a multiply and an add, and says that reproducible precision does not guarantee reproducible behaviour. | [ECMA-335, 6th edition, Partition III §1.1.1, note](https://ecma-international.org/wp-content/uploads/ECMA-335_6th_edition_june_2012.pdf) | "permits the use of wider precision hardware registers, as well as the application of optimizing transformations (such as contractions), which result in the same or greater precision." | cited |
| A6-03 | A member of the runtime repository described C# code in 2019 as behaving like the C compiler's precise mode, and listed "`a * b + c` to `fmadd`" among the things a separate fast mode could allow. | [dotnet/runtime issue 12753](https://github.com/dotnet/runtime/issues/12753), opened 2019-05-25, closed 2026-06-29 | "a pure C# code behaves more like `/fp:precise`" | cited |
| A6-04 | The 2017 proposal to make the JIT recognise `(a * b) + c` and emit a fused instruction was closed in 2020 without that change; the closing comment says a switch would be needed. | [dotnet/runtime issue 8289](https://github.com/dotnet/runtime/issues/8289), comment of 2020-10-12 | "the runtime would require some kind of knob to enable the JIT to optimize these kinds of sequences" | cited |
| A6-05 | In the same thread a JIT contributor wrote that the CLI standard allows the fusion, and the proposer showed that the two forms can give different results. | [issue 8289](https://github.com/dotnet/runtime/issues/8289), comments of 2017-06-06 and 2017-06-05 | "*contraction* is explicitly allowed by ECMA 335 (III.1.1.1), so it might be reasonable to do this folding without user consent, but I'm not sure." and "with `(1e300 * 2) - 1e300`, you will get `Inf`, but with `fma(1e300, 2, -1e300)` you get `1e300`." | cited |
| A6-06 | A repository member called contraction a value-changing optimisation, asked for it to be switched off in every C compiler used to build the runtime, and noted that Arm64 always has the fused instruction. | [dotnet/runtime issue 64604](https://github.com/dotnet/runtime/issues/64604), opened 2022-02-01 | "it is considered a value changing optimization in the IEEE 754 specification and is therefore considered unsafe." and "Arm64 however brings `fused multiply-add` instructions as \"baseline\" and they are always available." | cited |
| A6-07 | A repository member wrote in 2021 that fusing for floating point would belong to an "unsafe" mode in the future. | [dotnet/runtime issue 49283](https://github.com/dotnet/runtime/issues/49283), opened 2021-03-07 | "we might want to also recognize fmadd (for fp) in future in a sort of an \"unsafe\" math mode." | cited |
| A6-08 | Observed on x64, runtime 10.0.11, on a processor that reports `Fma.IsSupported=True`: `a * b + c` gave `400E276666047CCE` and `Math.FusedMultiplyAdd(a, b, c)` gave `400E276666047CCF`, for inputs where the two differ. The unfused result was the same on the first call, after 1.2 million calls and 1.8 s of waiting for the optimising tier, inlined in a hot loop, with `AggressiveOptimization`, in Debug, in Release, with `DOTNET_TieredCompilation=0` and with `DOTNET_TieredPGO=0`. No fusion was observed. | Probe P4, five runs | `after 1.2M calls and 1.8 s of sleeps: a*b+c=400E276666047CCE local=400E276666047CCE opt=400E276666047CCE FusedMultiplyAdd=400E276666047CCF differ=0` | run |
| A6-09 | The documentation of `Math.FusedMultiplyAdd` states that it differs from the two-step form. | [API documentation source, Math.xml lines 3424-3432](https://github.com/dotnet/dotnet-api-docs/blob/a010100852b71f33d67d913d7a9ed69f83a639b1/xml/System/Math.xml#L3424-L3432) | "This differs from the non-fused sequence, which would compute `(x * y)` as if to infinite precision, round the result to the nearest representable value, add `z` to the rounded result as if to infinite precision, and finally round to the nearest representable value." | cited |
| A6-10 | `Math` functions call the C library of the platform. In the source of the installed runtime, `Math.Sin`, `Cos`, `Exp`, `Log`, `Pow` and the others are one-line calls of the C function of the same name. | [runtime source, floatdouble.cpp lines 48-244](https://github.com/dotnet/dotnet/blob/e2f47b0110ed922f21a1522da67279133ce28f32/src/runtime/src/coreclr/classlibnative/float/floatdouble.cpp#L48-L244) | "`FCIMPL1_V(double, COMDouble::Sin, double x)`" … "`return sin(x);`" | cited |
| A6-11 | A repository member stated that the results of these functions can differ by architecture, by operating system and by .NET release. | [dotnet/dotnet-api-docs issue 4231](https://github.com/dotnet/dotnet-api-docs/issues/4231), opened 2020-05-13 | "The implementation currently just invokes down to the underlying C Runtime implementation for each OS/Architecture, so the results you get may differ" and "They may further differ between releases of .NET based on the underlying C Runtime implementation version" | cited |
| A6-12 | The runtime team lists `+`, `-`, `*`, `/`, `Math.Sqrt` and `Math.FusedMultiplyAdd` as the .NET forms of operations that IEEE 754:2019 requires. | [dotnet/runtime issue 1387](https://github.com/dotnet/runtime/issues/1387) | "formatOf-multiplication(source1, source2) … double = double * double" and "formatOf-squareRoot(source1) … double Math.Sqrt(double)" | cited |
| A6-13 | IEEE 754 requires the four basic operations and square root to be exactly rounded and does not require that of transcendental functions. | [Goldberg 1991, as reprinted by Oracle](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html), two sentences found by text search; the headings above them were not recorded | "The IEEE standard requires that the result of addition, subtraction, multiplication and division be exactly rounded." and "The IEEE standard does not require transcendental functions to be exactly rounded because of the table maker's dilemma." | cited |
| A6-14 | The addendum printed with that reprint, which is not by Goldberg, says that conformance to IEEE 754 does not make results identical across systems. | [same page, section "Differences Among IEEE 754 Implementations"](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) | "the IEEE standard does not guarantee that the same program will deliver identical results on all conforming systems." and "This material was not written by David Goldberg" | cited |
| A6-15 | Inference: an expected result built from `+ - * /` only, evaluated in the same order as the code, can be compared bit for bit on the platform where A6-08 was observed. Nothing read gives that as a guarantee for another architecture, another runtime version or a future JIT: the standards allow the difference (A6-01, A6-02) and the runtime team's statements are comments in issues, not documentation. A result that passes through a `Math` function other than `Sqrt`, `FusedMultiplyAdd`, `Abs`, `Min`, `Max` and the rounding functions has no basis for exact comparison across platforms (A6-10, A6-11). | A6-01 to A6-13 | | inferred |
| A6-16 | Observed: the same expression evaluated twice, and two algebraically equal orderings of it, gave the same bits in one case (`fine * days + 0.25`, `0.25 + days * fine`, `fine + fine + fine + 0.25` all `3FE199999999999A`), while `0.1 * 3.0` is `3FD3333333333334` and the literal `0.3` is `3FD3333333333333`, one step apart. Equal bits for reordered expressions is an observation on these inputs, not a rule (A5-14, query 12). | Probe P7, lines "fine*days+0.25 twice" and "ulp distance example" | `Math.BitIncrement(0.3) == 0.1*3: True` | run |

### Question A7: how existing .NET tools choose `double` inputs

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| A7-01 | FsCheck's default `float` (the .NET `double`) generator draws from two sources in the ratio 7 to 1: a value between `-size` and `size`, or one of six special values. | [FsCheck source, Internals.DefaultArbs.fs lines 189-196](https://github.com/fscheck/FsCheck/blob/1ef52cfc65d5c318f5ee4da467df9087ad03e34c/src/FsCheck/Internals.DefaultArbs.fs#L189-L196) | "`Gen.frequency [(7, Default.NormalFloat.Generator …) (1, Gen.elements [ Double.NaN; Double.NegativeInfinity; Double.PositiveInfinity Double.MaxValue; Double.MinValue; Double.Epsilon])]`" | cited |
| A7-02 | The list has no negative zero, no negative `Epsilon` and no neighbour of any value. A NaN or an infinity shrinks to `0.0`. | [same file, lines 195-199](https://github.com/fscheck/FsCheck/blob/1ef52cfc65d5c318f5ee4da467df9087ad03e34c/src/FsCheck/Internals.DefaultArbs.fs#L195-L199) | the shrinker's first branch tests `Double.IsInfinity fl` or `Double.IsNaN fl` and ends in "`then Seq.singleton 0.0`" | cited |
| A7-03 | FsCheck also has a `NormalFloat` type whose generator leaves the special values out. | [same file, lines 165-175](https://github.com/fscheck/FsCheck/blob/1ef52cfc65d5c318f5ee4da467df9087ad03e34c/src/FsCheck/Internals.DefaultArbs.fs#L165-L175) | "Generates float values that are between -size and size (without NaN, Infinity, Epsilon, MinValue, MaxValue)" | cited |
| A7-04 | CsCheck's default `double` generator is the range from -1e50 to 1e50. (Already row K8 of `research/verifiable-beyond-enumeration.md`; re-read here.) | [CsCheck source, Gen.cs line 2071](https://github.com/AnthonyLloyd/CsCheck/blob/9288cc9cb469d7bf00b39f7c11fc21b73307099d/CsCheck/Gen.cs#L2071) | "`internal static readonly Gen<double> DefaultDouble = Double[-1e50, 1e50];`" | cited |
| A7-05 | CsCheck's `Gen.Double.Special` returns, in 1 draw of 16, one of 16 listed values: NaN, both infinities, `MaxValue`, `MinValue`, `Epsilon`, `-Epsilon`, the integers ±1 to ±4, and `0.0`. In the other 15 draws it reinterprets 64 random bits as a `double`. The list has `0.0` and not `-0.0`. | [Gen.cs lines 2833-2862](https://github.com/AnthonyLloyd/CsCheck/blob/9288cc9cb469d7bf00b39f7c11fc21b73307099d/CsCheck/Gen.cs#L2833-L2862) | "`return (i & 0xF0UL) == 0xD0UL ? MakeSpecial(i) : BitConverter.Int64BitsToDouble((long)i);`" | cited |
| A7-06 | CsCheck has a range generator, `Gen.Double[start, finish]`. | [Gen.cs lines 2754-2755](https://github.com/AnthonyLloyd/CsCheck/blob/9288cc9cb469d7bf00b39f7c11fc21b73307099d/CsCheck/Gen.cs#L2754-L2755) | "`public Gen<double> this[double start, double finish]`", with the comment "Generate double in the range" start "to" finish | cited |
| A7-07 | Inference from the generator lines read: neither library looks at the code under test, so neither places inputs at, or one step from, the constants the code compares with. The probability that a default generator hits a given cell depends on the width of the cell. | A7-01 to A7-06 | | inferred |
| A7-08 | IntelliTest finds inputs with the Z3 constraint solver. Its documentation page on input generation does not contain the word "floating". | [learn: IntelliTest input generation](https://learn.microsoft.com/en-us/visualstudio/test/intellitest-manual/input-generation?view=visualstudio) | "IntelliTest uses the Z3 constraint solver." | cited |
| A7-09 | IntelliTest is deprecated in Visual Studio 2026 and was supported for .NET Framework only in Visual Studio 2022. | [learn: IntelliTest overview](https://learn.microsoft.com/en-us/visualstudio/test/intellitest-manual/?view=visualstudio) | "IntelliTest is deprecated in Visual Studio 2026. In Visual Studio 2022, IntelliTest is supported for .NET Framework only and is limited to Visual Studio Enterprise." | cited |
| A7-10 | In 2010, Pex (the research tool behind IntelliTest) did not solve floating-point constraints exactly: it approximated floating-point values by rationals, then called custom solvers to repair the model. Two of the four authors were from the Pex team. Whether this still describes IntelliTest was not established. | [Lakhotia, Tillmann, Harman, de Halleux, "FloPSy – Search-Based Floating Point Constraint Solving for Symbolic Execution", ICTSS 2010, author-hosted copy](http://www0.cs.ucl.ac.uk/staff/mharman/ictss10.pdf), section 2 | "When Pex constructs constraint systems for Z3, all floating point values are approximated by rational numbers, and most operations are encoded as uninterpreted functions." | cited |

### Question A8: compiler-API facts the admission needs

`research/verifiable-csharp-domains.md` rows Q2-06 to Q2-24 and Q5-01 to Q5-21 cover records, constructors, `init`, `required`, and the pattern operations; they are not repeated.
The present admission rejects `in`, `with`, calls, assignments, loops and local declarations (`references/csharp/shapes.md`, section "Decision admission", read).

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| A8-01 | A `readonly record struct` declared in source has `TypeKind=Struct`, `IsRecord=True`, `IsReadOnly=True`. A plain `record struct` has `IsReadOnly=False`. A `readonly struct` has `IsRecord=False`, `IsReadOnly=True`. A record class has `TypeKind=Class`. | Probe P2, section "A8 symbols" | `Loan: TypeKind=Struct IsRecord=True IsReadOnly=True`; `RS: TypeKind=Struct IsRecord=True IsReadOnly=False`; `Step: TypeKind=Struct IsRecord=False IsReadOnly=True` | run |
| A8-02 | `ITypeSymbol.IsRecord` is false for a record struct that comes from a compiled assembly instead of source. | [compiler source, ITypeSymbol.cs lines 138-145](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Symbols/ITypeSymbol.cs#L138-L145) | "Returns false for record structs in metadata since they don't have any distinctive marker." | cited |
| A8-03 | An `in` parameter has `IParameterSymbol.RefKind == RefKind.In` (value 3). A `ref readonly` parameter is a different kind, `RefReadOnlyParameter` (value 4). `RefKind.RefReadOnly` has the same value 3 as `In` and is documented for return types. | [compiler source, RefKind.cs lines 30-43](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Symbols/RefKind.cs#L30-L43); probe P2 | "Indicates an \"in\" parameter." … "`In = 3,`" … "`RefReadOnly = 3,`" … "`RefReadOnlyParameter = 4,`"; `parameter loan: RefKind=In (3)`; `parameter other: RefKind=RefReadOnlyParameter (4)` | cited, run |
| A8-04 | A `with` expression is an `IWithOperation` with `Operand`, `CloneMethod` and `Initializer`. Each changed member is an `ISimpleAssignmentOperation` inside the initializer whose target is an `IPropertyReferenceOperation`. | [compiler source, OperationInterfaces.xml lines 3371-3398](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml#L3371-L3398); probe P2 | "Represents cloning of an object instance."; `[loan with { Fine = loan.Fine * step.Days, Lost = false }]: With type=Loan operand=ParameterReference CloneMethod=null initializer=ObjectOrCollectionInitializer` then two `SimpleAssignment target=PropertyReference[…]` lines | cited, run |
| A8-05 | For a record struct `CloneMethod` is null in valid code; for a record class it is the synthesized clone method. So a null `CloneMethod` separates "copy of a struct" from "call of a clone method". | Probe P2 | `[loan with { Fine = Cap }]: … CloneMethod=null`; `[rc with { A = 1 }]: With type=RC … CloneMethod=RC.<Clone>$()` | run |
| A8-06 | For a struct, `with` copies the receiver and then performs the assignments in order. Copy semantics of a struct cannot be customised. | [record structs proposal, lines 285-295](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-10.0/record-structs.md?plain=1#L285-L295); [C# reference, with expression](https://github.com/dotnet/docs/blob/c3377f5f732f604c8f9bffc14d814dd35c99f3c0/docs/csharp/language-reference/operators/with-expression.md?plain=1#L30) | "For a receiver with struct type, the receiver is first copied, then each `member_initializer` is processed the same way as an assignment to a field or property access of the result of the conversion." and "You can't customize the copy semantics for structure types." | cited |
| A8-07 | A positional property of a record is recognised by its declaring syntax, which is the parameter (`SyntaxKind.Parameter`). `IsImplicitlyDeclared` is false for the property and true for its getter. A property that the record body redeclares has `PropertyDeclaration` as its declaring syntax and a getter that is not implicit. The backing field is implicit and its `AssociatedSymbol` is the property. | Probe P2, section "A8 symbols" | `property Fine: double implicit=False … set.IsInitOnly=True get.IsReadOnly=True get.implicit=True declSyntax=Parameter`; `WithBody … property A: … get.implicit=False declSyntax=PropertyDeclaration`; `field <Fine>k__BackingField: … implicit=True IsReadOnly=True associated=Fine` | run |
| A8-08 | `SemanticModel.GetDeclaredSymbol` on the positional parameter returns the constructor parameter, not the property. No public member that maps one to the other was looked for beyond what A8-07 shows. | Probe P2 | `GetDeclaredSymbol(positional parameter Fine) -> Parameter double Fine containing=Loan.Loan(int, double, int, bool, Tier, float, long)` | run |
| A8-09 | A struct declared with a primary constructor that is not a record gets no property from its parameters; the property is whatever the body declares. | Probe P2 | `StepP: … IsRecord=False … property Days: … get.implicit=False declSyntax=PropertyDeclaration` | run |
| A8-10 | A loop is an `ILoopOperation` (`for`, `foreach`, `while`, `do`) with `OperationKind.Loop`. A call is an `IInvocationOperation`. An assignment is an `IAssignmentOperation` (simple, compound, deconstruction, coalescing); `++` and `--` are a separate `IIncrementOrDecrementOperation`. `OperationExtensions.Descendants` and `OperationWalker` are public. | [OperationInterfaces.xml lines 128-140 and 1363-1373](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml#L128-L140); [PublicAPI.Shipped.txt lines 2464, 3766](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt); probe P2 | "C# 'while', 'for', 'foreach' and 'do' loop statements"; method `Bad`: `loop LoopKind=For`, `assignment CompoundAssignment target=LocalReference`, `Increment target=LocalReference`, `invocation System.Math.Abs(double)` | cited, run |
| A8-11 | The target of an assignment says what is written: `LocalReference`, `ParameterReference`, `FieldReference` or `PropertyReference`. The assignments inside a `with` initializer are also `IAssignmentOperation` nodes with a property target, so a rule "no assignment except to locals" has to exempt the children of an `IWithOperation.Initializer`. | Probe P2, method `Apply` | `SimpleAssignmentx3 … Withx2` in a method with no assignment statement | run |
| A8-12 | "No calls" is wider than "no `IInvocationOperation`". Code can run without one through: `IObjectCreationOperation` (a constructor), `IPropertyReferenceOperation` (a getter, user-written or synthesized), an `IBinaryOperation` or `IConversionOperation` whose `OperatorMethod` is not null, an `IWithOperation` whose `CloneMethod` is not null, and the other nodes of the interface list such as interpolated strings, `foreach`, `using`, `await`, deconstruction, list patterns and collection expressions. | Probe P2, method `Bad`; [OperationInterfaces.xml, node list](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml) | `object creation Loan.Loan(int, double, int, bool, Tier, float, long)`; `property read Loan.Fine property.implicit=False`; `with CloneMethod=RC.<Clone>$()` | run, cited |
| A8-13 | Observed: a `decimal` comparison (`m > 1`) produced no `IBinaryOperation` with a non-null `OperatorMethod`, although `decimal` operators are library methods. A null `OperatorMethod` therefore does not show that no method runs; the operand type has to be checked too. | Probe P2, method `Bad`: no line "binary with OperatorMethod" was printed | | run |
| A8-14 | `IMethodSymbol.IsReadOnly` says whether an instance method of a struct has a read-only `this`. Observed: false for a method without the modifier in a non-readonly struct, true for one declared `readonly`. | [compiler source, IMethodSymbol.cs lines 141-147](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Symbols/IMethodSymbol.cs#L141-L147); probe P2 | "Indicates whether the method is readonly, i.e. whether the 'this' receiver parameter is 'ref readonly'."; `Apply.IsReadOnly=False … Bad.IsReadOnly=True` | cited, run |
| A8-15 | Observed: `with` keeps every field it does not name bit for bit, including a NaN with an unusual payload (`7FF0000000000123` before and after). | Probe P7, last line | `Rate bits before=7FF0000000000123 after=7FF0000000000123` | run |

### Question B1: postconditions

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| B1-01 | In Dafny an `ensures` clause states the postcondition of a method or function; several clauses are joined with "and"; a missing clause means `ensures true`. | [Dafny reference manual at v4.11.0, Specifications.md lines 65-85](https://github.com/dafny-lang/dafny/blob/v4.11.0/docs/DafnyRef/Specifications.md?plain=1#L65-L85) | "An `ensures` clause specifies the post condition for a method, function or iterator." | cited |
| B1-02 | Dafny's basic numeric types are `int` and `real`. Rows D10 to D13 and experiment X8 of `research/verifiable-beyond-enumeration.md` show that `real` compiles to an exact rational in C#, so a Dafny postcondition proved over `real` says nothing about `double` rounding. | [Types.md at v4.11.0, line 26](https://github.com/dafny-lang/dafny/blob/v4.11.0/docs/DafnyRef/Types.md?plain=1#L26) | "The basic scalar types: `bool`, `char`, `int`, `real`, `ORDINAL`, bitvector types" | cited |
| B1-03 | .NET Code Contracts express a postcondition as `Contract.Ensures(condition)` with `Contract.Result<T>()` and `Contract.OldValue<T>(e)`. | [learn: Code contracts (.NET Framework)](https://learn.microsoft.com/en-us/dotnet/framework/debug-trace-profile/code-contracts) | "Postconditions express a condition that must be true upon normal termination of the method." | cited |
| B1-04 | Code Contracts are not supported on .NET 5 and later. `Contract.Ensures` is still declared, conditional on the symbol `CONTRACTS_FULL`. (Status already in rows R10 and R11 of `research/verifiable-beyond-enumeration.md`; R11 read `Contract.Requires`, this row read the `Ensures` signature.) | [same page](https://learn.microsoft.com/en-us/dotnet/framework/debug-trace-profile/code-contracts); [learn: Contract.Ensures](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.contracts.contract.ensures?view=net-10.0) | "Code contracts aren't supported in .NET 5+ (including .NET Core versions)." and "`[System.Diagnostics.Conditional("CONTRACTS_FULL")] public static void Ensures(bool condition);`" | cited |
| B1-05 | In JML an `ensures` clause states a normal postcondition and can use `\result` and `\old(E)`. JML is for Java; no .NET tool for it was looked for. | [JML Reference Manual, section 9.9.3](https://www.cs.ucf.edu/~leavens/JML/jmlrefman/jmlrefman_9.html) | "An ensures clause specifies a normal postcondition, i.e., a property that is guaranteed to hold at the end of the method (or constructor) invocation in the case that this method (or constructor) invocation returns without throwing an exception." | cited |
| B1-06 | The survey of the oracle problem treats assertions and contracts as one kind of specified oracle and names their advantage over separate specification languages. | [Barr, Harman, McMinn, Shahbaz, Yoo, "The Oracle Problem in Software Testing: A Survey", author-hosted preprint of the IEEE TSE 2015 paper](http://www0.cs.ucl.ac.uk/staff/M.Harman/tse-oracle.pdf), section 4.2 | "assertions can directly reference and define relations over program variables, reducing the impedance mismatch between specification and implementation" | cited |
| B1-07 | Known weakness, as an inference: a postcondition is a predicate, so it can be true for many functions. The Dafny manual's own example, `ensures r > 0`, is met by every body that returns a positive number. A postcondition fixes the result only when it is an equation, and then it is the reference expression of B2 under another name. | B1-01 | | inferred |
| B1-08 | Known weakness, as an inference: outside a prover a postcondition is evaluated only on the inputs that are run. In this tool that means the representatives of each cell, so it shows the predicate at those points and not on the cell. | B1-06, A4-05 | | inferred |

### Question B2: a reference expression evaluated beside the code

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| B2-01 | The compiler's scripting API evaluates a C# expression given as text, with host objects as globals, and can build a script once and run it many times through a delegate. | [dotnet/roslyn, docs/wiki/Scripting-API-Samples.md](https://github.com/dotnet/roslyn/blob/d31af711e72386db87ddaf2fa73f90812c187099/docs/wiki/Scripting-API-Samples.md) | "`object result = await CSharpScript.EvaluateAsync("1 + 2");`" and the scenario "Create & build a C# script and execute it multiple times" | cited |
| B2-02 | The scripting API is a separate package, `Microsoft.CodeAnalysis.CSharp.Scripting`, whose newest stable version on nuget.org is 5.9.0. Restored next to the probe it brought its own compiler build (`5.9.0-1.26357.3+35d9211b…`), which is not the build in the SDK folder that the backend references (`5.9.0-1.26379.115+14fbf8d5…`). | [nuget.org version list](https://api.nuget.org/v3-flatcontainer/microsoft.codeanalysis.csharp.scripting/index.json); probe P5, first line | `scripting 5.9.0-1.26357.3+35d9211b841e7613c1d2f8f5af6d628ace696c4c; compiler 5.9.0-1.26357.3+35d9211b841e7613c1d2f8f5af6d628ace696c4c` | cited, run |
| B2-03 | Observed cost on one machine, two runs. First `EvaluateAsync` of `fine * days + 0.25`: 1005 and 1043 ms. Ten more evaluations of ten different texts: 837 and 851 ms in total. Building one script and a delegate: 91 and 85 ms. 10,000 calls of that delegate: 26.5 and 28.1 ms. | Probe P5, lines 1 to 4 | `1 first EvaluateAsync: 1005 ms`; `2 ten more EvaluateAsync calls with different text: 837 ms in total` | run |
| B2-04 | Observed cost of the other route: one compilation that holds the code and a generated class with one method per spec expression, emitted to memory: 222 and 210 ms, measured in a process whose compiler had already been used by the script calls. A further compilation in the same process: 11 and 12 ms. Loading the assembly and 10,000 reflection calls of each of the two methods: 4.9 and 5.4 ms. The two results had equal bits. The comparison between the two routes is not controlled: the first number of each route includes different warm-up. | Probe P5, lines 5 to 7 | `5 compile code + spec tree and emit: 222 ms success=True`; `6 … actual=3FE199999999999A expected=3FE199999999999A equal bits=True` | run |
| B2-05 | The backend already parses, compiles, emits and calls by reflection (`Program.cs` lines 75-83, 187, 207-208), so the second route adds a syntax tree and no new dependency. That it adds no dependency is an inference from those lines. | `skills/development/verifiable/scripts/dotnet/Program.cs` | "`var compilation = CSharpCompilation.Create("VerifiableDecision", [tree],`" | read |
| B2-06 | A spec expression is code. Observed: a generated spec method whose body reads a file compiles with 0 errors, so a spec expression has to pass the same admission rules as the code under check before it is run. | Probe P5, line 8 | `8 a spec expression that reads a file compiles with 0 errors` | run |
| B2-07 | Weyuker defined a program as non-testable when no oracle exists or when deciding correctness costs an extraordinary amount of time. Only the abstract on the publisher's page was opened, through a summarising fetch tool; the full text was not read. | [Weyuker, "On Testing Non-testable Programs", The Computer Journal 25(4), 1982, pages 465-470](https://academic.oup.com/comjnl/article/25/4/465/366384) | "A program is non-testable if either an oracle does not exist" | cited |
| B2-08 | The survey describes the pseudo-oracle of Davis and Weyuker as a second version of the program, and makes independence part of the definition. The Davis and Weyuker paper itself could not be opened. | [Barr et al., section 5.1](http://www0.cs.ucl.ac.uk/staff/M.Harman/tse-oracle.pdf) | "A pseudo-oracle is an alternative version of the program produced independently, e.g. by a different programming team or written in an entirely different programming language." | cited |
| B2-09 | Inference: a reference expression is a pseudo-oracle in that sense only while it is independent of the code. An expression copied from the code, or derived from it, passes every check by construction and shows nothing. The tool cannot see where the expression came from; the skill's own wording for the row table is the same point (`references/csharp/shapes.md`: "Write outcomes from the requirement, never by evaluating the method." and "The tool cannot infer or certify that human review occurred."). | B2-08; `references/csharp/shapes.md`, section "Spec" (read) | | inferred |
| B2-10 | Inference: when the reference expression is written in C# and evaluated by the same compiler and runtime, the two share every error of that compiler and runtime: literal rounding, constant folding, the order of evaluation, the precision rules of A6. Agreement shows that two texts mean the same to one toolchain. | B2-08, A3-04, A6-15 | | inferred |
| B2-11 | The survey places N-version programming beside pseudo-oracles: several versions, and a vote on the output. | [Barr et al., section 5.1](http://www0.cs.ucl.ac.uk/staff/M.Harman/tse-oracle.pdf) | "the software is implemented in multiple ways and executed in parallel. Where results differ at run-time, a \"voting\" mechanism decides which output to use." | cited |

### Question B3: metamorphic relations and properties per cell

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| B3-01 | Metamorphic testing derives new test cases from ones that passed, and its authors present it as usable without an oracle and together with other test selection methods. | [Chen, Cheung, Yiu, "Metamorphic Testing: A New Approach for Generating Next Test Cases", Technical Report HKUST-CS98-01, 1998, arXiv:2002.12543](https://arxiv.org/pdf/2002.12543) | "can be used in the absence of test oracles" and "metamorphic testing is to be used with other test case selection strategies." | cited |
| B3-02 | The survey defines a metamorphic relation as a relation over several executions, and calls the oracle it gives partial. | [Barr et al., section 5.2](http://www0.cs.ucl.ac.uk/staff/M.Harman/tse-oracle.pdf) | "a metamorphic relation is a relation over applications of f that we expect to hold across multiple executions of p." and "to generate partial test oracles for follow-up test cases" | cited |
| B3-03 | In FsCheck a property is a function that returns a truth value; it can carry a precondition; the documentation warns that a precondition skews the inputs. From C# the form is `Prop.ForAll<…>(…).QuickCheck()`. | [FsCheck, docs/Properties.fsx lines 36 and 141-145](https://github.com/fscheck/FsCheck/blob/1ef52cfc65d5c318f5ee4da467df9087ad03e34c/docs/Properties.fsx#L141-L145); [examples, Properties.cs lines 53-56](https://github.com/fscheck/FsCheck/blob/1ef52cfc65d5c318f5ee4da467df9087ad03e34c/examples/FsCheck.Docs.CSharpSnippets/Properties.cs#L53-L56) | "the `==>` operator can skew the distribution of test data badly, since only test data which satisfies the given condition is used." | cited |
| B3-04 | CsCheck has a sampling method for the metamorphic form: two ways of doing one thing, compared. | [CsCheck README lines 292-295](https://github.com/AnthonyLloyd/CsCheck/blob/9288cc9cb469d7bf00b39f7c11fc21b73307099d/README.md?plain=1#L292-L295) | "Metamorphic testing is another economical form: doing something two different ways and checking they produce the same result." | cited |
| B3-05 | Inference: the relations that fit this shape are of three kinds. Frame: every field not named in the `with` is unchanged. Order: the result field is monotonic in an input field inside one cell. Range: the result field stays inside stated bounds. The frame relation needs no spec text, because the set of written fields can be read from `IWithOperation.Initializer` (A8-04) and checked on bits (A8-15). | A8-04, A8-15, B3-02 | | inferred |
| B3-06 | Known weakness, as an inference from B3-02: a relation is a partial oracle. Many wrong formulas are monotonic and bounded. A relation shows a family the formula belongs to and never the formula. | B3-02 | | inferred |
| B3-07 | Known weakness, as an inference: a relation needs at least two inputs in one cell, and the default generators of both libraries do not sample by cell (A7-07). Inside a cell a range generator (A7-06) or the neighbours of A2-01 have to supply the pairs. For a cell that holds one value (a constant) no pair exists. | A7-06, A7-07, A4-03 | | inferred |
| B3-08 | Known weakness: monotonicity in exact arithmetic need not survive rounding in every formula. No source was read for which formulas keep it; one run only shows that rounding moves a boundary (A4-09). | A4-09 | | inferred |

### Question B4: how an expected `double` is compared

| ID | Claim | Source | Evidence | Tag |
|---|---|---|---|---|
| B4-01 | The two usual measures of rounding error are units in the last place and relative error; a correctly rounded result can be off by half a unit. | [Goldberg 1991, Oracle reprint](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html), section "Relative Error and Ulps" | "If the result of a calculation is the floating-point number nearest to the correct result, it still might be in error by as much as .5 ulp." | cited |
| B4-02 | The same absolute error is a different relative error depending on the magnitude, and the relative error that corresponds to half a unit varies by a factor of the base. | [same section](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) | "the relative error corresponding to .5 ulp can vary by a factor of" the base, and "This factor is called the wobble." | cited |
| B4-03 | MSTest's `Assert.AreEqual(double expected, double actual, double delta)` fails when the two differ by more than `delta`; that is an absolute tolerance. | [learn: Assert.AreEqual](https://learn.microsoft.com/en-us/dotnet/api/microsoft.visualstudio.testtools.unittesting.assert.areequal?view=mstest-net-4.0); [MSTest source, Assert.AreEqual.Numerics.Double.cs lines 16-23](https://github.com/microsoft/testfx/blob/8dd78e1347417e400c3ef8d786059a8bb346162f/src/TestFramework/TestFramework/Assertions/Assert.AreEqual.Numerics.Double.cs#L16-L23) | "The required accuracy. An exception will be thrown only if actual is different than expected by more than delta."; "`static (left, right, allowedDelta) => Math.Abs(left - right) > allowedDelta`" | cited |
| B4-04 | In the source at the `main` branch the check runs in this order: a NaN or negative `delta` throws `ArgumentOutOfRangeException`; `expected.Equals(actual)` passes at once; then exactly one NaN fails; then the absolute difference is compared with `delta`. | [MSTest source, Assert.AreEqual.Numerics.cs lines 13-38](https://github.com/microsoft/testfx/blob/8dd78e1347417e400c3ef8d786059a8bb346162f/src/TestFramework/TestFramework/Assertions/Assert.AreEqual.Numerics.cs#L13-L38) | "`if (expected.Equals(actual)) { return false; }`" and "// If only one of them is NaN, then they are not equal regardless of the value of delta." | cited |
| B4-05 | Inference from B4-04 and A1-07: with this assertion NaN equals NaN, the two zeros are equal for every `delta`, an infinity equals the same infinity, and `delta = 0` means `Equals`, not equal bits. A `delta` of `+inf` accepts any two values that are not NaN, because no difference is greater than `+inf`; that last point was not run. | B4-04, A1-07 | | inferred |
| B4-06 | The comparisons available in .NET differ on exactly the special values. Bits (`BitConverter.DoubleToInt64Bits`): the zeros differ, NaN payloads differ. `==`: zeros equal, NaN never equal. `Equals`: zeros equal, every NaN equal. Record struct `==`: as `Equals` on each field. | A1-03, A1-05, A1-16; probe P7, last line | `record with NaN field equals itself: True True; -0.0 field equals +0.0 field: True` | run |
| B4-07 | The distance between two finite doubles of the same sign in units in the last place is the difference of their bit patterns read as integers; the compiler source relies on the same ordering property. This is an inference from the cited sentence; no library function for the distance was looked for. | [compiler source, ValueSetFactory.DoubleTC.cs lines 26-30](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Utilities/ValueSetFactory.DoubleTC.cs#L26-L30) | "Every bit sequence between the representation of 0 and MaxValue represents a distinct value, and the integer representations are ordered by value the same as the floating-point numbers they represent." | inferred |
| B4-08 | Inference: the comparison mode has to match what the spec form can promise. A reference expression with the same operations in the same order can be held to equal bits where A6-08 holds. A decimal literal typed by a person is itself rounded (A3-01) and is exact only if the person computed the correctly rounded result. A real-number formula (B1-02, row 3d of section (c)) can only be held to a tolerance, and the tolerance then needs a source: one operation is within half a unit (B4-01), a chain of `k` operations is not bounded by `k` halves in general, and no bound was derived here. | A3-01, A6-08, A6-15, B4-01 | | inferred |

### Question B5: how the TypeScript backend states a computed result

Read from the code in the working tree at commit `ed295ec`; `scripts/inventory.ts` has uncommitted changes, `scripts/conversion.ts` and `scripts/driver.ts` have none.
The prose of `references/typescript/shapes.md` (section "Conversion") was read afterwards and agrees with the rows below on every point it states; it is not the evidence for any row.

| ID | Claim | Lines | Tag |
|---|---|---|---|
| B5-01 | A conversion is admitted only as one `return <expression>` statement. The expression is translated into a small tree with five node kinds: input, literal, negation, binary `+ - * / %`, and rounding by `floor`, `ceil`, `round`, `trunc`. Anything else is a violation. | `scripts/conversion.ts` 7-17, 55-77, 85-170 | read |
| B5-02 | Literals must be safe integers. The product of two inputs is rejected. A divisor must be made of literals only and must not be zero. One `as` cast around the whole result is allowed and is stripped before translation. | `conversion.ts` 102-107, 121-126, 171-175 | read |
| B5-03 | The spec is a second TypeScript file that exports `function expected(...)` with the same number of parameters. It is parsed and translated by the same function as the code, so it is held to the same vocabulary. | `scripts/inventory.ts` 606-648 | read |
| B5-04 | The spec is read only in the partition mode `code+spec`. In the other mode the "spec" tree is the code's own tree. | `inventory.ts` 606-608 | read |
| B5-05 | The inputs to check are found, not listed by a person. The first probe is all zeros. One solver query asks for an input on which code and spec differ; if one exists it becomes a probe. | `conversion.ts` 353, 368-370 | read |
| B5-06 | Then each "neighbour" of the code's tree is taken: `+` and `-` swapped, `*` and `/` swapped, each literal plus and minus one, each rounding removed or replaced by another rounding, each input replaced by another input of the same kind. For each neighbour that no existing probe separates from the code, the solver is asked for an input on which the two differ. The witness becomes a probe; "no such input" is counted as an equivalent neighbour. | `conversion.ts` 272-310, 371-387 | read |
| B5-07 | The solver model is exact integer arithmetic, not JavaScript numbers: inputs are declared as `Int`, each sub-expression is a fraction with an integer numerator term and a positive integer denominator, and rounding is expressed with integer `div`. Inputs are bounded in three growing steps: 1,000, 1,000,000 and 8,640,000,000,000,000. | `conversion.ts` 178-270, 312, 327-337 | read |
| B5-08 | The solver and the JavaScript evaluator are cross-checked on every witness. If the solver says two trees differ on an input and the JavaScript evaluation says they agree, or the two disagree on whether a result is a whole number, a mismatch is recorded and the claim is blocked. An answer of `unknown` also blocks the claim. | `conversion.ts` 358-367, 380-385; `inventory.ts` 656-662 | read |
| B5-09 | An extra query asks whether the result can be a fraction; a witness makes the conversion a violation ("round the result"). Each date input gets one probe with an invalid date. | `conversion.ts` 267-270, 358-367, 389-396; `inventory.ts` 663-667 | read |
| B5-10 | The obligation that is written out holds the probes, the number of neighbours and the number counted as equivalent. The number of checks is the number of probes. | `inventory.ts` 668-685 | read |
| B5-11 | The check calls the spec's `expected` and the code's function with the same arguments for every probe, and compares the two results with `sameNumber`. `sameNumber` is `a === b`, or both NaN. There is no tolerance. Under `===` the two zeros are equal. | `scripts/driver.ts` 345-369; `conversion.ts` 38-39 | read |
| B5-12 | So the expected value is never written down. It is computed at check time by running the spec function in the same JavaScript engine as the code. | `driver.ts` 361-362 | read |
| B5-13 | Inference: the design does not prevent a spec that restates the code. In that case the "differ" query has no witness and every probe passes. What the probes then still fix is the code against its own neighbours: a later edit of the code into one of the non-equivalent neighbours fails at least one probe. That is a statement about which edits are caught, and it holds only for the neighbour set of B5-06. | B5-05, B5-06, B5-11 | inferred |
| B5-14 | Inference: exact equality is sound in that shape because the admitted results are whole numbers within the range where JavaScript numbers are exact (B5-02, B5-07, B5-09) and the shape has no cells. Neither condition holds for the planned C# shape: results are fractions, and the rule has guards. The neighbour idea and the "differ" query carry over only with a floating-point model (A5) or with sampling. | B5-02, B5-07, B5-09, A5-13, A5-14 | inferred |

## (c) Possible forms of a spec for a computed result

No form is recommended.
Each row is an inference from the rows named; "needs" and "cannot show" are the two questions the task asked.

| # | Form | What the spec contains | Needs | Cannot show | Rests on |
|---|---|---|---|---|---|
| 1 | Literal result per representative input | For each cell and each chosen input, the result as a number | A person who computes each number from the requirement. A stated rule for how the number is compared: equal bits, `Equals`, or a tolerance with its unit. A notation for NaN, the infinities and negative zero, which JSON numbers do not have (inference; the JSON grammar was not opened). | The formula between the chosen inputs. Whether the typed decimal is the correctly rounded result or only close to it. | A3-01, A4-05, B4-06, B4-08 |
| 2 | Postcondition per cell | A truth-valued expression over the inputs and the result | An expression language and a way to evaluate it (form 3a, 3b or 3c). | The result itself, unless the predicate is an equation. Anything outside the inputs that are run. Rounding, if the predicate is proved in a real-number tool. | B1-01 to B1-08 |
| 3a | Reference expression, evaluated by the scripting API | A C# expression per cell, as text | The scripting package and its own compiler build. About 1 s for the first evaluation and under 0.1 s per further expression in the runs made. Admission of the expression before it runs. | Independence from the code. Any error shared with the compiler and runtime. | B2-01 to B2-03, B2-06, B2-09, B2-10 |
| 3b | Reference expression, compiled into the same compilation as the code | A C# expression per cell, placed in a generated method | A generator for the extra syntax tree. The same admission walk as for the code. No new dependency. | The same two points as 3a. In addition the expression and the code are folded by one compiler in one pass. | B2-04 to B2-06, B2-09, B2-10 |
| 3c | Reference expression in the tool's own small language, evaluated by the tool | A tree of inputs, constants and `+ - * /`, as the TypeScript conversion shape has | A parser and an evaluator in the tool. A decision on evaluation order and on what a constant is (decimal text or bits). | Independence from the code. Whether the tool's evaluator and the compiled code agree on every platform; A6-15 gives the basis for x64 only. | B5-01 to B5-14, A6-15 |
| 3d | Reference formula in exact arithmetic | A formula over exact rationals or decimals, evaluated without rounding | An exact number type, and a tolerance that says how far a correct `double` result may be from the exact one. | Equal bits. Any behaviour at NaN, infinities or negative zero, which exact arithmetic does not have. The tolerance itself is a claim that needs a derivation. | B1-02, B4-01, B4-08 |
| 4 | Relations per cell | Statements such as "monotonic in this field", "between these bounds", "these fields unchanged" | Pairs of inputs inside one cell. A generator or the neighbour values. The number of pairs and the generator as part of the report. | The formula. A cell with one value. Every wrong formula that satisfies the same relations. | B3-01 to B3-08 |
| 5 | Frame only, read from the code | Nothing written by a person: the set of fields the `with` assigns | The operation tree. A bit comparison of the other fields on each run. | Anything about the fields that are assigned. | A8-04, A8-11, A8-15 |
| 6 | Equivalence by solver | A reference expression as in 3c, and a query "is there an input in this cell on which code and spec differ" | A native solver on every platform. A floating-point model of each admitted operation. A timeout and a rule for "unknown". Care with NaN on the way back. | Anything about operations the theory lacks (`Math` functions). Whether the runtime follows the model on a platform that fuses or widens. Independence of the spec. An answer within a time limit: one multiplication took 40 s to prove commutative. | A5-01 to A5-15, A6-02, B5-05 |
| 7 | Proof in a verifier | A Dafny method with `ensures`, compiled to C# or kept as the reference | The verifier, a solver executable, and a person who writes the proof. | `double` behaviour: the proof is over `real`. Hand-written C#. | B1-01, B1-02; `references/csharp/beyond-enumeration.md`, section "Proof (Dafny)" |

Forms can be combined, and the combinations are not listed.
Two points apply to every form.
The comparison rule (bits, `Equals`, tolerance) is part of the spec and decides what a pass means for NaN, the zeros and the infinities (B4-06).
The representatives decide where the form is evaluated: with one input per cell a wrong slope can pass forms 1 to 3, and with the constant and its two neighbours an off-by-one-step boundary is seen but a wrong formula in the middle of a wide cell may still agree at those three points (A4-05).

## (d) Probes

Every probe is a console project with this project file, changed only in the name and, where noted, in its references:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <NuGetAudit>false</NuGetAudit>
  </PropertyGroup>
</Project>
```

The scratch folder holds this `global.json`; `dotnet --version` printed `10.0.400`:

```json
{
  "sdk": { "version": "10.0.400", "rollForward": "latestFeature", "allowPrerelease": false }
}
```

P2 adds the two compiler references exactly as `skills/development/verifiable/scripts/dotnet/Verifiable.csproj` has them (`HintPath` into `$(MSBuildSDKsPath)/../Roslyn/bincore/`).
P3 and P3b add `<PackageReference Include="Microsoft.Z3" Version="4.12.2" />`.
P5 adds `<PackageReference Include="Microsoft.CodeAnalysis.CSharp.Scripting" Version="5.9.0" />`.
For P3, P3b and P5, `NUGET_PACKAGES` and `NUGET_HTTP_CACHE_PATH` pointed into the scratch folder and a `nuget.config` there named nuget.org as the only source.

| Probe | Rows | Commands | Result |
|---|---|---|---|
| P1 | A1-03, A1-05, A1-08, A1-11, A1-16, A1-17, A2-03, A2-07, A2-09, A3-03, A3-04, A3-08, A3-09, A3-11, A3-12 | `dotnet build -c Release` then `dotnet run -c Release --no-build` | Build: 0 warnings, 0 errors. First line `.NET 10.0.11 X64 Microsoft Windows 10.0.26300` |
| P2 | A1-10, A1-12, A1-13, A1-15, A3-05, A3-10, A3-13 to A3-16, A8-01, A8-03 to A8-05, A8-07 to A8-14 | `dotnet build -c Release` then `dotnet run -c Release --no-build` | First line `compiler 5.9.0-1.26379.115+14fbf8d5271c98133561eb55185fdb05b286f578`. The probed source itself compiles with no diagnostic |
| P3 | A4-08, A5-01, A5-06, A5-10 to A5-12, A5-14 | `dotnet build -c Release --configfile <scratch>/nuget.config` then `dotnet run -c Release --no-build` | First line `Z3 Z3 4.12.2.0; .NET 10.0.11` |
| P3b | A5-08, A5-10, A5-11 | as P3 | `isNaN(x): SATISFIABLE`; `0 < x < Epsilon: UNSATISFIABLE` |
| P4 | A5-15, A6-08 | `dotnet build -c Release`, `dotnet build -c Debug`, then `dotnet bin/Release/net10.0/P4.dll` four times (no variable, `DOTNET_TieredCompilation=0`, `DOTNET_TieredPGO=0`, `DOTNET_EnableFMA=0`) and `dotnet bin/Debug/net10.0/P4.dll` | Identical output lines in all five runs apart from the header. With `DOTNET_EnableFMA=0` the header still printed `Fma.IsSupported=True`, so that run is not counted as a separate configuration |
| P5 | B2-02 to B2-04, B2-06 | `dotnet build -c Release --configfile <scratch>/nuget.config` then `dotnet bin/Release/net10.0/P5.dll` twice | Both runs printed the eight lines quoted in B2-03 and B2-04 |
| P6 | A4-02 | `dotnet build -c Release` then `dotnet bin/Release/net10.0/P6.dll` | 10.0 s |
| P7 | A4-09, A4-10, A6-16, A8-15, B4-06 | `dotnet build -c Release` then `dotnet bin/Release/net10.0/P7.dll` | See rows |

Sources of the probes follow.

### P1

```csharp
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

static class P
{
    [MethodImpl(MethodImplOptions.NoInlining)] static double V(double x) => x;
    [MethodImpl(MethodImplOptions.NoInlining)] static float VF(float x) => x;
    [MethodImpl(MethodImplOptions.NoInlining)] static long VL(long x) => x;
    [MethodImpl(MethodImplOptions.NoInlining)] static int VI(int x) => x;
    static string B(double d) => BitConverter.DoubleToInt64Bits(d).ToString("X16");
    static string BF(float d) => BitConverter.SingleToInt32Bits(d).ToString("X8");
    static string T(bool b) => b ? "T" : "F";

    static string Sw1(double x) => x switch { < 0.0 => "neg", 0.0 => "zero", > 0.0 => "pos", double.NaN => "nan" };
    static string Sw2(double x) => x switch { < 0.5 => "lt", >= 0.5 => "ge", _ => "other" };
    static string Sw3(double x) => x switch { double.NegativeInfinity => "-inf", double.PositiveInfinity => "+inf", double.NaN => "nan", _ => "finite" };

    static void Main()
    {
        Console.WriteLine($"{RuntimeInformation.FrameworkDescription} {RuntimeInformation.ProcessArchitecture} {RuntimeInformation.OSDescription}");
        double nan = V(0.0) / V(0.0), pinf = V(1.0) / V(0.0), ninf = V(-1.0) / V(0.0), pz = V(0.0), nz = -V(0.0), one = V(1.0);
        Console.WriteLine($"bits nan={B(nan)} double.NaN={B(double.NaN)} +inf={B(pinf)} -inf={B(ninf)} +0={B(pz)} -0={B(nz)}");
        var vals = new (string n, double v)[] { ("NaN", nan), ("-inf", ninf), ("-0", nz), ("+0", pz), ("1", one), ("+inf", pinf) };
        Console.WriteLine("== A1 operators: a b | < <= > >= == != | Equals CompareTo");
        foreach (var (an, a) in vals)
            foreach (var (bn, b) in vals)
                Console.WriteLine($"{an,5} {bn,5} | {T(a < b)} {T(a <= b)} {T(a > b)} {T(a >= b)} {T(a == b)} {T(a != b)} | {T(a.Equals(b))} {a.CompareTo(b),2}");
        Console.WriteLine("== A1 patterns: x | is double.NaN | is 0.0 | is -0.0 | is > 0.5 | is <= 0.5 | is < 0 or >= 0 | is not > 0.5 | is double.PositiveInfinity | is >= double.NegativeInfinity | Sw1 Sw2 Sw3");
        foreach (var (n, x) in vals)
            Console.WriteLine($"{n,5} | {T(x is double.NaN)} | {T(x is 0.0)} | {T(x is -0.0)} | {T(x is > 0.5)} | {T(x is <= 0.5)} | {T(x is < 0 or >= 0)} | {T(x is not > 0.5)} | {T(x is double.PositiveInfinity)} | {T(x is >= double.NegativeInfinity)} | {Sw1(x)} {Sw2(x)} {Sw3(x)}");
        double otherNan = BitConverter.Int64BitsToDouble(0x7FF0000000000001L);
        double posNan = BitConverter.Int64BitsToDouble(0x7FF8000000000000L);
        Console.WriteLine($"other NaN payloads: 7FF0000000000001 is double.NaN={T(otherNan is double.NaN)} IsNaN={T(double.IsNaN(otherNan))} Equals(double.NaN)={T(otherNan.Equals(double.NaN))}; 7FF8000000000000 is double.NaN={T(posNan is double.NaN)}");
        Console.WriteLine($"signed zero told apart: 1/+0={1 / pz} 1/-0={1 / nz} IsNegative(-0)={T(double.IsNegative(nz))} ToString(-0)={nz} Equals(+0,-0)={T(pz.Equals(nz))} object.Equals={T(object.Equals(pz, nz))} GetHashCode equal={T(pz.GetHashCode() == nz.GetHashCode())} Math.Min(+0,-0)={B(Math.Min(pz, nz))} Math.Max(-0,+0)={B(Math.Max(nz, pz))}");

        Console.WriteLine("== A2 neighbours");
        void N(string n, double x) => Console.WriteLine($"{n,12}: x={B(x)} BitDecrement={B(Math.BitDecrement(x))} ({Math.BitDecrement(x):R}) BitIncrement={B(Math.BitIncrement(x))} ({Math.BitIncrement(x):R})");
        N("+0", pz); N("-0", nz); N("Epsilon", double.Epsilon); N("-Epsilon", -double.Epsilon); N("0.5", V(0.5)); N("1", one);
        N("MaxValue", double.MaxValue); N("MinValue", double.MinValue); N("+inf", pinf); N("-inf", ninf); N("NaN", nan);
        N("2^53", V(9007199254740992.0)); N("MinNormal", V(2.2250738585072014E-308));
        Console.WriteLine($"double.Epsilon bits={B(double.Epsilon)} value={double.Epsilon:R}; 0.5+Epsilon==0.5: {T(V(0.5) + double.Epsilon == V(0.5))}; BitIncrement(0.5)-0.5={Math.BitIncrement(0.5) - 0.5:R}; 0.5-BitDecrement(0.5)={0.5 - Math.BitDecrement(0.5):R}");
        Console.WriteLine($"generic statics: double.BitIncrement(1)={B(double.BitIncrement(1.0))} MathF.BitIncrement(1f)={BF(MathF.BitIncrement(1f))} float.BitDecrement(1f)={BF(float.BitDecrement(1f))}");

        Console.WriteLine("== A3 literals and conversions");
        Console.WriteLine($"0.1={B(0.1)} run-time parse 0.1={B(double.Parse("0.1", System.Globalization.CultureInfo.InvariantCulture))} 0.1f={BF(0.1f)} (double)0.1f={B((double)0.1f)} ({(double)0.1f:R})");
        Console.WriteLine($"const 0.1+0.2==0.3: {T(0.1 + 0.2 == 0.3)}; run-time: {T(V(0.1) + V(0.2) == V(0.3))}; const sum bits={B(0.1 + 0.2)} run-time sum bits={B(V(0.1) + V(0.2))} 0.3={B(0.3)}");
        Console.WriteLine($"9007199254740993.0 -> {B(9007199254740993.0)} ({9007199254740993.0:R}); 9007199254740993.0000001 -> {9007199254740993.0000001:R}; 4.9e-324={B(4.9e-324)}; 2.4703282292062328e-324={B(2.4703282292062328e-324)}; 2.4703282292062329e-324={B(2.4703282292062329e-324)}; 1.7976931348623158e308={B(1.7976931348623158e308)}");
        float f = VF(0.1f);
        Console.WriteLine($"float field f=0.1f against double constant 0.1: f<0.1={T(f < 0.1)} f==0.1={T(f == 0.1)} f>0.1={T(f > 0.1)}; against 0.1f: f==0.1f={T(f == 0.1f)}; f is 0.1f={T(f is 0.1f)}; f is > 0.1f={T(f is > 0.1f)}");
        float fb = MathF.BitDecrement(f);
        Console.WriteLine($"BitDecrement(0.1f)={BF(fb)} as double {(double)fb:R}: <0.1 {T(fb < 0.1)}; (float)0.1 == 0.1f: {T((float)V(0.1) == 0.1f)}; (float)BitDecrement(0.1)={BF((float)Math.BitDecrement(V(0.1)))} (float)BitIncrement(0.1)={BF((float)Math.BitIncrement(V(0.1)))}");
        int i2 = VI(2), i3 = VI(3);
        Console.WriteLine($"int against double 2.5: 2>2.5={T(i2 > 2.5)} 3>2.5={T(i3 > 2.5)}; int.MaxValue as double exact: {((double)VI(int.MaxValue)):R}");
        long big = VL(9007199254740993L);
        Console.WriteLine($"long 9007199254740993 against double 9007199254740992.0: n>c={T(big > 9007199254740992.0)} n==c={T(big == 9007199254740992.0)} (double)n={(double)big:R}; long.MaxValue as double={(double)VL(long.MaxValue):R}; (double)long.MaxValue==9223372036854775808.0: {T(VL(long.MaxValue) == 9223372036854775808.0)}");
        Console.WriteLine($"int 16777217 as float: {(float)VI(16777217):R}; 16777217 == 16777216f: {T(VI(16777217) == 16777216f)}");
        const double C = 1.0 / 3.0;
        Console.WriteLine($"const double 1.0/3.0 folded={B(C)} run-time={B(V(1.0) / V(3.0))}");
    }
}
```

### P2

```csharp
using System.Diagnostics;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

static class P
{
    static readonly MetadataReference[] Refs = ((string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES")!).Split(Path.PathSeparator)
        .Select(p => (MetadataReference)MetadataReference.CreateFromFile(p)).ToArray();

    static CSharpCompilation Compile(string source) => CSharpCompilation.Create("Probe",
        [CSharpSyntaxTree.ParseText(source, new CSharpParseOptions(LanguageVersion.CSharp14))], Refs,
        new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, optimizationLevel: OptimizationLevel.Release));

    static string Cv(Optional<object?> c) => !c.HasValue ? "none" : c.Value is double d ? $"System.Double {d:R} bits={BitConverter.DoubleToInt64Bits(d):X16}"
        : c.Value is float f ? $"System.Single {f:R} bits={BitConverter.SingleToInt32Bits(f):X8}" : $"{c.Value?.GetType().FullName} {c.Value}";

    static string Op(IOperation o)
    {
        var s = $"{o.Kind}";
        if (o is IConversionOperation c)
            s += $"[{c.Operand.Type}->{c.Type} implicit={c.IsImplicit} numeric={c.Conversion.IsNumeric} convImplicit={c.Conversion.IsImplicit} identity={c.Conversion.IsIdentity} userDefined={c.Conversion.IsUserDefined} checked={c.IsChecked} operand={Op(c.Operand)}]";
        else if (o is IPropertyReferenceOperation p) s += $"[{p.Property.Name}:{p.Type}]";
        else if (o is IFieldReferenceOperation f) s += $"[{f.Field.Name}:{f.Type}]";
        else if (o is ILiteralOperation) s += $"[{o.Type}]";
        return s + $" const={Cv(o.ConstantValue)}";
    }

    static void Diag(string label, string body)
    {
        var src = "public static class D { public static object M(double x, float f, int i) { " + body + " } }";
        var comp = Compile(src);
        var tree = comp.SyntaxTrees[0];
        var model = comp.GetSemanticModel(tree);
        var diags = comp.GetDiagnostics().Select(d => $"{d.Id} {d.Severity} level={d.WarningLevel}: {d.GetMessage()}").ToList();
        var sw = tree.GetRoot().DescendantNodes().OfType<SwitchExpressionSyntax>().FirstOrDefault();
        var ex = sw is null ? "" : $" IsExhaustive={((ISwitchExpressionOperation)model.GetOperation(sw)!).IsExhaustive}";
        Console.WriteLine($"{label}: [{body}]{ex}\n    -> {(diags.Count > 0 ? string.Join("\n    -> ", diags) : "no diagnostic")}");
    }

    static void Main()
    {
        Console.WriteLine($"compiler {FileVersionInfo.GetVersionInfo(typeof(CSharpCompilation).Assembly.Location).ProductVersion}");
        Console.WriteLine($"runtime {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription}");
        var source = """
            public enum Tier { Standard, Gold }
            public readonly record struct Loan(int Id, double Fine, int DaysLate, bool Lost, Tier Tier, float Rate, long Count);
            public readonly struct Step { public readonly double Days; public Step(double days) { Days = days; } }
            public readonly struct StepP(double days) { public double Days { get; } = days; }
            public struct Mutable { public double X; }
            public record struct RS(double A);
            public record class RC(double A);
            public readonly record struct WithBody(double A) { public double B => A * 2; public double A { get; init; } = A; }
            public struct FineRule
            {
                const double Cap = 0.1 + 0.2;
                const float FCap = 0.1f;
                public Loan Apply(in Loan loan, in Step step, ref readonly Step other, Step byValue)
                {
                    if (loan.Fine > 0.5) return loan with { Fine = Cap };
                    if (loan.Fine is > 0.25 and <= 0.5) return loan;
                    if (loan.Fine == 0.1) return loan;
                    if (loan.DaysLate > 2.5) return loan;
                    if (loan.Rate < 0.1) return loan;
                    if (loan.Rate < FCap) return loan;
                    if (loan.Count > 9007199254740992.0) return loan;
                    if (loan.Fine is double.NaN) return loan;
                    if (loan.Fine is 0) return loan;
                    if (loan.Fine < 1) return loan;
                    if (0.5 < loan.Fine) return loan;
                    if (loan.Fine >= Cap) return loan;
                    return loan.Fine switch
                    {
                        < 0.0 => loan,
                        >= 0.0 => loan with { Fine = loan.Fine * step.Days, Lost = false },
                        double.NaN => loan,
                    };
                }
                public readonly double Bad(Loan loan, RC rc)
                {
                    double t = 0;
                    for (int i = 0; i < 3; i++) t += loan.Fine;
                    t = System.Math.Abs(t);
                    var copy = new Loan(1, t, 0, false, Tier.Gold, 0f, 0L);
                    var rc2 = rc with { A = 1 };
                    decimal m = 1.5m; if (m > 1) t++;
                    return t;
                }
            }
            """;
        var comp = Compile(source);
        foreach (var d in comp.GetDiagnostics()) Console.WriteLine($"diag {d.Id} {d.Severity}: {d.GetMessage()}");
        var tree = comp.SyntaxTrees[0];
        var model = comp.GetSemanticModel(tree);
        var root = tree.GetRoot();

        Console.WriteLine("== A8 symbols");
        foreach (var name in new[] { "Loan", "Step", "StepP", "Mutable", "RS", "RC", "WithBody", "FineRule" })
        {
            var t = comp.GetTypeByMetadataName(name)!;
            Console.WriteLine($"{name}: TypeKind={t.TypeKind} IsRecord={t.IsRecord} IsReadOnly={t.IsReadOnly} IsValueType={t.IsValueType} IsRefLikeType={t.IsRefLikeType} ctors=[{string.Join("; ", t.InstanceConstructors.Select(c => $"({string.Join(", ", c.Parameters.Select(p => p.Type + " " + p.Name))}) implicit={c.IsImplicitlyDeclared}"))}]");
            if (name is "Loan" or "WithBody" or "StepP" or "RS")
                foreach (var m in t.GetMembers())
                {
                    if (m is IPropertySymbol p)
                        Console.WriteLine($"   property {p.Name}: {p.Type} implicit={p.IsImplicitlyDeclared} IsReadOnly={p.IsReadOnly} set.IsInitOnly={p.SetMethod?.IsInitOnly} get.IsReadOnly={p.GetMethod?.IsReadOnly} get.implicit={p.GetMethod?.IsImplicitlyDeclared} declSyntax={string.Join(",", p.DeclaringSyntaxReferences.Select(r => r.GetSyntax().Kind()))}");
                    if (m is IFieldSymbol f)
                        Console.WriteLine($"   field {f.Name}: {f.Type} implicit={f.IsImplicitlyDeclared} IsReadOnly={f.IsReadOnly} associated={f.AssociatedSymbol?.Name}");
                }
        }
        var apply = (IMethodSymbol)comp.GetTypeByMetadataName("FineRule")!.GetMembers("Apply").Single();
        foreach (var p in apply.Parameters) Console.WriteLine($"parameter {p.Name}: RefKind={p.RefKind} ({(int)p.RefKind}) Type={p.Type}");
        Console.WriteLine($"Apply.IsReadOnly={apply.IsReadOnly} IsStatic={apply.IsStatic}; Bad.IsReadOnly={((IMethodSymbol)comp.GetTypeByMetadataName("FineRule")!.GetMembers("Bad").Single()).IsReadOnly}");
        var loanParam = root.DescendantNodes().OfType<ParameterSyntax>().First(p => p.Identifier.Text == "Fine");
        var sym = model.GetDeclaredSymbol(loanParam);
        Console.WriteLine($"GetDeclaredSymbol(positional parameter Fine) -> {sym?.Kind} {sym} containing={sym?.ContainingSymbol}");

        Console.WriteLine("== A3 operations in Apply");
        var applySyntax = root.DescendantNodes().OfType<MethodDeclarationSyntax>().First(m => m.Identifier.Text == "Apply");
        foreach (var b in applySyntax.DescendantNodes().OfType<BinaryExpressionSyntax>())
        {
            if (model.GetOperation(b) is not IBinaryOperation bo) continue;
            Console.WriteLine($"[{b}]: {bo.Kind} OperatorKind={bo.OperatorKind} type={bo.Type} OperatorMethod={(bo.OperatorMethod is null ? "null" : bo.OperatorMethod.ToString())} IsChecked={bo.IsChecked} const={Cv(bo.ConstantValue)}\n     left={Op(bo.LeftOperand)}\n     right={Op(bo.RightOperand)}");
            var ti = model.GetTypeInfo(b.Right);
            Console.WriteLine($"     syntax right: GetConstantValue={Cv(model.GetConstantValue(b.Right))} Type={ti.Type} ConvertedType={ti.ConvertedType}; left GetConstantValue={Cv(model.GetConstantValue(b.Left))}");
        }
        foreach (var isp in applySyntax.DescendantNodes().OfType<IsPatternExpressionSyntax>())
        {
            var io = (IIsPatternOperation)model.GetOperation(isp)!;
            Console.WriteLine($"[{isp}]: value={Op(io.Value)}");
            foreach (var pat in io.Pattern.DescendantsAndSelf())
            {
                if (pat is IRelationalPatternOperation rp) Console.WriteLine($"     RelationalPattern OperatorKind={rp.OperatorKind} InputType={rp.InputType} NarrowedType={rp.NarrowedType} value={Op(rp.Value)}");
                else if (pat is IConstantPatternOperation cp) Console.WriteLine($"     ConstantPattern InputType={cp.InputType} value={Op(cp.Value)}");
                else if (pat is IBinaryPatternOperation bp) Console.WriteLine($"     BinaryPattern OperatorKind={bp.OperatorKind}");
            }
        }
        var sw = applySyntax.DescendantNodes().OfType<SwitchExpressionSyntax>().Single();
        var so = (ISwitchExpressionOperation)model.GetOperation(sw)!;
        Console.WriteLine($"switch: IsExhaustive={so.IsExhaustive} arms={so.Arms.Length} armPatterns=[{string.Join("; ", so.Arms.Select(a => a.Pattern.Kind + (a.Pattern is IRelationalPatternOperation r ? ":" + r.OperatorKind + ":" + Cv(r.Value.ConstantValue) : a.Pattern is IConstantPatternOperation c ? ":" + Cv(c.Value.ConstantValue) : "")))}]");
        foreach (var w in root.DescendantNodes().OfType<WithExpressionSyntax>())
        {
            var wo = (IWithOperation)model.GetOperation(w)!;
            Console.WriteLine($"[{w}]: {wo.Kind} type={wo.Type} operand={wo.Operand.Kind} CloneMethod={(wo.CloneMethod is null ? "null" : wo.CloneMethod.ToString())} initializer={wo.Initializer.Kind}");
            foreach (var init in wo.Initializer.Initializers)
                Console.WriteLine($"     {init.Kind} target={(init is ISimpleAssignmentOperation sa ? Op(sa.Target) + " value=" + Op(sa.Value) : "?")}");
        }

        Console.WriteLine("== A8 operation kinds per method body");
        foreach (var m in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            var body = model.GetOperation(m)!;
            var kinds = body.DescendantsAndSelf().GroupBy(o => o.Kind).OrderBy(g => g.Key.ToString()).Select(g => $"{g.Key}x{g.Count()}");
            Console.WriteLine($"{m.Identifier.Text}: root={body.Kind} :: {string.Join(" ", kinds)}");
            foreach (var o in body.Descendants())
            {
                switch (o)
                {
                    case ILoopOperation l: Console.WriteLine($"     loop LoopKind={l.LoopKind}"); break;
                    case IInvocationOperation inv: Console.WriteLine($"     invocation {inv.TargetMethod}"); break;
                    case IObjectCreationOperation oc: Console.WriteLine($"     object creation {oc.Constructor}"); break;
                    case IAssignmentOperation a when a.Parent is not IObjectOrCollectionInitializerOperation: Console.WriteLine($"     assignment {a.Kind} target={a.Target.Kind}"); break;
                    case IIncrementOrDecrementOperation inc: Console.WriteLine($"     {inc.Kind} target={inc.Target.Kind}"); break;
                    case IBinaryOperation { OperatorMethod: not null } ub: Console.WriteLine($"     binary with OperatorMethod {ub.OperatorMethod}"); break;
                    case IConversionOperation { OperatorMethod: not null } uc: Console.WriteLine($"     conversion with OperatorMethod {uc.OperatorMethod}"); break;
                    case IWithOperation w: Console.WriteLine($"     with CloneMethod={(w.CloneMethod is null ? "null" : w.CloneMethod.ToString())}"); break;
                    case IPropertyReferenceOperation pr when pr.Parent is not ISimpleAssignmentOperation: Console.WriteLine($"     property read {pr.Property} property.implicit={pr.Property.IsImplicitlyDeclared}"); break;
                }
            }
        }

        Console.WriteLine("== A1 diagnostics");
        Diag("d1", "return x is < double.NaN;");
        Diag("d2", "return x switch { < 0.0 => 1, >= 0.0 => 2 };");
        Diag("d3", "return x switch { < 0.0 => 1, >= 0.0 => 2, double.NaN => 3 };");
        Diag("d4", "return x switch { < 0.5 => 1, > 0.5 => 2, double.NaN => 3 };");
        Diag("d5", "return x switch { 0.0 => 1, -0.0 => 2, _ => 3 };");
        Diag("d6", "return x is > 0.5 and < 0.25;");
        Diag("d7", "return x == double.NaN;");
        Diag("d8", "return x is 1e400;");
        Diag("d9", "return f is > 0.1;");
        Diag("d10", "return i is > 2.5;");
        Diag("d11", "return x is > 1;");
        Diag("d12", "return x switch { double.NaN => 1, double.NaN => 2, _ => 3 };");
        Diag("d13", "return x switch { <= double.PositiveInfinity => 1, double.NaN => 2 };");
        Diag("d14", "return x switch { > double.PositiveInfinity => 1, _ => 2 };");
        Diag("d15", "return x switch { < 0.5 => 1, >= 0.5 => 2, _ => 3 };");
        Diag("d16", "return x switch { < 0.5 => 1, 0.5 => 2, > 0.5 => 3, double.NaN => 4, _ => 5 };");
        Diag("d17", "return f < 0.1;");
        Diag("d18", "const double c = 1e308 * 10; return c;");
        Diag("d19", "const double c = 0.0 / 0.0; return x is c;");
        Diag("d20", "return x is not double.NaN and not (< 0.5 or >= 0.5);");
    }
}
```

### P3

```csharp
using System.Diagnostics;
using Microsoft.Z3;

static class P
{
    static double ToDouble(Context ctx, Model m, FPExpr x)
    {
        var bv = (BitVecNum)m.Eval(ctx.MkFPToIEEEBV(x), true);
        return BitConverter.UInt64BitsToDouble(bv.UInt64);
    }
    static string B(double d) => BitConverter.DoubleToInt64Bits(d).ToString("X16");

    static void Ask(Context ctx, string label, FPExpr[] vars, params BoolExpr[] asserts)
    {
        var s = ctx.MkSolver();
        s.Set("timeout", 60000u);
        s.Assert(asserts);
        var sw = Stopwatch.StartNew();
        var r = s.Check();
        sw.Stop();
        var text = $"{label}: {r} in {sw.ElapsedMilliseconds} ms";
        if (r == Status.SATISFIABLE)
            foreach (var v in vars)
            {
                var num = s.Model.Eval(v, true);
                var d = ToDouble(ctx, s.Model, v);
                text += $" | {v}={d:R} bits={B(d)} z3=[{num}] type={num.GetType().Name}" + (num is FPNum n ? $" IsNaN={n.IsNaN} IsZero={n.IsZero} IsNegative={n.IsNegative} IsInf={n.IsInf}" : "");
            }
        if (r == Status.UNKNOWN) text += $" reason={s.ReasonUnknown}";
        Console.WriteLine(text);
    }

    static void Main()
    {
        Console.WriteLine($"Z3 {Microsoft.Z3.Version.FullVersion}; {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription}");
        using var ctx = new Context();
        var D = ctx.MkFPSortDouble();
        Console.WriteLine($"MkFPSortDouble: ebits={D.EBits} sbits={D.SBits}");
        var rne = ctx.MkFPRoundNearestTiesToEven();
        var x = (FPExpr)ctx.MkConst("x", D);
        var y = (FPExpr)ctx.MkConst("y", D);
        var z = (FPExpr)ctx.MkConst("z", D);
        FPExpr C(double v) => ctx.MkFP(v, D);

        Ask(ctx, "1 interval 0.25 < x <= 0.5", [x], ctx.MkFPGt(x, C(0.25)), ctx.MkFPLEq(x, C(0.5)));
        Ask(ctx, "2 neither x < 0.5 nor x >= 0.5", [x], ctx.MkNot(ctx.MkFPLt(x, C(0.5))), ctx.MkNot(ctx.MkFPGEq(x, C(0.5))));
        Ask(ctx, "3 fp.eq(x, +0) and not (x = +0)", [x], ctx.MkFPEq(x, ctx.MkFPZero(D, false)), ctx.MkNot(ctx.MkEq(x, ctx.MkFPZero(D, false))));
        Ask(ctx, "4 x = NaN (structural) and fp.eq(x, x)", [x], ctx.MkEq(x, ctx.MkFPNaN(D)), ctx.MkFPEq(x, x));
        Ask(ctx, "5 x > 0.5 and x < BitIncrement(0.5)", [x], ctx.MkFPGt(x, C(0.5)), ctx.MkFPLt(x, C(Math.BitIncrement(0.5))));
        Ask(ctx, "6 smallest step: x > 0.5 and x <= BitIncrement(0.5)", [x], ctx.MkFPGt(x, C(0.5)), ctx.MkFPLEq(x, C(Math.BitIncrement(0.5))));
        Ask(ctx, "7 two fields: x < y and y < 1 and x > 0.999", [x, y], ctx.MkFPLt(x, y), ctx.MkFPLt(y, C(1.0)), ctx.MkFPGt(x, C(0.999)));
        Ask(ctx, "8 arithmetic: x * 3.0 > 1.0 and x < 0.34 and x > 0", [x], ctx.MkFPGt(ctx.MkFPMul(rne, x, C(3.0)), C(1.0)), ctx.MkFPLt(x, C(0.34)), ctx.MkFPGt(x, C(0.0)));
        Ask(ctx, "9 arithmetic: x + 0.1 == 0.3 (fp.eq)", [x], ctx.MkFPEq(ctx.MkFPAdd(rne, x, C(0.1)), C(0.3)));
        var finite = new[] { x, y, z }.Select(v => ctx.MkNot(ctx.MkOr(ctx.MkFPIsNaN(v), ctx.MkFPIsInfinite(v)))).ToArray();
        var mulAdd = ctx.MkFPAdd(rne, ctx.MkFPMul(rne, x, y), z);
        var fma = ctx.MkFPFMA(rne, x, y, z);
        Ask(ctx, "10 x*y+z differs from fma(x,y,z), finite inputs in [1,2]", [x, y, z],
            [.. finite, ctx.MkFPGEq(x, C(1.0)), ctx.MkFPLEq(x, C(2.0)), ctx.MkFPGEq(y, C(1.0)), ctx.MkFPLEq(y, C(2.0)), ctx.MkFPGEq(z, C(1.0)), ctx.MkFPLEq(z, C(2.0)),
             ctx.MkNot(ctx.MkFPEq(mulAdd, fma))]);
        Ask(ctx, "11 x*y == y*x for all (expect UNSAT of the negation)", [x, y],
            ctx.MkNot(ctx.MkEq(ctx.MkFPMul(rne, x, y), ctx.MkFPMul(rne, y, x))));
        Ask(ctx, "12 (x+y)+z == x+(y+z) for all finite (negation)", [x, y, z],
            [.. finite, ctx.MkNot(ctx.MkFPEq(ctx.MkFPAdd(rne, ctx.MkFPAdd(rne, x, y), z), ctx.MkFPAdd(rne, x, ctx.MkFPAdd(rne, y, z))))]);
        Ask(ctx, "13 x/y*y == x for all normal x,y in [1,1000] (negation)", [x, y],
            ctx.MkFPGEq(x, C(1.0)), ctx.MkFPLEq(x, C(1000.0)), ctx.MkFPGEq(y, C(1.0)), ctx.MkFPLEq(y, C(1000.0)),
            ctx.MkNot(ctx.MkFPEq(ctx.MkFPMul(rne, ctx.MkFPDiv(rne, x, y), y), x)));
        var r = ctx.MkFPToReal(C(0.1));
        Console.WriteLine($"MkFPToReal(0.1) simplified: {r.Simplify()}");
        Console.WriteLine($"MkFP(0.1, double) prints as: {C(0.1)}; MkFPNaN: {ctx.MkFPNaN(D)}; MkFPInf(neg): {ctx.MkFPInf(D, true)}; MkFPZero(neg): {ctx.MkFPZero(D, true)}");
        var n01 = (FPNum)C(0.1);
        Console.WriteLine($"FPNum 0.1: Sign={n01.Sign} SignificandUInt64={n01.SignificandUInt64:X} ExponentInt64(biased)={n01.ExponentInt64(true)} ExponentInt64(unbiased)={n01.ExponentInt64(false)} Significand={n01.Significand}");
    }
}
```

### P3b

```csharp
using Microsoft.Z3;

using var ctx = new Context();
var D = ctx.MkFPSortDouble();
var x = (FPExpr)ctx.MkConst("x", D);
Console.WriteLine($"Z3 {Microsoft.Z3.Version.FullVersion}");
foreach (var (name, term) in new (string, FPExpr)[] { ("NaN", ctx.MkFPNaN(D)), ("+inf", ctx.MkFPInf(D, false)), ("-inf", ctx.MkFPInf(D, true)), ("-0", ctx.MkFPZero(D, true)), ("0.1", ctx.MkFP(0.1, D)), ("double.NaN via MkFP", ctx.MkFP(double.NaN, D)), ("Epsilon", ctx.MkFP(double.Epsilon, D)), ("MaxValue", ctx.MkFP(double.MaxValue, D)) })
{
    var bv = ctx.MkFPToIEEEBV(term).Simplify();
    var n = (FPNum)term;
    Console.WriteLine($"{name}: to_ieee_bv simplified = {bv} ({bv.GetType().Name}); FPNum IsNaN={n.IsNaN} IsInf={n.IsInf} IsZero={n.IsZero} IsNegative={n.IsNegative} IsSubnormal={n.IsSubnormal}");
}
var s = ctx.MkSolver();
s.Assert(ctx.MkFPIsNaN(x));
Console.WriteLine($"isNaN(x): {s.Check()}");
var m = s.Model;
Console.WriteLine($"model x = {m.Eval(x, true)} | Eval(to_ieee_bv(x), completion) = {m.Eval(ctx.MkFPToIEEEBV(x), true)} | without completion = {m.Eval(ctx.MkFPToIEEEBV(x), false)}");
var bvx = ctx.MkBVConst("b", 64);
var s2 = ctx.MkSolver();
s2.Assert(ctx.MkEq(ctx.MkFPToFP(bvx, D), x), ctx.MkFPIsNaN(x));
Console.WriteLine($"x = to_fp(b) and isNaN(x): {s2.Check()} b = {s2.Model.Eval(bvx, true)} (0x{((BitVecNum)s2.Model.Eval(bvx, true)).UInt64:X16})");
var s3 = ctx.MkSolver();
s3.Assert(ctx.MkFPLt(x, ctx.MkFP(double.Epsilon, D)), ctx.MkFPGt(x, ctx.MkFPZero(D, false)));
Console.WriteLine($"0 < x < Epsilon: {s3.Check()}");
```

### P4

```csharp
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Intrinsics.X86;

static class P
{
    static string B(double d) => BitConverter.DoubleToInt64Bits(d).ToString("X16");
    static double D(long bits) => BitConverter.Int64BitsToDouble(bits);
    [MethodImpl(MethodImplOptions.NoInlining)] static double MulAdd(double a, double b, double c) => a * b + c;
    [MethodImpl(MethodImplOptions.NoInlining)] static double MulAddLocal(double a, double b, double c) { var p = a * b; return p + c; }
    [MethodImpl(MethodImplOptions.NoInlining)] static double FmaCall(double a, double b, double c) => Math.FusedMultiplyAdd(a, b, c);
    [MethodImpl(MethodImplOptions.AggressiveOptimization | MethodImplOptions.NoInlining)] static double MulAddOpt(double a, double b, double c) => a * b + c;

    static void Main()
    {
        Console.WriteLine($"{RuntimeInformation.FrameworkDescription} {RuntimeInformation.ProcessArchitecture}; Fma.IsSupported={Fma.IsSupported}; TieredCompilation env={Environment.GetEnvironmentVariable("DOTNET_TieredCompilation") ?? "unset"}; TieredPGO env={Environment.GetEnvironmentVariable("DOTNET_TieredPGO") ?? "unset"}");
#if DEBUG
        Console.WriteLine("configuration: Debug");
#else
        Console.WriteLine("configuration: Release");
#endif
        double a = D(0x3FFB7C0AD074A76C), b = D(0x3FF2750D17F83148), c = D(0x3FFC9A2F147BF802);
        Console.WriteLine($"first call:  a*b+c={B(MulAdd(a, b, c))} local={B(MulAddLocal(a, b, c))} opt={B(MulAddOpt(a, b, c))} FusedMultiplyAdd={B(FmaCall(a, b, c))}");
        double sink = 0; long differ = 0;
        for (int round = 0; round < 6; round++)
        {
            for (int i = 0; i < 200_000; i++)
            {
                var r = MulAdd(a, b, c);
                if (BitConverter.DoubleToInt64Bits(r) != BitConverter.DoubleToInt64Bits(MulAddLocal(a, b, c))) differ++;
                sink += r;
            }
            Thread.Sleep(300);
        }
        Console.WriteLine($"after 1.2M calls and 1.8 s of sleeps: a*b+c={B(MulAdd(a, b, c))} local={B(MulAddLocal(a, b, c))} opt={B(MulAddOpt(a, b, c))} FusedMultiplyAdd={B(FmaCall(a, b, c))} differ={differ} sink={sink != 0}");
        double inl = 0;
        for (int i = 0; i < 2_000_000; i++) inl = a * b + c;
        Console.WriteLine($"inline in a hot loop of Main: {B(inl)}");
        Console.WriteLine($"Z3 models checked in .NET: 0.19999999999999998 + 0.1 == 0.3: {D(0x3FC9999999999999) + 0.1 == 0.3}; 0.3334197985568594 * 3.0 > 1.0: {D(0x3FD556BFFEA8FFE7) * 3.0 > 1.0}; x/y*y==x for x=1000, y=320.32409351703245: {1000.0 / D(0x4074052F7CAF0800) * D(0x4074052F7CAF0800) == 1000.0}");
        double x12 = D(unchecked((long)0xC1E000000000000F)), y12 = D(unchecked((long)0xC1EFFFFFFFFFFFF0)), z12 = D(0x41F0000000000019);
        Console.WriteLine($"associativity model: (x+y)+z={B((x12 + y12) + z12)} x+(y+z)={B(x12 + (y12 + z12))}");
    }
}
```

### P5

```csharp
using System.Diagnostics;
using System.Reflection;
using System.Runtime.Loader;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Scripting;
using Microsoft.CodeAnalysis.Scripting;

public sealed class Globals { public double fine; public double days; }

public static class P
{
    static string B(double d) => BitConverter.DoubleToInt64Bits(d).ToString("X16");
    public static async Task Main()
    {
        Console.WriteLine($"{System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription}; scripting {FileVersionInfo.GetVersionInfo(typeof(CSharpScript).Assembly.Location).ProductVersion}; compiler {FileVersionInfo.GetVersionInfo(typeof(CSharpCompilation).Assembly.Location).ProductVersion}");
        const string expr = "fine * days + 0.25";
        var g = new Globals { fine = 0.1, days = 3.0 };
        var sw = Stopwatch.StartNew();
        var r1 = await CSharpScript.EvaluateAsync<double>(expr, ScriptOptions.Default, g);
        Console.WriteLine($"1 first EvaluateAsync: {sw.ElapsedMilliseconds} ms result={B(r1)} direct={B(0.1 * 3.0 + 0.25)}");
        sw.Restart();
        for (int i = 0; i < 10; i++) await CSharpScript.EvaluateAsync<double>(expr + " + " + i + ".0", ScriptOptions.Default, g);
        Console.WriteLine($"2 ten more EvaluateAsync calls with different text: {sw.ElapsedMilliseconds} ms in total");
        sw.Restart();
        var script = CSharpScript.Create<double>(expr, ScriptOptions.Default, typeof(Globals));
        var runner = script.CreateDelegate();
        Console.WriteLine($"3 Create + CreateDelegate: {sw.ElapsedMilliseconds} ms");
        sw.Restart();
        double acc = 0;
        for (int i = 0; i < 10000; i++) acc += await runner(g);
        Console.WriteLine($"4 10,000 delegate calls: {sw.Elapsed.TotalMilliseconds:F1} ms result={B(await runner(g))}");

        var refs = ((string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES")!).Split(Path.PathSeparator).Select(p => (MetadataReference)MetadataReference.CreateFromFile(p)).ToArray();
        var code = "public static class Rule { public static double Apply(double fine, double days) => fine * days + 0.25; }";
        var spec = "public static class Spec { public static double Expected_0(double fine, double days) => " + expr + "; }";
        sw.Restart();
        var po = new CSharpParseOptions(LanguageVersion.CSharp14);
        var comp = CSharpCompilation.Create("WithSpec", [CSharpSyntaxTree.ParseText(code, po), CSharpSyntaxTree.ParseText(spec, po)], refs,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, optimizationLevel: OptimizationLevel.Release));
        using var ms = new MemoryStream();
        var emit = comp.Emit(ms);
        Console.WriteLine($"5 compile code + spec tree and emit: {sw.ElapsedMilliseconds} ms success={emit.Success}");
        sw.Restart();
        ms.Position = 0;
        var asm = new AssemblyLoadContext("probe", isCollectible: true).LoadFromStream(ms);
        var apply = asm.GetType("Rule")!.GetMethod("Apply")!;
        var expected = asm.GetType("Spec")!.GetMethod("Expected_0")!;
        object[] args = [0.1, 3.0];
        double a = 0, e = 0;
        for (int i = 0; i < 10000; i++) { a = (double)apply.Invoke(null, args)!; e = (double)expected.Invoke(null, args)!; }
        Console.WriteLine($"6 load + 10,000 reflection calls of each method: {sw.Elapsed.TotalMilliseconds:F1} ms actual={B(a)} expected={B(e)} equal bits={BitConverter.DoubleToInt64Bits(a) == BitConverter.DoubleToInt64Bits(e)}");
        sw.Restart();
        var comp2 = CSharpCompilation.Create("CodeOnly", [CSharpSyntaxTree.ParseText(code, po)], refs, new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, optimizationLevel: OptimizationLevel.Release));
        using var ms2 = new MemoryStream();
        comp2.Emit(ms2);
        Console.WriteLine($"7 second compilation, code tree only (warm compiler): {sw.ElapsedMilliseconds} ms");
        var bad = "public static class Spec { public static double Expected_0(double fine, double days) => System.IO.File.ReadAllText(\"x\").Length; }";
        var comp3 = CSharpCompilation.Create("Bad", [CSharpSyntaxTree.ParseText(bad, po)], refs, new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        Console.WriteLine($"8 a spec expression that reads a file compiles with {comp3.GetDiagnostics().Count(d => d.Severity == DiagnosticSeverity.Error)} errors");
    }
}
```

### P6

```csharp
using System.Collections.Concurrent;
using System.Diagnostics;

static class P
{
    // Constants the "code" compares one float field with.
    const float C1 = -1.5f, C2 = 0f, C3 = 0.1f, C4 = 2.5f;
    static readonly float[] Cs = [C1, C2, C3, C4];

    // Every comparison form of one field against the constants: six operators, constant pattern, relational patterns, Equals.
    static ulong Signature(float x)
    {
        ulong s = 0; int bit = 0;
        void Add(bool b) { if (b) s |= 1UL << bit; bit++; }
        foreach (var c in Cs) { Add(x < c); Add(x <= c); Add(x > c); Add(x >= c); Add(x == c); Add(x != c); Add(x.Equals(c)); }
        Add(x is C1); Add(x is C2); Add(x is C3); Add(x is C4);
        Add(x is > C1); Add(x is >= C2); Add(x is < C3); Add(x is <= C4);
        Add(x is > C1 and <= C3); Add(x is < C1 or > C4); Add(x is not (>= C2));
        return s;
    }

    // The cell model: NaN, then for sorted constants: below c1, at c1, between c1 and c2, ..., above cn. Infinities are ordinary members of the end cells.
    static int Cell(float x)
    {
        if (float.IsNaN(x)) return 0;
        int cell = 1;
        foreach (var c in Cs)
        {
            if (x < c) return cell;
            if (x == c) return cell + 1;
            cell += 2;
        }
        return cell;
    }

    static void Main()
    {
        Console.WriteLine($"{System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription} {System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture}");
        int cells = 2 * Cs.Length + 2;
        var seen = new ConcurrentDictionary<int, ulong>();
        var counts = new long[cells];
        long violations = 0;
        var sw = Stopwatch.StartNew();
        Parallel.For(0, 1 << 12, chunk =>
        {
            var local = new long[cells];
            uint start = (uint)chunk << 20;
            for (uint i = 0; i < (1u << 20); i++)
            {
                float x = BitConverter.UInt32BitsToSingle(start + i);
                int cell = Cell(x);
                ulong sig = Signature(x);
                local[cell]++;
                ulong first = seen.GetOrAdd(cell, sig);
                if (first != sig) Interlocked.Increment(ref violations);
            }
            lock (counts) for (int k = 0; k < cells; k++) counts[k] += local[k];
        });
        Console.WriteLine($"float bit patterns tried: {counts.Sum()} of 4294967296 in {sw.Elapsed.TotalSeconds:F1} s");
        Console.WriteLine($"cells in the model: {cells}; cells that received a value: {seen.Count}; values whose signature differs from the first value seen in their cell: {violations}");
        Console.WriteLine($"distinct signatures across cells: {seen.Values.Distinct().Count()}");
        Console.WriteLine("values per cell (0 = NaN, then below/at/between ... above): " + string.Join(", ", counts));
    }
}
```

### P7

```csharp
using System.Runtime.CompilerServices;

static class P
{
    [MethodImpl(MethodImplOptions.NoInlining)] static double V(double x) => x;
    static string B(double d) => BitConverter.DoubleToInt64Bits(d).ToString("X16");
    static void Main()
    {
        Console.WriteLine(System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription);
        // (b) arithmetic before the comparison: where does `x + 0.1 >= 0.3` switch?
        double x = V(0.2);
        for (int i = 0; i < 4; i++) { Console.WriteLine($"x={x:R} ({B(x)}): x + 0.1 = {x + 0.1:R}; x + 0.1 >= 0.3: {x + 0.1 >= 0.3}; x >= 0.2: {x >= 0.2}"); x = Math.BitDecrement(x); }
        // absorption: the condition `x + 1e16 > 1e16` is not the condition `x > 0`
        foreach (var v in new[] { 0.5, 1.0, 1.5, 2.0, 4.0 }) Console.WriteLine($"x={v}: x + 1e16 > 1e16: {V(v) + 1e16 > 1e16}; x > 0: {V(v) > 0}");
        // scaling: `x * 3.0 > 1.0` against the decimal boundary 1/3
        double third = V(1.0) / V(3.0);
        Console.WriteLine($"1.0/3.0={third:R} ({B(third)}): x*3.0 = {third * 3.0:R}; x*3.0 > 1.0: {third * 3.0 > 1.0}; next up {Math.BitIncrement(third):R}: x*3.0 = {Math.BitIncrement(third) * 3.0:R} > 1.0: {Math.BitIncrement(third) * 3.0 > 1.0}; two up: {Math.BitIncrement(Math.BitIncrement(third)) * 3.0 > 1.0}");
        // overflow and NaN created by arithmetic from finite, non-NaN inputs
        Console.WriteLine($"1e308 * 10 = {V(1e308) * 10}; (1e308 * 10) - (1e308 * 10) = {V(1e308) * 10 - V(1e308) * 10}; 0.0 * (1.0 / 0.0) = {V(0.0) * (V(1.0) / V(0.0))}; -0.0 produced by -1.0 * 0.0: {B(V(-1.0) * V(0.0))}");
        // exact comparison of a recomputed expression: same expression twice, and an algebraically equal one
        double fine = V(0.1), days = V(3.0);
        Console.WriteLine($"fine*days+0.25 twice: {B(fine * days + 0.25)} {B(fine * days + 0.25)}; algebraically equal 0.25+days*fine: {B(0.25 + days * fine)}; (fine+fine+fine)+0.25: {B(fine + fine + fine + 0.25)}; fine*days: {B(fine * days)} vs 0.3: {B(0.3)}");
        Console.WriteLine($"ulp distance example: |0.1*3 - 0.3| = {Math.Abs(fine * days - 0.3):R}; Math.BitIncrement(0.3) == 0.1*3: {Math.BitIncrement(0.3) == fine * days}; Math.Ulp-like step at 0.3: {Math.BitIncrement(0.3) - 0.3:R}");
        Console.WriteLine($"with on a record struct keeps other fields bit for bit, NaN payload included: {Keep()}");
    }
    readonly record struct Loan(int Id, double Fine, double Rate);
    static string Keep()
    {
        var odd = BitConverter.Int64BitsToDouble(0x7FF0000000000123L);
        var a = new Loan(7, 1.5, odd);
        var b = a with { Fine = 2.5 };
        return $"Rate bits before={B(a.Rate)} after={B(b.Rate)}; a == (b with {{ Fine = 1.5 }}): {a == (b with { Fine = 1.5 })}; record with NaN field equals itself: {a == a} {a.Equals(a)}; -0.0 field equals +0.0 field: {new Loan(1, 0.0, 0) == new Loan(1, -0.0, 0)}";
    }
}
```

## Not established

Each item names what was looked at, so that a search that found nothing is not read as proof of absence.

1. **The partition of A4-03 for `double`.**
   The exhaustive run (A4-02) was for `float`, with four constants and 39 comparison forms.
   For `double` the claim rests on the ordering clause of the standard (A1-02) and on the compiler's own model (A1-14); no run can try every `double`.
2. **Whether the JIT fuses `a * b + c` on Arm64, on a 32-bit process, on another runtime version, or under any switch.**
   One x64 machine and one runtime (10.0.11) were run.
   The JIT source was not opened.
   The runtime team's statements (A6-03 to A6-07) are issue comments from 2017 to 2022, not documentation, and no documentation page that states the rule was found; one web search restricted to `github.com` was made for it.
3. **Whether the current runtime ever computes with more precision than the type** (A6-01, A6-02).
   No source was found and no difference was observed; item 3 of section (c) of `research/verifiable-beyond-enumeration.md` stays open.
4. **A guarantee that `+ - * /` give identical bits on every supported platform.**
   A6-12 and A6-13 give the reason to expect it; A6-01, A6-02 and A6-14 give the permission to differ; no first-party sentence that promises it was found.
5. **The text of IEEE 754 itself.**
   The standard was not opened.
   What it requires is taken from the C# standard, the CLI standard, Goldberg's paper and the Oracle addendum.
6. **The two original pseudo-oracle papers.**
   Weyuker 1982: only the abstract on the publisher's page was read, through a summarising fetch tool; the full text needs a subscription.
   Davis and Weyuker, "Pseudo-oracles for non-testable programs", ACM '81: the publisher's page returned HTTP 403 and nothing of it was read.
   Rows B2-08 and B2-11 rest on the survey's account of both.
   A third-party copy of the Weyuker paper exists and was not used.
7. **An experiment or paper on how often an "independent" reference shares the faults of the code** (for example the work on N-version programming that the survey cites as [13] and [14]).
   Not opened; B2-09 and B2-10 are inferences.
8. **Spec#.**
   The overview paper on the Microsoft Research site returned HTTP 403; nothing of it was read.
9. **What `Contract.Ensures` does at run time on .NET 10.**
   Only its documented signature was read (B1-04); it was not called.
10. **How IntelliTest handles floating-point inputs today** (A7-08 to A7-10).
    The one documentation page read does not mention floating point, and the paper is from 2010 and about Pex.
11. **Tolerance comparison in NUnit and xUnit, and any library function that counts units in the last place between two doubles.**
    Not opened.
12. **A derived error bound for a formula of several operations** (B4-08), and **which formulas stay monotonic after rounding** (B3-08).
    No source was read for either.
13. **Z3 beyond what was run.**
    The cost figures (A5-14) are single runs on one machine with 4.12.2 and default settings; no other tactic, parameter or version was tried.
    Whether a later Z3 changes the result for `to_ieee_bv` of NaN (A5-11) was not checked.
    Agreement between Z3's model of an operation and .NET was checked on five witnesses (A5-15), not in general.
    Division by zero, subnormal results and `MkFPRem` against the C# `%` operator were not compared at all.
14. **The version in which the static `double.BitIncrement` and `float.BitIncrement` were added** (A2-09).
    They ran on .NET 10; their documentation pages were not opened.
15. **The remark that `double.Epsilon` behaves as zero on ARM** (A2-08).
    It is a sentence on a documentation page; where it comes from, and whether it holds on Arm64 with a current runtime, was not established.
16. **Rounding of a literal that is an exact tie in the subnormal range.**
    One tie was observed (2^53 + 1, A3-03).
    The two subnormal literals in probe P1 turned out to lie above the halfway point, so they show nothing about ties.
17. **A `switch` expression over a `double` that throws for NaN at run time** (A1-18).
    Inferred; not executed.
18. **`static readonly` fields and other non-constant comparands** (A4-13).
    Not run.
19. **A public compiler-API member that maps a positional parameter to its property** (A8-08).
    None was looked for beyond the declaring-syntax check of A8-07, and that check was run on two shapes only: a plain positional record and one that redeclares the property in its body. `partial` records and records with attributes on parameters were not tried.
20. **Whether an `in` parameter of a readonly struct type can still lead to a copy, and how `ref readonly` differs from `in` at the call site.**
    Not researched; A8-03 only shows how to recognise the two kinds.
21. **The complete list of operations that can run user code** (A8-12).
    The list in that row was assembled from the node names of `OperationInterfaces.xml` and from one probe; it was not checked node by node.
22. **That the sources read are the versions in use.**
    FsCheck, CsCheck and MSTest were read at a branch head, not at a released tag, and no package of them was run in this session.
    The runtime and compiler sources were read at the commits named in the installed files' version resources; nothing was compared at the binary level.
    The standard was read on draft branches; the clauses quoted may be reworded in later drafts, and drafts after v10 were not opened.
23. **The cost comparison between the scripting API and a compiled spec** (B2-03, B2-04).
    The measurements were taken in one process in a fixed order, so the first number of each route includes a different amount of warm-up.
24. **Whether a JSON spec can carry NaN, the infinities and negative zero** (section (c), form 1).
    The JSON grammar and the backend's JSON reader were not examined for this.
25. **`decimal` as a field type.**
    One observation (A8-13) was made in passing; nothing else about `decimal` was researched.

## Refuted

Claims that were expected to hold before the source or the run, and did not.

1. **Expected: the documentation comment on `IWithOperation.CloneMethod` is complete.**
   It says "This can be null in error scenarios."
   Run: for a `with` on a record struct in code that compiles with no diagnostic, `CloneMethod` is null (probe P2, row A8-05).
2. **Expected: a positional property of a record is implicitly declared.**
   Run: `IPropertySymbol.IsImplicitlyDeclared` is false for it; only its getter and its backing field are implicit (probe P2, row A8-07).
3. **Expected: `MkFPToIEEEBV` gives a usable bit pattern for every model value.**
   The Z3 header and the .NET documentation comment say the conversion "knows only one NaN and it will always produce the same bit-vector representation of that NaN."
   Run with 4.12.2: the term for NaN does not simplify to a number, and evaluating it in a model returned 0, the bits of `+0.0` (probe P3b, row A5-11).
4. **Expected: `FPNum.ToString()` prints the value.**
   Run with 4.12.2: it prints a fraction for finite values and for NaN, and `0` for negative infinity and negative zero (probe P3, row A5-12).
5. **Expected: a constant pattern can separate the two zeros, because the standard defines it through `object.Equals` and not `==`.**
   Run: `x is 0.0` and `x is -0.0` each match both zeros, and the compiler rejects a second arm for the other zero as unreachable (probes P1 and P2, rows A1-08 and A1-13). `Equals` separates NaN handling from `==`, not the zeros.
6. **Expected: because a real literal can never be an infinity (A3-02), a constant can never be one.**
   Run: `const double c = 1e308 * 10;` compiles with no diagnostic, and the library's own `PositiveInfinity` and `NaN` are constants (probe P2 d18, row A3-05).
7. **Expected: the boundary of `x + 0.1 >= 0.3` is 0.2.**
   Run: the answer changes between `0.19999999999999996` and `0.19999999999999998`, one step below 0.2 (probe P7, row A4-09).
8. **Expected: a `float` field and a `double` constant written with the same digits meet at the same number.**
   Run: `0.1f` is greater than the `double` `0.1`, and no `float` equals it (probe P1, row A3-08).
9. **Expected: `double.Epsilon` can serve as "the next value" for any constant.**
   Run: `0.5 + double.Epsilon == 0.5` (probe P1, row A2-07). The documentation says the same (A2-06).
10. **Expected: the syntax-level constant and the operation-level constant of one operand agree.**
    Run: for `loan.Fine < 1` the syntax gives `System.Int32 1` and the operation gives `System.Double 1` (probe P2, row A3-15).
11. **Expected: an operator with a null `OperatorMethod` runs no method.**
    Run: a `decimal` comparison reported no `OperatorMethod` (probe P2, row A8-13).
12. **Expected: adding the scripting package reuses the compiler the backend already references.**
    Run: the package restored its own compiler build, `5.9.0-1.26357.3`, next to the SDK's `5.9.0-1.26379.115` (probe P5, row B2-02).
13. **Expected: the relational-pattern NaN error is CS8781.**
    Run: it is CS8782 (probe P2 d1, row A1-10). This expectation came from memory and had no source.
