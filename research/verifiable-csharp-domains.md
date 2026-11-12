# C# input domains for the checker: primary-source research

Read on 2026-11-11.

## (a) Summary for a meeting

The C# backend can be extended to enums, small integers, strings and records, but only bool and small integer types have a domain that the tool can really enumerate.
An enum variable can hold every value of its underlying integer type, including zero and values with no name, and the `[Flags]` attribute changes nothing about that.
A string parameter can hold `null` and an unbounded number of strings, so a "finite string set" is a partition around the constants in the code and is never an exhaustive domain.
A `switch` expression that covers every named enum member still throws at run time for an unnamed value, and the compiler reports this only as a level 1 warning (CS8524), which the present backend does not look at because it filters on errors.
The compiler's public API gives the tool what it needs to read domains: enum members with their constant values, the underlying type, folded constants, the operation tree with all pattern forms, a control flow graph, and a flag that says whether a switch expression is exhaustive.
The compiler's own value-set reasoning is internal and cannot be called.
Integer comparison is simple when a parameter is compared with constants, but any arithmetic on the parameter brings in overflow context, promotion and exceptions, and then a partition at the constants is no longer justified by the constants alone.
A positional record can be built by reflection through its public primary constructor, but `default` of a record struct, `null` for a record class, reflection and `required` all create instances that the constructor never saw.
The official Z3 package on nuget.org stops at version 4.12.2 from May 2023 and contains native libraries for Windows x64 and macOS x64 only, while the Z3 repository publishes version 5.4.1 with six native platforms as a release asset only.
Nothing in this file was confirmed by running code, and section (d) lists the runs that are still needed.

## Method and scope

Every row in section (b) names a source that was opened on 2026-11-11.
The tag `cited` means the source was opened and the quoted words were found in it.
The tag `unverified` means the claim is recalled or inferred and was not found in an opened source.
Pages on learn.microsoft.com were downloaded and searched for the quoted sentence after removing HTML tags.
Files on GitHub were downloaded from `raw.githubusercontent.com` at a fixed commit, and the links point to the same file and commit on `github.com` with a line number.
Quotes from GitHub keep the Markdown of the file, quotes from learn.microsoft.com are the rendered text, and `[…]` marks words that were left out.
Compiler source was read at the commit named in the version resource of the compiler assembly inside the installed SDK 10.0.400 (`dotnet/dotnet` commit `14fbf8d5`, folder `src/roslyn`).
Runtime source was read at the commit named in the version resource of the installed runtime 10.0.11 (`dotnet/dotnet` commit `e2f47b01`, folder `src/runtime`).
The C# standard was read at branch `standard-v7` (C# 7, commit `02d1a901`) and branch `draft-v8` (commit `597762ff`).
No standard text for the pattern forms of C# 9 and later was read, so those features were read in the `dotnet/csharplang` proposals (commit `68b7855d`) and in the published documentation.
The published documentation already describes C# 15 features such as union types, which are outside the C# 14 vocabulary of the backend.
The backend source (`scripts/dotnet/Program.cs`, 285 lines), its project file and the two reference pages `shapes.md` and `evidence.md` were read in full.

## (b) Claims

### Question 1: enum semantics

| ID | Claim | Source | Quote | Tag |
|---|---|---|---|---|
| Q1-01 | An enum variable can hold every value of its underlying type, not only the named members. | [C# 7 standard, enums.md §19.6, line 235](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/enums.md?plain=1#L235) | "The set of values of the enum type is the same as the set of values of the underlying type and is not restricted to the values of the named constants. Any value of the underlying type of an enum can be cast to the enum type, and is a distinct valid value of that enum type." | cited |
| Q1-02 | The underlying type is one of eight integral types. | [C# 7 standard, types.md §8.3.10, line 388](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/types.md?plain=1#L388) | "Every enumeration type has an underlying type, which shall be `byte`, `sbyte`, `short`, `ushort`, `int`, `uint`, `long` or `ulong`." | cited |
| Q1-03 | The underlying type is `int` when none is declared. | [C# 7 standard, enums.md §19.2, line 51](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/enums.md?plain=1#L51) | "An enum declaration that does not explicitly declare an underlying type has an underlying type of `int`." | cited |
| Q1-04 | A cast to an enum type is allowed from every numeric type, including `char`, `float`, `double` and `decimal`. | [C# 7 standard, conversions.md §10.3.3, line 430](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/conversions.md?plain=1#L430) | "From `sbyte`, `byte`, `short`, `ushort`, `int`, `uint`, `long`, `ulong`, `char`, `float`, `double`, or `decimal` to any *enum_type*." | cited |
| Q1-05 | A cast to or from an enum follows the numeric conversion rules of the underlying type, so the overflow context applies to it. | [C# 7 standard, conversions.md §10.3.3, line 434](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/conversions.md?plain=1#L434) | "An explicit enumeration conversion between two types is processed by treating any participating *enum_type* as the underlying type of that *enum_type*, and then performing an implicit or explicit numeric conversion between the resulting types." | cited |
| Q1-06 | The default value of an enum is zero, also when no member has the value zero. | [learn: Enumeration types](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/enum) | "The default value of an enumeration type `E` is the value produced by expression `(E)0`, even if zero doesn't have the corresponding enum member." | cited |
| Q1-07 | The standard gives the same default. | [C# 7 standard, types.md §8.3.3, line 225](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/types.md?plain=1#L225) | "For an *enum_type* `E`, the default value is `0`, converted to the type `E`." | cited |
| Q1-08 | A constant zero of any integer type converts to any enum type without a cast. | [C# 7 standard, conversions.md §10.2.4, line 111](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/conversions.md?plain=1#L111) | "An implicit enumeration conversion permits a *constant_expression* […] with any integer type and the value zero to be converted to any *enum_type* and to any *nullable_value_type* whose underlying type is an *enum_type*." | cited |
| Q1-09 | Two members can have the same value. | [C# 7 standard, enums.md §19.4, line 131](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/enums.md?plain=1#L131) | "Multiple enum members may share the same associated value." | cited |
| Q1-10 | Arithmetic and bitwise operators are defined on enum values, so code can produce unnamed values without a cast. The list that follows the quote names binary `+`, binary `-`, `^`, `&`, the bitwise or operator, `~`, `++` and `--`. | [C# 7 standard, enums.md §19.6, lines 239-247](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/enums.md?plain=1#L239-L247) | "The following operators can be used on values of enum types:" | cited |
| Q1-11 | `[Flags]` is a marker that says the enum can be treated as a bit field. | [learn: FlagsAttribute](https://learn.microsoft.com/en-us/dotnet/api/system.flagsattribute) | "Indicates that an enumeration can be treated as a bit field; that is, a set of flags." | cited |
| Q1-12 | Bit fields are meant to be combined into values that have no name. | [learn: FlagsAttribute](https://learn.microsoft.com/en-us/dotnet/api/system.flagsattribute) | "Therefore, bit fields are designed to be combined with a bitwise `OR` operation to generate unnamed values, whereas enumerated constants are not." | cited |
| Q1-13 | The library documentation says that a method taking an enum should validate it, because any number can be cast to the enum. | [learn: FlagsAttribute](https://learn.microsoft.com/en-us/dotnet/api/system.flagsattribute) | "The reason is that you can cast a numeric value to the enumeration type even if that numeric value is not defined in the enumeration." | cited |
| Q1-14 | `Enum.IsDefined` reports whether a value, or a name given as a string, is one of the named constants. | [learn: Enum.IsDefined](https://learn.microsoft.com/en-us/dotnet/api/system.enum.isdefined) | "Returns a Boolean telling whether a given integral value, or its name as a string, exists in a specified enumeration." | cited |
| Q1-15 | `Enum.IsDefined` returns `false` for a combination of flags that has no name of its own. | [learn: Enum.IsDefined](https://learn.microsoft.com/en-us/dotnet/api/system.enum.isdefined) | "In other words, for enumerations that define a set of bit fields, the method determines only whether a single bit field belongs to the enumeration." | cited |
| Q1-16 | When `Enum.IsDefined` gets a string it compares member names with case sensitivity. | [learn: Enum.IsDefined](https://learn.microsoft.com/en-us/dotnet/api/system.enum.isdefined) | "The string representation of the name of an enumeration member. The characters in the string must have the same case as the enumeration member name." | cited |
| Q1-17 | `Enum.ToObject` builds an enum value from any integer and does not check that the value is named. | [learn: Enum.ToObject](https://learn.microsoft.com/en-us/dotnet/api/system.enum.toobject) | "Note that the conversion succeeds even if value is outside the bounds of `enumType` members." | cited |
| Q1-18 | `Enum.GetValues` returns one entry per member, so members that share a value give duplicates. | [learn: Enum.GetValues](https://learn.microsoft.com/en-us/dotnet/api/system.enum.getvalues) | "If multiple members have the same value, the returned array includes duplicate values." | cited |
| Q1-19 | A `switch` statement with no matching case and no `default` does nothing and continues after the statement. | [C# 7 standard, statements.md §13.8.3, lines 766-768](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/statements.md?plain=1#L766-L768) | "Otherwise, control is transferred to the end point of the `switch` statement." | cited |
| Q1-20 | The published documentation says the same. | [learn: Selection statements](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/selection-statements) | "If a match expression doesn't match any case pattern and there's no `default` case, control falls through a `switch` statement." | cited |
| Q1-21 | In the C# 7 standard, a set of patterns is exhaustive for an enum only when it matches every value of the underlying type. | [C# 7 standard, patterns.md §11.4, line 164](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/patterns.md?plain=1#L164) | "`T` is an integral or enum type, or a nullable version of one of those, and for every possible value of `T`’s non-nullable underlying type, some pattern in `Q` would match that value; or" | cited |
| Q1-22 | The end of a `switch` statement is reachable when there is no `default` and the cases are not exhaustive. | [C# 7 standard, statements.md §13.8.3, lines 955-956](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/statements.md?plain=1#L955-L956) | "The switch expression is a non-constant value, and the set of patterns appearing among the cases of the switch statement that do not have guards or have guards whose value is the constant true, is not *exhaustive* […] for the switch governing type." | cited |
| Q1-23 | A `switch` expression with no matching arm throws. | [C# 8 draft standard, expressions.md §12.11, line 3890](https://github.com/dotnet/csharpstandard/blob/597762ff3818cc9ed227dd4151acd34486cf9f0f/standard/expressions.md?plain=1#L3890) | "If there is no such *switch_expression_arm*, the *switch_expression* throws an instance of the exception `System.InvalidOperationException` (or a class derived from that)." | cited |
| Q1-24 | On .NET Core 3.0 and later the exception type is `SwitchExpressionException`. | [learn: switch expression](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/switch-expression) | "If none of a `switch` expression's patterns matches an input value, the runtime throws an exception. In .NET Core 3.0 and later versions, the exception is a `System.Runtime.CompilerServices.SwitchExpressionException`." | cited |
| Q1-25 | The exception can carry the unmatched value. | [learn: SwitchExpressionException](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.compilerservices.switchexpressionexception) | "Indicates that a switch expression that was non-exhaustive failed to match its input at runtime. The exception optionally contains an object representing the unmatched value." | cited |
| Q1-26 | The draft standard only says that a warning may be issued for a non-exhaustive `switch` expression. | [C# 8 draft standard, expressions.md §12.11, line 3888](https://github.com/dotnet/csharpstandard/blob/597762ff3818cc9ed227dd4151acd34486cf9f0f/standard/expressions.md?plain=1#L3888) | "A switch expression is *exhaustive* if every value of its input is handled by at least one arm of the switch expression. A warning may be issued if a switch expression is not exhaustive." | cited |
| Q1-27 | CS8509 is the general "not exhaustive" warning for a `switch` expression. | [compiler resources, CSharpResources.resx, line 6005](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/CSharpResources.resx#L6005), number at [ErrorCode.cs line 1626](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Errors/ErrorCode.cs#L1626) | "The switch expression does not handle all possible values of its input type (it is not exhaustive). For example, the pattern '{0}' is not covered." | cited |
| Q1-28 | CS8524 is the warning for a `switch` expression that misses only unnamed enum values. | [compiler resources, CSharpResources.resx, line 6017](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/CSharpResources.resx#L6017), number at [ErrorCode.cs line 1641](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Errors/ErrorCode.cs#L1641) | "The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '{0}' is not covered." | cited |
| Q1-29 | The compiler picks CS8509 when an uncovered value equals a declared public member, and CS8524 when no uncovered value has a name. | [compiler source, PatternExplainer.cs, lines 811-825](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Binder/PatternExplainer.cs#L811-L825) | "// If the input is an enumeration type, see if any declared enumeration constant values are in the set." and "// If so, that is what to report." | cited |
| Q1-30 | When an uncovered value could still be matched by an arm with a `when` clause, the compiler reports CS8846 instead, and this choice comes before the choice between CS8524 and CS8509. | [compiler source, SwitchExpressionBinder.cs, lines 107-110](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Binder/SwitchExpressionBinder.cs#L107-L110) | "requiresFalseWhenClause ? ErrorCode.WRN_SwitchExpressionNotExhaustiveWithWhen :" and "unnamedEnumValue ? ErrorCode.WRN_SwitchExpressionNotExhaustiveWithUnnamedEnumValue :" | cited |
| Q1-31 | CS8509 and CS8524 are warnings of level 1, not errors. | [compiler source, ErrorFacts.cs, lines 466, 470 and 578](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Errors/ErrorFacts.cs#L466-L578) | "case ErrorCode.WRN_SwitchExpressionNotExhaustiveWithUnnamedEnumValue:" and, at the end of the same case group, "return 1;" | cited |
| Q1-32 | An arm that can never be chosen is an error (CS8510), not a warning. | [compiler source, SwitchExpressionBinder.cs, line 80](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Binder/SwitchExpressionBinder.cs#L80), text at [CSharpResources.resx line 5297](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/CSharpResources.resx#L5297) | "The pattern is unreachable. It has already been handled by a previous arm of the switch expression or it is impossible to match." | cited |
| Q1-33 | The exhaustiveness warnings above leave out paths where the input is `null`, which a separate nullable analysis reports. | [compiler source, SwitchExpressionBinder.cs, lines 95-97](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Binder/SwitchExpressionBinder.cs#L95-L97) | "Handling paths with nulls is the job of the nullable walker." | cited |
| Q1-34 | The published documentation describes the split between the three warnings in the same way. | [learn: Pattern matching errors and warnings](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/pattern-matching-warnings) | "The compiler warns separately for unnamed enum values (**CS8524**) and for cases where a `when` clause might match an otherwise-unhandled value (**CS8846**)." | cited |
| Q1-35 | The documentation ties the three exhaustiveness diagnostics to `switch` expressions; no such diagnostic for a `switch` statement was found in the sources read. | [learn: Pattern matching errors and warnings](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/pattern-matching-warnings) | "Add switch arms that handle all possible input values to create exhaustive switch expressions (**CS8509**, **CS8524**, **CS8846**)." | cited |

### Question 2: compiler APIs for reading domains and constants

All interfaces below are declared in the language-neutral compiler library, source folder `src/Compilers/Core/Portable`.
That this library is the file `Microsoft.CodeAnalysis.dll` is an inference from the folder layout and from the backend's own references, not a statement that was read.
"Public" in this table means that the member is listed in the file `PublicAPI.Shipped.txt` of the compiler library at the commit that built the installed SDK.

| ID | Claim | Source | Quote | Tag |
|---|---|---|---|---|
| Q2-01 | The installed SDK 10.0.400 carries the compiler assembly `Microsoft.CodeAnalysis.CSharp.dll` with product version `5.9.0-1.26379.115+14fbf8d5271c98133561eb55185fdb05b286f578`. | Version resource of the file `Roslyn/bincore/Microsoft.CodeAnalysis.CSharp.dll` in the SDK folder `10.0.400`, read on the machine | "ProductVersion : 5.9.0-1.26379.115+14fbf8d5271c98133561eb55185fdb05b286f578" | cited |
| Q2-02 | The backend's project file takes the two compiler assemblies from the SDK folder with a `HintPath`, not from a NuGet package. | The backend's project file (the `.csproj` file in `scripts/dotnet/`), lines 11-18 | "`<HintPath>$(MSBuildSDKsPath)/../Roslyn/bincore/Microsoft.CodeAnalysis.CSharp.dll</HintPath>`" | cited |
| Q2-03 | The same APIs ship on nuget.org in the package `Microsoft.CodeAnalysis.CSharp`, whose newest stable version is 5.9.0 under the MIT licence, for `net10.0` and `netstandard2.0`. | [nuget.org version list](https://api.nuget.org/v3-flatcontainer/microsoft.codeanalysis.csharp/index.json) and [nuspec of 5.9.0](https://api.nuget.org/v3-flatcontainer/microsoft.codeanalysis.csharp/5.9.0/microsoft.codeanalysis.csharp.nuspec) | "`<license type="expression">MIT</license>`" and "`<dependency id="Microsoft.CodeAnalysis.Common" version="[5.9.0, 5.9.0]" exclude="Build,Analyzers" />`" | cited |
| Q2-04 | The language-neutral part is in the package `Microsoft.CodeAnalysis.Common`, which is meant to arrive as a dependency. | [nuspec of Microsoft.CodeAnalysis.Common 5.9.0](https://api.nuget.org/v3-flatcontainer/microsoft.codeanalysis.common/5.9.0/microsoft.codeanalysis.common.nuspec) | "A shared package used by the Microsoft .NET Compiler Platform ("Roslyn"). Do not install this package manually, it will be added as a prerequisite by other packages that require it." | cited |
| Q2-05 | Compiler package version 5.0 is the first with C# 14. | [dotnet/roslyn docs, NuGet-packages.md, line 56](https://github.com/dotnet/roslyn/blob/10e172fe737d23f8145ff6ee743ff1728dabbc56/docs/wiki/NuGet-packages.md?plain=1#L56) | "Version `5.0` includes C# 14.0 (Visual Studio 2026 version 18.0, .NET 10)" | cited |
| Q2-06 | `INamedTypeSymbol.EnumUnderlyingType` (namespace `Microsoft.CodeAnalysis`) gives the underlying type of an enum and is public. | [INamedTypeSymbol.cs, lines 113-117](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Symbols/INamedTypeSymbol.cs#L113-L117), [PublicAPI.Shipped.txt line 1474](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L1474) | "For enum types, gets the underlying type. Returns null on all other kinds of types." | cited |
| Q2-07 | `IFieldSymbol.HasConstantValue` and `IFieldSymbol.ConstantValue` (namespace `Microsoft.CodeAnalysis`) give the constant of a `const` field and are public. | [IFieldSymbol.cs, lines 89-99](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Symbols/IFieldSymbol.cs#L89-L99), [PublicAPI.Shipped.txt lines 1363 and 1367](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L1363-L1367) | "Returns false if the field wasn't declared as "const", or constant value was omitted or erroneous. True otherwise." | cited |
| Q2-08 | `SemanticModel.GetConstantValue` (namespace `Microsoft.CodeAnalysis`) returns the folded constant of a syntax node and is public. | [SemanticModel.cs, lines 740-748](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Compilation/SemanticModel.cs#L740-L748), [PublicAPI.Shipped.txt line 2578](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L2578) | "If the node provided has a constant value an Optional value will be returned with HasValue set to true and with Value set to the constant.  If the node does not have an constant value, an Optional will be returned with HasValue set to false." | cited |
| Q2-09 | `SemanticModel.GetOperation` returns the `IOperation` tree, and every `IOperation` has a `ConstantValue`; both are public. | [IOperation.cs, lines 12-45](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/IOperation.cs#L12-L45), [PublicAPI.Shipped.txt lines 1560 and 2581](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L1560) | "Root type for representing the abstract semantics of C# and VB statements and expressions." | cited |
| Q2-10 | The `IOperation` interface carries a written reservation about change. | [IOperation.cs, lines 15-17](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/IOperation.cs#L15-L17) | "This interface is reserved for implementation by its associated APIs. We reserve the right to change it in the future." | cited |
| Q2-11 | `ControlFlowGraph` (namespace `Microsoft.CodeAnalysis.FlowAnalysis`) is public and is created from a root syntax node and a semantic model, or from a root operation. | [ControlFlowGraph.cs, lines 17-24 and 73-83](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/ControlFlowGraph.cs#L17-L24), [PublicAPI.Shipped.txt line 3697](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L3697) | "`Control flow graph representation for a given executable code block <see cref="OriginalOperation"/>. This graph contains a set of <see cref="BasicBlock"/>s, with an entry block, zero or more intermediate basic blocks and an exit block.`" | cited |
| Q2-12 | The graph can be created only for a root operation, such as a whole method body. | [ControlFlowGraph.cs, lines 100-105](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/ControlFlowGraph.cs#L100-L105) | "Root operation block, which must have a null parent." | cited |
| Q2-13 | In the graph, a `switch` expression becomes one pattern test per arm, followed by a throw. | [ControlFlowGraphBuilder.cs, lines 7759-7832](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/ControlFlowGraphBuilder.cs#L7759-L7832) | "// GotoIfFalse (captureInput is pat1 && g1) label1;" and "// throw new switch failure" | cited |
| Q2-14 | `ISwitchExpressionOperation.IsExhaustive` (namespace `Microsoft.CodeAnalysis.Operations`) is public and states whether the arms cover every input. | [OperationInterfaces.xml, line 3106](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml#L3106), [PublicAPI.Shipped.txt line 2384](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L2384) | "True if the switch expressions arms cover every possible input value." | cited |
| Q2-15 | `IsExhaustive` is `false` exactly when the compiler kept a default label for the switch expression, which is the same condition under which it considers CS8509, CS8524 or CS8846. | [CSharpOperationFactory.cs, lines 2775-2783](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Operations/CSharpOperationFactory.cs#L2775-L2783), [SwitchExpressionBinder.cs lines 85-90](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Binder/SwitchExpressionBinder.cs#L85-L90) | "if (boundSwitchExpression.DefaultLabel != null)" and "// switch expression is exhaustive; no default label needed." | cited |
| Q2-16 | `IConstantPatternOperation` (namespace `Microsoft.CodeAnalysis.Operations`) is public and holds the constant as an operation in `Value`. | [OperationInterfaces.xml, line 2667](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml#L2667), [PublicAPI.Shipped.txt line 2121](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L2121) | "Represents a pattern with a constant value." | cited |
| Q2-17 | `IRelationalPatternOperation` is public and holds the operator kind and the constant. | [OperationInterfaces.xml, line 3351](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml#L3351), [PublicAPI.Shipped.txt line 2355](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L2355) | "Represents a pattern comparing the input with a constant value using a relational operator." | cited |
| Q2-18 | `IBinaryPatternOperation` is public and covers the `and` and `or` patterns. | [OperationInterfaces.xml, line 3303](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml#L3303), [PublicAPI.Shipped.txt line 2074](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L2074) | "Represents a binary ("and" or "or") pattern." | cited |
| Q2-19 | `INegatedPatternOperation` is public and covers the `not` pattern. | [OperationInterfaces.xml, line 3285](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml#L3285), [PublicAPI.Shipped.txt line 2290](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L2290) | "Represents a negated pattern." | cited |
| Q2-20 | `IRecursivePatternOperation.PropertySubpatterns` and `IPropertySubpatternOperation` are public and cover property patterns: each entry names a member and the pattern it must match. | [OperationInterfaces.xml, line 3060](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Operations/OperationInterfaces.xml#L3060), [PublicAPI.Shipped.txt lines 2326 and 2344](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L2326-L2344) | "This contains the (symbol, property) pairs within a property subpattern." | cited |
| Q2-21 | `IBinaryOperation.IsChecked` and `IConversionOperation.IsChecked` are public, so the overflow context of each arithmetic operation and cast can be read. | [PublicAPI.Shipped.txt lines 2065 and 2128](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L2065) | "Microsoft.CodeAnalysis.Operations.IBinaryOperation.IsChecked.get -> bool" | cited |
| Q2-22 | Symbols for records are public: `ITypeSymbol.IsRecord`, `INamedTypeSymbol.InstanceConstructors`, `IPropertySymbol.IsRequired`, `IFieldSymbol.IsRequired` and `IMethodSymbol.IsInitOnly`. | [PublicAPI.Shipped.txt lines 1372, 1422, 1479, 1619 and 1709](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt#L1709) | "Microsoft.CodeAnalysis.ITypeSymbol.IsRecord.get -> bool" | cited |
| Q2-23 | The compiler's own sets of remaining values, which it uses to decide exhaustiveness, are internal types. | [IValueSet.cs, lines 10-16](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Utilities/IValueSet.cs#L10-L16) | "internal interface IValueSet" | cited |
| Q2-24 | A compilation created through the API has overflow checking off, the nullable context disabled and warning level 4 unless the caller says otherwise. | [CSharpCompilationOptions.cs, lines 57-84](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/CSharpCompilationOptions.cs#L57-L84), [Diagnostic.cs line 28](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/Diagnostic/Diagnostic.cs#L28) | "bool checkOverflow = false," and "NullableContextOptions nullableContextOptions = NullableContextOptions.Disable)" | cited |
| Q2-25 | The compiler repository reviews every public API added to the compiler libraries, and it names a different group of assemblies as the one without a compatibility bar. | [dotnet/roslyn docs, API Review Process.md, line 7](https://github.com/dotnet/roslyn/blob/10e172fe737d23f8145ff6ee743ff1728dabbc56/docs/contributing/API%20Review%20Process.md?plain=1#L7) | "The rule of thumb is that we (**dotnet/roslyn**) review every public API that is being added to this repository in the CodeAnalysis (compiler), Workspaces, Features, and EditorFeatures libraries. APIs in the LanguageServices dlls are not usually reviewed as they are not intended for general consumption; they are for use in Visual Studio, and we don't have a compat bar for these APIs." | cited |
| Q2-26 | The APIs in rows Q2-06 to Q2-22 are stable across compiler versions. | No source was found that states a compatibility guarantee for them. | none | unverified |

### Question 3: integer semantics for partitioning a range at constants

| ID | Claim | Source | Quote | Tag |
|---|---|---|---|---|
| Q3-01 | The predefined integer comparison operators exist for `int`, `uint`, `long` and `ulong` only, and they compare numeric values. | [C# 7 standard, expressions.md §12.12.2, lines 4054-4088](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L4054-L4088) | "Each of these operators compares the numeric values of the two integer operands and returns a `bool` value that indicates whether the particular relation is `true` or `false`." | cited |
| Q3-02 | Operands of smaller integer types are converted to `int` before they are compared. The subclause that says so is marked informative. | [C# 7 standard, expressions.md §12.4.7.3, line 315](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L315) | "Otherwise, both operands are converted to type `int`." | cited |
| Q3-03 | A `uint` compared with a signed 32-bit or smaller operand is compared as `long`. | [C# 7 standard, expressions.md §12.4.7.3, line 313](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L313) | "Otherwise, if either operand is of type `uint` and the other operand is of type `sbyte`, `short`, or `int`, both operands are converted to type `long`." | cited |
| Q3-04 | A `ulong` cannot be compared with a signed operand. | [C# 7 standard, expressions.md §12.4.7.3, line 311](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L311) | "Otherwise, if either operand is of type `ulong`, the other operand is converted to type `ulong`, or a binding-time error occurs if the other operand is of `type sbyte`, `short`, `int`, or `long`." | cited |
| Q3-05 | Implicit conversions between integer types keep the value. | [C# 7 standard, conversions.md §10.2.3, line 105](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/conversions.md?plain=1#L105) | "Conversions from `int`, `uint`, `long` or `ulong` to `float` and from `long` or `ulong` to `double` may cause a loss of precision, but will never cause a loss of magnitude. The other implicit numeric conversions never lose any information." | cited |
| Q3-06 | An integer literal without a suffix has the first of four types that can hold it. | [C# 7 standard, lexical-structure.md §6.4.5.3, line 703](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/lexical-structure.md?plain=1#L703) | "If the literal has no suffix, it has the first of these types in which its value can be represented: `int`, `uint`, `long`, `ulong`." | cited |
| Q3-07 | The literal `2147483648` is `uint`, except directly after a unary minus, where the two tokens form the `int` value −2147483648. | [C# 7 standard, lexical-structure.md §6.4.5.3, line 714](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/lexical-structure.md?plain=1#L714) | "When an *Integer_Literal* representing the value `2147483648` (2³¹) and no *Integer_Type_Suffix* appears as the token immediately following a unary minus operator token […], the result (of both tokens) is a constant of type int with the value `−2147483648` (−2³¹). In all other situations, such an *Integer_Literal* is of type `uint`." | cited |
| Q3-08 | Negating a `uint` gives a `long`, and negating a `ulong` does not compile. | [C# 7 standard, expressions.md §12.9.3, lines 3369-3371](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L3369-L3371) | "If the operand of the negation operator is of type `uint`, it is converted to type `long`, and the type of the result is `long`." and "If the operand of the negation operator is of type `ulong`, a compile-time error occurs." | cited |
| Q3-09 | A constant of type `int` converts without a cast to a smaller or unsigned integer type when its value fits. | [C# 7 standard, conversions.md §10.2.11, line 290](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/conversions.md?plain=1#L290) | "A *constant_expression* […] of type `int` can be converted to type `sbyte`, `byte`, `short`, `ushort`, `uint`, or `ulong`, provided the value of the *constant_expression* is within the range of the destination type." | cited |
| Q3-10 | The compiler has a warning for a comparison with a constant that lies outside the range of the other operand's type (CS0652). | [compiler resources, CSharpResources.resx, line 1932](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/CSharpResources.resx#L1932), number at [ErrorCode.cs line 448](https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Errors/ErrorCode.cs#L448) | "Comparison to integral constant is useless; the constant is outside the range of type '{0}'" | cited |
| Q3-11 | Non-constant expressions are unchecked by default, unless something outside the source asks for checking. | [C# 7 standard, expressions.md §12.8.19, line 3008](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L3008) | "For non-constant expressions […] (expressions that are evaluated at run-time) that are not enclosed by any `checked` or `unchecked` operators or statements, the default overflow checking context is unchecked, unless external factors (such as compiler switches and execution environment configuration) call for checked evaluation." | cited |
| Q3-12 | The outside factor in this toolchain is the compiler option `CheckForOverflowUnderflow`, which is off by default. | [learn: compiler options for language features](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-options/language) | "The default value for this option is `false`, which means overflow checking is disabled." | cited |
| Q3-13 | Constant expressions are checked by default, and an overflow in one is a compile-time error. | [C# 7 standard, expressions.md §12.8.19, line 3010](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L3010) | "For constant expressions […] (expressions that can be fully evaluated at compile-time), the default overflow checking context is always checked. Unless a constant expression is explicitly placed in an `unchecked` context, overflows that occur during the compile-time evaluation of the expression always cause compile-time errors." | cited |
| Q3-14 | The overflow context affects `++`, `--`, unary minus, binary `+`, `-`, `*`, `/` and explicit numeric conversions. It does not appear in the list for comparisons. | [C# 7 standard, expressions.md §12.8.19, lines 2996-3001](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L2996-L3001) | "The following operations are affected by the overflow checking context established by the checked and unchecked operators and statements:" | cited |
| Q3-15 | In a checked context an overflow at run time throws, and in an unchecked context the result wraps. | [C# 7 standard, expressions.md §12.8.19, lines 3005-3006](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L3005-L3006) | "Otherwise, when the operation is performed at run-time, a `System.OverflowException` is thrown." and "In an `unchecked` context, the result is truncated by discarding any high-order bits that do not fit in the destination type." | cited |
| Q3-16 | An unchecked cast to a smaller integer type drops the high bits. | [C# 7 standard, conversions.md §10.3.2, lines 404-406](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/conversions.md?plain=1#L404-L406) | "If the source type is larger than the destination type, then the source value is truncated by discarding its “extra” most significant bits. The result is then treated as a value of the destination type." | cited |
| Q3-17 | Integer division by zero throws in every context. | [C# 7 standard, expressions.md §12.10.3, line 3642](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L3642) | "If the value of the right operand is zero, a `System.DivideByZeroException` is thrown." | cited |
| Q3-18 | Dividing the smallest `int` or `long` by −1 overflows, and in an unchecked context the standard leaves the result to the implementation. | [C# 7 standard, expressions.md §12.10.3, line 3646](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L3646) | "In an `unchecked` context, it is implementation-defined as to whether a `System.ArithmeticException` (or a subclass thereof) is thrown or the overflow goes unreported with the resulting value being that of the left operand." | cited |
| Q3-19 | The remainder operator also throws for a zero divisor. | [C# 7 standard, expressions.md §12.10.4, line 3693](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L3693) | "The result of `x % y` is the value produced by `x – (x / y) * y`. If `y` is zero, a `System.DivideByZeroException` is thrown." | cited |
| Q3-20 | Every expression that meets the rules for a constant expression is evaluated by the compiler, also inside a larger non-constant expression. | [C# 7 standard, expressions.md §12.23, line 6657](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L6657) | "Whenever an expression fulfills the requirements listed above, the expression is evaluated at compile-time. This is true even if the expression is a subexpression of a larger expression that contains non-constant constructs." | cited |
| Q3-21 | Compile-time evaluation follows the run-time rules, and a run-time exception becomes a compile-time error. | [C# 7 standard, expressions.md §12.23, line 6659](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L6659) | "The compile-time evaluation of constant expressions uses the same rules as run-time evaluation of non-constant expressions, except that where run-time evaluation would have thrown an exception, compile-time evaluation causes a compile-time error to occur." | cited |
| Q3-22 | Constants can be of the integer types, `char`, the floating types, `decimal`, `bool`, any enum type, or `string` or `null`. | [C# 7 standard, expressions.md §12.23, line 6612](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L6612) | "If a constant expression is a value type, it must be one of the following types: `sbyte`, `byte`, `short`, `ushort`, `int`, `uint`, `long`, `ulong`, `char`, `float`, `double`, `decimal`, `bool,` or any enumeration type. If a constant expression is a reference type, it must be the `string` type, a default value expression […] for some reference type, or the value of the expression must be `null`." | cited |
| Q3-23 | Comparing two values of one enum type is the same as comparing their underlying integers. | [C# 7 standard, expressions.md §12.12.6, line 4182](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L4182) | "In other words, the enumeration type comparison operators simply compare the underlying integral values of the two operands." | cited |
| Q3-24 | A relational pattern needs a constant on its right side. | [language proposal, csharp-9.0/patterns3.md, line 91](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-9.0/patterns3.md?plain=1#L91) | "The expression is required to evaluate to a constant value.  It is an error if that constant value is `double.NaN` or `float.NaN`." | cited |
| Q3-25 | The proposal lists the input types of relational patterns as the numeric types and `char`, with no enum type in the list. | [language proposal, csharp-9.0/patterns3.md, line 77](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-9.0/patterns3.md?plain=1#L77) | "Specifically, we support all of these relational patterns for `sbyte`, `byte`, `short`, `ushort`, `int`, `uint`, `long`, `ulong`, `char`, `float`, `double`, `decimal`, `nint`, and `nuint`." | cited |
| Q3-26 | The published documentation says the constant of a relational pattern can also be of an enum type. | [learn: Patterns](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/patterns) | "The constant expression can be of an integer, floating-point, char, or enum type." | cited |
| Q3-27 | The proposal intends a `switch` expression over an integer to count as exhaustive when relational patterns cover the whole range. | [language proposal, csharp-9.0/patterns3.md, lines 279-284](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-9.0/patterns3.md?plain=1#L279-L284) | "A switch expression such as this should be considered *exhaustive* (it handles all possible input values)." | cited |

### Question 4: string semantics

| ID | Claim | Source | Quote | Tag |
|---|---|---|---|---|
| Q4-01 | `==` on two `string` operands compares content, not references. | [C# 7 standard, expressions.md §12.12.8, lines 4308-4310](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L4308-L4310) | "Both values are non-`null` references to string instances that have identical lengths and identical characters in each character position." and "The string equality operators compare string values rather than string references." | cited |
| Q4-02 | Two `null` strings are equal under `==`. | [C# 7 standard, expressions.md §12.12.8, lines 4305-4307](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/expressions.md?plain=1#L4305-L4307) | "Two `string` values are considered equal when one of the following is true:" and "Both values are `null`." | cited |
| Q4-03 | The library operator behind `==` performs an ordinal comparison. | [learn: String.Equality operator](https://learn.microsoft.com/en-us/dotnet/api/system.string.op_equality) | "The operator, in turn, calls the static `Equals(String, String)` method, which performs an ordinal (case-sensitive and culture-insensitive) comparison." | cited |
| Q4-04 | In the installed runtime's source, `==` calls `Equals(a, b)`, which returns `true` for the same reference, `false` when one side is `null` or the lengths differ, and otherwise compares the characters. | [runtime source, String.Comparison.cs, lines 670-683 and 726](https://github.com/dotnet/dotnet/blob/e2f47b0110ed922f21a1522da67279133ce28f32/src/runtime/src/libraries/System.Private.CoreLib/src/System/String.Comparison.cs#L670-L683) | "public static bool operator ==(string? a, string? b) => Equals(a, b);" | cited |
| Q4-05 | A `switch` statement on a string matches case labels exactly and with case sensitivity. | [C# 7 standard, statements.md §13.8.3, line 933](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/statements.md?plain=1#L933) | "Like the string equality operators […], the `switch` statement is case sensitive and will execute a given switch section only if the switch expression string exactly matches a `case` label constant." | cited |
| Q4-06 | `null` is allowed as a case label when the switch is on a string. | [C# 7 standard, statements.md §13.8.3, line 934](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/statements.md?plain=1#L934) | "When the governing type of a `switch` statement is `string` or a nullable value type, the value `null` is permitted as a `case` label constant." | cited |
| Q4-07 | A constant pattern on a non-integer input, such as a string, matches through `object.Equals`. | [C# 7 standard, patterns.md §11.2.3, lines 101-102](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/patterns.md?plain=1#L101-L102) | "the pattern `P` *matches* the value *e* if `object.Equals(e, v)` returns `true`." | cited |
| Q4-08 | `String.Equals(Object)`, `String.Equals(String)` and the static `String.Equals(String, String)` are ordinal. | [learn: String.Equals](https://learn.microsoft.com/en-us/dotnet/api/system.string.equals) | "This method performs an ordinal (case-sensitive and culture-insensitive) comparison." | cited |
| Q4-09 | The static `String.Equals(String, String)` returns `true` for two `null` arguments. | [learn: String.Equals](https://learn.microsoft.com/en-us/dotnet/api/system.string.equals) | "If both `a` and `b` are `null`, the method returns `true`." | cited |
| Q4-10 | The overloads with a `StringComparison` argument let the caller choose culture, case and sort rules. | [learn: String.Equals](https://learn.microsoft.com/en-us/dotnet/api/system.string.equals) | "A parameter specifies the culture, case, and sort rules used in the comparison." | cited |
| Q4-11 | `StringComparison.Ordinal` and `StringComparison.OrdinalIgnoreCase` are the two options that do not use culture-sensitive sort rules. The enum has four more members, for the current culture and the invariant culture, each with and without case. | [learn: StringComparison](https://learn.microsoft.com/en-us/dotnet/api/system.stringcomparison) | "Compare strings using ordinal (binary) sort rules." and "Compare strings using ordinal (binary) sort rules and ignoring the case of the strings being compared." | cited |
| Q4-12 | A comparison with a current-culture option depends on the culture of the running thread. | [learn: Best practices for comparing strings](https://learn.microsoft.com/en-us/dotnet/standard/base-types/best-practices-strings) | "Comparisons that are based on the current culture use the thread's current culture or locale." | cited |
| Q4-13 | Ordinal comparison does not depend on the culture. | [learn: Best practices for comparing strings](https://learn.microsoft.com/en-us/dotnet/standard/base-types/best-practices-strings) | "Ordinal search and comparison routines are never affected by the current thread's culture setting." | cited |
| Q4-14 | `OrdinalIgnoreCase` uses the invariant culture's casing tables outside ASCII, and its results can change with new Unicode data. | [learn: Best practices for comparing strings](https://learn.microsoft.com/en-us/dotnet/standard/base-types/best-practices-strings) | "Casing outside the ASCII range uses the invariant culture's tables." and "However, the *OrdinalIgnoreCase* comparer's behavior may change as Unicode grows to encompass more character sets and corrects omissions in existing casing data." | cited |
| Q4-15 | Calling an instance method such as `s.Equals(x)` on a `null` string throws. | [learn: String class](https://learn.microsoft.com/en-us/dotnet/api/system.string) | "A string that has been declared but has not been assigned a value is `null`. Attempting to call methods on that string throws a `NullReferenceException`." | cited |
| Q4-16 | A constant of a reference type can only be a string or `null`. | [learn: const keyword](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/const) | "Therefore, the only possible values for constants of reference types are strings and a null reference." | cited |
| Q4-17 | The nullable annotation on a `string` parameter does not stop `null` from arriving at run time. | Same source as row Q5-16 | see row Q5-16 | cited |

### Question 5: records as inputs

| ID | Claim | Source | Quote | Tag |
|---|---|---|---|---|
| Q5-01 | A positional record has a public constructor with one parameter per positional parameter. | [language proposal, csharp-9.0/records.md, lines 355-358](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-9.0/records.md?plain=1#L355-L358) | "A record type has a public constructor whose signature corresponds to the value parameters of the type declaration." | cited |
| Q5-02 | The published documentation lists the same constructor among the members the compiler creates. | [learn: Records](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record) | "A primary constructor whose parameters match the positional parameters on the record declaration." | cited |
| Q5-03 | Positional properties are init-only in a record class and in a readonly record struct, and read-write in a plain record struct. | [learn: Records](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record) | "Positional properties are *immutable* in a `record class` and a `readonly record struct`. They're *mutable* in a `record struct`." | cited |
| Q5-04 | Two records are equal when they have the same type and equal stored values. | [learn: Records](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record) | "For types with the `record` modifier (`record class`, `record struct`, and `readonly record struct`), two objects are equal if they are of the same type and store the same values." | cited |
| Q5-05 | Record class equality compares each instance field with the default equality comparer of the field type, and also compares the run-time record type. | [language proposal, csharp-9.0/records.md, lines 78-83](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-9.0/records.md?plain=1#L78-L83) | "For each instance field `fieldN` in the record type that is not inherited, the value of `System.Collections.Generic.EqualityComparer<TN>.Default.Equals(fieldN, other.fieldN)` where `TN` is the field type, and" | cited |
| Q5-06 | Record struct equality compares each instance field in the same way. | [language proposal, csharp-10.0/record-structs.md, lines 69-70](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-10.0/record-structs.md?plain=1#L69-L70) | "The synthesized `Equals(R)` returns `true` if and only if for each instance field `fieldN` in the record struct the value of `System.Collections.Generic.EqualityComparer<TN>.Default.Equals(fieldN, other.fieldN)` where `TN` is the field type is `true`." | cited |
| Q5-07 | A record class also gets a copy constructor, which is protected, or private when the record is sealed. | [language proposal, csharp-9.0/records.md, lines 203-209](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-9.0/records.md?plain=1#L203-L209) | "If the record is sealed, the constructor will be private, otherwise it will be protected." | cited |
| Q5-08 | A positional record struct also has a parameterless constructor that gives every field its default value. | [learn: Records](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record) | "For record struct types, a parameterless constructor that sets each field to its default value." | cited |
| Q5-09 | `default` of a struct type, and a new array of a struct type, do not run any constructor. | [learn: Structure types](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct) | "As the preceding example shows, the default value expression ignores a parameterless constructor and produces the default value of the structure type. Structure-type array instantiation also ignores a parameterless constructor and produces an array populated with the default values of a structure type." | cited |
| Q5-10 | The default value of a struct has every value-type field at its own default and every reference-type field `null`. | [C# 7 standard, types.md §8.3.3, line 226](https://github.com/dotnet/csharpstandard/blob/02d1a90122ece425cff575f47f197fb396be73d4/standard/types.md?plain=1#L226) | "For a *struct_type*, the default value is the value produced by setting all value type fields to their default value and all reference type fields to `null`." | cited |
| Q5-11 | A `required` member must be set by the code that creates the object, and it may be set to `null`. | [learn: required modifier](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/required) | "You must initialize required members, but you can initialize them to `null`." and "The compiler issues an error if the member isn't initialized at all." | cited |
| Q5-12 | `required` cannot be written on a positional parameter of a record. | [learn: required modifier](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/required) | "You can't use the `required` modifier on the declaration for positional parameters on a record." | cited |
| Q5-13 | `required` is not enforced for a struct created with `default`. | [language proposal, csharp-11.0/required-members.md, line 165](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-11.0/required-members.md?plain=1#L165) | "Required members are not enforced on instances of `struct` types created with `default` or `default(StructType)`." | cited |
| Q5-14 | The design notes for `required` say that reflection can get around it, and around read-only fields and init-only properties. | [language proposal, csharp-11.0/required-members.md, lines 495-498](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-11.0/required-members.md?plain=1#L495-L498) | "It is certainly possible to trick the system, via `Activator.CreateInstance(typeof(C))` or similar, which means we may not be able to fully guarantee all properties are always set." | cited |
| Q5-15 | The design notes for `init` say that it does not protect against reflection. | [language proposal, csharp-9.0/init.md, lines 336-341](https://github.com/dotnet/csharplang/blob/68b7855d1189437a6ca4e6ee948f70c5afb7833c/proposals/csharp-9.0/init.md?plain=1#L336-L341) | "It will not protect against the following circumstances:" and "1. Reflection over `public` members" | cited |
| Q5-16 | A nullable annotation on a reference type has no effect at run time. | [learn: Nullable reference types](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/nullable-reference-types) | "There's no runtime difference between a non-nullable reference type and a nullable reference type. The compiler doesn't add any runtime checking for non-nullable reference types." | cited |
| Q5-17 | `Activator.CreateInstance(Type, Object[])` calls the constructor that best matches the given arguments. | [learn: Activator.CreateInstance](https://learn.microsoft.com/en-us/dotnet/api/system.activator.createinstance) | "Creates an instance of the specified type using the constructor that best matches the specified parameters." | cited |
| Q5-18 | `ConstructorInfo.Invoke(Object[])` calls one chosen constructor, and reports an exception from the constructor as a `TargetInvocationException`. | [learn: ConstructorInfo.Invoke](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.constructorinfo.invoke) | "Invokes the constructor reflected by the instance that has the specified parameters, providing default values for the parameters not commonly used." and, for `TargetInvocationException`, "The invoked constructor throws an exception." | cited |
| Q5-19 | `MethodBase.Invoke`, which the backend uses to call a method under check, also reports an exception from the method as a `TargetInvocationException`. | [learn: MethodBase.Invoke](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.methodbase.invoke) | "The invoked method or constructor throws an exception." | cited |
| Q5-20 | `RuntimeHelpers.GetUninitializedObject` returns an instance that was not initialized. The page read does not say in words that no constructor runs. | [learn: RuntimeHelpers.GetUninitializedObject](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.compilerservices.runtimehelpers.getuninitializedobject) | "Returns an uninitialized instance of the system-provided type." | cited |
| Q5-21 | When a positional record has an explicit property with `required`, the primary constructor is marked as setting all required members, and that attribute switches the compiler check off. | [learn: required modifier](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/required) | "If any of those properties include the `required` modifier, the primary constructor adds the `SetsRequiredMembers` attribute." and "The `SetsRequiredMembers` attribute disables the compiler's checks that all `required` members are initialized when an object is created." | cited |

### Question 6: solver or no solver

| ID | Claim | Source | Quote | Tag |
|---|---|---|---|---|
| Q6-01 | The package id on nuget.org is `Microsoft.Z3`, and the newest version listed there is 4.12.2. | [nuget.org version list for microsoft.z3](https://api.nuget.org/v3-flatcontainer/microsoft.z3/index.json) | "`"4.11.2","4.12.0","4.12.2"]}`" | cited |
| Q6-02 | Version 4.12.2 was published on 2023-05-12. | [nuget.org registration for microsoft.z3](https://api.nuget.org/v3/registration5-gz-semver2/microsoft.z3/index.json) | "`"published":"2023-05-12T21:32:33.023+00:00"`" | cited |
| Q6-03 | The 4.12.2 package states the MIT licence, the author Microsoft, the project URL of the Z3 repository, and one target, .NET Standard 2.0. | [nuspec of Microsoft.Z3 4.12.2](https://api.nuget.org/v3-flatcontainer/microsoft.z3/4.12.2/microsoft.z3.nuspec) | "`<license type="expression">MIT</license>`" and "`<group targetFramework=".NETStandard2.0" />`" | cited |
| Q6-04 | The 4.12.2 package file contains native libraries for two platforms only: Windows x64 and macOS x64. | [package file Microsoft.Z3 4.12.2](https://api.nuget.org/v3-flatcontainer/microsoft.z3/4.12.2/microsoft.z3.4.12.2.nupkg), entry list read without unpacking | "runtimes/win-x64/native/libz3.dll" and "runtimes/osx-x64/native/libz3.dylib" | cited |
| Q6-05 | The description of the same package names a Linux dependency, although the package file has no Linux library. | [nuspec of Microsoft.Z3 4.12.2](https://api.nuget.org/v3-flatcontainer/microsoft.z3/4.12.2/microsoft.z3.nuspec) | "Linux Dependencies: libgomp.so.1 installed" | cited |
| Q6-06 | The 4.12.2 package has a build file that copies the Windows x64 native library to the output folder. | `build/Microsoft.Z3.targets` inside the [package file Microsoft.Z3 4.12.2](https://api.nuget.org/v3-flatcontainer/microsoft.z3/4.12.2/microsoft.z3.4.12.2.nupkg) | "`<None Include="$(MSBuildThisFileDirectory)..\runtimes\win-x64\native\libz3.dll">`" | cited |
| Q6-07 | The newest release in the Z3 repository is `z3-5.4.1`, published on 2026-11-11, and it has the assets `Microsoft.Z3.5.4.1.nupkg` and `Microsoft.Z3.x86.5.4.1.nupkg`. | [GitHub API, releases of Z3Prover/z3](https://api.github.com/repos/Z3Prover/z3/releases?per_page=5); the same release is at [github.com/Z3Prover/z3/releases/tag/z3-5.4.1](https://github.com/Z3Prover/z3/releases/tag/z3-5.4.1) | "`"tag_name": "z3-5.4.1"`" and "`"published_at": "2026-11-11T03:40:49Z"`" | cited |
| Q6-08 | The 5.4.1 package file from that release contains native libraries for six platforms, one managed assembly for .NET Standard 2.0, and the MIT licence in its nuspec. | [release asset Microsoft.Z3.5.4.1.nupkg](https://github.com/Z3Prover/z3/releases/download/z3-5.4.1/Microsoft.Z3.5.4.1.nupkg), entry list and nuspec read without unpacking the rest | "runtimes/linux-arm64/native/libz3.so", "runtimes/linux-x64/native/libz3.so", "runtimes/osx-arm64/native/libz3.dylib", "runtimes/osx-x64/native/libz3.dylib", "runtimes/win-arm64/native/libz3.dll", "runtimes/win-x64/native/libz3.dll" | cited |
| Q6-09 | The 4.12.2 package from nuget.org has a signature entry, and the 5.4.1 release asset has none. | Entry lists of the two package files in Q6-04 and Q6-08 | ".signature.p7s" appears in the first list and not in the second | cited |
| Q6-10 | The Z3 readme sends .NET users to nuget.org for the latest release, which does not match Q6-01 and Q6-07 on the day of reading. | [Z3 README.md, lines 131-137](https://github.com/Z3Prover/z3/blob/9e450b2e08d89aa4f2746188f578281e631bfe6a/README.md?plain=1#L131-L137) | "You can install a NuGet package for the latest release Z3 from [nuget.org](https://www.nuget.org/packages/Microsoft.Z3/)." | cited |
| Q6-11 | Z3 is under the MIT licence. | [Z3 LICENSE.txt](https://github.com/Z3Prover/z3/blob/9e450b2e08d89aa4f2746188f578281e631bfe6a/LICENSE.txt) | "MIT License" | cited |
| Q6-12 | The packaging script of the repository maps build outputs to the runtime identifiers `win-x64`, `win-x86`, `win-arm64`, `linux-x64`, `linux-arm64`, `osx-x64` and `osx-arm64`. | [Z3 scripts/mk_nuget_task.py, lines 24-35](https://github.com/Z3Prover/z3/blob/9e450b2e08d89aa4f2746188f578281e631bfe6a/scripts/mk_nuget_task.py#L24-L35) | "'arm64-win' : ('dll', 'win-arm64')," | cited |
| Q6-13 | The 32-bit Windows build is a separate package, `Microsoft.Z3.x86`, also at 4.12.2 on nuget.org. | [nuget.org version list for microsoft.z3.x86](https://api.nuget.org/v3-flatcontainer/microsoft.z3.x86/index.json) | "`"4.12.0","4.12.2"]}`" | cited |
| Q6-14 | The .NET API documentation is linked from the readme and is a generated reference page for the namespace `Microsoft.Z3`. | [Z3 README.md, line 240](https://github.com/Z3Prover/z3/blob/9e450b2e08d89aa4f2746188f578281e631bfe6a/README.md?plain=1#L240) and [the linked page](https://z3prover.github.io/api/html/namespace_microsoft_1_1_z3.html) | "* [.NET API](https://z3prover.github.io/api/html/namespace_microsoft_1_1_z3.html)" and the page title "Z3: Microsoft.Z3 Namespace Reference" | cited |
| Q6-15 | The package also carries the API documentation as an XML file next to the assembly. | Entry lists of the two package files in Q6-04 and Q6-08 | "lib/netstandard2.0/Microsoft.Z3.xml" | cited |
| Q6-16 | Alternative without bindings: Z3 reads SMT-LIB 2 text, and the two newest releases have stand-alone builds among their assets, for example `z3-5.4.1-x64-win.zip`. | [Z3 README.md, line 236](https://github.com/Z3Prover/z3/blob/9e450b2e08d89aa4f2746188f578281e631bfe6a/README.md?plain=1#L236) and the asset list in Q6-07 | "* Default input format is [SMTLIB2](http://smtlib.cs.uiowa.edu)" | cited |
| Q6-17 | Alternative on nuget.org: `Google.OrTools` 9.15.6755, Apache-2.0, a wrapper that depends on one native runtime package per platform. | [nuspec of Google.OrTools 9.15.6755](https://api.nuget.org/v3-flatcontainer/google.ortools/9.15.6755/google.ortools.nuspec) | "`<license type="expression">Apache-2.0</license>`" and "`<dependency id="Google.OrTools.runtime.win-x64" version="9.15.6755" exclude="Build,Analyzers" />`" | cited |
| Q6-18 | Alternative on nuget.org: `NanoByte.SatSolver` 0.5.1, MIT, a Boolean satisfiability solver whose nuspec names no native runtime package among its dependencies. | [nuspec of NanoByte.SatSolver 0.5.1](https://api.nuget.org/v3-flatcontainer/nanobyte.satsolver/0.5.1/nanobyte.satsolver.nuspec) | "`<description>CDCL Boolean Satisfiability Solver</description>`" | cited |
| Q6-19 | Alternative on nuget.org: `ZenLib` 3.1.6, a verification library that itself depends on `Microsoft.Z3` 4.11.0. | [nuspec of ZenLib 3.1.6](https://api.nuget.org/v3-flatcontainer/zenlib/3.1.6/zenlib.nuspec) | "`<dependency id="Microsoft.Z3" version="4.11.0" exclude="Build,Analyzers" />`" | cited |
| Q6-20 | A search of nuget.org for "smt solver" returned 13 packages, and the two owned by the accounts `Microsoft` and `Z3Prover` are `Microsoft.Z3` and `Microsoft.Z3.x86`. | [nuget.org search API, query "smt solver"](https://azuresearch-usnc.nuget.org/query?q=smt+solver&take=8&prerelease=false) | "`"totalHits":13`" | cited |
| Q6-21 | Alternative with no solver: the compiler already decides exhaustiveness of a `switch` expression and exposes the result, but not the value sets behind it. | Rows Q2-14, Q2-15 and Q2-23 | see those rows | cited |
| Q6-22 | Alternative with no solver: enumerate every input when the domain is small, as the backend does today for `bool` parameters. | Backend source `scripts/dotnet/Program.cs`, lines 126 and 136-137 | "var count = 1 << parameters.Length;" | cited |

## (c) Could not be established

Each item names what was looked at, so that a failed search is not read as proof of absence.

1. **A compatibility guarantee for the compiler APIs (row Q2-26).**
   The files read were `docs/contributing/API Review Process.md` in full (46 lines), the first 40 lines of `docs/Breaking API Changes.md`, and the remarks on `IOperation`.
   A text search for "Experimental" in the six source files behind rows Q2-06 to Q2-14 found three matches, two on collection-expression operations and one on an unrelated member of `SemanticModel`, and none on a member named in rows Q2-06 to Q2-22.
   No page on learn.microsoft.com about API compatibility of the compiler packages was searched for.
2. **Whether taking the compiler assemblies from the SDK folder is a supported arrangement (row Q2-02).**
   No source was searched for this.
3. **That the compiler source read is the source of the installed assembly.**
   The link rests on the commit hash inside the assembly's version string and on the file `src/source-manifest.json` at that commit, which maps `src/roslyn` to `dotnet/roslyn` commit `58334908`.
   Nothing was built or compared at the binary level.
4. **The run-time type of the object that `IFieldSymbol.ConstantValue` returns for an enum member.**
   The comment read says only "Gets the constant value of this field".
   Experiment E6 prints it.
5. **Whether a relational pattern accepts an enum input.**
   The proposal lists no enum type (row Q3-25) and the published documentation allows an enum constant (row Q3-26).
   The standard clause that the documentation links to, "Relational pattern", was not opened.
   Experiment E6 compiles one.
6. **Whether a `switch` statement that covers every named member, has no `default`, and sits in a method that must return a value is rejected with CS0161.**
   This follows from rows Q1-21 and Q1-22 only as an inference, and both rows come from the C# 7 text.
   The C# 8 draft defines exhaustiveness in general words ("A set of patterns is exhaustive if, for every possible input value, some pattern in the set is applicable.").
   Experiment E6 compiles one.
7. **That `[Flags]` has no effect on the compiler's exhaustiveness check.**
   A text search for "flags", ignoring case, found no match in `SwitchExpressionBinder.cs` and `PatternExplainer.cs` at the SDK commit.
   In `DecisionDagBuilder.cs` at the same commit it found one match, in a comment that uses the word for internal status bits and not for the attribute.
   Other compiler files were not searched.
   This is a search that found nothing, not a statement that was read.
8. **Reflection details that the pages read do not state.**
   Whether `MethodBase.Invoke` accepts a boxed `int` for an enum parameter.
   Whether the best-match rule of `Activator.CreateInstance` can pick the non-public copy constructor of a record.
   Whether `RuntimeHelpers.GetUninitializedObject` runs no constructor (row Q5-20).
   What an object created by `Activator.CreateInstance` holds in a `required` member.
   Experiments E2 and E5 cover these.
9. **What dividing the smallest `int` by −1 does on the installed runtime (row Q3-18).**
   Experiment E3 covers it.
10. **How current-culture and invariant-culture comparison behave on the installed runtime.**
    The globalization mode of the runtime (ICU or NLS) was not read.
    No claim in this file depends on it, because rows Q4-12 to Q4-14 only say which options are culture-dependent.
11. **That `EqualityComparer<string>.Default`, which record equality uses for a string field (rows Q5-05 and Q5-06), is ordinal.**
    No page for `EqualityComparer<T>.Default` was opened.
12. **Why nuget.org has no `Microsoft.Z3` version after 4.12.2, and whether the package attached to the repository release is meant to be used directly.**
    The repository's issues and release notes were not searched.
13. **Whether `Microsoft.Z3` 4.12.2 loads and works on .NET 10 on Windows x64.**
    Experiment E7 covers it.
14. **Which Z3 version the online .NET API reference describes.**
    Only the page title was read.
15. **Standard text for C# 9 to C# 14.**
    The standard repository has branches named `draft-v9` to `draft-v14`.
    Only the headings of `patterns.md` on `draft-v9` were read, and they list no relational, `and`, `or` or `not` pattern.
    Every statement from the C# 7 and C# 8 texts may have been reworded later.
16. **The compiled form of a `switch` on a string in C# 14.**
    Rows Q4-05 to Q4-07 give the specified behaviour, and no compiler lowering code for strings was read.
17. **Types outside the four questions.**
    `char`, `nint`, `nuint`, the floating-point types, `decimal`, nullable value types and tuples were not researched.
18. **Whether SDK 10.0.400 accepts every command form used in section (d).**
    The documentation page for single-file apps describes the current SDK, and one directive on it is marked "available in .NET 11 and .NET SDK 10.0.300 and later".

Coverage of the reading:

- Read in full: the backend source, its project file, `shapes.md`, `evidence.md`, and clause 19 (Enums) of the C# 7 standard.
- Read in part: every other standard clause, proposal and documentation page, where the subclause or section around each quote was read.
- Compiler source read as code: `SwitchExpressionBinder.cs` lines 20-125, `PatternExplainer.cs` lines 800-860, `ControlFlowGraphBuilder.cs` lines 7759-7850, `CSharpOperationFactory.cs` lines 2770-2793, and the constructor signature of `CSharpCompilationOptions`.
- Some of these regions were first read at `dotnet/roslyn` commit `10e172fe`, and each region or quoted line was then compared with the SDK commit and found equal.
- Compiler source reached only by text search: `ErrorFacts.cs`, `ErrorCode.cs`, `CSharpResources.resx`, `OperationInterfaces.xml`, `PublicAPI.Shipped.txt`.
- Two pages were first read through a summarising fetch tool (the nuget.org gallery page of `Microsoft.Z3` and the Z3 API reference), and every fact kept from them was read again from the nuget.org API or from the page source.

## (d) Proposed experiments

None of these was run.
Each one names the rows it would confirm or refute.
The lines under "Expected if the claims hold" are predictions, not results.

### Setup

Use a new, empty folder that is not inside any project tree, because build files in parent folders apply to single-file apps.
The machine has an SDK 11.0 release candidate next to SDK 10.0.400, so the folder needs a `global.json` that pins the SDK.

```json
{
  "sdk": { "version": "10.0.400", "rollForward": "latestPatch", "allowPrerelease": false }
}
```

Check the pin first: `dotnet --version`

### E1: run-time values of an enum (rows Q1-01, Q1-06, Q1-09, Q1-12, Q1-14, Q1-15, Q1-17 to Q1-20, Q1-23, Q1-24)

File `E1.cs`:

```csharp
#:property PublishAot=false
#:property Nullable=disable
using System;

Colour undefined = (Colour)7;
Colour zero = default;
Access both = Access.Read | Access.Write;
Small wrapped = unchecked((Small)258);
object boxed = Enum.ToObject(typeof(Colour), 7);
string shades = string.Join(",", Enum.GetValues<Shade>());
Console.WriteLine($"cast 7: text={undefined} defined={Enum.IsDefined(typeof(Colour), undefined)}");
Console.WriteLine($"default: raw={(int)zero} defined={Enum.IsDefined(typeof(Colour), zero)}");
Console.WriteLine($"flags: text={both} raw={(int)both} defined={Enum.IsDefined(typeof(Access), both)}");
Console.WriteLine($"ToObject 7: type={boxed.GetType()} text={boxed}");
Console.WriteLine($"GetValues with a shared value: {shades}");
Console.WriteLine($"unchecked cast of 258 to a byte enum: raw={(int)wrapped}");
Console.WriteLine($"switch statement on 7: {Statement(undefined)}");
try { Console.WriteLine(Expression(undefined)); }
catch (Exception e) { Console.WriteLine($"switch expression on 7 threw {e.GetType().FullName}"); }

static string Statement(Colour c)
{
    switch (c)
    {
        case Colour.Red: return "red";
        case Colour.Green: return "green";
    }
    return "no case matched";
}

static string Expression(Colour c) => c switch { Colour.Red => "red", Colour.Green => "green" };

enum Colour { Red = 1, Green = 2 }
enum Shade { Light = 1, Pale = 1, Dark = 2 }
enum Small : byte { One = 1 }
[Flags] enum Access { None = 0, Read = 1, Write = 2 }
```

Command: `dotnet run --file E1.cs`

Expected if the claims hold: `defined=False` on the first three lines, three entries for `GetValues`, `raw=2` for the wrapped cast, `no case matched`, and `System.Runtime.CompilerServices.SwitchExpressionException`.
The build is also expected to print warning CS8524 for `Expression`.

### E2: calling a method with an enum parameter through reflection (rows Q1-17, Q5-19, item 8 of section (c))

File `E2.cs`:

```csharp
#:property PublishAot=false
#:property Nullable=disable
using System;
using System.Reflection;

MethodInfo method = typeof(Decisions).GetMethod("Describe");
object[] named = { Enum.ToObject(typeof(Level), 2) };
object[] rawInt = { 2 };
object[] unnamed = { Enum.ToObject(typeof(Level), 9) };
Console.WriteLine($"boxed enum argument: {method.Invoke(null, named)}");
try { Console.WriteLine($"boxed int argument: {method.Invoke(null, rawInt)}"); }
catch (Exception e) { Console.WriteLine($"boxed int argument threw {e.GetType().FullName}"); }
try { method.Invoke(null, unnamed); }
catch (Exception e) { Console.WriteLine($"unnamed value: {e.GetType().FullName} wrapping {e.InnerException?.GetType().FullName}"); }

enum Level { Low = 1, High = 2 }

static class Decisions
{
    public static string Describe(Level level) => level switch { Level.Low => "low", Level.High => "high" };
}
```

Command: `dotnet run --file E2.cs`

Expected if the claims hold: `high` for the boxed enum argument, and `System.Reflection.TargetInvocationException wrapping System.Runtime.CompilerServices.SwitchExpressionException` for the unnamed value.
The result for the boxed `int` argument is not predicted.

### E3: integer promotion, literal types, overflow and division (rows Q3-02, Q3-03, Q3-06 to Q3-08, Q3-10 to Q3-12, Q3-15 to Q3-19)

File `E3.cs`:

```csharp
#:property PublishAot=false
#:property CheckForOverflowUnderflow=false
using System;

int i = -1;
uint u = 1;
byte b = 200;
long big = 4_000_000_000;
int max = int.MaxValue;
int min = int.MinValue;
int minusOne = -1;
int zero = 0;
Console.WriteLine($"-1 < 1u: {i < u}");
Console.WriteLine($"type of int + uint: {(i + u).GetType()}");
Console.WriteLine($"type of byte + byte: {(b + b).GetType()}");
Console.WriteLine($"type of 2147483648: {(2147483648).GetType()}");
Console.WriteLine($"type of -2147483648: {(-2147483648).GetType()}");
Console.WriteLine($"type of 4294967296: {(4294967296).GetType()}");
Console.WriteLine($"type of -(1u): {(-u).GetType()}");
Console.WriteLine($"default context, max + 1: {max + 1}");
try { Console.WriteLine(checked(max + 1)); }
catch (Exception e) { Console.WriteLine($"checked max + 1 threw {e.GetType().Name}"); }
Console.WriteLine($"unchecked (int)4000000000: {unchecked((int)big)}");
try { Console.WriteLine(checked((int)big)); }
catch (Exception e) { Console.WriteLine($"checked (int)4000000000 threw {e.GetType().Name}"); }
try { Console.WriteLine($"min / -1: {min / minusOne}"); }
catch (Exception e) { Console.WriteLine($"min / -1 threw {e.GetType().Name}"); }
try { Console.WriteLine($"1 / 0: {1 / zero}"); }
catch (Exception e) { Console.WriteLine($"1 / 0 threw {e.GetType().Name}"); }
try { Console.WriteLine($"1 % 0: {1 % zero}"); }
catch (Exception e) { Console.WriteLine($"1 % 0 threw {e.GetType().Name}"); }
Console.WriteLine($"-7 / 2 = {-7 / 2} and -7 % 2 = {-7 % 2}");
Console.WriteLine($"byte 200 == 300: {b == 300}");
```

Command: `dotnet run --file E3.cs`

Expected if the claims hold: `True`, `System.Int64`, `System.Int32`, `System.UInt32`, `System.Int32`, `System.Int64`, `System.Int64`, `-2147483648`, `OverflowException`, `-294967296`, `OverflowException`, `DivideByZeroException` twice, `-3` and `-1`, and `False`.
The build is expected to print warning CS0652 for the last line.
The result of `min / -1` is not predicted.

### E4: string comparison (rows Q4-01 to Q4-09, Q4-12, Q4-13, Q4-15)

File `E4.cs`:

```csharp
#:property PublishAot=false
#:property Nullable=disable
#:property InvariantGlobalization=false
using System;
using System.Globalization;

string literal = "file";
string built = new string(new[] { 'f', 'i', 'l', 'e' });
string nothing = null;
bool patternOnNull = nothing is "file";
bool patternOnBuilt = built is "file";
Console.WriteLine($"equal content with ==: {literal == built}");
Console.WriteLine($"same reference: {ReferenceEquals(literal, built)}");
Console.WriteLine($"null == null: {nothing == null}");
Console.WriteLine($"null == literal: {nothing == literal}");
Console.WriteLine($"static Equals(null, null): {string.Equals(nothing, nothing)}");
Console.WriteLine($"literal.Equals(null): {literal.Equals(nothing)}");
try { Console.WriteLine(nothing.Equals(literal)); }
catch (Exception e) { Console.WriteLine($"null.Equals(literal) threw {e.GetType().Name}"); }
Console.WriteLine($"constant pattern on null: {patternOnNull}, on built string: {patternOnBuilt}");
Console.WriteLine($"switch: null -> {Classify(nothing)}, FILE -> {Classify(literal.ToUpperInvariant())}, built -> {Classify(built)}");
CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
string upper = "FILE";
Console.WriteLine($"tr-TR, CurrentCultureIgnoreCase: {string.Equals(literal, upper, StringComparison.CurrentCultureIgnoreCase)}");
Console.WriteLine($"tr-TR, OrdinalIgnoreCase: {string.Equals(literal, upper, StringComparison.OrdinalIgnoreCase)}");
Console.WriteLine($"tr-TR, ==: {literal == upper}");

static string Classify(string s)
{
    switch (s)
    {
        case null: return "null case";
        case "file": return "file case";
        default: return "default case";
    }
}
```

Command: `dotnet run --file E4.cs`

Expected if the claims hold: `True`, `False`, `True`, `False`, `True`, `False`, `NullReferenceException`, `False` and `True` for the patterns, `null case`, `default case` and `file case` for the switch, then `False`, `True`, `False` under the Turkish culture.

### E5: building records by reflection and by default (rows Q5-01, Q5-03, Q5-07 to Q5-10, Q5-14, Q5-16 to Q5-18, Q5-20, item 8 of section (c))

File `E5.cs`:

```csharp
#:property PublishAot=false
#:property Nullable=enable
using System;
using System.Reflection;
using System.Runtime.CompilerServices;

Type type = typeof(Request);
foreach (ConstructorInfo found in type.GetConstructors(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance))
    Console.WriteLine($"constructor: public={found.IsPublic} {found}");
ConstructorInfo primary = type.GetConstructor(new[] { typeof(Level), typeof(bool), typeof(string) })!;
object?[] hostile = { (Level)9, true, null };
object viaInvoke = primary.Invoke(hostile);
object viaActivator = Activator.CreateInstance(type, Level.High, true, "a")!;
object uninitialized = RuntimeHelpers.GetUninitializedObject(type);
Console.WriteLine($"Invoke with an unnamed enum value and a null string: {viaInvoke}");
Console.WriteLine($"value equality with a normally built record: {viaActivator.Equals(new Request(Level.High, true, "a"))}");
Console.WriteLine($"uninitialized object: {uninitialized}");
Cell cell = default;
bool sameAsZero = cell == new Cell((Level)0, false);
Console.WriteLine($"default record struct: {cell}, equal to Cell((Level)0, false): {sameAsZero}");
Console.WriteLine($"Activator on the record struct with no arguments: {Activator.CreateInstance(typeof(Cell))}");
Needy needy = (Needy)Activator.CreateInstance(typeof(Needy))!;
Console.WriteLine($"required member after Activator is null: {needy.Name is null}");

enum Level { Low = 1, High = 2 }
record Request(Level Level, bool Urgent, string Tag);
readonly record struct Cell(Level Level, bool Flag);
record Needy { public required string Name { get; init; } }
```

Command: `dotnet run --file E5.cs`

Expected if the claims hold: two constructors for `Request`, one public with three parameters and one non-public with one parameter; a record that prints `Level = 9` and an empty `Tag`; `True` for value equality; a default `Cell` that prints `Level = 0` and compares equal; and `True` on the last line.
What the uninitialized object prints is not predicted.

### E6: what the compiler API reports (rows Q1-27 to Q1-32, Q2-06 to Q2-09, Q2-11, Q2-14 to Q2-21, Q2-24, Q3-10, Q3-13, Q3-25 to Q3-27, items 4 to 6 of section (c))

This probe uses the same compiler assemblies and the same compilation options as the backend.

File `probe/Probe.csproj`:

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
  <ItemGroup>
    <Reference Include="Microsoft.CodeAnalysis">
      <HintPath>$(MSBuildSDKsPath)/../Roslyn/bincore/Microsoft.CodeAnalysis.dll</HintPath>
    </Reference>
    <Reference Include="Microsoft.CodeAnalysis.CSharp">
      <HintPath>$(MSBuildSDKsPath)/../Roslyn/bincore/Microsoft.CodeAnalysis.CSharp.dll</HintPath>
    </Reference>
  </ItemGroup>
</Project>
```

File `probe/Program.cs`:

```csharp
using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.FlowAnalysis;
using Microsoft.CodeAnalysis.Operations;

const string Source = """
    public enum Level : byte { Low = 1, High = 2, Top = High }
    public record Pair(Level Level, bool Flag);
    public static class Subject
    {
        public const int Limit = 10 * 10;
        public static bool Named(Level l) => l switch { Level.Low => true, Level.High => false };
        public static bool Partial(Level l) => l switch { Level.Low => true };
        public static bool Total(Level l) => l switch { Level.Low => true, _ => false };
        public static bool Range(int n) => n switch { < 0 => false, >= 0 and < Limit => true, >= Limit => false };
        public static bool Ordered(Level l) => l is > Level.Low;
        public static bool Shape(Pair p) => p is { Level: Level.Low or Level.High, Flag: not false };
        public static bool Narrow(byte b) => b == 300;
        public static bool Mixed(int i, uint u) => i < u;
        public static bool Statement(Level l)
        {
            switch (l)
            {
                case Level.Low: return true;
                case Level.High: return false;
            }
        }
    }
    """;

var references = ((string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES")!).Split(Path.PathSeparator)
    .Select(path => (MetadataReference)MetadataReference.CreateFromFile(path)).ToArray();
var tree = CSharpSyntaxTree.ParseText(Source, new CSharpParseOptions(LanguageVersion.CSharp14));
var compilation = CSharpCompilation.Create("Probe", [tree], references,
    new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, optimizationLevel: OptimizationLevel.Release));
var version = typeof(CSharpCompilation).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
Console.WriteLine($"compiler: {version}");
Console.WriteLine($"options: checkOverflow={compilation.Options.CheckOverflow} nullable={compilation.Options.NullableContextOptions} warningLevel={compilation.Options.WarningLevel}");
foreach (var diagnostic in compilation.GetDiagnostics().Where(d => d.Severity >= DiagnosticSeverity.Warning))
{
    var line = diagnostic.Location.GetLineSpan().StartLinePosition.Line + 1;
    Console.WriteLine($"diagnostic: {diagnostic.Id} {diagnostic.Severity} level={diagnostic.WarningLevel} line={line}: {diagnostic.GetMessage()}");
}

var model = compilation.GetSemanticModel(tree);
var level = compilation.GetTypeByMetadataName("Level")!;
Console.WriteLine($"enum: kind={level.TypeKind} underlying={level.EnumUnderlyingType}");
foreach (var enumMember in level.GetMembers().OfType<IFieldSymbol>())
    Console.WriteLine($"member {enumMember.Name}: has={enumMember.HasConstantValue} value={enumMember.ConstantValue} clr={enumMember.ConstantValue?.GetType()}");
var pair = compilation.GetTypeByMetadataName("Pair")!;
var constructors = string.Join("; ", pair.InstanceConstructors.Select(c => c.DeclaredAccessibility + " " + c));
Console.WriteLine($"record: IsRecord={pair.IsRecord} constructors={constructors}");

foreach (var method in tree.GetCompilationUnitRoot().DescendantNodes().OfType<MethodDeclarationSyntax>())
{
    Console.WriteLine($"method {method.Identifier.ValueText}");
    foreach (var node in method.DescendantNodes())
    {
        switch (model.GetOperation(node))
        {
            case ISwitchExpressionOperation switchExpression:
                Console.WriteLine($"  switch expression: arms={switchExpression.Arms.Length} IsExhaustive={switchExpression.IsExhaustive}");
                break;
            case IConstantPatternOperation constant:
                var constantValue = constant.Value.ConstantValue.Value;
                Console.WriteLine($"  constant pattern: input={constant.InputType} value={constantValue} clr={constantValue?.GetType()}");
                break;
            case IRelationalPatternOperation relational:
                Console.WriteLine($"  relational pattern: {relational.OperatorKind} value={relational.Value.ConstantValue.Value}");
                break;
            case IBinaryPatternOperation combined:
                Console.WriteLine($"  binary pattern: {combined.OperatorKind}");
                break;
            case INegatedPatternOperation:
                Console.WriteLine("  negated pattern");
                break;
            case IRecursivePatternOperation recursive:
                var members = string.Join(",", recursive.PropertySubpatterns.Select(s => s.Member.Syntax.ToString()));
                Console.WriteLine($"  recursive pattern: members={members}");
                break;
            case IBinaryOperation binary:
                Console.WriteLine($"  binary operation: {binary.OperatorKind} left={binary.LeftOperand.Type} right={binary.RightOperand.Type} checked={binary.IsChecked}");
                break;
        }
    }
    var graph = ControlFlowGraph.Create(method, model);
    var blocks = graph is null ? "none" : graph.Blocks.Length + " blocks";
    Console.WriteLine($"  control flow graph: {blocks}");
}

var overflowTree = CSharpSyntaxTree.ParseText(
    "class C { const int Over = int.MaxValue + 1; const int Wrapped = unchecked(int.MaxValue + 1); }",
    new CSharpParseOptions(LanguageVersion.CSharp14));
var overflow = CSharpCompilation.Create("Overflow", [overflowTree], references, compilation.Options);
foreach (var diagnostic in overflow.GetDiagnostics().Where(d => d.Severity >= DiagnosticSeverity.Warning))
    Console.WriteLine($"overflow diagnostic: {diagnostic.Id} {diagnostic.Severity}: {diagnostic.GetMessage()}");
```

Command: `dotnet run --project probe/Probe.csproj`

Expected if the claims hold:

- `compiler:` starts with `5.9.0`, and the options line shows `checkOverflow=False`, `nullable=Disable`, `warningLevel=4`.
- `Named` gives warning CS8524 at level 1 and `IsExhaustive=False`.
- `Partial` gives warning CS8509 at level 1 and `IsExhaustive=False`.
- `Total` and `Range` give no exhaustiveness diagnostic and `IsExhaustive=True`.
- `Narrow` gives warning CS0652.
- `Mixed` shows both operands as `long`.
- `Statement` gives error CS0161.
- The enum members print values 1, 2 and 2, and the `clr=` part answers item 4 of section (c).
- `Ordered` either compiles or gives an error, which answers item 5 of section (c).
- The second compilation gives one error for `Over` and none for `Wrapped`.

### E7: the Z3 package from nuget.org on .NET 10 (rows Q6-03, Q6-04, Q6-06, item 13 of section (c))

This run needs network access to restore the package.

File `E7.cs`:

```csharp
#:package Microsoft.Z3@4.12.2
#:property PublishAot=false
using System;
using Microsoft.Z3;

using Context context = new Context();
IntExpr n = context.MkIntConst("n");
BoolExpr inRange = context.MkAnd(context.MkGe(n, context.MkInt(0)), context.MkLt(n, context.MkInt(10)));
BoolExpr covered = context.MkOr(context.MkLt(n, context.MkInt(5)), context.MkGe(n, context.MkInt(5)));
Solver solver = context.MkSolver();
solver.Assert(inRange);
solver.Assert(context.MkNot(covered));
Console.WriteLine($"Z3 {Microsoft.Z3.Version.FullVersion}: a value in [0, 10) outside both classes is {solver.Check()}");
```

Command: `dotnet run --file E7.cs`

Expected if the claims hold: the native library loads and the line ends with `UNSATISFIABLE`.
Every member used above is present in the file `lib/netstandard2.0/Microsoft.Z3.xml` of the 4.12.2 package, which was searched by member name.

## (e) Consequences for the checker

Every item in this section is an inference.
None of them is a statement found in a source, and the rows named in brackets are the facts each one rests on.
Three facts about the present backend were read in its source and are used below: it rejects a file only on diagnostics of severity `Error` (`Program.cs` line 84), it builds the compilation with default options apart from the output kind and the optimization level (line 83), and it calls the method under check with `MethodBase.Invoke` and casts the result to `bool` (line 179).

1. **Inference: the named members of an enum are a partition, not the domain.** [Q1-01, Q1-04, Q1-06, Q1-10, Q1-17]
   The run-time domain of an enum parameter is the whole underlying type.
   The tool can call an enum domain exhaustive only if it enumerates every value of the underlying type, which is practical for `byte` and `sbyte` (256 values) and possibly `short` and `ushort` (65,536 values).
   For an `int` enum, the honest report is a partition: one class per distinct named value, plus a class of unnamed values with stated representatives, for example zero when it is unnamed, a value between two members, and the two ends of the underlying type.
2. **Inference: the classes of an enum are its distinct values, not its member names.** [Q1-09, Q1-18]
   Two members with one value cannot be told apart by the code, so the spec table needs one row per value.
3. **Inference: `[Flags]` needs no separate rule.** [Q1-01, Q1-11, Q1-12, Q1-15]
   A combination of flags is an unnamed value like any other, and the number of meaningful combinations can be far larger than the number of members.
   Item 7 of section (c) says what was not established about the compiler here.
4. **Inference: a method over an enum has outcomes beyond its return values.** [Q1-19, Q1-23, Q1-24, Q5-19]
   A `switch` expression with no catch-all arm throws for every unnamed value, and a `switch` statement falls through to whatever follows.
   The spec format therefore needs a "throws" outcome, or the admission rules must demand a catch-all arm.
   Through `MethodBase.Invoke` the exception arrives wrapped in `TargetInvocationException`, so the run step has to unwrap it before it can compare outcomes.
5. **Inference: the compiler's warnings must be read, not only its errors.** [Q1-27 to Q1-31, Q2-14, Q2-15]
   With the present error-only filter, a `switch` expression that misses a named member (CS8509) and one that misses only unnamed values (CS8524) both pass admission without a trace.
   The same information is available without parsing diagnostics, from `ISwitchExpressionOperation.IsExhaustive`.
   CS8509 and CS8524 separate two different situations, and only the first one is a likely defect in the code under check.
6. **Inference: a `switch` statement gets no such help.** [Q1-19, Q1-22, Q1-35]
   No diagnostic was found that reports a missing enum member in a `switch` statement, so the tool has to compute the uncovered class itself from the case labels.
7. **Inference: an enum return type has the same open domain as an enum parameter.** [Q1-01, Q1-06, Q1-10]
   If casts, arithmetic and `default` are kept out of the admitted expressions, a method can return only named constants and its own parameters, and the outcome set stays finite.
   Outcomes should be compared by underlying value. [Q1-09, Q3-23]
8. **Inference: boundaries must come from bound constants, not from literal text.** [Q2-08, Q2-09, Q3-06 to Q3-09, Q3-20]
   A constant in a comparison can be a literal, a `const` field, an enum member or a folded expression, and its type and value are fixed only after binding.
   `SemanticModel.GetConstantValue` and `IOperation.ConstantValue` give the folded value.
9. **Inference: a partition at constants is justified only for comparison-only code.** [Q3-01 to Q3-05, Q3-11, Q3-14 to Q3-19]
   If the method touches an integer parameter only through `==`, `!=`, `<`, `<=`, `>`, `>=` and relational or constant patterns against constants, every value between two neighbouring boundaries takes the same path, and comparison is not affected by the overflow context.
   Once arithmetic on the parameter is admitted (`n + 1`, `n * 2`, `n % 3`, `n / m`, a cast), wrapping, the checked context and the two division exceptions create classes that the constants do not show.
   The choices are to reject arithmetic, or to enumerate the whole type when it is small, and in neither case to report a partition as exhaustive.
10. **Inference: the report should say which kind of domain claim it makes.** [Q1-01, Q4-01, Q4-02, Q5-16]
    "Exhaustive" fits `bool`, fully enumerated 8-bit and 16-bit integers and enums, and records made only of such fields.
    "Partition with N classes and these representatives" fits wider integers, wider enums and strings.
    The two words should not share one counter.
11. **Inference: mixed operand types need an explicit rule.** [Q3-02 to Q3-04, Q3-10]
    A comparison between a parameter and a constant outside the parameter type's range is always true or always false, and the compiler flags it with warning CS0652, which the error-only filter also drops.
    A boundary computed from such a constant lies outside the domain and produces an empty class.
12. **Inference: the overflow setting is part of the checked artefact.** [Q2-21, Q2-24, Q3-11, Q3-12]
    The backend compiles with overflow checking off because that is the API default, while a project can turn it on.
    The report already records the compiler version, and the same reasoning applies to this option as soon as any arithmetic is admitted.
13. **Inference: a string parameter has no finite domain.** [Q4-01, Q4-02, Q4-05 to Q4-07]
    The classes that the code can tell apart are: each string constant it compares with, `null`, and all other strings.
    The last class needs at least one representative, and representatives that differ from a constant only in case, or by one character, are the ones that expose a wrong comparison.
14. **Inference: only the ordinal forms are deterministic enough to admit first.** [Q4-03, Q4-08, Q4-10 to Q4-14]
    `==`, `!=`, a constant pattern and a `switch` case are ordinal and culture-independent.
    A call with a current-culture option gives results that depend on the machine, and `OrdinalIgnoreCase` depends on Unicode data that can change between runtime versions.
15. **Inference: `null` belongs to every string and record-class domain, whatever the annotation says.** [Q4-02, Q4-15, Q5-16]
    The backend compiles with the nullable context disabled, and even with it enabled nothing checks at run time.
    An instance call on the parameter, such as `s.Equals("a")`, throws for `null`, which is again an outcome outside the return type.
16. **Inference: a record input is a product of field domains plus extra instances.** [Q5-01, Q5-08 to Q5-10, Q5-13 to Q5-16]
    The tool can build each combination through the public primary constructor by reflection.
    For a record struct, `default` is one more way to get an instance, and it equals the all-zero combination, in which an enum field is `(E)0`, named or not.
    For a record class, `null` is one more input.
17. **Inference: only plain positional records keep the product honest.** [Q5-03, Q5-05, Q5-07, Q5-11, Q5-21]
    A record with a constructor body, an explicit property, an extra field, a `required` member or a base record can hold state that the positional parameters do not determine, or can reject combinations.
    A non-sealed record class can be passed as a derived record with more fields.
    Admission would need to check these points on the symbols. [Q2-22]
18. **Inference: table size is a product and needs a cap.** [Q6-22]
    The present cap is 4096 combinations for twelve `bool` parameters, and one 8-bit field already contributes a factor of 256.
19. **Inference: property patterns can be read without text matching.** [Q2-16 to Q2-20]
    A decision table written as a `switch` expression over a record maps to recursive pattern operations whose subpatterns name the member and the nested constant, relational, `and`, `or` or `not` pattern.
20. **Inference: the control flow graph is the uniform place to collect conditions.** [Q2-11 to Q2-13]
    It turns `if`, the conditional operator and `switch` expressions into branches on single tests, which is where boundaries and uncovered classes can be collected.
    It can be built only for a whole method body.
21. **Inference: no solver is needed while every admitted condition is a comparison of one input with a constant.** [Q2-14, Q2-23, Q6-21, Q6-22]
    In that shape, boundaries follow from sorting the constants, and the compiler's exhaustiveness flag covers `switch` expressions.
    A solver becomes relevant when conditions relate two inputs, or use arithmetic, and the compiler's own value sets cannot be borrowed for that because they are internal.
22. **Inference: a Z3 dependency would change how the tool is distributed.** [Q6-01 to Q6-10, Q2-02]
    The backend today needs only the SDK.
    The package on nuget.org is from 2023 and has native libraries for two platforms, and the current package exists only as a release asset that a project would have to fetch from GitHub itself.
    Running the stand-alone solver on SMT-LIB text is the other route, and it also adds a native download. [Q6-16]
23. **Inference: the version the tool reports should include the SDK pin.** [Q2-01]
    The machine has a newer preview SDK installed, and the facts in this file were read for the compiler inside SDK 10.0.400.

## (f) Verification pass (2026-11-11)

This pass read sections (b), (c) and (d) only.
Sections (a) and (e) and the part "Method and scope" were not read, so nothing in them was checked.
Criticality: public interest, because the checker's output is a statement that every input was tried, and the person who receives it cannot check it.
Perspective: the person who receives that statement.
Every claim started as false and was accepted only on a line printed from the cited file, a sentence found in the fetched page, or an observed run.

### Summary for a meeting

All seven experiments of section (d) were run on SDK 10.0.400 with C# 14 on runtime 10.0.11, Windows x64, and every prediction written there held.
123 of the 148 rows of section (b) were checked: 118 confirmed, 4 narrower, 1 refuted, 0 unreachable.
The refuted row is Q1-29: the compiler reported CS8524, the warning about unnamed enum values, on a `switch` expression that also leaves a named member unhandled, and that member threw at run time.
So the warning ID does not show that every named member is handled, and row Q1-28 is narrower for the same reason.
Row Q5-08 is narrower: reflection lists no parameterless constructor on a positional record struct, although the zero value can still be produced.
Row Q2-26, the one row tagged `unverified`, stays without a source: no compatibility guarantee was found.
Row Q6-22 is narrower: the backend line it quotes exists at the last commit and is absent from the working tree as read today.
Three observations that no row states matter for a checker that calls methods by reflection: `Enum.GetValues` returns values sorted by unsigned magnitude and not in declaration order; `MethodBase.Invoke` silently accepts a boxed `int`, a boxed `byte`, a value of another enum type and `null` for an enum parameter; and `ISwitchExpressionOperation.IsExhaustive` was `False` with no diagnostic at all when only `null` was unhandled.
Not run: nullable-enabled diagnostics, sealed records, any platform other than Windows x64, loading the Z3 5.4.1 package, and reading enum symbols from a compiled assembly.
25 rows were not checked and are listed in Table B.

### Setup used for every run

- SDK 10.0.400, pinned by `global.json` with `"rollForward": "latestFeature"` and `"allowPrerelease": false`; `dotnet --version` printed `10.0.400`.
- Language version 14: `<LangVersion>14</LangVersion>` in the three probe projects, and the line `#:property LangVersion=14` added as the first line of each single-file app.
- Runtime `.NET 10.0.11`, printed by the added experiments; core library product version `10.0.11-servicing.26373.116+e2f47b0110ed922f21a1522da67279133ce28f32`.
- Compiler assemblies from the SDK folder, product version `5.9.0-1.26379.115+14fbf8d5271c98133561eb55185fdb05b286f578`, printed by each probe.
- A scratch folder outside every project tree; no build file exists in any parent folder (each parent was listed).
- `TEMP`, `TMP`, `NUGET_PACKAGES`, `NUGET_HTTP_CACHE_PATH` and `DOTNET_CLI_HOME` pointed into the scratch folder, and a `nuget.config` there with nuget.org as the only source.
- Each single-file app was built first with `dotnet build <file>.cs --no-incremental`, because `dotnet run --file` does not print warnings, and then run with `dotnet run --file <file>.cs`.

Changes to the experiments of section (d), and why:

- `rollForward` is `latestFeature` instead of `latestPatch`. The resolved SDK is the same.
- The `LangVersion` line was added to E1 to E5 and E7, so that the language version of each run is stated and not inferred. This moves every reported line number in those files down by one.
- E3 sets `CheckForOverflowUnderflow=false` itself, so it cannot show the default of that option (row Q3-12). Experiment H leaves the option unset.
- E5 cannot show whether `RuntimeHelpers.GetUninitializedObject` runs a constructor, because its record has no constructor with an effect that can be seen. It also does not try `Activator.CreateInstance` with an existing record as the argument. Experiment E adds both.
- E6 does not call `SemanticModel.GetConstantValue` (row Q2-08). That row rests on the cited lines and on reflection only.

### Table 1: experiments

"SDK" is 10.0.400 and "language" is C# 14 in every row; runtime is .NET 10.0.11 on Windows x64.
E1 to E7 use the code of section (d) with the one added line.
The code of A to I follows the table.

| ID | Rows tested | SDK, language | Code or command | Observed output, trimmed | Verdict |
|---|---|---|---|---|---|
| E1 | Q1-01, Q1-06, Q1-09, Q1-12, Q1-14, Q1-15, Q1-17 to Q1-20, Q1-23, Q1-24 | 10.0.400, C# 14 | `dotnet build E1.cs --no-incremental` then `dotnet run --file E1.cs` | Build: `E1.cs(32,41): warning CS8524 … the pattern '(Colour)0' is not covered`. Run: `cast 7: text=7 defined=False`; `default: raw=0 defined=False`; `flags: text=Read, Write raw=3 defined=False`; `ToObject 7: type=Colour text=7`; `GetValues with a shared value: Light,Light,Dark`; `unchecked cast of 258 to a byte enum: raw=2`; `switch statement on 7: no case matched`; `switch expression on 7 threw System.Runtime.CompilerServices.SwitchExpressionException` | confirmed by run |
| E2 | Q1-17, Q5-19, item 8 of (c) | 10.0.400, C# 14 | `dotnet run --file E2.cs` | `boxed enum argument: high`; `boxed int argument: high`; `unnamed value: System.Reflection.TargetInvocationException wrapping System.Runtime.CompilerServices.SwitchExpressionException`. Build: CS8524 on `Describe`. | confirmed by run; the unpredicted result is that a boxed `int` is accepted |
| E3 | Q3-02, Q3-03, Q3-06 to Q3-08, Q3-10 to Q3-12, Q3-15 to Q3-19 | 10.0.400, C# 14 | `dotnet run --file E3.cs` | `True`, `System.Int64`, `System.Int32`, `System.UInt32`, `System.Int32`, `System.Int64`, `System.Int64`, `-2147483648`, `OverflowException`, `-294967296`, `OverflowException`, `min / -1 threw OverflowException`, `DivideByZeroException` twice, `-3` and `-1`, `False`. Build: `E3.cs(34,39): warning CS0652`. | confirmed by run, except that Q3-12 cannot be tested by this file; the unpredicted result is `OverflowException` for `min / -1` |
| E4 | Q4-01 to Q4-09, Q4-12, Q4-13, Q4-15 | 10.0.400, C# 14 | `dotnet run --file E4.cs` | `True`, `False`, `True`, `False`, `True`, `False`, `NullReferenceException`, `constant pattern on null: False, on built string: True`, `switch: null -> null case, FILE -> default case, built -> file case`, then `False`, `True`, `False` under tr-TR | confirmed by run; Q4-12 and Q4-13 need the contrast in experiment I |
| E5 | Q5-01, Q5-03, Q5-07 to Q5-10, Q5-14, Q5-16 to Q5-18, Q5-20, item 8 of (c) | 10.0.400, C# 14 | `dotnet run --file E5.cs` | `constructor: public=True Void .ctor(Level, Boolean, System.String)`; `constructor: public=False Void .ctor(Request)`; `Request { Level = 9, Urgent = True, Tag =  }`; value equality `True`; `uninitialized object: Request { Level = 0, Urgent = False, Tag =  }`; `default record struct: Cell { Level = 0, Flag = False }, equal … True`; Activator on the record struct gives the same value; `required member after Activator is null: True` | confirmed by run for the predictions; Q5-03, Q5-18 (exception from a constructor) and Q5-20 are not tested by this file |
| E6 | Q1-27 to Q1-32, Q2-06 to Q2-09, Q2-11, Q2-14 to Q2-21, Q2-24, Q3-10, Q3-13, Q3-25 to Q3-27, items 4 to 6 of (c) | 10.0.400, C# 14 | `dotnet run --project probe/Probe.csproj` | Full output below. `Named`: CS8524 Warning level=1, `IsExhaustive=False`. `Partial`: CS8509 Warning level=1, `IsExhaustive=False`. `Total`, `Range`: no diagnostic, `IsExhaustive=True`. `Narrow`: CS0652 Warning level=2. `Mixed`: `left=long right=long`. `Statement`: CS0161 Error. Members `1, 2, 2` with `clr=System.Byte`. `Ordered` compiles. `Over`: CS0220 Error; `Wrapped`: none. | confirmed by run; item 4: the value is a boxed value of the underlying type; item 5: accepted; item 6: CS0161 |
| E7 | Q6-03, Q6-04, Q6-06, item 13 of (c) | 10.0.400, C# 14 | `dotnet run --file E7.cs`, package restored from nuget.org into the scratch folder | `Z3 Z3 4.12.2.0: a value in [0, 10) outside both classes is UNSATISFIABLE`; `libz3.dll` is present in the output folder | confirmed by run |
| A | Q1-01, Q1-06, Q1-14, Q1-19, Q1-22 to Q1-25, Q1-27, Q1-28, Q1-30 to Q1-32, Q1-35, item 6 of (c) | 10.0.400, C# 14 | `X1.cs` part a, `X2.cs`, `probe2` variants a1 to a12 | `default(E)`: raw 0, text `0`, `IsDefined=False`. `(E)7`: raw 7, `IsDefined=False`. Switch expression naming every member: throws `System.Runtime.CompilerServices.SwitchExpressionException` (base `System.InvalidOperationException`) for 7 and for 0, message `Non-exhaustive switch expression failed to match its input.` then a line break then `Unmatched value was 7.` (or `0.`), `UnmatchedValue` is the value with type `E`. Diagnostics: without a discard arm CS8524, Warning, level 1, example `(E)0`; with a discard arm none. Switch statement without `default` in a method that must return: CS0161, Error, level 0. The same statement followed by a `return`: no diagnostic, and it falls through for 7 and 0. | confirmed by run |
| B | Q1-09, Q1-12, Q1-15, Q1-18, item 7 of (c) | 10.0.400, C# 14 | `X1.cs` part b, `probe2` section "enums" and variant a10 | `GetValues<F>` raw `[0,1,2,3,4]`. `GetValues<Dup>` raw `[0,1,1,2,2]`, printed as `[Zed,Light,Light,Dark,Dark]`, names `[Zed,Light,Pale,Dark,Dim]`. `GetValues<Neg>` raw `[0,1,-1]`. Reflection fields and compiler symbols both keep declaration order: `Light=1, Pale=1, Dark=2, Dim=2, Zed=0`, one field per member, followed by one `Method .ctor` member. `[Flags]` is visible only as an attribute; a10 gives CS8524 with example `(F)4`. | confirmed by run; the order of `GetValues` is by unsigned magnitude |
| C | Q2-06, Q2-07, Q2-09, Q2-14, Q2-15, item 4 of (c) | 10.0.400, C# 14 | `probe2`, SDK compiler assemblies referenced by path | `E`: `EnumUnderlyingType=int`, `SpecialType=System_Int32`. `A`: `HasConstantValue=True ConstantValue=1 clr=System.Int32`; `B`: `2`. A `byte` enum gives `System.Byte`, a `ulong` enum `System.UInt64`. A class gives `EnumUnderlyingType=null`. `GetOperation` on the switch expression: `IsExhaustive=False` without a discard arm, `IsExhaustive=True` with one. | confirmed by run |
| D | Q3-23, Q3-25, Q3-26, item 5 of (c) | 10.0.400, C# 14 | `X1.cs` part d, `probe2` section "d" | All five forms compile with no diagnostic of any severity. For raw 0, 1, 2, 7, -1: `e is E.A` = F, T, F, F, F; `e is E.A or E.B` = F, T, T, F, F; `e is > E.A` = F, F, T, T, F; `e == E.B` = F, F, T, F, F; `e < E.B` = T, T, F, F, T. The operands of `==` and `<` have type `E` and no operator method. | confirmed by run |
| E | Q1-17, Q4-17, Q5-01, Q5-07 to Q5-10, Q5-16, Q5-17, Q5-19, Q5-20, item 8 of (c) | 10.0.400, C# 14 | `X1.cs` part e | Enum parameter through `MethodInfo.Invoke`: boxed member works; `Enum.ToObject(type, 7)` arrives as 7; a boxed `int` 2 or 7 is accepted and arrives as that value; a boxed `byte` 2 is accepted; a value of another enum type is accepted; `null` is accepted and arrives as 0; a boxed `long` and a string throw `System.ArgumentException`. Record: one public constructor `(E, Boolean, System.String)` and one protected `(Req)`; built by `ConstructorInfo.Invoke`, also with `(E)7` and a `null` string, and with a boxed `int` for the enum. Record struct: one public constructor `(E, Boolean)` and no other; `default(Cell)` is `Cell { Kind = 0, Flag = False }` with `IsDefined=False` for `Kind`. A method with the record as parameter is called with the built object; with `null` it throws `TargetInvocationException` wrapping `NullReferenceException`. `Activator.CreateInstance(typeof(Req), existingReq)` throws `System.MissingMethodException`. `GetUninitializedObject`: constructor count stays 0. | confirmed by run; row Q5-08 is narrower |
| F | none in (b); task item f | 10.0.400, C# 14 | `X1.cs` part f, `probe2` section "f" | `Pair(first, second)=A,B Pair(second, first)=B,A`. The compiler API returns no diagnostic of any severity, and the real build of `X1.cs` reports only the CS8524 of part a. | confirmed by run |
| G | Q1-08, Q1-10, Q1-21, Q1-28, Q1-29, Q1-33, Q2-15 | 10.0.400, C# 14 | `probe3` variants g1 to g12, `X4.cs` | g1: `e switch { > (E)2 and not (E)7 => 1, E.A => 2 }` leaves `E.B` unhandled and gets CS8524 with example `(E)7`; `X4.cs` shows the same warning from the real build and `M(E.B) threw System.Runtime.CompilerServices.SwitchExpressionException`. g2, the same arms in the other order: CS8509 with example `E.B`. g5, a pair of enums with the named pair `(E.B, E.B)` missing: CS8524. g8, a `string` input with `"a"` and `not null` arms: no diagnostic, `IsExhaustive=False`. g10, a switch statement whose patterns cover the whole underlying range, no `default`, must return: no diagnostic. g11: `E z = 0` compiles, `E o = 1` is CS0266. | refuted by run for Q1-29; narrower for Q1-28; confirmed by run for the other rows |
| H | Q1-10, Q3-12, Q4-01, Q4-03, Q4-05, Q4-07, Q5-05, Q5-06, items 11 and 16 of (c) | 10.0.400, C# 14 | `X3.cs` | `E.B + 1 raw=3 defined=False`; bitwise or of `E.A` and `E.B`: `raw=3 defined=False`; `~E.A raw=-2`; `(Small)255 + 1 raw=0` with no overflow option set. Composed and decomposed forms of one accented letter: invariant-culture comparison `True`; `==` `False`; constant pattern `False`; `switch` takes the default case; `EqualityComparer<string>.Default` `False`; two records that differ only in that string are not equal; `a` and `A` are not equal. | confirmed by run for the inputs tried |
| I | Q4-12, Q4-13 | 10.0.400, C# 14 | `X5.cs` | `en-US: CurrentCultureIgnoreCase=True OrdinalIgnoreCase=True`; `tr-TR: CurrentCultureIgnoreCase=False OrdinalIgnoreCase=True` | confirmed by run |
| not run | Q1-33, second half | | a nullable-enabled compilation with a nullable input | | not run: the nullable diagnostic is named in the compiler source (`ErrorFacts.cs` lines 45-46) and was not triggered |
| not run | Q5-07, sealed case | | a sealed record | | not run: only an unsealed record was built |
| not run | Q6-08 | | loading the 5.4.1 package | | not run: the package file was downloaded and its entries listed, nothing was loaded |
| not run | Q3-18, Q6-04 on other platforms | | any run outside Windows x64 | | not run: one machine |

#### Code of experiments A to I

`X1.cs` (parts a, b, d, e, f):

```csharp
#:property LangVersion=14
#:property PublishAot=false
#:property Nullable=enable
using System;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

Console.WriteLine($"runtime: {RuntimeInformation.FrameworkDescription}");

// (a) enum with members 1 and 2 only
E d = default(E);
E seven = (E)7;
Console.WriteLine($"a: default(E): raw={(int)d} text={d} IsDefined={Enum.IsDefined(d)}");
Console.WriteLine($"a: (E)7: raw={(int)seven} text={seven} IsDefined={Enum.IsDefined(seven)}");
Console.WriteLine($"a: IsDefined(E.A)={Enum.IsDefined(E.A)} IsDefined(E.B)={Enum.IsDefined(E.B)} IsDefined(typeof(E), 7)={Enum.IsDefined(typeof(E), 7)} IsDefined(typeof(E), 0)={Enum.IsDefined(typeof(E), 0)}");
foreach (E v in new[] { E.A, E.B, seven, d })
{
    try { Console.WriteLine($"a: NoDiscard(raw {(int)v}) = {Sw.NoDiscard(v)}"); }
    catch (Exception ex)
    {
        var see = ex as SwitchExpressionException;
        string message = ex.Message.Replace("\r", "<CR>").Replace("\n", "<LF>");
        Console.WriteLine($"a: NoDiscard(raw {(int)v}) threw {ex.GetType().FullName} (base {ex.GetType().BaseType}); message=[{message}]; UnmatchedValue={see?.UnmatchedValue} of type {see?.UnmatchedValue?.GetType()}");
    }
    Console.WriteLine($"a: WithDiscard(raw {(int)v}) = {Sw.WithDiscard(v)}; StatementNoDefault(raw {(int)v}) = {Sw.StatementNoDefault(v)}");
}

// (b) flags and shared values at run time
Console.WriteLine($"b: GetValues<F> raw = [{string.Join(",", Enum.GetValues<F>().Select(x => (int)x))}] names = [{string.Join(",", Enum.GetNames<F>())}]");
Console.WriteLine($"b: GetValues<Dup> raw = [{string.Join(",", Enum.GetValues<Dup>().Select(x => (int)x))}] text = [{string.Join(",", Enum.GetValues<Dup>())}] names = [{string.Join(",", Enum.GetNames<Dup>())}]");
Console.WriteLine($"b: GetValues<Neg> raw = [{string.Join(",", Enum.GetValues<Neg>().Select(x => (int)x))}] names = [{string.Join(",", Enum.GetNames<Neg>())}]");
Console.WriteLine($"b: Dup fields in reflection order = [{string.Join(",", typeof(Dup).GetFields(BindingFlags.Public | BindingFlags.Static).Select(f => f.Name + "=" + f.GetRawConstantValue()))}]");
Console.WriteLine($"b: Neg fields in reflection order = [{string.Join(",", typeof(Neg).GetFields(BindingFlags.Public | BindingFlags.Static).Select(f => f.Name + "=" + f.GetRawConstantValue()))}]");
F combo = F.R | F.X;
Console.WriteLine($"b: F.R|F.X raw={(int)combo} text={combo} IsDefined={Enum.IsDefined(combo)}; F.R|F.W raw={(int)(F.R | F.W)} text={F.R | F.W} IsDefined={Enum.IsDefined(F.R | F.W)}; (F)8 text={(F)8} IsDefined={Enum.IsDefined((F)8)}");

// (d) patterns and operators on enum values
foreach (E v in new[] { d, E.A, E.B, seven, (E)(-1) })
    Console.WriteLine($"d: raw {(int)v}: [e is E.A]={Pat.Const(v)} [e is E.A or E.B]={Pat.Or(v)} [e is > E.A]={Pat.Rel(v)} [e == E.B]={Pat.Eq(v, E.B)} [e < E.B]={Pat.Lt(v, E.B)} [e == (E)7]={Pat.Eq(v, seven)}");

// (e) reflection: enum parameter
MethodInfo with = typeof(Sw).GetMethod(nameof(Sw.WithDiscard))!;
MethodInfo without = typeof(Sw).GetMethod(nameof(Sw.NoDiscard))!;
void Try(string label, MethodInfo m, object? arg)
{
    try { Console.WriteLine($"e: {m.Name}({label}) returned {m.Invoke(null, new[] { arg })}"); }
    catch (Exception ex)
    {
        string inner = ex.InnerException is null ? "" : " wrapping " + ex.InnerException.GetType().FullName;
        string first = ex.Message.Split((char)10)[0].Trim();
        Console.WriteLine($"e: {m.Name}({label}) threw {ex.GetType().FullName}{inner}: {first}");
    }
}
Try("boxed E.B", with, E.B);
Try("Enum.ToObject(typeof(E), 7)", with, Enum.ToObject(typeof(E), 7));
Try("Enum.ToObject(typeof(E), 7)", without, Enum.ToObject(typeof(E), 7));
Try("boxed int 2", with, 2);
Try("boxed int 2", without, 2);
Try("boxed int 7", with, 7);
Try("boxed int 7", without, 7);
Try("boxed long 2", with, 2L);
Try("boxed byte 2", with, (byte)2);
Try("boxed other enum Neg.One", with, Neg.One);
Try("string B", with, "B");
Try("null", with, null);

// (e) reflection: records
ConstructorInfo[] reqCtors = typeof(Req).GetConstructors();
Console.WriteLine($"e: public constructors of record Req: [{string.Join("; ", reqCtors.Select(c => c.ToString()))}]");
Console.WriteLine($"e: all instance constructors of record Req: [{string.Join("; ", typeof(Req).GetConstructors(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance).Select(c => (c.IsPublic ? "public " : c.IsFamily ? "protected " : c.IsPrivate ? "private " : "other ") + c))}]");
ConstructorInfo reqCtor = typeof(Req).GetConstructor(new[] { typeof(E), typeof(bool), typeof(string) })!;
object req = reqCtor.Invoke(new object?[] { E.B, true, "t" });
Console.WriteLine($"e: Req built by ConstructorInfo.Invoke: {req}; equals new Req(E.B, true, t): {req.Equals(new Req(E.B, true, "t"))}");
object hostile = reqCtor.Invoke(new object?[] { Enum.ToObject(typeof(E), 7), false, null });
Console.WriteLine($"e: Req built with (E)7 and null Tag: {hostile}; Tag is null: {((Req)hostile).Tag is null}");
object fromInt = reqCtor.Invoke(new object?[] { 2, false, "i" });
Console.WriteLine($"e: Req built with a boxed int 2 for the enum parameter: {fromInt}");
MethodInfo describe = typeof(Rec).GetMethod(nameof(Rec.Describe))!;
Console.WriteLine($"e: Rec.Describe(req) via Invoke returned {describe.Invoke(null, new[] { req })}");
Console.WriteLine($"e: Rec.Describe(hostile) via Invoke returned {describe.Invoke(null, new[] { hostile })}");
try { Console.WriteLine($"e: Rec.Describe(null) via Invoke returned {describe.Invoke(null, new object?[] { null })}"); }
catch (Exception ex) { Console.WriteLine($"e: Rec.Describe(null) threw {ex.GetType().FullName} wrapping {ex.InnerException?.GetType().FullName}"); }
try { Console.WriteLine($"e: Activator.CreateInstance(typeof(Req), existing Req) returned {Activator.CreateInstance(typeof(Req), req)}"); }
catch (Exception ex) { Console.WriteLine($"e: Activator.CreateInstance(typeof(Req), existing Req) threw {ex.GetType().FullName}"); }
try { Console.WriteLine($"e: Activator.CreateInstance(typeof(Req)) returned {Activator.CreateInstance(typeof(Req))}"); }
catch (Exception ex) { Console.WriteLine($"e: Activator.CreateInstance(typeof(Req)) with no arguments threw {ex.GetType().FullName}"); }

ConstructorInfo[] cellCtors = typeof(Cell).GetConstructors();
Console.WriteLine($"e: public constructors of readonly record struct Cell: [{string.Join("; ", cellCtors.Select(c => c.ToString()))}]");
object cell = typeof(Cell).GetConstructor(new[] { typeof(E), typeof(bool) })!.Invoke(new object?[] { E.A, true });
Cell dc = default;
Console.WriteLine($"e: Cell built by ConstructorInfo.Invoke: {cell}; default(Cell): {dc}; default Kind raw={(int)dc.Kind} IsDefined={Enum.IsDefined(dc.Kind)}; default == new Cell((E)0, false): {dc == new Cell((E)0, false)}; Activator.CreateInstance(typeof(Cell)): {Activator.CreateInstance(typeof(Cell))}");
MethodInfo describeCell = typeof(Rec).GetMethod(nameof(Rec.DescribeCell))!;
Console.WriteLine($"e: Rec.DescribeCell(cell) via Invoke returned {describeCell.Invoke(null, new[] { cell })}; with a null argument returned {describeCell.Invoke(null, new object?[] { null })}");

// (e) addition: does GetUninitializedObject run a constructor
object raw = RuntimeHelpers.GetUninitializedObject(typeof(Counted));
Console.WriteLine($"e: GetUninitializedObject(Counted): Marker={((Counted)raw).Marker} constructor runs so far={Counted.Runs}; new Counted().Marker={new Counted().Marker} runs={Counted.Runs}");

// (f) two parameters of the same enum type, arguments swapped
E first = E.A, second = E.B;
Console.WriteLine($"f: Pair(first, second)={Swap.Pair(first, second)} Pair(second, first)={Swap.Pair(second, first)}");

public enum E { A = 1, B = 2 }
[Flags] public enum F { None = 0, R = 1, W = 2, RW = R | W, X = 4 }
public enum Dup { Light = 1, Pale = 1, Dark = 2, Dim = 2, Zed = 0 }
public enum Neg { Minus = -1, Zero = 0, One = 1 }
public record Req(E Kind, bool Urgent, string Tag);
public readonly record struct Cell(E Kind, bool Flag);
public class Counted { public static int Runs; public int Marker; public Counted() { Runs++; Marker = 42; } }

public static class Sw
{
    public static string NoDiscard(E e) => e switch { E.A => "a", E.B => "b" };
    public static string WithDiscard(E e) => e switch { E.A => "a", E.B => "b", _ => "other" };
    public static string StatementNoDefault(E e)
    {
        switch (e)
        {
            case E.A: return "a";
            case E.B: return "b";
        }
        return "fell through";
    }
}

public static class Pat
{
    public static bool Const(E e) => e is E.A;
    public static bool Or(E e) => e is E.A or E.B;
    public static bool Rel(E e) => e is > E.A;
    public static bool Eq(E x, E y) => x == y;
    public static bool Lt(E x, E y) => x < y;
}

public static class Rec
{
    public static string Describe(Req r) => $"{r.Kind}/{r.Urgent}/{r.Tag ?? "<null>"}";
    public static string DescribeCell(Cell c) => $"{c.Kind}/{c.Flag}";
}

public static class Swap
{
    public static string Pair(E first, E second) => $"{first},{second}";
}
```

Build output of `X1.cs`: `X1.cs(116,46): warning CS8524: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '(E)0' is not covered.`
No other diagnostic was printed.

Observed output of `dotnet run --file X1.cs`:

```text
runtime: .NET 10.0.11
a: default(E): raw=0 text=0 IsDefined=False
a: (E)7: raw=7 text=7 IsDefined=False
a: IsDefined(E.A)=True IsDefined(E.B)=True IsDefined(typeof(E), 7)=False IsDefined(typeof(E), 0)=False
a: NoDiscard(raw 1) = a
a: WithDiscard(raw 1) = a; StatementNoDefault(raw 1) = a
a: NoDiscard(raw 2) = b
a: WithDiscard(raw 2) = b; StatementNoDefault(raw 2) = b
a: NoDiscard(raw 7) threw System.Runtime.CompilerServices.SwitchExpressionException (base System.InvalidOperationException); message=[Non-exhaustive switch expression failed to match its input.<CR><LF>Unmatched value was 7.]; UnmatchedValue=7 of type E
a: WithDiscard(raw 7) = other; StatementNoDefault(raw 7) = fell through
a: NoDiscard(raw 0) threw System.Runtime.CompilerServices.SwitchExpressionException (base System.InvalidOperationException); message=[Non-exhaustive switch expression failed to match its input.<CR><LF>Unmatched value was 0.]; UnmatchedValue=0 of type E
a: WithDiscard(raw 0) = other; StatementNoDefault(raw 0) = fell through
b: GetValues<F> raw = [0,1,2,3,4] names = [None,R,W,RW,X]
b: GetValues<Dup> raw = [0,1,1,2,2] text = [Zed,Light,Light,Dark,Dark] names = [Zed,Light,Pale,Dark,Dim]
b: GetValues<Neg> raw = [0,1,-1] names = [Zero,One,Minus]
b: Dup fields in reflection order = [Light=1,Pale=1,Dark=2,Dim=2,Zed=0]
b: Neg fields in reflection order = [Minus=-1,Zero=0,One=1]
b: F.R|F.X raw=5 text=R, X IsDefined=False; F.R|F.W raw=3 text=RW IsDefined=True; (F)8 text=8 IsDefined=False
d: raw 0: [e is E.A]=False [e is E.A or E.B]=False [e is > E.A]=False [e == E.B]=False [e < E.B]=True [e == (E)7]=False
d: raw 1: [e is E.A]=True [e is E.A or E.B]=True [e is > E.A]=False [e == E.B]=False [e < E.B]=True [e == (E)7]=False
d: raw 2: [e is E.A]=False [e is E.A or E.B]=True [e is > E.A]=True [e == E.B]=True [e < E.B]=False [e == (E)7]=False
d: raw 7: [e is E.A]=False [e is E.A or E.B]=False [e is > E.A]=True [e == E.B]=False [e < E.B]=False [e == (E)7]=True
d: raw -1: [e is E.A]=False [e is E.A or E.B]=False [e is > E.A]=False [e == E.B]=False [e < E.B]=True [e == (E)7]=False
e: WithDiscard(boxed E.B) returned b
e: WithDiscard(Enum.ToObject(typeof(E), 7)) returned other
e: NoDiscard(Enum.ToObject(typeof(E), 7)) threw System.Reflection.TargetInvocationException wrapping System.Runtime.CompilerServices.SwitchExpressionException: Exception has been thrown by the target of an invocation.
e: WithDiscard(boxed int 2) returned b
e: NoDiscard(boxed int 2) returned b
e: WithDiscard(boxed int 7) returned other
e: NoDiscard(boxed int 7) threw System.Reflection.TargetInvocationException wrapping System.Runtime.CompilerServices.SwitchExpressionException: Exception has been thrown by the target of an invocation.
e: WithDiscard(boxed long 2) threw System.ArgumentException: Object of type 'System.Int64' cannot be converted to type 'E'.
e: WithDiscard(boxed byte 2) returned b
e: WithDiscard(boxed other enum Neg.One) returned a
e: WithDiscard(string B) threw System.ArgumentException: Object of type 'System.String' cannot be converted to type 'E'.
e: WithDiscard(null) returned other
e: public constructors of record Req: [Void .ctor(E, Boolean, System.String)]
e: all instance constructors of record Req: [public Void .ctor(E, Boolean, System.String); protected Void .ctor(Req)]
e: Req built by ConstructorInfo.Invoke: Req { Kind = B, Urgent = True, Tag = t }; equals new Req(E.B, true, t): True
e: Req built with (E)7 and null Tag: Req { Kind = 7, Urgent = False, Tag =  }; Tag is null: True
e: Req built with a boxed int 2 for the enum parameter: Req { Kind = B, Urgent = False, Tag = i }
e: Rec.Describe(req) via Invoke returned B/True/t
e: Rec.Describe(hostile) via Invoke returned 7/False/<null>
e: Rec.Describe(null) threw System.Reflection.TargetInvocationException wrapping System.NullReferenceException
e: Activator.CreateInstance(typeof(Req), existing Req) threw System.MissingMethodException
e: Activator.CreateInstance(typeof(Req)) with no arguments threw System.MissingMethodException
e: public constructors of readonly record struct Cell: [Void .ctor(E, Boolean)]
e: Cell built by ConstructorInfo.Invoke: Cell { Kind = A, Flag = True }; default(Cell): Cell { Kind = 0, Flag = False }; default Kind raw=0 IsDefined=False; default == new Cell((E)0, false): True; Activator.CreateInstance(typeof(Cell)): Cell { Kind = 0, Flag = False }
e: Rec.DescribeCell(cell) via Invoke returned A/True; with a null argument returned 0/False
e: GetUninitializedObject(Counted): Marker=0 constructor runs so far=0; new Counted().Marker=42 runs=1
f: Pair(first, second)=A,B Pair(second, first)=B,A
```

`X2.cs` (switch statement without `default` in a method that must return):

```csharp
#:property LangVersion=14
#:property PublishAot=false
using System;

Console.WriteLine(Sw.StatementMustReturn(E.A));

public enum E { A = 1, B = 2 }

public static class Sw
{
    public static string StatementMustReturn(E e)
    {
        switch (e)
        {
            case E.A: return "a";
            case E.B: return "b";
        }
    }
}
```

Observed output of `dotnet build X2.cs`: `X2.cs(11,26): error CS0161: 'Sw.StatementMustReturn(E)': not all code paths return a value`

`probe2/Program.cs` (the project file is the one of E6 with the name changed):

```csharp
using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

var references = ((string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES")!).Split(Path.PathSeparator)
    .Select(path => (MetadataReference)MetadataReference.CreateFromFile(path)).ToArray();
var parse = new CSharpParseOptions(LanguageVersion.CSharp14);
var compilerAssembly = typeof(CSharpCompilation).Assembly;
Console.WriteLine($"compiler: {compilerAssembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion}");
Console.WriteLine($"runtime: {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription}; language version: {parse.LanguageVersion}");

(CSharpCompilation compilation, SyntaxTree tree, SemanticModel model) Compile(string name, string source)
{
    var tree = CSharpSyntaxTree.ParseText(source, parse);
    var compilation = CSharpCompilation.Create(name, [tree], references, new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
    return (compilation, tree, compilation.GetSemanticModel(tree));
}

void Diagnostics(string label, CSharpCompilation compilation)
{
    var all = compilation.GetDiagnostics();
    if (all.Length == 0) Console.WriteLine($"{label}: diagnostics of every severity: none");
    foreach (var d in all)
        Console.WriteLine($"{label}: diagnostic {d.Id} severity={d.Severity} default={d.DefaultSeverity} warningLevel={d.WarningLevel} line={d.Location.GetLineSpan().StartLinePosition.Line + 1}: {d.GetMessage()}");
}

void Switches(string label, SyntaxTree tree, SemanticModel model)
{
    foreach (var node in tree.GetRoot().DescendantNodes().OfType<SwitchExpressionSyntax>())
    {
        var operation = model.GetOperation(node);
        if (operation is ISwitchExpressionOperation sw)
            Console.WriteLine($"{label}: GetOperation -> {operation.Kind}: arms={sw.Arms.Length} IsExhaustive={sw.IsExhaustive} inputType={sw.Value.Type}");
        else
            Console.WriteLine($"{label}: GetOperation -> {operation?.GetType().Name ?? "null"}");
    }
    foreach (var node in tree.GetRoot().DescendantNodes().OfType<SwitchStatementSyntax>())
    {
        var operation = model.GetOperation(node);
        var hasIsExhaustive = operation?.GetType().GetInterfaces().Any(i => i.GetProperty("IsExhaustive") is not null);
        Console.WriteLine($"{label}: switch statement GetOperation -> {operation?.Kind}; cases={(operation as ISwitchOperation)?.Cases.Length}; an IsExhaustive property on its interfaces: {hasIsExhaustive}");
    }
}

void EnumReport(string label, CSharpCompilation compilation, string metadataName)
{
    var type = compilation.GetTypeByMetadataName(metadataName)!;
    var flags = type.GetAttributes().Any(a => a.AttributeClass?.ToDisplayString() == "System.FlagsAttribute");
    Console.WriteLine($"{label}: {type.Name}: TypeKind={type.TypeKind} EnumUnderlyingType={(type.EnumUnderlyingType is null ? "null" : type.EnumUnderlyingType.ToDisplayString())} SpecialType={type.EnumUnderlyingType?.SpecialType} hasFlagsAttribute={flags}");
    Console.WriteLine($"{label}: {type.Name}: GetMembers() = [{string.Join(", ", type.GetMembers().Select(m => m.Kind + " " + m.Name))}]");
    foreach (var field in type.GetMembers().OfType<IFieldSymbol>())
        Console.WriteLine($"{label}:   {field.Name}: IsConst={field.IsConst} HasConstantValue={field.HasConstantValue} ConstantValue={field.ConstantValue} clr={field.ConstantValue?.GetType()} fieldType={field.Type}");
}

const string EnumE = "public enum E { A = 1, B = 2 }\n";

// (a) + (c): switch forms over an enum with members 1 and 2 only
var variants = new (string name, string source)[]
{
    ("a1 switch expression, every member, no discard", EnumE + "public static class S { public static string M(E e) => e switch { E.A => \"a\", E.B => \"b\" }; }"),
    ("a2 switch expression, every member, discard arm", EnumE + "public static class S { public static string M(E e) => e switch { E.A => \"a\", E.B => \"b\", _ => \"other\" }; }"),
    ("a3 switch expression, one member missing", EnumE + "public static class S { public static string M(E e) => e switch { E.A => \"a\" }; }"),
    ("a4 switch statement, every member, no default, must return", EnumE + "public static class S { public static string M(E e) { switch (e) { case E.A: return \"a\"; case E.B: return \"b\"; } } }"),
    ("a5 switch statement, every member, no default, return after", EnumE + "public static class S { public static string M(E e) { switch (e) { case E.A: return \"a\"; case E.B: return \"b\"; } return \"none\"; } }"),
    ("a6 switch statement, one member missing, no default, void", EnumE + "public static class S { public static void M(E e) { switch (e) { case E.A: System.Console.Write(1); break; } } }"),
    ("a7 switch statement, every member, default arm, must return", EnumE + "public static class S { public static string M(E e) { switch (e) { case E.A: return \"a\"; case E.B: return \"b\"; default: return \"other\"; } } }"),
    ("a8 switch expression, every member plus the unnamed zero and 7 only", EnumE + "public static class S { public static string M(E e) => e switch { E.A => \"a\", E.B => \"b\", 0 => \"zero\", (E)7 => \"seven\" }; }"),
    ("a9 switch expression, relational arms covering the whole underlying range", EnumE + "public static class S { public static string M(E e) => e switch { < E.A => \"low\", E.A => \"a\", > E.A => \"high\" }; }"),
    ("a10 switch expression over a [Flags] enum, every member", "[System.Flags] public enum F { None = 0, R = 1, W = 2, RW = R | W }\npublic static class S { public static string M(F f) => f switch { F.None => \"n\", F.R => \"r\", F.W => \"w\", F.RW => \"rw\" }; }"),
    ("a11 switch expression with an unreachable arm", EnumE + "public static class S { public static string M(E e) => e switch { E.A => \"a\", _ => \"other\", E.B => \"b\" }; }"),
    ("a12 switch expression, every member, one arm guarded", EnumE + "public static class S { public static string M(E e, bool g) => e switch { E.A => \"a\", E.B when g => \"b\", _ when !g => \"x\" }; }"),
};
foreach (var (name, source) in variants)
{
    var (compilation, tree, model) = Compile("V", source);
    Diagnostics(name, compilation);
    Switches(name, tree, model);
}

// (b) + (c): enum member symbols
var (enums, _, _) = Compile("Enums", """
    public enum E { A = 1, B = 2 }
    [System.Flags] public enum F { None = 0, R = 1, W = 2, RW = R | W, X = 4 }
    public enum Dup { Light = 1, Pale = 1, Dark = 2, Dim = 2, Zed = 0 }
    public enum Neg { Minus = -1, Zero = 0, One = 1 }
    public enum Small : byte { One = 1, Max = 255 }
    public enum Wide : ulong { Max = ulong.MaxValue }
    public enum Auto { First, Second, Tenth = 10, Eleventh }
    public class NotAnEnum { public const int K = 3; public static readonly int R = 4; public int I; }
    """);
Diagnostics("enums", enums);
foreach (var name in new[] { "E", "F", "Dup", "Neg", "Small", "Wide", "Auto", "NotAnEnum" })
    EnumReport("enums", enums, name);

// (d) patterns and operators on an enum input
var (patterns, patternTree, patternModel) = Compile("Patterns", EnumE + """
    public static class Pat
    {
        public static bool Const(E e) => e is E.A;
        public static bool Or(E e) => e is E.A or E.B;
        public static bool Rel(E e) => e is > E.A;
        public static bool Eq(E x, E y) => x == y;
        public static bool Lt(E x, E y) => x < y;
    }
    """);
Diagnostics("d", patterns);
using (var stream = new MemoryStream())
    Console.WriteLine($"d: Emit success={patterns.Emit(stream).Success}");
foreach (var method in patternTree.GetRoot().DescendantNodes().OfType<MethodDeclarationSyntax>())
{
    foreach (var node in method.DescendantNodes())
    {
        switch (patternModel.GetOperation(node))
        {
            case IIsPatternOperation isPattern:
                Console.WriteLine($"d: {method.Identifier.ValueText}: IsPattern input={isPattern.Value.Type} pattern={isPattern.Pattern.Kind}");
                break;
            case IConstantPatternOperation constant:
                Console.WriteLine($"d: {method.Identifier.ValueText}:   ConstantPattern value={constant.Value.ConstantValue.Value} clr={constant.Value.ConstantValue.Value?.GetType()} valueType={constant.Value.Type}");
                break;
            case IRelationalPatternOperation relational:
                Console.WriteLine($"d: {method.Identifier.ValueText}:   RelationalPattern {relational.OperatorKind} value={relational.Value.ConstantValue.Value} clr={relational.Value.ConstantValue.Value?.GetType()} valueType={relational.Value.Type}");
                break;
            case IBinaryPatternOperation binaryPattern:
                Console.WriteLine($"d: {method.Identifier.ValueText}:   BinaryPattern {binaryPattern.OperatorKind}");
                break;
            case IBinaryOperation binary:
                Console.WriteLine($"d: {method.Identifier.ValueText}: BinaryOperation {binary.OperatorKind} left={binary.LeftOperand.Type} right={binary.RightOperand.Type} result={binary.Type} operatorMethod={(binary.OperatorMethod is null ? "null" : binary.OperatorMethod.ToDisplayString())}");
                break;
        }
    }
}

// (f) two parameters of the same enum type with the arguments swapped
var (swap, _, _) = Compile("Swap", EnumE + """
    public static class Swap
    {
        public static string Pair(E first, E second) => first + "," + second;
        public static string Caller(E first, E second) => Pair(second, first);
    }
    """);
Diagnostics("f", swap);
using (var stream = new MemoryStream())
    Console.WriteLine($"f: Emit success={swap.Emit(stream).Success}");

// public surface check by reflection on the loaded compiler assemblies
(Type type, string member)[] surface =
[
    (typeof(INamedTypeSymbol), "EnumUnderlyingType"), (typeof(IFieldSymbol), "HasConstantValue"), (typeof(IFieldSymbol), "ConstantValue"),
    (typeof(SemanticModel), "GetConstantValue"), (typeof(SemanticModel), "GetOperation"), (typeof(IOperation), "ConstantValue"),
    (typeof(Microsoft.CodeAnalysis.FlowAnalysis.ControlFlowGraph), "Create"), (typeof(ISwitchExpressionOperation), "IsExhaustive"),
    (typeof(IConstantPatternOperation), "Value"), (typeof(IRelationalPatternOperation), "OperatorKind"), (typeof(IRelationalPatternOperation), "Value"),
    (typeof(IBinaryPatternOperation), "OperatorKind"), (typeof(INegatedPatternOperation), "Pattern"), (typeof(IRecursivePatternOperation), "PropertySubpatterns"),
    (typeof(IPropertySubpatternOperation), "Member"), (typeof(IBinaryOperation), "IsChecked"), (typeof(IConversionOperation), "IsChecked"),
    (typeof(ITypeSymbol), "IsRecord"), (typeof(INamedTypeSymbol), "InstanceConstructors"), (typeof(IPropertySymbol), "IsRequired"),
    (typeof(IFieldSymbol), "IsRequired"), (typeof(IMethodSymbol), "IsInitOnly"),
];
foreach (var (type, member) in surface)
{
    var found = type.GetMember(member, BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static);
    var experimental = found.Any(m => m.GetCustomAttributesData().Any(a => a.AttributeType.Name == "ExperimentalAttribute")) || type.GetCustomAttributesData().Any(a => a.AttributeType.Name == "ExperimentalAttribute");
    var obsolete = found.Any(m => m.GetCustomAttributesData().Any(a => a.AttributeType.Name == "ObsoleteAttribute")) || type.GetCustomAttributesData().Any(a => a.AttributeType.Name == "ObsoleteAttribute");
    Console.WriteLine($"surface: {type.FullName}.{member}: typeIsPublic={type.IsPublic} publicMembers={found.Length} experimental={experimental} obsolete={obsolete} assembly={type.Assembly.GetName().Name}");
}
```

Observed output of `dotnet run --project probe2/Probe2.csproj`, without the 22 lines that start with `surface:`:

```text
compiler: 5.9.0-1.26379.115+14fbf8d5271c98133561eb55185fdb05b286f578
runtime: .NET 10.0.11; language version: CSharp14
a1 switch expression, every member, no discard: diagnostic CS8524 severity=Warning default=Warning warningLevel=1 line=2: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '(E)0' is not covered.
a1 switch expression, every member, no discard: GetOperation -> SwitchExpression: arms=2 IsExhaustive=False inputType=E
a2 switch expression, every member, discard arm: diagnostics of every severity: none
a2 switch expression, every member, discard arm: GetOperation -> SwitchExpression: arms=3 IsExhaustive=True inputType=E
a3 switch expression, one member missing: diagnostic CS8509 severity=Warning default=Warning warningLevel=1 line=2: The switch expression does not handle all possible values of its input type (it is not exhaustive). For example, the pattern 'E.B' is not covered.
a3 switch expression, one member missing: GetOperation -> SwitchExpression: arms=1 IsExhaustive=False inputType=E
a4 switch statement, every member, no default, must return: diagnostic CS0161 severity=Error default=Error warningLevel=0 line=2: 'S.M(E)': not all code paths return a value
a4 switch statement, every member, no default, must return: switch statement GetOperation -> Switch; cases=2; an IsExhaustive property on its interfaces: False
a5 switch statement, every member, no default, return after: diagnostics of every severity: none
a5 switch statement, every member, no default, return after: switch statement GetOperation -> Switch; cases=2; an IsExhaustive property on its interfaces: False
a6 switch statement, one member missing, no default, void: diagnostics of every severity: none
a6 switch statement, one member missing, no default, void: switch statement GetOperation -> Switch; cases=1; an IsExhaustive property on its interfaces: False
a7 switch statement, every member, default arm, must return: diagnostics of every severity: none
a7 switch statement, every member, default arm, must return: switch statement GetOperation -> Switch; cases=3; an IsExhaustive property on its interfaces: False
a8 switch expression, every member plus the unnamed zero and 7 only: diagnostic CS8524 severity=Warning default=Warning warningLevel=1 line=2: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '(E)3' is not covered.
a8 switch expression, every member plus the unnamed zero and 7 only: GetOperation -> SwitchExpression: arms=4 IsExhaustive=False inputType=E
a9 switch expression, relational arms covering the whole underlying range: diagnostics of every severity: none
a9 switch expression, relational arms covering the whole underlying range: GetOperation -> SwitchExpression: arms=3 IsExhaustive=True inputType=E
a10 switch expression over a [Flags] enum, every member: diagnostic CS8524 severity=Warning default=Warning warningLevel=1 line=2: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '(F)4' is not covered.
a10 switch expression over a [Flags] enum, every member: GetOperation -> SwitchExpression: arms=4 IsExhaustive=False inputType=F
a11 switch expression with an unreachable arm: diagnostic CS8510 severity=Error default=Error warningLevel=0 line=2: The pattern is unreachable. It has already been handled by a previous arm of the switch expression or it is impossible to match.
a11 switch expression with an unreachable arm: GetOperation -> SwitchExpression: arms=3 IsExhaustive=True inputType=E
a12 switch expression, every member, one arm guarded: diagnostic CS8846 severity=Warning default=Warning warningLevel=1 line=2: The switch expression does not handle all possible values of its input type (it is not exhaustive). For example, the pattern 'E.B' is not covered. However, a pattern with a 'when' clause might successfully match this value.
a12 switch expression, every member, one arm guarded: GetOperation -> SwitchExpression: arms=3 IsExhaustive=False inputType=E
enums: diagnostics of every severity: none
enums: E: TypeKind=Enum EnumUnderlyingType=int SpecialType=System_Int32 hasFlagsAttribute=False
enums: E: GetMembers() = [Field A, Field B, Method .ctor]
enums:   A: IsConst=True HasConstantValue=True ConstantValue=1 clr=System.Int32 fieldType=E
enums:   B: IsConst=True HasConstantValue=True ConstantValue=2 clr=System.Int32 fieldType=E
enums: F: TypeKind=Enum EnumUnderlyingType=int SpecialType=System_Int32 hasFlagsAttribute=True
enums: F: GetMembers() = [Field None, Field R, Field W, Field RW, Field X, Method .ctor]
enums:   None: IsConst=True HasConstantValue=True ConstantValue=0 clr=System.Int32 fieldType=F
enums:   R: IsConst=True HasConstantValue=True ConstantValue=1 clr=System.Int32 fieldType=F
enums:   W: IsConst=True HasConstantValue=True ConstantValue=2 clr=System.Int32 fieldType=F
enums:   RW: IsConst=True HasConstantValue=True ConstantValue=3 clr=System.Int32 fieldType=F
enums:   X: IsConst=True HasConstantValue=True ConstantValue=4 clr=System.Int32 fieldType=F
enums: Dup: TypeKind=Enum EnumUnderlyingType=int SpecialType=System_Int32 hasFlagsAttribute=False
enums: Dup: GetMembers() = [Field Light, Field Pale, Field Dark, Field Dim, Field Zed, Method .ctor]
enums:   Light: IsConst=True HasConstantValue=True ConstantValue=1 clr=System.Int32 fieldType=Dup
enums:   Pale: IsConst=True HasConstantValue=True ConstantValue=1 clr=System.Int32 fieldType=Dup
enums:   Dark: IsConst=True HasConstantValue=True ConstantValue=2 clr=System.Int32 fieldType=Dup
enums:   Dim: IsConst=True HasConstantValue=True ConstantValue=2 clr=System.Int32 fieldType=Dup
enums:   Zed: IsConst=True HasConstantValue=True ConstantValue=0 clr=System.Int32 fieldType=Dup
enums: Neg: TypeKind=Enum EnumUnderlyingType=int SpecialType=System_Int32 hasFlagsAttribute=False
enums: Neg: GetMembers() = [Field Minus, Field Zero, Field One, Method .ctor]
enums:   Minus: IsConst=True HasConstantValue=True ConstantValue=-1 clr=System.Int32 fieldType=Neg
enums:   Zero: IsConst=True HasConstantValue=True ConstantValue=0 clr=System.Int32 fieldType=Neg
enums:   One: IsConst=True HasConstantValue=True ConstantValue=1 clr=System.Int32 fieldType=Neg
enums: Small: TypeKind=Enum EnumUnderlyingType=byte SpecialType=System_Byte hasFlagsAttribute=False
enums: Small: GetMembers() = [Field One, Field Max, Method .ctor]
enums:   One: IsConst=True HasConstantValue=True ConstantValue=1 clr=System.Byte fieldType=Small
enums:   Max: IsConst=True HasConstantValue=True ConstantValue=255 clr=System.Byte fieldType=Small
enums: Wide: TypeKind=Enum EnumUnderlyingType=ulong SpecialType=System_UInt64 hasFlagsAttribute=False
enums: Wide: GetMembers() = [Field Max, Method .ctor]
enums:   Max: IsConst=True HasConstantValue=True ConstantValue=18446744073709551615 clr=System.UInt64 fieldType=Wide
enums: Auto: TypeKind=Enum EnumUnderlyingType=int SpecialType=System_Int32 hasFlagsAttribute=False
enums: Auto: GetMembers() = [Field First, Field Second, Field Tenth, Field Eleventh, Method .ctor]
enums:   First: IsConst=True HasConstantValue=True ConstantValue=0 clr=System.Int32 fieldType=Auto
enums:   Second: IsConst=True HasConstantValue=True ConstantValue=1 clr=System.Int32 fieldType=Auto
enums:   Tenth: IsConst=True HasConstantValue=True ConstantValue=10 clr=System.Int32 fieldType=Auto
enums:   Eleventh: IsConst=True HasConstantValue=True ConstantValue=11 clr=System.Int32 fieldType=Auto
enums: NotAnEnum: TypeKind=Class EnumUnderlyingType=null SpecialType= hasFlagsAttribute=False
enums: NotAnEnum: GetMembers() = [Field K, Field R, Field I, Method .ctor, Method .cctor]
enums:   K: IsConst=True HasConstantValue=True ConstantValue=3 clr=System.Int32 fieldType=int
enums:   R: IsConst=False HasConstantValue=False ConstantValue= clr= fieldType=int
enums:   I: IsConst=False HasConstantValue=False ConstantValue= clr= fieldType=int
d: diagnostics of every severity: none
d: Emit success=True
d: Const: IsPattern input=E pattern=ConstantPattern
d: Or: IsPattern input=E pattern=BinaryPattern
d: Or:   BinaryPattern Or
d: Or:   ConstantPattern value=1 clr=System.Int32 valueType=E
d: Or:   ConstantPattern value=2 clr=System.Int32 valueType=E
d: Rel: IsPattern input=E pattern=RelationalPattern
d: Rel:   RelationalPattern GreaterThan value=1 clr=System.Int32 valueType=E
d: Eq: BinaryOperation Equals left=E right=E result=bool operatorMethod=null
d: Lt: BinaryOperation LessThan left=E right=E result=bool operatorMethod=null
f: diagnostics of every severity: none
f: Emit success=True
```

All 22 `surface:` lines read `typeIsPublic=True`, at least one public member, `experimental=False obsolete=False assembly=Microsoft.CodeAnalysis`.

`probe3/Program.cs`:

```csharp
using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

var references = ((string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES")!).Split(Path.PathSeparator)
    .Select(path => (MetadataReference)MetadataReference.CreateFromFile(path)).ToArray();
var parse = new CSharpParseOptions(LanguageVersion.CSharp14);
Console.WriteLine($"compiler: {typeof(CSharpCompilation).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion}; runtime: {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription}; language version: {parse.LanguageVersion}");

const string EnumE = "public enum E { A = 1, B = 2 }\n";
var variants = new (string name, string source)[]
{
    ("g1 two paths to the default: unnamed 7 on one, named E.B on the other", EnumE + "public static class S { public static int M(E e) => e switch { > (E)2 and not (E)7 => 1, E.A => 2 }; }"),
    ("g2 same arms in the other order", EnumE + "public static class S { public static int M(E e) => e switch { E.A => 2, > (E)2 and not (E)7 => 1 }; }"),
    ("g3 pair of enums: first component leaves only unnamed values, second leaves E.B", EnumE + "public static class S { public static int M(E x, E y) => (x, y) switch { (E.A or E.B, E.A) => 1 }; }"),
    ("g4 pair of enums: every named pair covered", EnumE + "public static class S { public static int M(E x, E y) => (x, y) switch { (E.A or E.B, E.A or E.B) => 1 }; }"),
    ("g5 pair of enums: named pair (B, B) missing, first arm leaves unnamed x", EnumE + "public static class S { public static int M(E x, E y) => (x, y) switch { (E.A, _) => 1, (E.B, E.A) => 2 }; }"),
    ("g6 record with an enum property: every named member", EnumE + "public record R(E Kind, bool Flag);\npublic static class S { public static int M(R r) => r switch { { Kind: E.A } => 1, { Kind: E.B } => 2 }; }"),
    ("g7 nullable enum input, every named member, no null arm", EnumE + "public static class S { public static int M(E? e) => e switch { E.A => 1, E.B => 2 }; }"),
    ("g8 string input, not null arm only (nullable context disabled)", "public static class S { public static int M(string s) => s switch { \"a\" => 1, not null => 2 }; }"),
    ("g9 bool input, both values", "public static class S { public static int M(bool b) => b switch { true => 1, false => 2 }; }"),
    ("g10 switch statement, patterns cover the whole underlying range, no default, must return", EnumE + "public static class S { public static string M(E e) { switch (e) { case < E.A: return \"low\"; case E.A: return \"a\"; case > E.A: return \"high\"; } } }"),
    ("g11 implicit conversion of constant zero and of constant one to the enum", EnumE + "public static class S { public static E Zero() { E z = 0; return z; } public static E One() { E o = 1; return o; } }"),
    ("g12 enum arithmetic without a cast", EnumE + "public static class S { public static E Plus(E e) => e + 1; public static E Or(E x, E y) => x | y; public static E Not(E e) => ~e; public static E Inc(E e) { e++; return e; } public static int Diff(E x, E y) => x - y; }"),
};
foreach (var (name, source) in variants)
{
    var tree = CSharpSyntaxTree.ParseText(source, parse);
    var compilation = CSharpCompilation.Create("V", [tree], references, new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
    var model = compilation.GetSemanticModel(tree);
    var all = compilation.GetDiagnostics();
    if (all.Length == 0) Console.WriteLine($"{name}: diagnostics of every severity: none");
    foreach (var d in all)
        Console.WriteLine($"{name}: diagnostic {d.Id} severity={d.Severity} warningLevel={d.WarningLevel}: {d.GetMessage()}");
    foreach (var node in tree.GetRoot().DescendantNodes().OfType<SwitchExpressionSyntax>())
        if (model.GetOperation(node) is ISwitchExpressionOperation sw)
            Console.WriteLine($"{name}: IsExhaustive={sw.IsExhaustive} inputType={sw.Value.Type}");
    foreach (var node in tree.GetRoot().DescendantNodes().OfType<BinaryExpressionSyntax>())
        if (model.GetOperation(node) is IBinaryOperation b)
            Console.WriteLine($"{name}: binary {b.OperatorKind} left={b.LeftOperand.Type} right={b.RightOperand.Type} result={b.Type} checked={b.IsChecked}");
}
```

Observed output of `dotnet run --project probe3/Probe3.csproj`:

```text
compiler: 5.9.0-1.26379.115+14fbf8d5271c98133561eb55185fdb05b286f578; runtime: .NET 10.0.11; language version: CSharp14
g1 two paths to the default: unnamed 7 on one, named E.B on the other: diagnostic CS8524 severity=Warning warningLevel=1: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '(E)7' is not covered.
g1 two paths to the default: unnamed 7 on one, named E.B on the other: IsExhaustive=False inputType=E
g2 same arms in the other order: diagnostic CS8509 severity=Warning warningLevel=1: The switch expression does not handle all possible values of its input type (it is not exhaustive). For example, the pattern 'E.B' is not covered.
g2 same arms in the other order: IsExhaustive=False inputType=E
g3 pair of enums: first component leaves only unnamed values, second leaves E.B: diagnostic CS8509 severity=Warning warningLevel=1: The switch expression does not handle all possible values of its input type (it is not exhaustive). For example, the pattern '(E.A, E.B)' is not covered.
g3 pair of enums: first component leaves only unnamed values, second leaves E.B: IsExhaustive=False inputType=(E x, E y)
g4 pair of enums: every named pair covered: diagnostic CS8524 severity=Warning warningLevel=1: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '((E)0, _)' is not covered.
g4 pair of enums: every named pair covered: IsExhaustive=False inputType=(E x, E y)
g5 pair of enums: named pair (B, B) missing, first arm leaves unnamed x: diagnostic CS8524 severity=Warning warningLevel=1: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '((E)0, _)' is not covered.
g5 pair of enums: named pair (B, B) missing, first arm leaves unnamed x: IsExhaustive=False inputType=(E x, E y)
g6 record with an enum property: every named member: diagnostic CS8524 severity=Warning warningLevel=1: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '{ Kind: (E)0 }' is not covered.
g6 record with an enum property: every named member: IsExhaustive=False inputType=R
g7 nullable enum input, every named member, no null arm: diagnostic CS8524 severity=Warning warningLevel=1: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '(E)0' is not covered.
g7 nullable enum input, every named member, no null arm: IsExhaustive=False inputType=E?
g8 string input, not null arm only (nullable context disabled): diagnostics of every severity: none
g8 string input, not null arm only (nullable context disabled): IsExhaustive=False inputType=string
g9 bool input, both values: diagnostics of every severity: none
g9 bool input, both values: IsExhaustive=True inputType=bool
g10 switch statement, patterns cover the whole underlying range, no default, must return: diagnostics of every severity: none
g11 implicit conversion of constant zero and of constant one to the enum: diagnostic CS0266 severity=Error warningLevel=0: Cannot implicitly convert type 'int' to 'E'. An explicit conversion exists (are you missing a cast?)
g12 enum arithmetic without a cast: diagnostics of every severity: none
g12 enum arithmetic without a cast: binary Add left=E right=int result=E checked=False
g12 enum arithmetic without a cast: binary Or left=E right=E result=E checked=False
g12 enum arithmetic without a cast: binary Subtract left=E right=E result=int checked=False
```

`X4.cs` (variant g1 through the real build):

```csharp
#:property LangVersion=14
#:property PublishAot=false
using System;

try { Console.WriteLine($"M(E.B) = {S.M(E.B)}"); }
catch (Exception ex) { Console.WriteLine($"M(E.B) threw {ex.GetType().FullName}"); }

public enum E { A = 1, B = 2 }
public static class S { public static int M(E e) => e switch { > (E)2 and not (E)7 => 1, E.A => 2 }; }
```

Observed: `X4.cs(9,55): warning CS8524: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '(E)7' is not covered.` and then `M(E.B) threw System.Runtime.CompilerServices.SwitchExpressionException`

`X3.cs`:

```csharp
#:property LangVersion=14
#:property PublishAot=false
#:property Nullable=enable
#:property InvariantGlobalization=false
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;

Console.WriteLine($"runtime: {RuntimeInformation.FrameworkDescription}; culture: {CultureInfo.CurrentCulture.Name}");

// enum arithmetic without a cast (row Q1-10)
E b = E.B;
E plus = b + 1;
E or = E.A | E.B;
E not = ~E.A;
E inc = b; inc++;
Small max = Small.Max;
Small wrapped = max + 1;
E zero = 0;
Console.WriteLine($"arith: E.B + 1 raw={(int)plus} defined={Enum.IsDefined(plus)}; E.A | E.B raw={(int)or} defined={Enum.IsDefined(or)}; ~E.A raw={(int)not}; E.B++ raw={(int)inc}; (Small)255 + 1 raw={(int)wrapped}; E zero = 0 raw={(int)zero}");

// strings: composed and decomposed forms of the same text (rows Q4-01, Q4-03, Q4-05, Q4-07, Q5-05; items 11 and 16 of section (c))
string composed = "é";
string decomposed = "é";
Console.WriteLine($"string: culture comparison says equal: {string.Equals(composed, decomposed, StringComparison.InvariantCulture)}; == says: {composed == decomposed}; constant pattern says: {decomposed is "é"}; switch says: {Classify(decomposed)} and for the composed form: {Classify(composed)}");
Console.WriteLine($"string: EqualityComparer<string>.Default says equal: {EqualityComparer<string>.Default.Equals(composed, decomposed)}; comparer type: {EqualityComparer<string>.Default.GetType().Name}");
Console.WriteLine($"record: Req with composed Tag == Req with decomposed Tag: {new Req(E.A, true, composed) == new Req(E.A, true, decomposed)}; with Tag a and Tag A: {new Req(E.A, true, "a") == new Req(E.A, true, "A")}; with equal content built separately: {new Req(E.A, true, new string('x', 3)) == new Req(E.A, true, "xxx")}; null Tag on both sides: {new Req(E.A, true, null!) == new Req(E.A, true, null!)}");
Console.WriteLine($"record struct: Cell(E.A, true) == Cell(E.A, true): {new Cell(E.A, true) == new Cell(E.A, true)}; Cell((E)7, false) == Cell((E)7, false): {new Cell((E)7, false) == new Cell((E)7, false)}");

static string Classify(string s)
{
    switch (s)
    {
        case "é": return "composed case";
        default: return "default case";
    }
}

public enum E { A = 1, B = 2 }
public enum Small : byte { One = 1, Max = 255 }
public record Req(E Kind, bool Urgent, string Tag);
public readonly record struct Cell(E Kind, bool Flag);
```

Observed output:

```text
runtime: .NET 10.0.11; culture: en-US
arith: E.B + 1 raw=3 defined=False; E.A | E.B raw=3 defined=False; ~E.A raw=-2; E.B++ raw=3; (Small)255 + 1 raw=0; E zero = 0 raw=0
string: culture comparison says equal: True; == says: False; constant pattern says: False; switch says: default case and for the composed form: composed case
string: EqualityComparer<string>.Default says equal: False; comparer type: StringEqualityComparer
record: Req with composed Tag == Req with decomposed Tag: False; with Tag a and Tag A: False; with equal content built separately: True; null Tag on both sides: True
record struct: Cell(E.A, true) == Cell(E.A, true): True; Cell((E)7, false) == Cell((E)7, false): True
```

`X5.cs`:

```csharp
#:property LangVersion=14
#:property PublishAot=false
#:property InvariantGlobalization=false
using System;
using System.Globalization;

foreach (string name in new[] { "en-US", "tr-TR" })
{
    CultureInfo.CurrentCulture = new CultureInfo(name);
    Console.WriteLine($"{name}: CurrentCultureIgnoreCase={string.Equals("file", "FILE", StringComparison.CurrentCultureIgnoreCase)} OrdinalIgnoreCase={string.Equals("file", "FILE", StringComparison.OrdinalIgnoreCase)} Ordinal={string.Equals("file", "FILE", StringComparison.Ordinal)} ==:{"file" == "FILE".ToLowerInvariant()}");
}
```

Observed output:

```text
en-US: CurrentCultureIgnoreCase=True OrdinalIgnoreCase=True Ordinal=False ==:True
tr-TR: CurrentCultureIgnoreCase=False OrdinalIgnoreCase=True Ordinal=False ==:True
```

Observed output of E6, `dotnet run --project probe/Probe.csproj`:

```text
compiler: 5.9.0-1.26379.115+14fbf8d5271c98133561eb55185fdb05b286f578
options: checkOverflow=False nullable=Disable warningLevel=4
diagnostic: CS8524 Warning level=1 line=6: The switch expression does not handle some values of its input type (it is not exhaustive) involving an unnamed enum value. For example, the pattern '(Level)0' is not covered.
diagnostic: CS8509 Warning level=1 line=7: The switch expression does not handle all possible values of its input type (it is not exhaustive). For example, the pattern 'Level.High' is not covered.
diagnostic: CS0652 Warning level=2 line=12: Comparison to integral constant is useless; the constant is outside the range of type 'byte'
diagnostic: CS0161 Error level=0 line=14: 'Subject.Statement(Level)': not all code paths return a value
enum: kind=Enum underlying=byte
member Low: has=True value=1 clr=System.Byte
member High: has=True value=2 clr=System.Byte
member Top: has=True value=2 clr=System.Byte
record: IsRecord=True constructors=Public Pair.Pair(Level, bool); Protected Pair.Pair(Pair)
method Named
  switch expression: arms=2 IsExhaustive=False
  constant pattern: input=Level value=1 clr=System.Byte
  constant pattern: input=Level value=2 clr=System.Byte
  control flow graph: 8 blocks
method Partial
  switch expression: arms=1 IsExhaustive=False
  constant pattern: input=Level value=1 clr=System.Byte
  control flow graph: 6 blocks
method Total
  switch expression: arms=2 IsExhaustive=True
  constant pattern: input=Level value=1 clr=System.Byte
  control flow graph: 8 blocks
method Range
  switch expression: arms=3 IsExhaustive=True
  relational pattern: LessThan value=0
  binary pattern: And
  relational pattern: GreaterThanOrEqual value=0
  relational pattern: LessThan value=100
  relational pattern: GreaterThanOrEqual value=100
  control flow graph: 10 blocks
method Ordered
  relational pattern: GreaterThan value=1
  control flow graph: 3 blocks
method Shape
  recursive pattern: members=Level,Flag
  binary pattern: Or
  constant pattern: input=Level value=1 clr=System.Byte
  constant pattern: input=Level value=2 clr=System.Byte
  negated pattern
  constant pattern: input=bool value=False clr=System.Boolean
  control flow graph: 3 blocks
method Narrow
  binary operation: Equals left=int right=int checked=False
  control flow graph: 3 blocks
method Mixed
  binary operation: LessThan left=long right=long checked=False
  control flow graph: 3 blocks
method Statement
  control flow graph: 6 blocks
overflow diagnostic: CS0220 Error: The operation overflows at compile time in checked mode
```

### Table 2: citations

Basis codes, which name the evidence behind each verdict:

- `line`: the cited file was downloaded at the cited commit, the cited line numbers were printed, and the quote is there.
- `page`: the page was downloaded on 2026-11-11 and the quoted sentence was found in its text. A page is not pinned to a commit.
- `api`: the response of the nuget.org API or the GitHub API was read.
- `pkg`: the package file was downloaded and its entry list, nuspec or build file was read.
- `local`: a file on the machine was read.
- `run X`: observed in experiment X of Table 1.

A verdict of `confirmed` on basis `line` or `page` alone says that the source contains the quote.
It does not say that the compiler or the runtime behaves that way.

| Row | Verdict | Basis, and the accurate statement where the verdict is not `confirmed` |
|---|---|---|
| Q1-01 | confirmed | line; run E1, A |
| Q1-02 | confirmed | line |
| Q1-03 | confirmed | line; run C |
| Q1-04 | confirmed | line |
| Q1-05 | confirmed | line; run E1 (258 cast to a `byte` enum gives 2) |
| Q1-06 | confirmed | page; run A |
| Q1-07 | confirmed | line |
| Q1-08 | confirmed | line; run G (g11) |
| Q1-09 | confirmed | line; run B |
| Q1-10 | confirmed | line; run G (g12), H |
| Q1-11 | confirmed | page |
| Q1-12 | confirmed | page; run E1 |
| Q1-13 | confirmed | page |
| Q1-14 | confirmed | page; run A for values; the form that takes a name as a string was not run |
| Q1-15 | confirmed | page; run B |
| Q1-16 | confirmed | page; not run |
| Q1-17 | confirmed | page; run E1, E |
| Q1-18 | confirmed | page; run B. The same page says the array is sorted by unsigned magnitude, and the run shows it. |
| Q1-19 | confirmed | line; run A |
| Q1-20 | confirmed | page |
| Q1-21 | confirmed | line, C# 7 text; run G (g10) agrees on the installed compiler |
| Q1-22 | confirmed | line; run A (a4, a5), `X2.cs` |
| Q1-23 | confirmed | line; run A |
| Q1-24 | confirmed | page; run A |
| Q1-25 | confirmed | page; run A |
| Q1-26 | confirmed | line |
| Q1-27 | confirmed | line; run A (a3) |
| Q1-28 | narrower | CS8524 is reported when the example that the compiler picks is an unnamed enum value. It was also reported on a `switch` expression that leaves a named member unhandled (run G, g1 and g5). Message text: <https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/CSharpResources.resx#L6017> |
| Q1-29 | refuted | The compiler reports on the first path to the default label that it finds, and then stops. It reports CS8509 when a declared public member is among the values left on that path, and CS8524 when none is. A named member left unhandled on another path does not change the code. Read at <https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Binder/SwitchExpressionBinder.cs#L101-L116> and <https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/CSharp/Portable/Binder/PatternExplainer.cs#L805-L825>; observed in run G (g1, g2, g5) and `X4.cs`. The quoted comment lines are present at lines 811-812. |
| Q1-30 | confirmed | line; run A (a12) |
| Q1-31 | confirmed | line; run A, E6 (level 1 printed) |
| Q1-32 | confirmed | line; run A (a11) |
| Q1-33 | confirmed | line; run G (g7, g8) for the first half; the nullable diagnostic was not triggered in a run |
| Q1-34 | confirmed | page. The sentence is on the page. It does not describe the first-path behaviour of row Q1-29 either. |
| Q1-35 | confirmed | page; run A (a6): a switch statement that misses a member gets no diagnostic of any severity from the compiler |
| Q2-01 | confirmed | local |
| Q2-02 | confirmed | local, working tree; the two `HintPath` lines are lines 13 and 16 |
| Q2-03 | confirmed | api |
| Q2-05 | confirmed | line |
| Q2-06 | confirmed | line; run C |
| Q2-07 | confirmed | line; run C |
| Q2-08 | confirmed | line; reflection in run C; the method was not called |
| Q2-09 | confirmed | line; run C, E6 |
| Q2-10 | confirmed | line |
| Q2-11 | confirmed | line; run E6 |
| Q2-14 | confirmed | line; run C |
| Q2-15 | confirmed | line; run C, G. One detail read in the same lines: when an arm has an error the default label is kept and no warning is considered. |
| Q2-16 | confirmed | line; run E6, D |
| Q2-17 | confirmed | line; run E6, D |
| Q2-18 | confirmed | line; run E6, D |
| Q2-19 | confirmed | line; run E6 |
| Q2-20 | confirmed | line; run E6 |
| Q2-21 | confirmed | line; run E6 for `IBinaryOperation.IsChecked`; `IConversionOperation.IsChecked` by reflection only |
| Q2-22 | confirmed | line; run E6 for `IsRecord` and `InstanceConstructors`; the other three by reflection only |
| Q2-23 | confirmed | line |
| Q2-24 | confirmed | line; run E6 |
| Q2-25 | confirmed | line |
| Q2-26 | narrower | No compatibility guarantee was found, so stability across compiler versions is not established. What was established: every member of rows Q2-06 to Q2-22 is listed in <https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/src/Compilers/Core/Portable/PublicAPI.Shipped.txt> at the cited lines; none of the 22 members read by reflection in the installed assembly carries an `Experimental` or `Obsolete` attribute; and the file <https://github.com/dotnet/dotnet/blob/14fbf8d5271c98133561eb55185fdb05b286f578/src/roslyn/docs/Breaking%20API%20Changes.md> (120 lines, read by headings and by a text search for ten names from these rows) lists breaking changes of public API in versions 1.1.0 to 4.9.0 and names none of these members. A search that found nothing is not a guarantee. |
| Q3-01 | confirmed | line |
| Q3-02 | confirmed | line; run E3, E6 |
| Q3-03 | confirmed | line; run E3, E6 |
| Q3-04 | confirmed | line; not run |
| Q3-06 | confirmed | run E3; the citation was not re-opened |
| Q3-07 | confirmed | run E3; the citation was not re-opened |
| Q3-08 | confirmed | line; run E3 for `uint`; the `ulong` case was not run |
| Q3-10 | confirmed | line; run E3, E6. The warning level observed is 2. |
| Q3-11 | confirmed | line; run E3, H |
| Q3-12 | confirmed | run H and the options line of E6; the page was not re-opened |
| Q3-13 | confirmed | line; run E6 |
| Q3-14 | confirmed | line |
| Q3-15 | confirmed | line; run E3 |
| Q3-16 | confirmed | run E3; the citation was not re-opened |
| Q3-17 | confirmed | line; run E3 |
| Q3-18 | confirmed | line; run E3: `OverflowException` on this machine |
| Q3-19 | confirmed | line; run E3 |
| Q3-23 | confirmed | line; run D |
| Q3-24 | confirmed | line |
| Q3-25 | confirmed | line; a text search of the whole proposal file for "enum" found no match. The installed compiler accepts an enum input all the same (run D, E6). |
| Q3-26 | confirmed | page; run D, E6 |
| Q3-27 | confirmed | run E6 (`Range`: `IsExhaustive=True`); the citation was not re-opened |
| Q4-01 | confirmed | line; run E4, H |
| Q4-02 | confirmed | line; run E4 |
| Q4-03 | confirmed | page; run H |
| Q4-04 | confirmed | line; the commit in the link is the commit in the product version of the installed core library |
| Q4-05 | confirmed | line; run E4, H |
| Q4-06 | confirmed | line; run E4 |
| Q4-07 | confirmed | line; run E4, H |
| Q4-08 | confirmed | page; the sentence occurs three times, once per overload |
| Q4-09 | confirmed | page; run E4 |
| Q4-12 | confirmed | run I; the page was not re-opened |
| Q4-13 | confirmed | run I; the page was not re-opened |
| Q4-15 | confirmed | run E4; the page was not re-opened |
| Q4-17 | confirmed | run E: a `null` string reached a non-nullable `string` parameter with the nullable context enabled |
| Q5-01 | confirmed | line; run E5, E |
| Q5-02 | confirmed | page |
| Q5-03 | confirmed | page; not run |
| Q5-05 | confirmed | line; run H for a string field |
| Q5-06 | confirmed | line; run H |
| Q5-07 | confirmed | line; run E5, E for an unsealed record; the sealed case was not run |
| Q5-08 | narrower | The page lists a parameterless constructor for record struct types: <https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record>. Reflection on a compiled positional `readonly record struct` lists one public constructor, the positional one, and no parameterless constructor (run E). The zero value is still reachable through `default`, through `Activator.CreateInstance(type)` and through a `null` argument to `Invoke`. A plain `record struct` was not run. |
| Q5-09 | confirmed | page; run E5, E |
| Q5-10 | confirmed | line; run E5, E |
| Q5-14 | confirmed | run E5; the citation was not re-opened |
| Q5-16 | confirmed | run E; the page was not re-opened |
| Q5-17 | confirmed | page; run E5, E. The run adds that the protected copy constructor is not picked: `MissingMethodException`. |
| Q5-18 | confirmed | page; an exception from a constructor was not run |
| Q5-19 | confirmed | run E2, E; the page was not re-opened |
| Q5-20 | confirmed | run E: no constructor ran; the page was not re-opened |
| Q6-01 | confirmed | api |
| Q6-02 | confirmed | api |
| Q6-03 | confirmed | pkg |
| Q6-04 | confirmed | pkg |
| Q6-05 | confirmed | pkg |
| Q6-06 | confirmed | pkg; run E7 |
| Q6-07 | confirmed | api: tag `z3-5.4.1`, `published_at` `2026-11-11T03:40:49Z`, both package assets present |
| Q6-08 | confirmed | pkg: six native libraries, one managed assembly under `lib/netstandard2.0`, `MIT` in the nuspec |
| Q6-09 | confirmed | pkg: `.signature.p7s` is in the 4.12.2 entry list and not in the 5.4.1 entry list |
| Q6-10 | confirmed | line |
| Q6-12 | confirmed | line |
| Q6-13 | confirmed | api |
| Q6-15 | confirmed | pkg, both packages |
| Q6-16 | confirmed | line; api for the asset names |
| Q6-22 | narrower | The quoted line is line 126 of the backend source at the last commit that changed that file (short hash `c850b39`), read with `git show`. In the working tree on 2026-11-11 the file is modified, the quoted line is absent, and the code at that place builds each input from a list of tokens. The row is true of the committed file only. |

### Error rate

- Rows in section (b): 148.
- Rows checked: 123.
- Confirmed: 118.
- Narrower: 4 (Q1-28, Q2-26, Q5-08, Q6-22).
- Refuted: 1 (Q1-29).
- Unreachable: 0.
- Not checked: 25.
- Of the 118 confirmed rows, 13 rest on a run only, without the citation re-opened: Q3-06, Q3-07, Q3-12, Q3-16, Q3-27, Q4-12, Q4-13, Q4-15, Q4-17, Q5-14, Q5-16, Q5-19, Q5-20.
- Predictions of section (d): every prediction held, and the five results it left open were observed (a boxed `int` is accepted; `min / -1` throws; the uninitialized object prints default fields; a relational pattern accepts an enum; `ConstantValue` of an enum member is a boxed value of the underlying type).
- The one refuted row was found by an input that section (d) does not contain. The experiments of section (d) could not have refuted it, because each of them has one path to the default label.

Limits of the agreement.
118 confirmations in a row is a long stretch of agreement, so its basis is stated.
The line numbers and quotes matched on every line printed, which shows careful citation and nothing more.
Each run shows the behaviour for the inputs tried, on one machine, one SDK and one runtime.
No verdict here was changed after it was first reached.

### Rows that must not be relied on as written

- **Q1-29.** Corrected: the warning code describes the first unhandled path the compiler finds. CS8524 does not show that every named member is handled, and CS8509 does not show that only named members are missing. Use `IsExhaustive` and the arms themselves, never the warning ID, to decide what is handled.
- **Q1-28.** Corrected: CS8524 means that the reported example is an unnamed enum value. Other values, named ones included, can be unhandled in the same `switch` expression.
- **Q5-08.** Corrected: a positional `readonly record struct` exposes one constructor to reflection. The zero value exists without any constructor and has to be added to the input domain as its own case: it holds enum value 0 also when 0 is not a named member.
- **Q2-26.** Corrected: no guarantee of stability was found. The members are shipped public API at the SDK commit, with no experimental marker.
- **Q6-22.** Corrected: true of the committed backend file; the working-tree file has changed.

Observed behaviour that no row states, and that a row could be read as excluding:

- `Enum.GetValues` sorts by unsigned magnitude (`[0,1,-1]` for members -1, 0, 1) and repeats shared values; printing a repeated value shows one name twice. Declaration order comes from the fields, or from the compiler symbols.
- `MethodBase.Invoke` and `ConstructorInfo.Invoke` convert a boxed `int`, a boxed `byte` and a value of another enum type to the enum parameter, and turn `null` into the value 0. A wrong argument type does not fail; it becomes an input.
- `IsExhaustive` was `False` with no diagnostic when the only unhandled input was `null` (g8, nullable context disabled).
- `IsExhaustive` was `True` in a compilation that has error CS8510 (a11).
- A `switch` expression that covers every named member still throws for `default(E)` when 0 is not a member.
- CS0652 has warning level 2, not 1.

### Attempts to refute that failed

- A relational pattern might reject an enum input: it compiles and compares underlying values.
- `[Flags]` might change the exhaustiveness diagnostic: variant a10 behaves like the plain enum. This is one case.
- `IsExhaustive` might be `True` while an input is unhandled: it was `False` in every variant with an unhandled input (a1, a3, a8, a10, a12, g1 to g8).
- `==`, `switch` and a constant pattern on strings might follow the culture: they did not, for one composed and decomposed pair and under tr-TR.
- `EqualityComparer<string>.Default` might follow the culture: it did not, for the same pair.
- Members of rows Q2-06 to Q2-22 might be marked experimental: none is.
- `Activator.CreateInstance` might pick the copy constructor of a record: it throws `MissingMethodException`.
- Swapped arguments of one enum type might draw a diagnostic: none of any severity.
- The Z3 4.12.2 package might fail to load on .NET 10: it loads and answers.
- A release dated on the day of the note might not exist: the GitHub API lists it, and its "latest" endpoint returns the same tag.
- A cited line number might point elsewhere: every printed line matched, except row Q6-22 in the working tree.

### Worklist for a person

Table A, one row per finding, by effort.

| ID | Question to decide | Where to look | Command | Minutes |
|---|---|---|---|---|
| V1 | Should the checker ever read the warning ID to decide which enum members are handled? | `X4.cs` above | `dotnet build X4.cs --no-incremental` then `dotnet run --file X4.cs` | 5 |
| V2 | Should named members be read from fields in declaration order and not from `Enum.GetValues`? | `X1.cs`, part b | `dotnet run --file X1.cs` | 5 |
| V3 | Should the harness refuse an argument whose run-time type is not exactly the parameter type before it calls `Invoke`? | `X1.cs`, part e, the `Try` lines | `dotnet run --file X1.cs` | 10 |
| V4 | Is the zero value of a record struct, and of an enum with no member 0, an input the checker must try? | `X1.cs`, parts a and e | `dotnet run --file X1.cs` | 10 |
| V5 | Does section (b) still describe the backend file that is being changed? | the backend source file of row Q6-22 | `git diff HEAD -- <path of that file>` | 10 |
| V6 | Is a pin to one SDK commit accepted as the only protection against a change of the compiler API? | row Q2-26 in Table 2 | none | 15 |

Table B, places this pass did not reach, by effort.

| Place | Perspective applied | What was not ruled out | Minutes |
|---|---|---|---|
| Sealed record | receiver of the verdict | that the copy constructor is private and unreachable | 5 |
| Plain `record struct` (row Q5-03, Q5-08) | receiver of the verdict | which constructors and setters reflection lists | 5 |
| `Enum.IsDefined` with a name (rows Q1-14, Q1-16) | receiver of the verdict | nothing was run | 5 |
| Nullable-enabled compilation (row Q1-33) | receiver of the verdict | which diagnostic a `null` path gets, and what `IsExhaustive` is then | 10 |
| Exception thrown inside a constructor (row Q5-18) | receiver of the verdict | nothing was run | 10 |
| Enum symbols read from a compiled assembly | receiver of the verdict | order of members and extra fields; only source symbols were read | 15 |
| Enums with underlying types other than `int`, `byte`, `ulong` | receiver of the verdict | the run-time type of `ConstantValue` | 10 |
| Z3 5.4.1 package | receiver of the verdict | whether it restores from a local folder and loads | 20 |
| Any platform other than Windows x64, runtime 10.0.11 | receiver of the verdict | `min / -1`, the Z3 native library, culture data | 30 |
| Rows never opened: Q2-04, Q2-12, Q2-13, Q3-05, Q3-09, Q3-20, Q3-21, Q3-22, Q4-10, Q4-11, Q4-14, Q4-16, Q5-04, Q5-11, Q5-12, Q5-13, Q5-15, Q5-21, Q6-11, Q6-14, Q6-17, Q6-18, Q6-19, Q6-20, Q6-21 | none | everything; never opened | 60 |
| Standard text for C# 9 to C# 14 (item 15 of (c)) | none | everything; never opened | 60 |
| Sections (a) and (e) and "Method and scope" of this file | none | everything; never read, by design of this pass | 30 |
| Items 1, 2, 3, 10, 12, 14, 17 of section (c) | none | still open | 60 |

Items of section (c) that the runs settled: 4, 5, 6, 8, 9, 13 and 18, and 7, 11 and 16 for the inputs tried only.
