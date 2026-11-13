# C# admitted shapes

Only **decisions** are implemented: methods that return a `bool` or an enum value from `bool` values, enum values, integers, strings and records of those.
An integer or a string is admitted only where the code compares it with constants.
All other shapes, arithmetic, floating-point and `decimal` values, record classes and library calls are unsupported.
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
  Each field is a `bool`, an admitted enum, an integer or a `string`, written as an ordinary positional parameter with no default, attribute or modifier.
  No body members, type parameters, base list, attributes or `partial`.
  Record classes, a `record struct` without `readonly`, and a field of a record type are not admitted.
- Methods: `public static`, non-generic, returning `bool` or an admitted enum, with ordinary parameters of type `bool`, an admitted enum, an integer type, `string` or an admitted record.
  A record, an integer or a string cannot be the result.
- Integer types: `sbyte`, `byte`, `short`, `ushort`, `int`, `uint`, `long` and `ulong`.
  `char`, `nint`, `nuint`, `float`, `double`, `decimal` and the nullable forms are not admitted.
  No defaults, parameter attributes, `ref`, `out`, `in`, `this`, `__arglist` or overloads.
- Expressions: Boolean literals, parameters, a field read from a record parameter (`request.Overdue`), named enum members (and any other compile-time constant field of those types), parentheses, `!`, `&&`, `||`, `&`, `|`, `^`, `==`, `!=`, `?:`, `is` with a pattern, and `switch` expressions.
- Enum values are compared only with named members: `==` or `!=` between a member and a parameter or a field of a record parameter, and constant patterns combined with `or`, `and` and `not`.
  No ordering (`<`, `>`, relational patterns), casts, arithmetic, bit operations, `default`, and no comparison of two enum parameters or fields.
- Integer values are compared only with compile-time constants of an integer type: `<`, `<=`, `>`, `>=`, `==` or `!=` between a constant and a parameter or a field of a record parameter, in either order, and relational and constant patterns combined with `or`, `and` and `not`.
  The constant is the value the compiler folds, so `7 * 24`, `int.MaxValue`, `(int)Membership.Staff` and `'a'` are constants.
  No arithmetic or bit operations on the input, no casts of it, no comparison of two inputs, and no comparison with a fraction or a `decimal`.
- String values are compared only with compile-time string constants and `null`: `==` or `!=` in either order, and constant patterns combined with `or`, `and` and `not`.
  `string.Empty` is not a compile-time constant; write `""`.
  A constant that holds half of a surrogate pair is not admitted, because the obligations file could not name it.
  No members of the string (`Length`, `Equals`, `StartsWith`), no concatenation with an input, and no comparison of two inputs.
- An enum result is always a named member.
  An enum parameter or field is not admitted as the returned value, as a branch of `?:` or as the value of a `switch` arm, so `paid ? Tier.Gold : tier` is rejected.
- A record parameter is read only through its fields and through property patterns: `request is { Overdue: false }`, or `request switch` with such arms.
  A property pattern gives named fields a pattern from the admitted ones, and may state the record type (`RenewalRequest { ... }`).
  No positional patterns, no variables (`var x`, or a name after the pattern), no `==` between records, no `with`, `new` or calls.
  The discards `_` and `var _` name no variable and are admitted.
  A property pattern on a `bool`, an enum value, an integer or a string is not admitted.
- `is` and `switch` take a parameter or a field of a record parameter as their input.
  A `switch` arm has no `when` guard.
  A `switch` expression must return a value for every input; over an enum that needs an arm for the unnamed values, which is a discard arm or a `not` pattern.
  Over a string it needs a discard arm.
  Over an integer the relational arms can cover every value themselves.
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

An integer parameter has the cells its spec states under `domains`: ranges that together cover every value of the type once.
The tool reads from the code every value at which a comparison with a constant changes its answer, and splits the spec's ranges there too.
Between two neighbouring split points every value takes the same branches and has the same spec row, because the admitted code can only compare the input with constants.
The tool tries the lowest and the highest value of each such piece, so every boundary of the code and of the spec is tried on both sides.
The pieces at the two ends of the type are tried at its lowest and its highest value, for `int` -2147483648 and 2147483647.
A comparison with a constant outside the range of the type splits nothing.

A string parameter has one cell per string its spec lists under `domains`, the cell `#null`, and the cell `#other` for every other string.
A string variable can hold `null` whatever its annotation says, so `#null` is a cell of every string input; a string field holds `null` in a record's zero value.
The tool tries each listed string and `null`.
It also tries every constant the code compares with that the spec does not list: such a constant lies in `#other`, and the code tells it apart.
For the rest of `#other` it tries the empty string and each constant with the case of its letters `a` to `z` swapped, leaving out any of these that is itself a constant, and `x` when none is left.
The admitted code can only test a string for equality with constants, and that test compares the characters one by one, whatever the culture.
So every string that is no constant takes the same branches, and one of them would be enough; the others guard against a mistake in the tool's reading of the code.

The number of checks is the product of the values tried for each parameter and record field, at most 4096 per method.
For `bool` values and enums that is the product of the cells.
A parameterless method has one check.

`paths`, `inventory` and `run` print a claim per method: `every input` when all parameters and record fields are `bool`, and `cells` when any of them is an enum, an integer or a string.
Repeat the word the tool printed.
Never describe a `cells` result as every input: a cell is tried at one or a few values, and the result holds only for the admitted vocabulary above.
If admission is ever widened to ordering or arithmetic on enums, or to returning an enum input, one representative per unnamed cell is no longer enough.
In the same way, two values per piece of an integer and a handful of strings are enough only while the code compares each input with constants and does nothing else with it.

`paths` runs without a spec, so the integer ranges and strings it prints are the ones the code tells apart, and its count is for those alone.
`inventory` counts again with the cells of the spec.

## Spec

Use a JSON `units` object keyed by fully qualified type and method name.
`paths` prints the exact key of each unit; copy that spelling, which matters for names that are C# keywords.
Each unit requires `requirement`, `parameters` in declaration order, `rows`, and `unsettled` (possibly empty).
Each row has an `input` array with one entry per parameter, and an `outcome`.
A `bool` value is a JSON boolean.
An enum value is a string: a member name, or `"#unnamed"`.
An outcome is a JSON boolean or a member name, never `"#unnamed"`.
A record value is a JSON object with one property per field, named exactly as the field; the order of the properties does not matter.
The rows must describe every combination of cells exactly once, the `#unnamed` cells included; the tool, not the agent, enumerates the checks to execute.

A unit with integer or string inputs also requires `domains`: a JSON object with one property per such input, named as `paths` prints the input (`daysLate`, or `request.DaysLate` for a record field).
For an integer the property is an array of ranges, each written `"<first>..<last>"` with both ends included.
Leave out `<first>` for the lowest value of the type and `<last>` for the highest: `"..0", "1..14", "15.."` covers an `int`, and `".."` is the whole type.
The ranges must cover every value of the type exactly once.
For a string the property is an array of the strings the requirement names, which may be empty; `#null` and `#other` are cells of every string and are not listed.
So a string that is itself spelled `#null` or `#other` cannot have a row of its own; when the code compares with one, it is tried as a string of the `#other` cell.
A row names an integer cell by its range, spelled as in `domains`, and a string cell by the listed string, `"#null"` or `"#other"`.
A unit without integer or string inputs has no `domains`, or an empty one.

Write the ranges and the strings from the requirement.
Do not copy the cells `paths` prints into `domains`: they are read from the code, and a boundary copied from the code cannot show that the code's boundary is wrong.
A boundary that only the code has is still tried on both sides, and the two results are compared with the one row both sides share.

The requirement has to say what happens for an unnamed enum value, for a missing string (`#null`) and for a string it does not name (`#other`).
When it does not, ask; if the user directs you to keep the current behavior, record the point in `unsettled`.

See `assets/csharp/Decision.cs` with `Decision.spec.json` for a `bool` decision, `assets/csharp/LoanPeriod.cs` with `LoanPeriod.spec.json` for an enum decision with its `#unnamed` rows, `assets/csharp/Renewal.cs` with `Renewal.spec.json` for a decision table over a record, and `assets/csharp/LateFee.cs` with `LateFee.spec.json` for an integer split into ranges and a string.
A spec needs exactly the file's admitted units, with no missing or extra units.
Unknown JSON properties, duplicate keys, missing fields, unknown values, repeated input rows, ranges with a gap or an overlap, and `domains` for an input that is no integer and no string are rejected.
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
