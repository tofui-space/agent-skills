# C# admitted shapes

Two shapes are implemented.
A **decision** returns a `bool` or an enum value from `bool` values, enum values, numbers, strings and records of those.
A **computed result** returns an `int`, a `long`, a `double` or a record, worked out from the same kinds of inputs with `+`, `-`, `*` and `/`.
In a condition, a number or a string is admitted only where the code compares it with constants.
All other shapes, `float` and `decimal` values, calls of any method, record classes and library calls are unsupported.
The examples in `assets/csharp/` are executable inputs to the checker; adapt the requirement before using them in a project.

## Admission

The entire file must compile as standalone C# 14 against the tool runtime's platform assemblies.
Expression and statement rules are checked on the compiler's bound operations, so they are about what the code means, not how it is spelled.
Class, struct, enum, record, method and parameter rules are checked on the syntax: modifiers, attribute lists and parameter lists.
The types of parameters, results and record fields are the ones the compiler resolves, and so is whether a method is generic, takes `__arglist` or returns by reference.
Enum member values, and the names that decide whether two methods are overloads, are also the resolved ones.
Preprocessor directives, imports, `checked` and `unchecked` are rejected on the syntax anywhere in the file, the value of an enum member included.

- Classes: top-level or namespace-contained `public static` non-generic classes, containing only methods and at least one.
  No nested types, fields, properties, constructors, attributes or base types.
- Structs: top-level or namespace-contained `public readonly` non-generic structs, containing only methods and at least one.
  No fields, properties, constructors, interfaces, attributes, `partial` or `ref struct`.
  The tool calls a method of such a struct on the struct's zero value.
- Enums: `public`, declared at the top level or in a namespace of the checked file, without attributes (so no `[Flags]`), with distinct member values.
  Enums from other assemblies and nullable enums are not admitted.
  An enum of underlying type `byte` or `sbyte` that names every value from zero up is not admitted, because the unnamed cell's representative is searched from zero up.
- Records: `public readonly record struct`, declared at the top level or in a namespace of the checked file, with at least one positional field and nothing else.
  Each field is a `bool`, an admitted enum, an integer, a `double` or a `string`, written as an ordinary positional parameter with no default, attribute or modifier.
  No body members, type parameters, base list, attributes or `partial`.
  Record classes, a `record struct` without `readonly`, and a field of a record type are not admitted.
- Methods: `public static` in a class and `public` without `static` in a struct, non-generic, with parameters of type `bool`, an admitted enum, an integer type, `double`, `string` or an admitted record.
  A decision returns `bool` or an admitted enum.
  A computed result returns `int`, `long`, `double`, or the record type of exactly one parameter.
  No other result type is admitted, a string and the other integer types included.
- Integer types: `sbyte`, `byte`, `short`, `ushort`, `int`, `uint`, `long` and `ulong`.
  `char`, `nint`, `nuint`, `float`, `decimal` and the nullable forms are not admitted.
- Parameters: no defaults, attributes, `ref`, `out`, `ref readonly`, `this`, `__arglist` or overloads.
  `in` is admitted on a record parameter only.
- Bodies: an expression body, or blocks containing only `if`/`else` and `return`.
  `switch` statements are not admitted.
- No imports, directives (including conditional compilation), calls, assignments, loops, exceptions, state reads, async work, local declarations, `checked` or `unchecked`, or `ref` expressions.

Compilation errors and unsupported code reject the whole file before any target executes.
Parameter names and order are part of the spec and are checked.
Two parameters of one type can still be passed in the wrong order by a caller; the tool checks the method, not its callers.

## Conditions

A condition is the whole body of a decision, and in a computed result it is what chooses between result expressions.

- Expressions: Boolean literals, parameters, a field read from a record parameter (`request.Overdue`), named enum members (and any other compile-time constant field of those types), parentheses, `!`, `&&`, `||`, `&`, `|`, `^`, `==`, `!=`, `?:`, `is` with a pattern, and `switch` expressions.
- Enum values are compared only with named members: `==` or `!=` between a member and a parameter or a field of a record parameter, and constant patterns combined with `or`, `and` and `not`.
  No ordering (`<`, `>`, relational patterns), casts, arithmetic, bit operations, `default`, and no comparison of two enum parameters or fields.
- Integer values are compared only with compile-time constants of an integer type: `<`, `<=`, `>`, `>=`, `==` or `!=` between a constant and a parameter or a field of a record parameter, in either order, and relational and constant patterns combined with `or`, `and` and `not`.
  The constant is the value the compiler folds, so `7 * 24`, `int.MaxValue`, `(int)Membership.Staff` and `'a'` are constants.
  No arithmetic or bit operations on the input, no casts of it, no comparison of two inputs, and no comparison with a fraction or a `decimal`.
- `double` values are compared only with compile-time constants, with the same six operators in either order and the same patterns.
  The constant is the folded value as a `double`, so `2`, `0.1f`, `0.1 + 0.2`, `double.MaxValue` and `double.NaN` are constants, and `0.1 + 0.2` is the double above 0.3, not 0.3.
  `x == double.NaN` is admitted and is false for every input; `x is double.NaN` is true for NaN alone.
  No arithmetic on the input before the comparison, no comparison of two inputs, no casts, and no `Math` or `double` methods such as `double.IsNaN`.
- String values are compared only with compile-time string constants and `null`: `==` or `!=` in either order, and constant patterns combined with `or`, `and` and `not`.
  `string.Empty` is not a compile-time constant; write `""`.
  A constant that holds half of a surrogate pair is not admitted, because the obligations file could not name it.
  No members of the string (`Length`, `Equals`, `StartsWith`), no concatenation with an input, and no comparison of two inputs.
- An enum result of a decision is always a named member.
  An enum parameter or field is not admitted as the returned value of a decision, as a branch of its `?:` or as the value of a `switch` arm, so `paid ? Tier.Gold : tier` is rejected.
- A record parameter is read only through its fields and through property patterns: `request is { Overdue: false }`, or `request switch` with such arms.
  A property pattern gives named fields a pattern from the admitted ones, and may state the record type (`RenewalRequest { ... }`).
  No positional patterns, no variables (`var x`, or a name after the pattern), no `==` between records, no `new` or calls; `with` is a result expression and not part of a condition.
  The discards `_` and `var _` name no variable and are admitted.
  A property pattern on a `bool`, an enum value, a number or a string is not admitted.
- `is` and `switch` take a parameter or a field of a record parameter as their input.
  A `switch` arm has no `when` guard.
  A `switch` expression must return a value for every input; over an enum that needs an arm for the unnamed values, which is a discard arm or a `not` pattern.
  Over a string it needs a discard arm.
  Over an integer the relational arms can cover every value themselves.
  Over a `double` they cannot: NaN matches no relational arm, so it needs the arm `double.NaN` or a discard arm.

## Result expressions

A computed result is read in two layers.
Conditions choose a result expression through `if`/`else`, `?:` and `switch` expressions.
A result expression computes the value.
It is not a condition: `Paid = loan.Days > 3` is rejected, and `loan.Days > 3 ? loan with { Paid = true } : loan` is admitted.

- A number is built from parameters and record fields of type `int`, `long` or `double`, compile-time constants of those types, `+`, `-`, `*`, `/`, unary minus and parentheses.
  The only conversions are the implicit ones from `int` to `long`, from `int` to `double` and from `long` to `double`.
  An integer is divided only by a constant other than 0 and -1, so no admitted division throws.
  Integer arithmetic wraps around, as C# does outside `checked`; the checks at the two ends of the type show the wrapped values.
  No `%`, casts, calls (`Math` included), bit operations, and no arithmetic on `sbyte`, `byte`, `short`, `ushort`, `uint` or `ulong` values.
- A record result is the record parameter itself, or `parameter with { Field = value, ... }`.
  A field of type `int`, `long` or `double` takes a number as above.
  A `bool` or enum field takes a parameter or record field of its type, `true`, `false` or a named member.
  A field of any other type is kept: it is left out, or set from an input of its type.
  No `new`, `default`, nested `with`, or `with` on anything but the parameter.

A result expression may use an input in ways a condition may not, because it does not choose the branch.
The tool reads each result expression as a tree of inputs, constants and operations, and holds it against the formula of the spec; see Formulas below.

## Cells

A `bool` parameter has two values, and both are tried.
A `bool` is taken to hold `false` or `true`.
Reinterpreting memory can produce a `bool` with another stored byte, for example through `MemoryMarshal.Read`, which needs no `unsafe` keyword.
In a run on .NET 10 a `bool` with stored byte 2 passed `is true`, `?:` and `switch` like `true`.
Compared with a variable that held an ordinary `true`, it was unequal under `==` and gave `false` under `&` and `&&`.
Such values are outside every claim the tool prints.

An enum parameter has one cell per named value, plus one cell for every other value of its underlying integer type.
An enum variable can hold values that no member names, for example after a cast or as `default`.
The admitted code can test an enum only for equality with named members, and can return only a named member or the input unchanged.
So no branch depends on which unnamed value came in, and one representative is enough for that cell.
The representative is the smallest value from zero up that no member names; that is `default` when zero is unnamed.
Specs and reports write this cell as `#unnamed`, and `paths` prints the representative value.

A record parameter has the cells of its fields.
`paths` lists each field as `<parameter>.<field>`.
A record struct cannot be `null`.
Its zero value (`default`) holds `false` in every `bool` field and 0 in every enum field.
That 0 is the member with value 0 or, when no member has that value, the unnamed representative, so the zero value is one of the combinations.

An integer parameter has the cells its spec states under `domains`: ranges that together cover every value of the type once.
The tool reads from the code every value at which a comparison with a constant changes its answer, and splits the spec's ranges there too.
Between two neighbouring split points every value takes the same branches and has the same spec row, because a condition can only compare the input with constants.
The tool tries the lowest and the highest value of each such piece, so every boundary of the code and of the spec is tried on both sides.
The pieces at the two ends of the type are tried at its lowest and its highest value, for `int` -2147483648 and 2147483647.
A comparison with a constant outside the range of the type splits nothing.

A `double` parameter has the cells its spec states under `domains`, and the cell `#nan`.
The doubles other than NaN stand in one order from negative infinity to positive infinity, with the two zeros in one place.
The tool cuts that order at every constant a condition compares with and at the ends of the spec's ranges, as it does for an integer.
It tries the lowest and the highest value of each piece, and one value from the inside of a piece that has one.
Next to a constant the lowest or highest value is the neighbouring double: for 0.5 these are 0.49999999999999994 and 0.5000000000000001.
Where zero is tried, both `-0.0` and `0.0` are tried: no comparison tells them apart, and a result can.
The pieces at the two ends are tried at the infinities.
NaN answers `false` to every operator except `!=`, matches no relational pattern and matches the pattern `double.NaN`, so it takes branches of its own and is a cell of every `double` input.
Every NaN is tried as the one value `double.NaN`.

A string parameter has one cell per string its spec lists under `domains`, the cell `#null`, and the cell `#other` for every other string.
A string variable can hold `null` whatever its annotation says, so `#null` is a cell of every string input; a string field holds `null` in a record's zero value.
The tool tries each listed string and `null`.
It also tries every constant the code compares with that the spec does not list: such a constant lies in `#other`, and the code tells it apart.
For the rest of `#other` it tries the empty string and each constant with the case of its letters `a` to `z` swapped, leaving out any of these that is itself a constant, and `x` when none is left.
The admitted code can only test a string for equality with constants, and that test compares the characters one by one, whatever the culture.
So every string that is no constant takes the same branches, and one of them would be enough; the others guard against a mistake in the tool's reading of the code.

### How many checks

An input counts as read when a condition reads it, and as named when some spec row names one of its cells.
The inputs that are read or named are tried in every combination of their values.
An input that is neither is tried side by side with the other such inputs: the first check takes the first value of each, the next check the second, until the longest list of values is through.
Neither the branch nor the row depends on such an input, so every combination with it would run the same check again.
The tool takes "read" from the conditions it admitted, never from the rows: an input that a condition reads is tried in every combination whatever the rows say.
The number of checks is the product of the values tried for the read or named inputs, times the longest list of the others, at most 4096 per method.
A parameterless method has one check.

`paths`, `inventory` and `run` print a claim per method.
`every input` means that all parameters and record fields are `bool` and every combination of them was tried.
`cells` means anything else: an enum, a number or a string is among the inputs, or `bool` inputs were tried side by side.
Repeat the word the tool printed.
Never describe a `cells` result as every input: a cell is tried at one or a few values, and the result holds only for the admitted vocabulary above.
If admission is ever widened to ordering or arithmetic on enums in a condition, one representative per unnamed cell is no longer enough.
In the same way, a few values per piece of a number and a handful of strings are enough only while a condition compares each input with constants and does nothing else with it.

`paths` runs without a spec, so the ranges and strings it prints are the ones the code tells apart, and it counts as if no row named a cell.
`inventory` counts again with the cells and the rows of the spec.

## Spec

Use a JSON `units` object keyed by fully qualified type and method name.
`paths` prints the exact key of each unit; copy that spelling, which matters for names that are C# keywords.
Each unit requires `requirement`, `parameters` in declaration order, `rows`, and `unsettled` (possibly empty).
Each row has an `input` array with one entry per parameter, and an `outcome`.
A `bool` value is a JSON boolean.
An enum value is a string: a member name, or `"#unnamed"`.
The outcome of a decision is a JSON boolean or a member name, never `"#unnamed"`.
A record value is a JSON object with one property per field, named exactly as the field; the order of the properties does not matter.

In a row, `"#any"` in place of a cell stands for every cell of that input.
A field that is left out of a record object stands for every cell of that field, so `{}` is any record.
The rows must cover every combination of cells exactly once, the `#unnamed`, `#null`, `#other` and `#nan` cells included; the tool, not the agent, enumerates the checks to execute.
Two rows that cover one combination are rejected, and so is a combination that no row covers.
The tool counts the combinations over the inputs of which some row names a cell.
Use `#any` only where the requirement makes no difference between the cells; it is a statement about the requirement, not a way to shorten a table.

A unit with number or string inputs also requires `domains`: a JSON object with one property per such input, named as `paths` prints the input (`daysLate`, or `request.DaysLate` for a record field).
For an integer the property is an array of ranges, each written `"<first>..<last>"` with both ends included.
Leave out `<first>` for the lowest value of the type and `<last>` for the highest: `"..0", "1..14", "15.."` covers an `int`, and `".."` is the whole type.
For a `double` the ranges are written the same way in decimal numbers, such as `0.5`, `-2` or `1e-3`.
A `>` before the first number or a `<` before the last one leaves that number out: `"..<0", "0..<0.5", "0.5.."` covers every double that is not NaN, and `">0..1"` is every value above zero up to 1.
A number is read as the C# literal with the same digits, so the range ends are the doubles the code's constants are.
A number other than zero that is too small for a `double`, such as `1e-400`, is rejected, because it would be read as zero.
An end that is left out reaches the infinity on that side, which is part of the range; the infinities cannot be written.
`#nan` is a cell of every `double` and is not listed.
The ranges must cover every value of the type exactly once.
For a string the property is an array of the strings the requirement names, which may be empty; `#null` and `#other` are cells of every string and are not listed.
So a string that is itself spelled `#null`, `#other` or `#any` cannot have a row of its own; when the code compares with one, it is tried as a string of the `#other` cell.
A row names a number cell by its range, spelled as in `domains`, or by `"#nan"`, and a string cell by the listed string, `"#null"` or `"#other"`.
A unit without number or string inputs has no `domains`, or an empty one.

Write the ranges and the strings from the requirement.
Do not copy the cells `paths` prints into `domains`: they are read from the code, and a boundary copied from the code cannot show that the code's boundary is wrong.
A boundary that only the code has is still tried on both sides, and the two results are compared with the one row both sides share.

The requirement has to say what happens for an unnamed enum value, for a missing string (`#null`), for a string it does not name (`#other`) and for a `double` that is NaN.
When it does not, ask; if the user directs you to keep the current behavior, record the point in `unsettled`.

### Formulas

The outcome of a computed result is a formula per row.
For a number result it is a string, or a JSON number for a plain number.
For a record result it is an object with one formula per field that changes; a field that is left out is kept, and `{}` keeps the whole record.

A formula is made of the inputs under the names `paths` prints (`daysLate`, `loan.Fee`), numbers, `+`, `-`, `*`, `/`, unary minus and parentheses, with the precedence of C#.
A number is read as the C# literal with the same digits: `14` is an `int`, `2L` a `long`, `0.5` and `1e3` are `double`.
The lowest `int` and the lowest `long` are written with their minus sign, `-2147483648`, as in C#.
A constant part that leaves its type is rejected, as the compiler rejects it: `1000000 * 1000000` is no `int`, and `1000000 * 1000000L` is a `long`.
`-0` is the integer 0, so the negative zero of a `double` is written `-0.0`.
A formula is the expression and nothing else: no comment, no directive, no semicolon.
An input whose name is a C# keyword is written as in the code, `@event`.
A word that is both an input and a member of the field's enum is rejected; rename the input.
Types follow C#.
Two integers divide as integers, so `1 / 2` is 0 and `1.0 / 2` is 0.5.
An `int` next to a `long` or a `double` is widened, and so is a `long` next to a `double`.
The formula of a field must have the field's type or one that widens to it.
A `bool` field takes `true`, `false` or a `bool` input, and an enum field takes a member name or an input of its enum.

The tool holds the code to the formula in two ways.

First it compares the operations.
For each input tried, it finds the result expression the code reaches, and requires it to be the formula's operations on the same operands.
Only the two operands of a `+` and of a `*` may change places.
So `a + b * c` is the same as `b * c + a` and as `c * b + a`, and is not the same as `(a + b) * c`, `a + b * c + 0` or `a + c * b * 1`.
This is strict on purpose: in `double` arithmetic `(a + b) + c` and `a + (b + c)` give different results for some values, so two formulas that differ in grouping are two different requirements.
A constant expression counts as its value: `2 * 3.0` is `6.0`.
Where a piece of an input holds one value, or the two zeros, every value of the piece is tried.
For an input that is read or named, the tool then puts the value tried in place of the input before it compares, so in the cell `0..0` the code's `0` and the formula `days` agree.
A failure of this kind reads `the code computes <expression>, and the spec states <formula>`.

Then it compares the values.
It runs the compiled method on every input tried and compares what comes back with the value it computes from the formula, bit for bit.
Every NaN counts as the same NaN; `-0.0` and `0.0` are different results.
The obligations file holds the expected value of every check.

Because the operations are the same, the result is the same for every value of the cells and not only for the values tried.
That step rests on two things the tool does not prove.
Its reading of an expression has to be the compiler's; the comparison of values checks this on every input tried.
The compiled code has to compute each `double` operation on its own, rounded to nearest; [evidence.md](evidence.md) says where that was observed and where it is not established.

Write each formula from the requirement, as for outcomes.
A formula copied from the code shows nothing about the requirement: it only shows that the code is what it is.

## Examples and rejections

See `assets/csharp/Decision.cs` with `Decision.spec.json` for a `bool` decision, `assets/csharp/LoanPeriod.cs` with `LoanPeriod.spec.json` for an enum decision with its `#unnamed` rows, `assets/csharp/Renewal.cs` with `Renewal.spec.json` for a decision table over a record, `assets/csharp/LateFee.cs` with `LateFee.spec.json` for an integer split into ranges and a string, and `assets/csharp/AccrueFee.cs` with `AccrueFee.spec.json` for a struct that computes a record from a record.
A spec needs exactly the file's admitted units, with no missing or extra units.
Unknown JSON properties, duplicate keys, missing fields, unknown values, rows that cover one combination twice, ranges with a gap or an overlap, formulas that use anything outside the vocabulary above, and `domains` for an input that is no number and no string are rejected.
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
