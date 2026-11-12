# C# admitted shapes

Only **decisions over `bool` values, enum values and records of those** are implemented.
All other shapes, numeric and string domains, record classes and library calls are unsupported.
The examples in `assets/csharp/` are executable inputs to the checker; adapt the requirement before using them in a project.

## Decision admission

The entire file must compile as standalone C# 14 against the tool runtime's platform assemblies.
Expression and statement rules are checked on the compiler's bound operations, so they are about what the code means, not how it is spelled.
Class, enum, record, method and parameter rules are checked on the syntax: modifiers, attribute lists and parameter lists.
The types of parameters, results and record fields are the ones the compiler resolves, and so is whether a method is generic, takes `__arglist` or returns by reference.
Enum member values, and the names that decide whether two methods are overloads, are also the resolved ones.
Preprocessor directives, imports, `checked` and `unchecked` are rejected on the syntax anywhere in the file, the value of an enum member included.

- Classes: top-level or namespace-contained `public static` non-generic classes, containing only methods and at least one.
  No nested types, fields, properties, constructors, attributes or base types.
- Enums: `public`, declared at the top level or in a namespace of the checked file, without attributes (so no `[Flags]`), with distinct member values.
  Enums from other assemblies and nullable enums are not admitted.
  An enum of underlying type `byte` or `sbyte` that names every value from zero up is not admitted, because the unnamed cell's representative is searched from zero up.
- Records: `public readonly record struct`, declared at the top level or in a namespace of the checked file, with at least one positional field and nothing else.
  Each field is a `bool` or an admitted enum, written as an ordinary positional parameter with no default, attribute or modifier.
  No body members, type parameters, base list, attributes or `partial`.
  Record classes, a `record struct` without `readonly`, and a field of a record type are not admitted.
- Methods: `public static`, non-generic, returning `bool` or an admitted enum, with ordinary parameters of type `bool`, an admitted enum or an admitted record.
  A record cannot be the result.
  No defaults, parameter attributes, `ref`, `out`, `in`, `this`, `__arglist` or overloads.
- Expressions: Boolean literals, parameters, a field read from a record parameter (`request.Overdue`), named enum members (and any other compile-time constant field of those types), parentheses, `!`, `&&`, `||`, `&`, `|`, `^`, `==`, `!=`, `?:`, `is` with a pattern, and `switch` expressions.
- Enum values are compared only with named members: `==` or `!=` between a member and a parameter or a field of a record parameter, and constant patterns combined with `or`, `and` and `not`.
  No ordering (`<`, `>`, relational patterns), casts, arithmetic, bit operations, `default`, and no comparison of two enum parameters or fields.
- An enum result is always a named member.
  An enum parameter or field is not admitted as the returned value, as a branch of `?:` or as the value of a `switch` arm, so `paid ? Tier.Gold : tier` is rejected.
- A record parameter is read only through its fields and through property patterns: `request is { Overdue: false }`, or `request switch` with such arms.
  A property pattern gives named fields a pattern from the admitted ones, and may state the record type (`RenewalRequest { ... }`).
  No positional patterns, no variables (`var x`, or a name after the pattern), no `==` between records, no `with`, `new` or calls.
  The discards `_` and `var _` name no variable and are admitted.
  A property pattern on a `bool` or an enum value is not admitted.
- `is` and `switch` take a parameter or a field of a record parameter as their input.
  A `switch` arm has no `when` guard.
  A `switch` expression must return a value for every input; over an enum that needs an arm for the unnamed values, which is a discard arm or a `not` pattern.
- Bodies: an expression body, or blocks containing only `if`/`else` and `return`.
  `switch` statements are not admitted.
- No imports, directives (including conditional compilation), calls, assignments, loops, exceptions, state reads, async work, local declarations, `checked` or `unchecked`, or `ref` expressions.

Compilation errors and unsupported code reject the whole file before any target executes.
Parameter names and order are part of the spec and are checked.
Two parameters of one type can still be passed in the wrong order by a caller; the tool checks the method, not its callers.

## Cells

A `bool` parameter has two values, and both are tried.
A `bool` is taken to hold `false` or `true`.
Reinterpreting memory can produce a `bool` with another stored byte, for example through `MemoryMarshal.Read`, which needs no `unsafe` keyword.
In a run on .NET 10 a `bool` with stored byte 2 passed `is true`, `?:` and `switch` like `true`.
Compared with a variable that held an ordinary `true`, it was unequal under `==` and gave `false` under `&` and `&&`.
Such values are outside every claim the tool prints.

An enum parameter has one cell per named value, plus one cell for every other value of its underlying integer type.
An enum variable can hold values that no member names, for example after a cast or as `default`.
The admitted code can test an enum only for equality with named members and can return only named members.
So neither a branch nor a result depends on which unnamed value came in, and one representative is enough for that cell.
The representative is the smallest value from zero up that no member names; that is `default` when zero is unnamed.
Specs and reports write this cell as `#unnamed`, and `paths` prints the representative value.

A record parameter has the cells of its fields: one check per combination of field cells.
`paths` lists each field as `<parameter>.<field>`.
A record struct cannot be `null`.
Its zero value (`default`) holds `false` in every `bool` field and 0 in every enum field.
That 0 is the member with value 0 or, when no member has that value, the unnamed representative, so the zero value is one of the combinations.

The number of checks is the product of the cells of all parameters and record fields, at most 4096 per method.
A parameterless method has one check.

`paths`, `inventory` and `run` print a claim per method: `every input` when all parameters and record fields are `bool`, and `cells` when any of them is an enum.
Repeat the word the tool printed.
Never describe a `cells` result as every input: it is one check per cell, and it holds only for the admitted vocabulary above.
If admission is ever widened to ordering or arithmetic on enums, or to returning an enum input, one representative per unnamed cell is no longer enough.

## Spec

Use a JSON `units` object keyed by fully qualified type and method name.
`paths` prints the exact key of each unit; copy that spelling, which matters for names that are C# keywords.
Each unit requires `requirement`, `parameters` in declaration order, `rows`, and `unsettled` (possibly empty).
Each row has an `input` array with one entry per parameter, and an `outcome`.
A `bool` value is a JSON boolean.
An enum value is a string: a member name, or `"#unnamed"`.
An outcome is a JSON boolean or a member name, never `"#unnamed"`.
A record value is a JSON object with one property per field, named exactly as the field; the order of the properties does not matter.
The rows must describe every cell exactly once, the `#unnamed` cells included; the tool, not the agent, enumerates the checks to execute.

The requirement has to say what happens for an unnamed enum value.
When it does not, ask; if the user directs you to keep the current behavior, record the point in `unsettled`.

See `assets/csharp/Decision.cs` with `Decision.spec.json` for a `bool` decision, `assets/csharp/LoanPeriod.cs` with `LoanPeriod.spec.json` for an enum decision with its `#unnamed` rows, and `assets/csharp/Renewal.cs` with `Renewal.spec.json` for a decision table over a record.
A spec needs exactly the file's admitted units, with no missing or extra units.
Unknown JSON properties, duplicate keys, missing fields, unknown values and repeated input rows are rejected.
There is no fallback or default outcome: a domain change requires a new reviewed table.

Write outcomes from the requirement, never by evaluating the method.
Where the user directs you to preserve behavior without a settled requirement, record the point in `unsettled`.
Passing checks do not settle it.
The tool cannot infer or certify that human review occurred.

## Extending admission

Before adding a construct, define its domain and failure behavior, compile executable fixtures, and plant faults that the computed checks must catch.
State which inputs the new construct lets the code tell apart, because that decides the cells.
Read [evidence.md](evidence.md) for semantic traps.
Do not copy TypeScript's numeric, nullability, regex or exception assumptions into C#.
