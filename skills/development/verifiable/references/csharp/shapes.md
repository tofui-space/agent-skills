# C# admitted shapes

Only **decisions over `bool` and enum values** are implemented.
All other shapes, numeric and string domains, records and library calls are unsupported.
The examples in `assets/csharp/` are executable inputs to the checker; adapt the requirement before using them in a project.

## Decision admission

The entire file must compile as standalone C# 14 against the tool runtime's platform assemblies.
Expression and statement rules are checked on the compiler's bound operations, so they are about what the code means, not how it is spelled.
Class, enum, method and parameter rules are checked on the syntax: modifiers, attribute lists and parameter lists.

- Classes: top-level or namespace-contained `public static` non-generic classes, containing only methods.
  No nested types, fields, properties, constructors, attributes or base types.
- Enums: `public`, declared at the top level or in a namespace of the checked file, without attributes (so no `[Flags]`), with distinct member values.
  Enums from other assemblies and nullable enums are not admitted.
- Methods: `public static`, non-generic, returning `bool` or an admitted enum, with ordinary parameters of those types.
  No defaults, parameter attributes, `ref`, `out`, `in`, `this`, `__arglist` or overloads.
- Expressions: Boolean literals, parameters, named enum members (and any other compile-time constant field of those types), parentheses, `!`, `&&`, `||`, `&`, `|`, `^`, `==`, `!=`, `?:`, `is` with a pattern, and `switch` expressions.
- Enum values are compared only with named members: `==` or `!=` between a parameter and a member, and constant patterns combined with `or`, `and` and `not`.
  No ordering (`<`, `>`, relational patterns), casts, arithmetic, bit operations, `default`, and no comparison of two enum parameters.
- `is` and `switch` take a parameter as their input.
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

An enum parameter has one cell per named value, plus one cell for every other value of its underlying integer type.
An enum variable can hold values that no member names, for example after a cast or as `default`.
The admitted code can test an enum only for equality with named members, so it cannot tell two unnamed values apart, and one representative is enough for that cell.
The representative is the smallest value from zero up that no member names; that is `default` when zero is unnamed.
Specs and reports write this cell as `#unnamed`, and `paths` prints the representative value.

The number of checks is the product of the cells of all parameters, at most 4096 per method.
A parameterless method has one check.

`paths`, `inventory` and `run` print a claim per method: `every input` when all parameters are `bool`, and `cells` when any parameter is an enum.
Repeat the word the tool printed.
Never describe a `cells` result as every input: it is one check per cell, and it holds only for the admitted vocabulary above.
If admission is ever widened to ordering or arithmetic on enums, the unnamed cell has to be split first.

## Spec

Use a JSON `units` object keyed by fully qualified type and method name.
Each unit requires `requirement`, `parameters` in declaration order, `rows`, and `unsettled` (possibly empty).
Each row has an `input` array and an `outcome`.
A `bool` value is a JSON boolean.
An enum value is a string: a member name, or `"#unnamed"`.
The rows must describe every cell exactly once, the `#unnamed` cells included; the tool, not the agent, enumerates the checks to execute.

The requirement has to say what happens for an unnamed enum value.
When it does not, ask; if the user directs you to keep the current behavior, record the point in `unsettled`.

See `assets/csharp/Decision.cs` with `Decision.spec.json` for a `bool` decision, and `assets/csharp/LoanPeriod.cs` with `LoanPeriod.spec.json` for an enum decision with its `#unnamed` rows.
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
