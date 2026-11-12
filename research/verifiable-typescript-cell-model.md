# The cell model of the TypeScript backend

Read on 2026-11-11, at commit `c850b39`, with no local change under the skill folder.
All paths below are relative to `skills/development/verifiable/`.
Perspective of the read: a maintainer who ports the model to a statically compiled language.
Criticality: business critical, because a wrong description produces a port that computes different checks, and that harm stays inside the organization.

Evidence rule used in this file.
Unless a sentence says otherwise, a statement about behaviour rests on an executable statement that was read, and not run.
A sentence that starts with "Inference:" was reasoned and not read.
A sentence that starts with "Not established:" names something the read could not settle.
The only thing executed was one line of Node that prints the result of `path.relative` and `path.sep` on this machine.

## (a) Summary for a meeting

The backend does not analyse the body of a decision at all: it reads the parameter types, expands each into a finite list of string and boolean values, and the run-time driver calls the function once for every combination and compares the result with a spec table, so the number of checks is the product of the value counts, limited to 4096 by default.
For open inputs it builds "atoms" from the conditions of the code and of a spec function written in the same restricted vocabulary, enumerates all 2^n true/false combinations of at most 12 atoms, and asks the Z3 solver for one input per combination plus inputs at the edges of each numeric or length comparison; a single plain number is handled without the solver by trying the values next to each constant.
The obligations file stores the inputs of the checks (value lists for decisions, concrete probe values for classifiers) and never the expected results, which the driver obtains at run time by importing the spec module.
Staleness is detected only by recomputing the whole inventory and comparing it with the file; the driver itself cannot notice a stale file for decisions and classifiers.
Reconciliation and the driver depend on run-time features of Node (module load hooks, source rewriting at load, `Proxy`, dynamic `import()`, V8 coverage), and the classifier vocabularies depend on JavaScript semantics for numbers, strings, regular expressions and `typeof`.
The read found ten places where the prose references and the code differ, and three points it could not settle, the most important being whether solver witnesses are the same on every machine.

## (b) Answers

### 1. Decision shape

**Which files.**
A file is a decision file when its path matches the `shapes.decisions` globs, default `src/decisions/*.ts` (`scripts/project.ts:53-54`, `scripts/project.ts:158-163`).
The whole project is rejected when `strictNullChecks` is off, with one violation and no further analysis (`scripts/inventory.ts:287-298`).

**Which statements a decision file may hold.**
Imports, type aliases and interfaces are skipped (`scripts/inventory.ts:691-696`).
Every other top-level statement must be an exported, named function declaration, else the message is `only exported functions may sit in decisions` (`scripts/inventory.ts:697-704`).

**What is rejected inside the body.**
The body is checked by a list of forbidden constructs, not by a list of allowed ones (`scripts/inventory.ts:408-450`).
The forbidden constructs and their messages are:
- a loop: `loop in a pure shape` (`scripts/inventory.ts:410`);
- `try`: `try in a pure shape` (`scripts/inventory.ts:411`);
- `await`: `await in a pure shape` (`scripts/inventory.ts:412`);
- any call or `new`: `call in a pure shape` (`scripts/inventory.ts:413-418`);
- element access `a[b]`: `computed access in a pure shape` (`scripts/inventory.ts:419-420`);
- `this`: `this in a pure shape` (`scripts/inventory.ts:421-422`);
- any assignment operator: `assignment in a pure shape` (`scripts/inventory.ts:423-427`);
- `++` or `--`: `mutation in a pure shape` (`scripts/inventory.ts:428-435`);
- an identifier whose declarations all lie outside the function: `reads <name> from outside the function` (`scripts/inventory.ts:436-448`).

Type nodes, imports, exports, type aliases and interfaces are not walked (`scripts/inventory.ts:342-353`).
In every file under the claim a cast (`as`, `<T>x`, except `as const`) or a non-null assertion is rejected with `a cast or non-null assertion bypasses the types the counts rest on; ...` (`scripts/inventory.ts:471-481`).
Nothing in the lines read inspects `if`, `switch`, `?:`, arithmetic, template text, `throw` or a local declaration in a decision body.

**How the input domain is derived.**
The function `finiteValues` turns a type into a list of values or `undefined` (`scripts/inventory.ts:355-384`).
- A boolean literal type gives one value, `true` or `false` (`scripts/inventory.ts:356-357`).
- A string literal type gives its text (`scripts/inventory.ts:358`).
- A union gives the concatenation of its members' values, and is not finite if any member is not finite (`scripts/inventory.ts:359-364`).
- An object type with no call or construct signature and at least one property gives the cartesian product of its properties' values, as records (`scripts/inventory.ts:365-383`).
- The object branch stops at `depth >= 3` (`scripts/inventory.ts:371`).
- Every other type is not finite: there is no branch for a number literal, `null`, `undefined`, `bigint`, or an enum (`scripts/inventory.ts:355-384`).

Inference: plain `boolean` is finite because the compiler presents it as a union of `true` and `false`; the compiler API was not read.
Not established: whether a string enum is admitted as an input type.
It depends on whether the compiler's `isStringLiteral()` and `isUnion()` hold for enum types, and the compiler package is not installed in this checkout.
An enum member cannot be referenced in a decision body in any case, because the enum object is declared outside the function and the outside-read rule flags it (`scripts/inventory.ts:436-448`).

**Positional or record.**
When there is exactly one parameter and its type has the `Object` flag, the style is `record` and each property of that type is one dimension (`scripts/inventory.ts:719-731`).
Otherwise the style is `positional` and each parameter is one dimension (`scripts/inventory.ts:731`, `scripts/inventory.ts:759`).
A dimension that is not finite is flagged `input <name> is not a finite union` and left out of the dimensions (`scripts/inventory.ts:732-736`).

**The return type.**
The return type goes through the same `finiteValues`; an empty result is flagged `return type is not a finite union` (`scripts/inventory.ts:707-711`).

**Two inputs that look alike.**
For a decision, the comparison is on value sets, not on type identity.
Each dimension's values are canonicalised, sorted and compared, and equal sets give `two inputs share a type, so swapped arguments would compile` (`scripts/inventory.ts:737-744`).
Inference: two inputs typed `boolean` are therefore rejected, and so are two differently named unions with the same members.

**The count.**
`cases` is the product of the value counts of the admitted dimensions, starting from 1 (`scripts/inventory.ts:745-748`).
A function with no parameter has 1 case.

**The limit.**
The limit is `--max-domain`, default 4096 (`scripts/inventory.ts:1650`).
Above it the message is `domain of <cases> exceeds <max>; split into decisions joined by an intermediate finite type` (`scripts/inventory.ts:749-753`).

**What a rejection is.**
A rejection is a record `{ file, line, rule }`; the rule gets `; found: <first source line, cut at 80 characters>` appended (`scripts/inventory.ts:330-340`).
It is printed as `REJECTED <file>:<line> <rule>` and sets exit code 1 (`scripts/inventory.ts:1669-1670`, `scripts/inventory.ts:1698`).
A rejected decision is still pushed as an obligation (`scripts/inventory.ts:754-762`).
The file written contains every obligation, rejected or not (`scripts/inventory.ts:1653`, `scripts/inventory.ts:1694-1697`).
Only the printed list leaves it out: a unit whose source file or spec file has any violation prints `not counted` (`scripts/inventory.ts:1654-1668`).

### 2. Classifier shape

**Which of four kinds, and in which order the code decides.**
1. One parameter whose type parts are all string-like or `undefined`, with at least one string-like part: kind `string` (`scripts/inventory.ts:851-878`).
2. One parameter of type `unknown`: kind `unknown` (`scripts/inventory.ts:879-906`).
3. Every parameter number-like or `number | undefined`, and either more than one parameter or the first one optional: kind `numbers` (`scripts/inventory.ts:907-960`).
4. Exactly one parameter, an identifier, number-like: kind `number` (`scripts/inventory.ts:961-1058`).

Anything else is flagged `a classifier takes one string (with or without undefined), one unknown value, or one or more numbers ...` (`scripts/inventory.ts:961-972`).
"Number-like" means the `Number` flag, or an intersection with a `Number` part, which is how a branded number is recognised (`scripts/inventory.ts:386-389`).

**Kind `number`: no solver.**
The body is not parsed into branches.
Every reference to the parameter must be a direct operand of `<`, `<=`, `>`, `>=`, `===` or `!==` whose other operand is a numeric literal or a negated numeric literal; else `<name> is used other than in a comparison with a number literal` (`scripts/inventory.ts:973-1006`, `scripts/inventory.ts:204-214`).
The operator is mirrored when the parameter is on the right (`scripts/inventory.ts:1002-1005`).
The literal is not tested for being an integer (`scripts/inventory.ts:204-214`).
The constants of the code are those literals.
The constants of the spec are the `min` and `max` of the exported `intervals`, read statically from the spec's syntax tree (`scripts/inventory.ts:1007-1022`, `scripts/static-value.ts:106-110`).
The intervals must start at `Number.NEGATIVE_INFINITY`, end at `Number.POSITIVE_INFINITY`, and each `min` must equal the previous `max + 1`; else `spec intervals for <name> do not cover every integer exactly once` (`scripts/inventory.ts:1024-1037`).
Candidate values are `c-1, c, c+1` for each code constant, `min-1, min` for each finite `min`, `max, max+1` for each finite `max`, and `0` when there is no candidate (`scripts/inventory.ts:235-242`).
A cell is the pair of the true/false vector of the code comparisons and the index of the spec interval that holds the value (`scripts/inventory.ts:244-252`).
The candidates are visited in ascending order and the first one in each cell becomes the probe, so there is exactly one check per cell that some candidate reaches (`scripts/inventory.ts:244-254`).
No search is made for a cell that no candidate reaches.

**Kinds `numbers`, `string`, `unknown`: branches and atoms.**
Code and spec are each parsed by `readBranches` into an ordered list of `{ condition, outcome }` (`scripts/branches.ts:114-271`).
Admitted statements are `if (<condition>) return <literal>` without `else`, and a last `return` of a literal, of `<condition> ? <a> : <b>`, or of a bare condition (`scripts/branches.ts:220-258`).
A literal outcome is a string literal, `true` or `false`, stored as text (`scripts/branches.ts:168-175`).
The last branch must be unconditional, else `a classifier ends with an unconditional return` (`scripts/branches.ts:265-269`).
Conditions are combined with `!`, `&&`, `||` and parentheses over leaves (`scripts/branches.ts:130-163`).
A leaf is an atom: `{ smt, text, test, sets?, constants?, bound?, neighbours? }` (`scripts/branches.ts:13-22`).
`smt` is the atom as an SMT-LIB term, and `test` is the same atom as a JavaScript function over a concrete input.
The atoms of code and spec are merged by their `smt` text, so identical conditions count once (`scripts/branches.ts:295-303`, `scripts/branches.ts:310-320`).
More than 12 atoms throws an `Error` (`scripts/branches.ts:305`, `scripts/branches.ts:315-318`).
The constants therefore come from both code and spec in the default partition (`scripts/number-classifier.ts:177`, `scripts/string-classifier.ts:431`, `scripts/unknown-classifier.ts:228`).
With `--partition=code` the spec is replaced by the code (`scripts/inventory.ts:789-792`, `scripts/inventory.ts:1642-1643`).

**Number atoms.**
A side of a comparison is a linear term: a parameter, a safe-integer literal, unary minus, `+` or `-` (`scripts/number-classifier.ts:47-99`).
An atom is `left op right`, or `<input> === undefined` / `!== undefined` for an optional input (`scripts/number-classifier.ts:101-153`).
Each comparison atom carries a bound with `n = 0`, measured value `left - right`, and an exact constraint `left - right = k` (`scripts/number-classifier.ts:146-151`).
The solver variables are `v<i>` of sort `Int` and, for an optional input, `u<i>` of sort `Bool` meaning "is undefined" (`scripts/number-classifier.ts:186-191`).
An atom over an optional input is conjoined with `(not u<i>)` (`scripts/number-classifier.ts:130-141`).

**String atoms.**
The solver variable is `s` of sort `String`, and every atom is a regular-language membership `(str.in_re s ...)` (`scripts/string-classifier.ts:151-155`, `scripts/string-classifier.ts:440`).
Atoms are `=== '<literal>'`, `.length <op> <integer>`, `.split('<one character>').length <op> <integer>`, `/pattern/.test(x)`, `startsWith`, `endsWith`, `includes` (`scripts/string-classifier.ts:174-326`).
The subject is the parameter, or a `const` defined as `<input>.slice(n)` or `<input>.slice(n, -m)` (`scripts/string-classifier.ts:329-383`).
Length and part-count atoms carry a bound: `n` is the literal (or the literal minus one for parts), and the exact constraint is "length exactly k" (`scripts/string-classifier.ts:211-222`, `scripts/string-classifier.ts:243-254`).
A pattern atom carries neighbours: the same pattern with one anchor removed, one quantifier limit moved by one, or one character range moved by one at either end (`scripts/string-classifier.ts:288-297`, `scripts/regex.ts:712-759`).
The pattern subset is parsed by hand into sets, sequences, alternatives, repeats, lookarounds and word boundaries; everything else returns an error text (`scripts/regex.ts:263-540`).
Characters are UTF-16 code units from 0 to 0xffff (`scripts/regex.ts:41`).
The solver's alphabet is reduced to one representative character per region of the partition that all atoms' character sets induce (`scripts/regex.ts:648-671`, `scripts/string-classifier.ts:432-440`).
When the input may be `undefined`, the first statement of code and of spec must be `if (<input> === undefined) return <literal>`, and a `null` probe is put first in the list (`scripts/branches.ts:197-214`, `scripts/string-classifier.ts:445-450`).

**The solver's role (`numbers` and `string`).**
All cell queries go through `solveCells` (`scripts/branches.ts:441-578`), called at `scripts/number-classifier.ts:184` and `scripts/string-classifier.ts:438`.
For each of the `2^n` true/false vectors over the atoms, one query asserts each atom or its negation (`scripts/branches.ts:522-524`).
- `unsat` counts as infeasible, and the vector gets no probe (`scripts/branches.ts:526`, `scripts/branches.ts:528`).
- `unknown` is counted, and the vector gets no probe (`scripts/branches.ts:527-528`).
- `sat` gives a model, which is turned into a concrete input (`scripts/branches.ts:529`, `scripts/number-classifier.ts:193-196`, `scripts/string-classifier.ts:442`).

The concrete input is then re-evaluated by the JavaScript `test` of every atom.
A different vector is recorded as `the solver and JavaScript disagree on <atom> for the input <w>` and the input is dropped (`scripts/branches.ts:499-514`).
Boundary queries: for each atom with a bound, and for `k` in `n-1, n, n+1`, one more query adds the exact constraint to the vector (`scripts/branches.ts:530-538`).
Inputs are deduplicated by the key "vector, then for each bound the measured value minus `n`, clamped to -2..2" (`scripts/branches.ts:502-503`, `scripts/branches.ts:515-520`).
Neighbour queries: for each pattern neighbour that no probe of the vector already tells apart from the atom, one query asks for an input in the vector on which neighbour and atom differ (`scripts/branches.ts:539-560`).
After all vectors, a brute-force list of small inputs is evaluated in JavaScript, and any input that lands in a vector the solver called `unsat` is recorded as a mismatch (`scripts/branches.ts:562-568`).
For numbers the list is all tuples over sums of two values from `{-1, 0, 1, ±constants}`, skipped above 200,000 tuples (`scripts/number-classifier.ts:158-169`, `scripts/number-classifier.ts:179-183`, `scripts/number-classifier.ts:197`).
For strings it is all strings over the reduced alphabet, up to a length of at most 5 and at most 60,000 per level (`scripts/string-classifier.ts:411-424`).
A number witness that is not a safe integer is a mismatch (`scripts/number-classifier.ts:199-209`).

**Timeout and `unknown`.**
Each query has a timeout of `VERIFIABLE_QUERY_MS`, default 20,000 ms (`scripts/branches.ts:306-308`, `scripts/branches.ts:470`).
An `unknown` answer is returned before the cache is written, so it is asked again on the next run (`scripts/branches.ts:474`, `scripts/branches.ts:486`).
Any `unknown` count gives the violation `<n> cells came back unknown from the solver, so the claim is blocked`, and each mismatch gives `<mismatch>, so the claim is blocked; found: <name>` (`scripts/inventory.ts:839-850`).
The obligation is still pushed with the probes that were found (`scripts/inventory.ts:863-876`, `scripts/inventory.ts:935-958`).
Inference: a timeout surfaces as `unknown`; the solver's own behaviour was not read.
Answers are cached in a JSON file keyed by the SHA-256 of the solver version and the query text (`scripts/branches.ts:449-467`, `scripts/branches.ts:486-487`).

**Checks per cell (`numbers` and `string`).**
One witness per feasible vector, plus up to three per bound that differ in the clamped distance to the bound, plus one per undistinguished pattern neighbour (`scripts/branches.ts:529-560`).
`cases` is the number of probes, not the number of vectors (`scripts/inventory.ts:875`, `scripts/inventory.ts:957`).

**Kind `unknown`: no solver.**
Atoms are `typeof x === '<type>'`, `x === null`, `x === undefined`, five `Number.*` / `Array.isArray` predicates, `x === <literal>`, and `'<property>' in x`, on the input or a property path under it (`scripts/unknown-classifier.ts:109-206`).
Candidates are 14 named JavaScript values, the literals the code compares with, and, where properties are read, every combination of "absent or one representative" per property (`scripts/unknown-classifier.ts:18-33`, `scripts/unknown-classifier.ts:231-263`).
A cell is the true/false vector of the atoms at or under the path, and the first candidate per vector is kept (`scripts/unknown-classifier.ts:264-270`).
More than 200,000 object combinations, or more than 4096 probes, throws an `Error` (`scripts/unknown-classifier.ts:246-249`, `scripts/unknown-classifier.ts:273-276`).

**Other solver calls.**
`acceptsOnly` asks one question: does a predicate accept a text that is not 1 to 15 digits (`scripts/string-classifier.ts:462-482`, used at `scripts/inventory.ts:565`).
`conversionProbes` asks for inputs on which two arithmetic expressions differ, under three growing bounds (`scripts/conversion.ts:314-349`).

### 3. Spec format per shape

**Where a spec is.**
`<specs>/<unit>.spec.ts`, or a template with `{name}` and `{dir}` (`scripts/project.ts:145`, `scripts/project.ts:165-173`).
A spec is found by unit name, so two units with one name are a violation (`scripts/inventory.ts:1611-1618`).

**Decision.**
The inventory requires only that the spec file has a top-level exported `rows` (`scripts/inventory.ts:1576-1578`, `scripts/inventory.ts:1596-1609`, `scripts/static-value.ts:112-128`).
The messages are `no spec: write <path> exporting rows; found: <name>` and `the spec of <name> (<path>) does not export rows, which the checks of a decision need; found: <name>` (`scripts/inventory.ts:1606-1608`).
The inventory does not read the content of `rows`.
At run time the driver reads:
- `rows`: a list of `{ input, outcome }`; `input` is a list in parameter order for the positional style, or an object keyed by dimension name for the record style (`scripts/driver.ts:79`, `scripts/driver.ts:88-94`, `scripts/driver.ts:103-107`);
- `otherwise`: optional, the outcome of every combination that has no row (`scripts/driver.ts:129`);
- `reviewedDomain`: read only when `otherwise` is defined; an object from dimension name to value list (`scripts/driver.ts:108-122`).

**Completeness of a decision spec, enforced by the driver.**
- A key listed twice fails at once with `spec lists <key> twice` (`scripts/driver.ts:104-105`).
- A combination with no row and no `otherwise` adds `spec has no outcome for <key>` (`scripts/driver.ts:129-133`).
- A row whose key is not a combination adds `spec row <key> is outside the domain` (`scripts/driver.ts:144-145`).
- With `otherwise`, the sorted canonical values per dimension in the obligation must equal `reviewedDomain`, else `the domain changed since the default outcome was reviewed` (`scripts/driver.ts:108-122`).

The key is the canonical JSON of the value list, with object keys sorted (`scripts/canonical.ts:1-9`, `scripts/driver.ts:127`).
The outcomes in `rows` are not compared with the unit's `outcomes` list (`scripts/driver.ts:96-148`).
Inference: an `otherwise` without `reviewedDomain` fails with a `TypeError` from `Object.entries(undefined)`, not with a named message, because line 113 has no presence check.

**Classifier, kind `number`.**
`export const intervals = [{ min, max, outcome }, ...]`, written as literals so that it can be read from the syntax tree (`scripts/inventory.ts:1009-1022`, `scripts/static-value.ts:45-104`).
`Number.NEGATIVE_INFINITY` and `Number.POSITIVE_INFINITY` are recognised by their text (`scripts/static-value.ts:99-100`).
A missing file, a missing export, or a row without numeric `min` and `max` gives `no spec intervals for <name>` (`scripts/inventory.ts:1012-1023`).
The inventory does not read `outcome`; the driver does (`scripts/inventory.ts:1017`, `scripts/driver.ts:190-198`).

**Classifier, kinds `numbers`, `string`, `unknown`.**
A top-level `function expected(...)` with the same number of parameters as the unit, written in the same vocabulary (`scripts/inventory.ts:793-838`).
The messages are `no spec: write <path> exporting function expected(<inputs>) in the same <vocabulary> vocabulary`, `no spec function expected(<inputs>) for <name>`, and `spec function expected() for <name> takes <n> inputs and the code takes <m>` (`scripts/inventory.ts:797-824`).
A problem inside the spec function is a violation on the spec file's own line (`scripts/inventory.ts:825-834`).
The inventory finds `expected` by name and does not test that it is exported (`scripts/inventory.ts:810-813`).
No export list is required for classifiers (`scripts/inventory.ts:1576-1596`).
The driver calls `spec.expected` from the imported module (`scripts/driver.ts:158`, `scripts/driver.ts:173`).
Inference: an `expected` without `export` passes the inventory and fails in the driver.
Completeness of a classifier spec is structural: the spec function must end with an unconditional return (`scripts/branches.ts:265-269`), and the intervals must tile the integers (`scripts/inventory.ts:1024-1037`).
There is no default and no row list for these kinds.

**Other shapes, export names only.**
Dispatch map: `expected`.
Adapter: `args`, `fake`, `provoke`, plus `unnamed` when it rethrows and `expected` when a variant carries data.
Handler: `observe`, `expected`, plus `order` and `exits` when it has guards (`scripts/inventory.ts:1579-1595`).

**Unsettled requirements.**
`export const unsettled = ['<text>', ...]`, read statically; entries that are not strings are ignored (`scripts/inventory.ts:1619-1632`).
Each entry prints `UNSETTLED <spec file> <unit>: <text>`, followed by one summary line (`scripts/inventory.ts:1675-1680`).
It changes no count and no exit code, and it is not written to the obligations file (`scripts/inventory.ts:1653`, `scripts/inventory.ts:1698`).

**`requirement`.**
No script reads an export named `requirement`.
A search of `scripts/*.ts` for that word found it only inside three message strings (`scripts/diagnose.ts:1279`, `scripts/driver.ts:321`, `scripts/inventory.ts:1679`).

### 4. Obligations file

**Location and form.**
Default `obligations.json` at the project root, or the `obligations` setting, or `--out` (`scripts/project.ts:62`, `scripts/project.ts:179`, `scripts/inventory.ts:1646-1647`).
Content: `{ "partition": "code" | "code+spec", "obligations": [...] }`, two-space JSON with a final newline (`scripts/inventory.ts:1653`).

**Fields common to every obligation.**
`kind`, `file` (path relative to the root), `name`, `cases` (`scripts/inventory.ts:46-142`).

**Fields by kind (`scripts/inventory.ts:46-142`).**
- `decision`: `outcomes`, `style` (`record` or `positional`), `dimensions` (list of `{ name, values }`).
- `classifier` with `input: "number"`: `outcomes`, `comparisons` (list of `{ op, constant }`), `intervals` (list of `{ min, max }` with `null` for infinity), `probes` (numbers), optional `assumes`.
- `classifier` with `input: "numbers"`: `outcomes`, `atoms` (texts), `paths`, `infeasible`, `boundary`, `probes` (lists of number or `null`), optional `assumes`.
- `classifier` with `input: "string"`: `outcomes`, `atoms`, `paths`, `infeasible`, `boundary`, `probes` (string or `null`).
- `classifier` with `input: "unknown"`: `outcomes`, `atoms`, `paths`, `probes` (a label, a `['literal', value]` pair, or an object of those).
- `adapter`, `route`, `contract`, `handler`, `conversion`: present in the type; not described here.

`paths` is the number of short-circuit evaluation paths through the code's branches (`scripts/branches.ts:276-293`, `scripts/branches.ts:322-335`).
The driver does not read `atoms`, `paths`, `infeasible`, `boundary`, `comparisons` or `outcomes` for decisions and classifiers (`scripts/driver.ts:96-205`).
The file holds no expected result, no hash of the code, and no hash of the spec.

**Order.**
Contract obligations first, then units in sorted file order and statement order (`scripts/inventory.ts:299-317`, `scripts/project.ts:149-157`, `scripts/inventory.ts:320`).

**Staleness.**
`--check` recomputes the whole inventory, parses the file and the fresh result, serialises both without whitespace, and compares the two strings (`scripts/inventory.ts:1686-1693`).
A difference prints `STALE <file> differs from the code; rerun the inventory` and sets exit code 1 (`scripts/inventory.ts:1688-1692`).
With `--check` nothing is written (`scripts/inventory.ts:1686`, `scripts/inventory.ts:1694-1697`).
So the file is stale when any of these changes: the partition flag, the set or order of units, a file path, a parameter or return type, a comparison constant in the code, a spec interval boundary, a condition in code or spec, or any probe value.
A change that leaves all of those equal does not make it stale: an edited decision body, an edited `rows` table, or a spec function that returns another literal under the same conditions.
The driver has three partial checks of its own: `reviewedDomain` for a decision with `otherwise` (`scripts/driver.ts:108-122`), the guard text of a handler (`scripts/driver.ts:287-298`), and the clause list of a contract (`scripts/driver.ts:377-382`).
For decisions and classifiers the driver compares the number it executed with `cases`, and both come from the same file (`scripts/driver.ts:125`, `scripts/driver.ts:147`, `scripts/driver.ts:169`, `scripts/driver.ts:187`, `scripts/driver.ts:204`, `scripts/driver.ts:473-477`).
Not established: whether two machines get the same witnesses from the solver for the same query.
The probes are model values, the cache is local, and nothing in the code canonicalises a model.
A fresh cache or another solver build could therefore make the file stale with no change to the code.
Measured on this machine: `path.relative` returns backslashes on Windows.
`file` is written from `path.relative` (`scripts/inventory.ts:323`), so a file computed on Windows differs from one computed on a POSIX system.

### 5. Runner

**Entry.**
An entry file in the project imports `driver.ts` from the folder named by `VERIFIABLE_TOOLS` and calls `register(test, <its own folder>)` with the runner's `test` function (`assets/entries/verifiable.node.test.mjs:1-12`, `assets/entries/verifiable.vitest.test.mjs:1-12`).

**Registration.**
`register` reads the obligations file, or the file named by `OBLIGATIONS` (`scripts/driver.ts:428-431`).
It imports every unit module and every spec module with dynamic `import()` (`scripts/driver.ts:442-453`).
It registers one test per obligation, named `<kind> <name>: <cases> cases` (`scripts/driver.ts:454-455`).
After the checks of a unit it asserts that the number executed equals `cases`, message `executed cases differ from the inventory` (`scripts/driver.ts:473-477`).

**Decision.**
The driver builds every combination of the dimension values (`scripts/driver.ts:81-86`, `scripts/driver.ts:125`).
It calls the function with the values as arguments, or with one object built from the dimension names for the record style (`scripts/driver.ts:134-138`).
It compares canonical JSON of actual and expected (`scripts/driver.ts:139`).
A mismatch adds `<key>: expected <canonical expected>, got <canonical actual>` (`scripts/driver.ts:140-142`).
All failures of one unit are collected and asserted at the end with `assert.deepEqual(failures, [])` (`scripts/driver.ts:146`).

**Classifier.**
- `string`: each probe is passed as is, `null` as `undefined`; expected is `spec.expected(x)` (`scripts/driver.ts:156-170`).
- `numbers`: each probe is spread as arguments, `null` as `undefined` (`scripts/driver.ts:174-176`).
- `unknown`: each probe is turned into a run-time value by `probeValue` (`scripts/driver.ts:177`, `scripts/unknown-classifier.ts:48-59`).
- `number`: expected is the `outcome` of the first interval that holds the probe (`scripts/driver.ts:189-198`).

The comparison is `!==` (`scripts/driver.ts:163`, `scripts/driver.ts:181`, `scripts/driver.ts:200`).
A mismatch adds `<JSON of the probe>: expected <want>, got <actual>` (`scripts/driver.ts:164-166`, `scripts/driver.ts:182-184`, `scripts/driver.ts:201`).

**What a failure prints.**
The message strings above, as the elements of the list that `assert.deepEqual` reports.
Not established: the exact layout, which belongs to `node:assert` and to the runner; neither was read or run.
A unit that throws on an input is not caught, so the test ends at that input (`scripts/driver.ts:126-143`, `scripts/driver.ts:159-167`).

### 6. Mutation and reconciliation inputs

**`mutation.ts`: fields read from the report.**
- `files`: an object from file name to `{ source, mutants }` (`scripts/mutation.ts:15-19`, `scripts/mutation.ts:106-108`).
- Per mutant: `mutatorName`, `replacement` (optional, empty text when absent), `status`, `location.start.line`, `location.start.column`, `location.end.line`, `location.end.column` (`scripts/mutation.ts:8-14`, `scripts/mutation.ts:119-124`).

No other field is read.
Statuses `Killed` and `Timeout` count as killed; `Survived` and `NoCoverage` are survivors; any other status counts as "other" (`scripts/mutation.ts:38`, `scripts/mutation.ts:114-118`).

**How a mutant is mapped to a unit.**
Line and column are 1-based and converted to an offset in the report's `source` by summing line lengths split on `\n` (`scripts/mutation.ts:40-45`).
The `source` text is parsed as TypeScript, and the top-level statement that contains the offset is taken (`scripts/mutation.ts:53-56`).
The unit name is that statement's function name, or the name of its first variable declaration (`scripts/mutation.ts:57-62`).
The unit is the obligation with the same `file` and `name`; its label is `<kind> <name>, <cases> checks` (`scripts/mutation.ts:63-66`).
The report's file name is made relative to the root with forward slashes (`scripts/mutation.ts:109-111`, `scripts/project.ts:139-142`).
Inference: on Windows the obligation's `file` has backslashes and this comparison fails for any file in a sub-folder, so every survivor would print `code that has no computed check`.
A survivor is `outside` when its file is not under the claim, `explained` when an entry of the equivalents file matches `file`, `mutator`, `original` and `replacement`, else `open` (`scripts/mutation.ts:97-100`, `scripts/mutation.ts:125-146`).
`original` is the slice of `source` between the two offsets (`scripts/mutation.ts:119-123`).
Exit code 1 when a survivor is open, an explanation matches nothing, or a mutant has another status (`scripts/mutation.ts:210`).

**`reconcile.ts`: how a cell is changed to another valid result.**
The source text of each file with counted units is rewritten in memory.
An exported unit `f` is renamed `f__counted`, and a new exported `f(...args)` calls `__flipped('f', f__counted, args)`; a dispatch map initialiser is wrapped in `__flippedMap(...)` (`scripts/reconcile.ts:110-160`).
The rewritten text is served when the runner loads the file, by a Node load hook or by a Vitest plugin (`scripts/flip-register.ts:7-20`, `scripts/reconcile.ts:263-271`).
At each call `flipped` runs the original, works out the cell of the call, and appends `[unit, cell, outcome]` to the file named by `VERIFIABLE_REACHED` (`scripts/flip.ts:274-285`, `scripts/flip.ts:220-223`).
The cell of a decision is the canonical JSON of its arguments (`scripts/flip.ts:117-122`).
The cell of a classifier is the true/false vector of its atoms on the arguments, recomputed from the source of code and spec (`scripts/flip.ts:128-141`, `scripts/flip.ts:86-109`).
When `VERIFIABLE_FLIP` names that unit and cell, the wrapper returns another member of the unit's `outcomes` list from the obligations file: the outcomes that differ from the real result, indexed by `to` modulo their count (`scripts/flip.ts:227-231`, `scripts/flip.ts:261-272`, `scripts/flip.ts:285-287`).
When there is no other outcome it returns the text `__changed__` and records the cell as changed to a value outside its type (`scripts/flip.ts:267-270`, `scripts/flip.ts:225`).
The number of alternatives of a cell is the number of outcomes minus one, at least one (`scripts/flip.ts:186-194`).

**`reconcile.ts`: the runs.**
1. One baseline run of all test files (`scripts/reconcile.ts:467`).
2. Each passing test alone, recording the cells it reaches (`scripts/reconcile.ts:521-535`).
3. For each reached cell, one run of the files that reach it with that cell changed to alternative 0; a test that fails by assertion "checks" the cell, a test that fails otherwise "breaks on" it (`scripts/reconcile.ts:574-587`).
4. For each test and each reached cell it does not check, the test alone under each further alternative, at most 24 runs (`scripts/reconcile.ts:597-641`).
5. One run with every outcome changed (`scripts/reconcile.ts:642`).

A failure by assertion is told from another failure by the TAP line `code: 'ERR_ASSERTION'` under `node:test`, and by the failure message text under Vitest (`scripts/reconcile.ts:207-208`, `scripts/reconcile.ts:329-331`).

**`reconcile.ts`: how a single test is run alone.**
A test id is `<file> > <suite> > ... > <title>` (`scripts/reconcile.ts:214`, `scripts/reconcile.ts:324-328`).
The id is split into the file and the title path (`scripts/reconcile.ts:478-481`).
The title path becomes an anchored pattern with each part escaped and joined by `( > | )` (`scripts/reconcile.ts:168-169`).
Under `node:test` the tool starts `node --import=<flip-register.ts> --test --test-reporter=tap --test-name-pattern=<pattern> <file>` and parses the TAP output (`scripts/reconcile.ts:179-220`).
Under Vitest it starts `vitest run ... -t <pattern> <file>` with the JSON reporter (`scripts/reconcile.ts:293-306`).
When the run does not execute exactly one test, the test is marked "cannot be run alone" (`scripts/reconcile.ts:525-528`, `scripts/reconcile.ts:706-707`).

**`prune.ts`, for completeness.**
It maps each reconciliation row to `remove`, `covered` or `keep` from the row's `status`, `verdict`, `reaches`, `checks` and `library` fields, and deletes nothing (`scripts/prune.ts:16-61`).

### 7. Language-specific parts

**The type checker is the source of every domain.**
- Finite domains come from string and boolean literal types and structural object types (`scripts/inventory.ts:355-384`).
- "Two inputs share a type" relies on structural value sets for decisions and on printed type names for numbers (`scripts/inventory.ts:737-744`, `scripts/inventory.ts:918-923`).
- A branded number is an intersection type `number & {...}`, and its presence removes the `ASSUMES` line (`scripts/inventory.ts:386-389`, `scripts/inventory.ts:947-956`, `scripts/inventory.ts:1052-1056`).
- `undefined` as a union member marks an optional input (`scripts/inventory.ts:774-775`, `scripts/inventory.ts:907-913`).
- The whole model needs `strictNullChecks` (`scripts/inventory.ts:287-298`).

**Specs are source text and run-time modules at once.**
- The inventory parses the spec file as a syntax tree and never runs it (`scripts/inventory.ts:804-813`, `scripts/static-value.ts:20-27`).
- The driver imports the same file and calls it (`scripts/driver.ts:446`, `scripts/driver.ts:452`).
- The reconciliation re-parses code and spec at test time to rebuild the atoms (`scripts/flip.ts:70-109`).

**Each atom exists twice, as solver text and as a JavaScript function.**
- Number semantics are JavaScript's: a missing argument is `NaN` in the function and a `Bool` in the solver (`scripts/number-classifier.ts:55`, `scripts/number-classifier.ts:118-123`).
- Witnesses must be safe integers (`scripts/number-classifier.ts:199-209`).
- String semantics are JavaScript's: `slice`, `split`, `startsWith`, UTF-16 code units, and `new RegExp(pattern, flags)` for pattern atoms (`scripts/string-classifier.ts:75-76`, `scripts/string-classifier.ts:240`, `scripts/string-classifier.ts:280`).
- Case folding for the `i` flag is computed from `toUpperCase` (`scripts/regex.ts:225-247`).

**The `unknown` kind is a model of JavaScript run-time values.**
- The universe has `undefined`, `null`, `NaN`, infinity, a fraction, a safe and an unsafe integer, `bigint`, `symbol`, a function, an array and an object (`scripts/unknown-classifier.ts:18-33`).
- The atoms are `typeof`, `in`, and identity with a literal (`scripts/unknown-classifier.ts:135-204`).
- Property reads on a non-object give `undefined` (`scripts/unknown-classifier.ts:69-77`).

**Run-time module features.**
- Dynamic `import()` of unit and spec modules by computed path (`scripts/driver.ts:446`, `scripts/flip.ts:253-255`).
- Node load hooks that replace a module's source text, and a resolver hook that maps `.js` to `.ts` (`scripts/flip-register.ts:11-20`, `scripts/ts-specifiers.ts:8-17`).
- A `Proxy` around a dispatch map (`scripts/flip.ts:319-353`).
- `Function.prototype.toString` and V8 precise coverage to prove which `return` a handler took (`scripts/driver.ts:36-76`, `scripts/driver.ts:433-441`).
- `instanceof Promise` to tell an asynchronous result (`scripts/flip.ts:314-316`).
- Environment variables as the channel between the tool and the test process: `VERIFIABLE_FLIP`, `VERIFIABLE_REACHED`, `VERIFIABLE_WRAPPED`, `VERIFIABLE_PORTS`, `VERIFIABLE_ROOT` (`scripts/flip.ts:48-51`, `scripts/flip.ts:365`, `scripts/reconcile.ts:362-366`).

**Values compared as canonical JSON.**
Decision keys, decision results and outcomes are compared as JSON text with sorted keys (`scripts/canonical.ts:1-9`, `scripts/driver.ts:139`, `scripts/flip.ts:266`).

**Top-level functions.**
Units are top-level exported function declarations or top-level `const` maps, and the mutation mapping and the wrapping both rely on that (`scripts/mutation.ts:54-62`, `scripts/reconcile.ts:110-153`).

## (c) Prose and code disagree

Ten points.
The code is stated first in each.

1. **Decision body.**
   Code: only the forbidden constructs listed in section 1 are flagged (`scripts/inventory.ts:408-450`).
   Prose: "May contain: `if`, `switch`, `?:`, `&&`, `||`, comparisons with literals, returns of literals" (`references/typescript/shapes.md:27`).
   Verdict: the prose reads as an allow-list, and the code has none.

2. **Finite input types.**
   Code: string literal and boolean literal types, unions of them, and objects of them (`scripts/inventory.ts:355-384`).
   Prose: "a union of literals, a boolean, or an object of such values" (`references/typescript/shapes.md:29`).
   Verdict: the prose is too broad; number literals, `null` and `undefined` have no branch.

3. **"Two inputs of one type".**
   Code: for a decision, two inputs with equal value sets are rejected, whatever their type names (`scripts/inventory.ts:737-744`).
   Prose: "Two inputs of one type can be swapped ... so the tool rejects them" (`references/typescript/shapes.md:19`).
   Verdict: the code is stricter than the prose.

4. **Statement form of a single-number classifier.**
   Code: the single-number path does not call `readBranches`; it checks only how the parameter is used (`scripts/inventory.ts:961-1058`).
   Prose: classifier statements are `if (<condition>) return <literal>` and one final `return`, for all four kinds (`references/typescript/shapes.md:60`).
   Verdict: not enforced for this kind.

5. **Whole numbers in a single-number classifier.**
   Code: a literal such as `2.5` is accepted as a constant, and the candidates are then `1.5, 2.5, 3.5` (`scripts/inventory.ts:204-214`, `scripts/inventory.ts:235-237`).
   Prose: the constants "cut the whole numbers into cells" (`references/typescript/shapes.md:62`).
   Verdict: the prose assumes an integer check that the code does not make for this kind; the several-numbers kind does make it (`scripts/number-classifier.ts:60-65`).

6. **The 12-condition limit.**
   Code: it applies to the `numbers`, `string` and `unknown` kinds (`scripts/branches.ts:310-320`, `scripts/number-classifier.ts:177`, `scripts/string-classifier.ts:431`, `scripts/unknown-classifier.ts:228`).
   Prose: stated for text only (`references/typescript/shapes.md:82`).
   Verdict: the prose is incomplete.

7. **Limits reported as rejections.**
   Code: more than 12 atoms, more than 4096 `unknown` cells and more than 200,000 object combinations are thrown `Error`s, and `inventory.ts` has no `try` statement of its own (`scripts/branches.ts:315-318`, `scripts/unknown-classifier.ts:246-249`, `scripts/unknown-classifier.ts:273-276`).
   Prose: "More than 4096 cells is rejected" (`references/typescript/shapes.md:94`), and a rejection is a `REJECTED` line with exit code 1 (`references/typescript/tools.md:60`).
   Verdict: these three are not `REJECTED` lines.
   Inference: the run ends before the obligations file is written, because the write follows the computation (`scripts/inventory.ts:1648-1652`, `scripts/inventory.ts:1694-1697`).

8. **Cells and checks.**
   Code: `cases` is the number of probes, and one true/false vector can hold several probes (`scripts/branches.ts:529-560`, `scripts/inventory.ts:875`).
   Prose: "One check per cell is enough, which is why cells are what gets counted" (`references/assurance.md:244`).
   Verdict: `references/assurance.md` is too coarse; `references/typescript/shapes.md:96` matches the code.

9. **Rejected units and the obligations file.**
   Code: every obligation is written, including those of units with a `REJECTED` line, and the driver registers a test for each (`scripts/inventory.ts:1653`, `scripts/driver.ts:454-455`).
   Prose: such a unit is "printed as `not counted`", and "A unit without its spec is not counted" (`references/typescript/tools.md:59`, `references/typescript/shapes.md:218`).
   Verdict: true of the printed list only; the prose does not say what the file holds.

10. **`reviewedDomain`.**
    Code: the inventory requires only `rows`; the driver reads `reviewedDomain` without testing that it exists (`scripts/inventory.ts:1576-1578`, `scripts/driver.ts:112-113`).
    Prose: a table with `otherwise` "must then also export `reviewedDomain`" (`references/typescript/shapes.md:47`).
    Verdict: right conclusion, enforced by a crash and not by a message.

One difference inside the code itself.
The help text of the number and string classifiers lists the final return as "a literal or `<condition> ? '<a>' : '<b>'`" (`scripts/number-classifier.ts:18-19`, `scripts/string-classifier.ts:32-33`).
`readBranches` also accepts a bare condition (`scripts/branches.ts:250-256`).

Claims of the prose that the code agrees with.
- The 4096 default (`references/typescript/shapes.md:31`, `scripts/inventory.ts:1650`).
- The 20-second query limit and its variable (`references/typescript/tools.md:68`, `scripts/branches.ts:306-308`).
- The cache keyed per solver version (`references/typescript/tools.md:70`, `scripts/branches.ts:460-462`).
- The need for a separate stale check (`references/typescript/coverage.md:212`, `scripts/driver.ts:473-477`).
- The `UNSETTLED` line (`references/typescript/shapes.md:200`, `scripts/inventory.ts:1675-1676`).

## (d) Not read

### Read in full

`scripts/inventory.ts`, `scripts/branches.ts`, `scripts/number-classifier.ts`, `scripts/string-classifier.ts`, `scripts/unknown-classifier.ts`, `scripts/static-value.ts`, `scripts/regex.ts`, `scripts/ports.ts`, `scripts/project.ts`, `scripts/reconcile.ts`, `scripts/flip.ts`, `scripts/flip-register.ts`, `scripts/mutation.ts`, `scripts/prune.ts`, `scripts/driver.ts`, `scripts/canonical.ts`, `scripts/ts-specifiers.ts`, `scripts/capabilities.json`, `scripts/capabilities.mjs`, `scripts/package.json`, and both files in `assets/entries/`.
`references/typescript/shapes.md`, `references/typescript/tools.md`, `references/typescript/contracts.md`, `references/typescript/coverage.md`, `references/assurance.md`.
The scripts hold no comment lines, so there was no prose to strip on the first pass.
About 6,900 lines of code were read in one session.
That is far above the size at which a reader still finds most defects, so this file is a description of mechanism and not a defect review.
In `scripts/inventory.ts` the adapter, wiring and conversion sections (lines 452-470, 495-687, 1063-1567) were read for structure only, and nothing is asserted about them above.
In `scripts/ports.ts` nothing is asserted above beyond the names that `reconcile.ts` and `flip.ts` import.

### Sampled

- `scripts/conversion.ts`: lines 290-404 read; lines 1-289 not read.
- `scripts/contracts.ts`: only the list of exported names; no body read.
- `scripts/diagnose.ts`: only the list of top-level declarations and print statements; no body read.

### Never opened

- `scripts/dotnet/Program.cs`, `scripts/dotnet/Verifiable.csproj`, `scripts/dotnet/global.json`, `scripts/dotnet/test_backend.py`.
- `scripts/pnpm-lock.yaml`.
- `references/typescript/commands.md`, `references/typescript/setup.md`, `references/coverage.md`, `references/formats.md`, `references/reconciliation.md`, everything in `references/csharp/`.
- `SKILL.md`, `assets/rules.md`, `assets/commands/`, `assets/csharp/`, `assets/typescript/`, `evals/`.
- The TypeScript compiler package and the Z3 package: not installed in this checkout, so no statement about their behaviour is from reading.

### Candidates that were dropped, with the reason

- "The driver detects a stale obligations file." Dropped for decisions and classifiers: both compared numbers come from the file (`scripts/driver.ts:147`, `scripts/driver.ts:473-477`).
- "Pattern neighbours lose the `i` and `s` flags, because they are compiled without flags (`scripts/string-classifier.ts:289`)." Dropped: sets are case-expanded and `.` is expanded when the pattern is parsed, and the neighbour's source is written from those sets (`scripts/regex.ts:275-278`, `scripts/regex.ts:418-422`, `scripts/regex.ts:764-765`).
- "An `unknown` answer is cached and repeats forever." Dropped: the function returns before the cache write (`scripts/branches.ts:474`).
- "A timeout is counted as infeasible." Dropped: `unknown` has its own counter and its own violation (`scripts/branches.ts:526-527`, `scripts/inventory.ts:843-847`).
- "The atom limit becomes a `REJECTED` line." Dropped: no `try` statement in `scripts/inventory.ts`.
- "Units with a `REJECTED` line are left out of the file." Dropped: `scripts/inventory.ts:1653`.

No second, independent pass confirmed the surviving points.
Each of them is a candidate until a person has answered the matching question below.

### What a person still has to decide

Table A, one row per open point, by effort.

| Id | Question | Where to look | Command | Minutes |
| --- | --- | --- | --- | --- |
| A1 | Should the obligations file hold forward slashes on every platform? | `scripts/inventory.ts:323`, `scripts/mutation.ts:63`, `scripts/mutation.ts:109-111` | `node -e "console.log(require('path').relative('D:/a','D:/a/src/x.ts'))"` | 5 |
| A2 | Is a fractional literal in a single-number classifier meant to be admitted? | `scripts/inventory.ts:204-214`, `scripts/inventory.ts:973-1006` | `grep -n "numericLiteral" scripts/inventory.ts` | 10 |
| A3 | Should the three thrown limits be `REJECTED` lines? | `scripts/branches.ts:315-318`, `scripts/unknown-classifier.ts:246-249`, `scripts/unknown-classifier.ts:273-276` | `grep -n "throw new Error" scripts/branches.ts scripts/unknown-classifier.ts` | 10 |
| A4 | Should a unit with a `REJECTED` line be written to the obligations file? | `scripts/inventory.ts:1653-1668` | `sed -n '1653,1668p' scripts/inventory.ts` | 10 |
| A5 | Should a classifier spec be required to export `expected`? | `scripts/inventory.ts:810-813`, `scripts/inventory.ts:1576-1596` | `sed -n '806,816p' scripts/inventory.ts` | 10 |
| A6 | Is a string enum a finite input today? | `scripts/inventory.ts:355-384` | `node scripts/inventory.ts --root=<a project with one decision that takes an enum>` | 20 |
| A7 | Do two machines with empty caches write the same probes? | `scripts/branches.ts:458-489`, `scripts/inventory.ts:1686-1693` | `node scripts/inventory.ts --root=<project> --check`, on a second machine, after deleting the cache | 30 |

Table B, one row per file or region the read did not cover, by effort.

| File or region | Perspective applied | What the read could not rule out | Minutes |
| --- | --- | --- | --- |
| `scripts/canonical.ts` | maintainer | whether the key order of objects that are not plain matters to a port | 5 |
| `scripts/prune.ts` | maintainer | whether a plan is safe to act on | 15 |
| `scripts/mutation.ts` | maintainer | behaviour on a report from another tool; behaviour with Windows paths | 20 |
| `scripts/conversion.ts:1-289` | never opened | the conversion vocabulary and its neighbours | 45 |
| `scripts/contracts.ts` | never opened beyond export names | how a contract is loaded and validated | 45 |
| `scripts/driver.ts` | maintainer | what the runner prints on failure; behaviour when a spec export is missing | 45 |
| `scripts/ports.ts` | maintainer, structure only | how a library call is matched to a contract | 45 |
| `scripts/inventory.ts:1063-1567` | maintainer, structure only | adapter and wiring admission rules | 60 |
| `scripts/regex.ts` | maintainer | whether the solver translation equals JavaScript's matcher on every admitted pattern | 90 |
| `scripts/branches.ts:441-578` | maintainer | whether every feasible vector with a bound gets its boundary probes; whether witnesses are deterministic | 90 |
| `scripts/reconcile.ts`, `scripts/flip.ts` | maintainer | correctness of the verdicts; behaviour with parallel or stateful tests | 90 |
| `scripts/diagnose.ts` | never opened beyond an outline | everything | 120 |
| `scripts/dotnet/*` | never opened | everything, including how far it already follows this model | 120 |
| All files | maintainer only | nothing was established from the view of a person who relies on the answer "the suite is sufficient" | not estimated |

## (e) Porting notes (inference)

Every line in this section is inference.
None of it was checked against a C# compiler, a .NET library or the existing .NET backend.

**Finite domains.**
C# has no literal union types, so the three sources of a finite domain would be `bool`, an `enum`, and a closed set of record types.
A C# `enum` accepts any value of its underlying integer type, so "the declared members are the domain" is an assumption that needs its own `ASSUMES` line or an analyzer rule.
`bool?` and nullable enums add `null`.
The TypeScript backend rejects `undefined` in a decision input, so the port must choose and document one rule.
The TypeScript rule rejects two inputs with the same value set, which rejects any function with two `boolean` parameters.
A backend for Boolean decisions cannot keep that rule unchanged, and the swap risk it guards against then needs another answer, such as wrapper types with one member each, or named inputs in the spec.

**Count and limit.**
The product and the 4096 limit carry over unchanged.
The obligations file stores dimensions, not rows, so the runner rebuilds the cartesian product.
The order of values inside a dimension is part of the file, so the port needs a defined order.

**Spec for a decision.**
`rows`, `otherwise` and `reviewedDomain` are plain data and fit JSON.
The four completeness messages of section 3 are the acceptance bar for the port's runner: duplicate key, missing outcome, row outside the domain, domain changed since review.
Keys are canonical JSON with sorted keys, so the port needs one canonical form shared by the file, the spec and the runner.

**Spec for a classifier.**
The spec function is parsed and also executed, so in C# it would be a method that is read through the compiler's syntax API and also compiled.
The vocabulary check must run on both the unit and the spec with the same translator.

**Atoms.**
Each atom needs a solver term and an executable predicate that agree.
The cross-check between the two is the model's main defence against a wrong translation, so a port should keep both forms and keep the cross-check.
For integers, C# `int` and `long` overflow, the solver's `Int` does not, and JavaScript's safe-integer rule is a third behaviour.
The port needs explicit range assertions in the solver preamble and a decision on `checked` arithmetic.
For strings, .NET strings are UTF-16 code units, which matches the 0 to 0xffff alphabet.
The .NET regular expression engine differs from JavaScript's in ways that touch the admitted subset, for example in what `\d`, `\w` and `$` match by default.
The solver translation of patterns can therefore not be reused without a review of each construct.
`string.Split` and `Substring` differ from JavaScript `split` and `slice` on edge cases such as indexes out of range, so the local-slice vocabulary needs its own definition.

**The single-number kind.**
It needs no solver and ports directly: constants plus and minus one, interval edges, one probe per pair of code vector and interval index.
The port should settle the question about fractional literals (A2) before copying the rule.

**The `unknown` kind.**
Its universe is a list of JavaScript run-time values and has no direct C# counterpart.
The nearest C# inputs are `object?` with type patterns, or a JSON element with its value kinds.
Either needs a new universe and a new atom list.

**Solver.**
The queries are plain SMT-LIB text with integer, Boolean, string and regular-expression terms, so any binding that can parse SMT-LIB text and return a model can serve.
The step from model to witness and the handling of `unknown` (count it, do not cache it, block the unit) should be kept as they are.
Witness stability (A7) should be settled before the file format is fixed.
Storing a canonical witness, for example the smallest model, would make staleness independent of the solver build.

**Obligations file and staleness.**
Recompute-and-compare ports directly.
Paths should be normalised to one separator before they are written.
The port should decide whether rejected units belong in the file (A4).

**Runner.**
Dynamic import of unit and spec has no direct counterpart.
The options are reflection over a compiled assembly, or compiling the unit and its spec together in memory.
One test per unit with a collected failure list carries over, and so does the assertion that the executed count equals `cases`.

**Reconciliation.**
Source rewriting at load time, `Proxy`, and module hooks do not carry over to a compiled assembly.
A port needs another interception point, such as a rewrite of the syntax tree before compilation, or an instrumented build.
Running one test alone maps to the name filter of the test runner, and the guard "exactly one test ran" should be kept.
Telling an assertion failure from another exception depends on the exception types of the test framework.

**Mutation.**
The mapping from a mutant to a unit parses the report's source as TypeScript and looks at top-level statements.
C# methods sit inside types and namespaces, so the mapping must walk to the enclosing method.
The reference page says that a report from the .NET mutation tool was not tried (`references/typescript/tools.md:151`); that is a claim of the prose and was not checked.

**Handler exit proof.**
It rests on V8 coverage and on the text of the running function, and has no direct counterpart.
