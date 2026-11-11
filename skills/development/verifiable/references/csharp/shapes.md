# C# admitted shapes

Only **Boolean decisions** are implemented. All other shapes, enums, numeric domains and
library calls are unsupported. The examples in `assets/csharp/` are executable inputs to
the checker; adapt the requirement before using them in a project.

## Decision admission

The entire file must compile as standalone C# 14 against the tool runtime's platform
assemblies. The checker reads syntax and resolves identifiers with Roslyn's semantic model.

- Top-level or namespace-contained `public static` non-generic classes, containing only
  methods. No nested types, fields, properties, constructors, attributes or base types.
- Methods are `public static`, non-generic, return `bool`, and have zero to twelve ordinary
  `bool` parameters. No defaults, parameter attributes, `ref`, `out`, `in` or overloads.
- Expressions: Boolean literals, references to the method's parameters, parentheses,
  `!`, `&&`, `||`, `&`, `|`, `^`, `==`, `!=`, and `?:`.
- Bodies: an expression body, or blocks containing only `if`/`else` and `return`.
- No imports, directives (including conditional compilation), calls, assignments, loops,
  casts, exceptions, state reads, async work or local declarations.

The tool enumerates every combination of false/true: at most 4096 per method. A parameterless
method has one combination. Parameter names/order are part of the spec and checked; this
subset allows several Boolean parameters and does not provide nominal type separation.
Compilation errors and unsupported syntax reject the whole file before any target executes.

## Spec

Use a JSON `units` object keyed by fully qualified type and method name. Each unit requires
`requirement`, `parameters` in declaration order, `rows`, and `unsettled` (possibly empty).
Each row has a Boolean `input` array and Boolean `outcome`. The rows must describe all
combinations exactly once; the tool, not the agent, enumerates the checks to execute.

See `assets/csharp/Decision.cs` and `assets/csharp/Decision.spec.json` for a library-borrowing
example. A spec needs exactly the file's admitted units, with no missing or extra units.
Unknown JSON properties, duplicate keys, missing fields and repeated input rows are rejected.
There is no fallback/default outcome: a domain change requires a new reviewed table.

Write outcomes from the requirement, never by evaluating the method. Where the user directs
you to preserve behavior without a settled requirement, record the point in `unsettled`.
Passing checks do not settle it. The tool cannot infer or certify that human review occurred.

## Extending admission

Before adding a construct, define its domain and failure behavior, compile executable
fixtures, and plant faults that the computed checks must catch. Read [evidence.md](evidence.md)
for semantic traps. Do not treat an enum's named members as its complete runtime domain,
or copy TypeScript's numeric, nullability, regex or exception assumptions into C#.
