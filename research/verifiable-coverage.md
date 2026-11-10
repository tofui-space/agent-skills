# Computed checks instead of guessed tests

Written 2026-11-09. The pilot is in `research/verifiable-coverage-pilot/`. Every number in this file was produced by a command run on that day, unless the line says "arithmetic" or "not run".

## The way out

Stop asking which tests a piece of code needs. For arbitrary code that question has no general answer, so neither a person nor a model can settle it by reading or by generating tests for longer.

Ask a different question instead: which code is allowed, so that a program can work out the checks? Restrict generated code to a few shapes (four at first, five since 2026-11-10). A tool reads the types and the code and lists every check the code needs. The expected result of each check comes from a small table that a person reviews against the requirement. The model writes code into the shapes. It never chooses, counts or writes test cases.

In the pilot, one authorization feature (178 lines of source) needs exactly 93 checks. The tool computed them; nobody chose them. They kill all 101 mutants Stryker makes. The checks and the gates around them stop all 10 hand-seeded faults, and two control runs show the same kind of fault getting through without the method.

## Your claims, in the order you made them

1. **"Web applications can't be statically verified."** Too strong. Arbitrary web code can't. Code kept to the four shapes can have every decision checked against its table for every input, and the tool rejects anything outside the shapes.
2. **"No test is deterministically correct, sufficient or needed; tests are guessed from code."** True for code without restrictions. Not a law: in the pilot the check list is computed, and it changes only when the types, the code's constants or the spec change.
3. **"Mapping a requirement to a hunk proves nothing; another hunk can add a path that breaks the requirement."** True, and better mapping won't fix it. What fixes it is a check that covers every input of a function, so it doesn't matter which hunk produced an answer. Seeded faults F1 and F3 are exactly that added hunk, and both are caught.
4. **"So requirements can't reach full deterministic coverage."** True for prose requirements. False once the requirement is also written as a finite table: the table is the requirement in a form that can be checked. Prose remains the source. A person still reviews the table against the prose, and that is the one guess left. It is bounded: the authorization table is 5 rows plus "everything else is denied".
5. **"An LLM generating tests for 100 hours never reaches the right set."** True, and the method doesn't try. The model writes zero test cases. The count is computed, and one generic driver runs it.
6. **"The right tests in the right number for the number of paths."** Paths are the wrong thing to count. They belong to the current implementation and change with every edit. One input per path says nothing about the other inputs on that path. And syntactic path counts, cyclomatic complexity and MC/DC formulas don't give a sufficient test count (the counterexamples are in §3.12 of the strategy document you pasted). Count input cells instead: every value of a finite type, and for numbers, the intervals cut by the constants in the code and in the spec.

## The shapes

Four at first; the fifth row was added on 2026-11-10.

| Shape | What it may contain | What the tool computes | Number of checks | Expected results come from |
|---|---|---|---|---|
| Decision | A pure function over finite types: unions of literals, booleans, records of them. No loops, calls, I/O or reads of outside state. | Every input value of every input, from the types | Product of the value counts | A table of rows, plus an optional default outcome, which the table must pin to the domain it was reviewed against |
| Classifier | The only place where a number, a string or an `unknown` value becomes a finite value. One number compared with literals; or several numbers compared with each other; or one string within the string vocabulary, including a regular-expression subset; or one `unknown` value under type tests. | The cells that the conditions of the code and of the spec cut, with their boundaries | One input per cell and boundary position | An interval table, or a spec function in the same vocabulary |
| Adapter | The only place with I/O and exceptions. The body is one try/catch that turns every outcome into a finite variant. The catch returns a variant only under `instanceof` a named error class, and it ends with `throw`, so an error it doesn't name (a `TypeError`, say) is never reported as a variant (added after the field test) | The variants, from the return type: string literals, or objects that each carry a literal `kind` and may carry data | One per variant, plus one for the rethrow | A fake of the port, a way to provoke each variant, the full result per variant when it carries data, and an unnamed error |
| Wiring | Straight-line glue. No `?:`, `&&`, `\|\|`, `??`, loops, try or optional chaining, and no `if` other than a guard statement that returns. No literals outside dispatch maps. Calls only to the other three shapes, or through `const` maps typed `Record<FiniteKey, V>`. | The keys of each dispatch map, and the exits of each guard | One per key, one per guard exit, plus one per handler | Expected value or effect per key, one witness per exit and per handler, and the order of the guards |

| Conversion (added 2026-11-10) | One `return` of arithmetic over numbers, dates and text of digits, with at most one cast to a branded number around the result. No branch. | The inputs on which the expression differs from each of its neighbours, and from the spec | One per such input, plus one per date input for the invalid date | A spec function in the same vocabulary |

The classifier, adapter and wiring rows were widened on 2026-11-09; the measurements behind each widening are in "Five additions to the shapes". The conversion row is measured in "Four additions after the third round".

Two rules hold across all shapes:

- **Every input gets its own type.** Two inputs of the same type can be swapped and the code still compiles. The pilot showed this for two booleans (F5b). With distinct literal unions (`'sameTenant' | 'otherTenant'`) and brands for numbers and strings, the compiler rejects the swap (F5). The tool rejects a decision with two inputs of one type (F10).
- **A decision domain has a budget.** The tool rejects a domain larger than 4096. The fix is to split the decision into two decisions joined by an intermediate finite type. This is what stops size from collapsing the method; see the next section.

## Why the count is right, not guessed

- **Decisions.** For a pure, deterministic function, agreeing with the table on every input of a finite domain is full agreement. This needs no look at the function body, so it holds for every implementation with that signature. Rewriting the body never changes the count (F1 changed the body and the inventory stayed the same).
- **Classifiers.** Suppose a function uses its integer input only in comparisons with constants and returns constants. Then it returns the same value for every input in one cell, so one input per cell decides its result for every integer. The cells must come from the code's constants together with the spec's bounds. Cells from the code alone can't see deleted logic. With code-only cells, the deleted negative-count check passes (F2b, probes 4 and 5). With code-plus-spec cells, it fails at −1 (F2).
- **Composition adds instead of multiplying.** Units are joined through finite types, and each unit is checked over its whole domain, so the combination is checked too. Role derivation (6) plus authorization (72) is 78 checks. Checking them as one function would take 144 (arithmetic). The whole handler as one function over its finite inputs would take 3·2·3·3·2·2 = 216 inputs times 3 store outcomes = 648 (arithmetic, not run). The pilot uses 93 in total.
- **Change.** The inventory is regenerated from the code, and `inventory.ts --check` fails when the committed `obligations.json` differs. A new hunk that adds a cell can't hide behind an old check list. F3 passes against the stale list but is flagged as stale, and the regenerated list catches it.

## What the pilot measured

Commands, run in `research/verifiable-coverage-pilot/`:

```sh
node tools/inventory.ts           # computes and writes obligations.json; exit 1 on any rejection
node tools/inventory.ts --check   # fails when obligations.json no longer matches the code
node_modules/.bin/tsc -p .        # TypeScript 7.0.2, strict
node --test 'test/*.test.ts'      # one generic driver runs every obligation
node_modules/.bin/stryker run     # Stryker 10.1.1, command runner
./faults.sh                       # seeds each fault in a temporary copy and reports the gates
```

**Computed checks:** authorize 72, deriveRole 6, classifyAccount 3 (inputs −1, 0, 5), writeProvider 3, execute map 4, statusOf map 4, handler 1. Total 93, all passing. Later the same day the tagged-union unit `decide` (6) was added, making 99, all passing; it is covered in "Claims in the pattern documents, tested".

**Mutation:** 101 mutants, 101 killed, 0 survived, 0 timeouts, 0 errors. Reading the kill reasons in `reports/mutation.json`: 100 were killed by a failing assertion, and 1 by a TypeError when the `execute` map was emptied. None was killed by a crash of the instrumented code. The run takes about 3 seconds. With `decide` added: 121 mutants, 121 killed, 20 of them in `approval-facts.ts`.

**Seeded faults** (from `./faults.sh`. "Before" means tests run against the old `obligations.json`, "after" means against the regenerated one):

| Fault | What was changed | Stopped by |
|---|---|---|
| F1 | A new hunk in `authorize` lets owners grant approval | Tests: 2 of 72 cases fail (owner, grant, active, same tenant, with and without ownership) |
| F2 | The negative-count check deleted from the classifier | Stale check, then tests fail at −1 |
| F2b | Same as F2, with cells taken from the code alone (control) | **Not caught**: 0 failures. This is the "tests derived from code" failure, reproduced |
| F3 | A new hunk: 3 failed logins suspends the account | Stale check. Before: 0 failures. After: fails at 3 |
| F4 | An `?:` branch in the handler, behaviour unchanged | Tool rejects (branch in wiring). Tests pass, because the branch changes no output |
| F5 | Tenant and ownership arguments swapped in the handler | Compiler rejects |
| F5b | The same swap with two plain booleans (control) | **Compiles**. This is why every input needs its own type |
| F6 | `Date.now()` added to the handler | Tool rejects (call to code outside the shapes) |
| F7 | New plan `archive`, no executor | Compiler rejects the dispatch map and the spec. With an executor added, the driver fails: "spec has no expectation for execute.archive" |
| F8 | New role `auditor`: 72 → 96 inputs | Stale check, then driver fails: domain changed since the default outcome was reviewed |
| F9 | The adapter stops returning `conflict` | Tool rejects (variant never returned), and tests fail |
| F10 | A second boolean input on `deriveRole` | Tool rejects (two inputs of one type). Compiler rejects the call site |
| F11 | A new variant `{ kind: 'locked' }` in the tagged union of `decide`, which has no `default` arm | Stale check (6 → 7 cases). Compiler rejects with TS2366 (function lacks ending return statement). Driver fails: spec has no outcome for `[{"kind":"locked"}]` |
| F12 | The ` ` check deleted from `classifyCredential` | Stale check, then tests fail |
| F13 | `split('.').length === 3` widened to `>= 3` | Stale check, then tests fail (boundary witness with four parts) |
| F14 | The adapter catch returns `'unavailable'` instead of rethrowing | Stale check. Before: the rethrow check fails. After: the tool rejects the adapter (the catch must end with `throw error`) |

F8 first passed silently: the default "otherwise deny" quietly absorbed the 24 new inputs. That's why a default outcome must now pin the domain it was reviewed against (`reviewedDomain` in `spec/authorize.spec.ts`). F4, F5 and F6 are invisible to tests and to mutation scores. Static gates stop them, and they are the reason the gates exist.

## String classifiers

Added 2026-11-09. A classifier with one `string | undefined` input may hold one `const x = input.slice(n)` and conditions built from `startsWith`, `endsWith`, `includes`, `=== 'literal'`, `.length` against an integer, and `.split('c').length` against an integer. `tools/string-classifier.ts` translates every condition into SMT-LIB string theory and asks Z3 (`z3-solver` 5.3.3) about every truth vector over the conditions of both the code and the spec. An unsat vector is infeasible, each sat vector gives a witness, and an unknown blocks the claim. JavaScript strings are UTF-16 code units, so the domain is limited to characters up to U+FFFF, where Z3's `str.len` equals `.length`.

**Pilot unit `classifyCredential`** (the bearer-header rule of a real authentication module): 8 code paths plus the `undefined` guard, and 7 atoms giving 128 vectors. 62 vectors are infeasible, leaving 66 witnesses, which with `undefined` make 67 checks. All 67 witnesses give the same result as the original regular expression `/^Bearer (.+)$/` followed by the split. Stryker kills 29 of 30 mutants. The survivor, `header.slice(7)` → `header`, is equivalent, because `"Bearer "` contains no dot and no line terminator.

Three lessons, all run:

1. My first probe used `(re.comp (str.to_re "."))`, which is wrong: `re.comp` complements whole strings, so the regex matched everything and Z3 returned a "three-part" witness that had four parts. A character complement needs `(re.diff re.allchar …)`.
2. One witness per pair of code path and spec region (9 checks) verified the code as written but left 10 mutants alive. The witness for the `\n` branch had no dots, so deleting the `\n` check changed no checked output. One witness per atom truth vector (67 checks) kills them, because every combination of conditions gets exercised, so a deleted or inverted check shows. The number classifier already worked this way.
3. A condition that can never change the outcome breeds equivalent mutants: `token.length === 0` was redundant with the three-part split, so it was removed.

**After the field test:** each cell also gets boundary witnesses at c − 1, c and c + 1 for every `.length` and split-count condition (W1). Witnesses are drawn from the literals' characters plus one fresh printable character. This loses no cell, because replacing every other character with the fresh one preserves every prefix, suffix, contains, equality, length and count fact. `classifyCredential` now has 66 cells + 101 boundary witnesses + `undefined` = 168 checks, and Stryker still kills 29 of 30 (the survivor is the same equivalent). On the field test's session-claim classifier, `> 9` → `>= 9` is now killed: 16 of 16.

**Cost:** Z3 answers are cached by a hash of the z3-solver version plus the query text, in `.verifiable-cache/z3.json` (gitignored). The first run took 153 s, a cached rerun 0.3 s. Three alternatives were benchmarked and none beat 38 s: one incremental solver searching depth-first, `str.indexof` chains for the split count, and a literal-character alphabet.

## Five additions to the shapes

Added 2026-11-09, after the second field-test round. Each one closes a gap that round named. The fixtures are a library loan desk (`src/classifiers/library-card.ts`, `loan-state.ts`, `current-day.ts`, `src/adapters/loan-catalog.ts`, `src/wiring/renewal-request.ts`).

### 1. Regular expressions in string classifiers

A condition may be `/pattern/.test(<input>)`. `tools/regex.ts` parses the pattern and translates it into a Z3 regular expression. The subset: literal characters, `.`, `\d \w \s` and their negations, `[classes]` with ranges, groups (plain, non-capturing and named), `|`, the quantifiers `? * + {n} {n,} {n,m}` (greedy or lazy, which is the same for `test`), `^` at the start and `$` at the end, lookahead, lookbehind and `\b` outside groups, and the flags `i` and `s`. Everything else is rejected by name: backreferences (no regular language can express them), a lookaround inside a group, other flags, Unicode property escapes, anchors inside the pattern. `match`, `exec` and `search` are rejected too, because they read what the pattern captured; the rejection says where to cut instead (see "Captures" below).

- **Alphabet.** Witnesses are drawn from one character per region that the character sets of all conditions cut out of U+0000 to U+FFFF. This generalizes the earlier "literal characters plus one fresh character" and loses no cell for the same reason: replacing a character by the representative of its region changes no condition.
- **The translator is checked on every run, not trusted.** Each witness is evaluated in JavaScript against every condition and must land in the cell the solver put it in. Then every string up to a short length over the alphabet (at most 60,000 strings) is evaluated in JavaScript, and reaching a cell that the solver called infeasible is a rejection. No disagreement on the pilot (Run).
- **Neighbours.** With one witness per cell, Stryker's mutant that drops `^` survived: a valid card with one character in front lies in the same cell as any other nine-character junk. So for each pattern the tool derives its neighbours (each anchor dropped, each quantifier bound moved by one, each written range end moved by one in both directions), and in every feasible cell it asks for an input on which the neighbour and the original disagree. That is the regex counterpart of c − 1, c, c + 1.
- **`isLibraryCard`** (`/^(M-[0-9]{6}|S-[A-Z]{2}[0-9]{4})$/` in the code; length 8, `/^M-\d+$/` and `/^S-[A-Z][A-Z]\d+$/` in the spec): 4 conditions, 16 vectors, 10 infeasible, 6 cells + 35 boundary witnesses + `undefined` = 42 checks. The witnesses include `M-:00000`, `S-[A0000`, `SM-00000` and `S-AA0000-`.
- **Flags.** `s` lets `.` match every character. `i` widens every character set to both cases with JavaScript's own rule for patterns without the `u` flag (upper-case each code unit, keep it when that gives more than one unit or leaves ASCII). Checked against JavaScript on every code unit in 7 surrounding texts, 458,752 texts per pattern, for `^bearer .+$`, `[a-f0-9]+\W`, `[^k]\w`, `\u017f|\u212a` with `i` and `^a.b$` with `s`: 0 disagreements (Run).
- **Cost, and its cause.** Restating the credential spec as `/^Bearer .+$/` joined with the split count on the sliced token first ran for over 10 minutes without finishing. The cause was the mix of string functions (`str.substr`, `str.prefixof`, `str.contains`, `str.len`) and patterns in one query. Every condition of the string vocabulary is a regular language of the one input, including conditions on `input.slice(n)`: "the slice is in L" is "n characters, then L", plus the strings shorter than n when L holds the empty string. So each condition is now stated as membership of the input in one pattern, and the solver only intersects patterns. Measured: the whole pilot computes uncached in 61 s, where `classifyCredential` alone took 153 s before. The credential spec in its requirement's own words computes in 4 minutes with no unknown cell.
- **`classifyCredential` against the requirement itself.** Its spec is now `/^Bearer .+$/.test(header) && token.split('.').length === 3`, while the code keeps `startsWith`, four `includes` and the split. 7 conditions, 128 vectors, 63 infeasible, 65 cells + 129 boundary witnesses + `undefined` = 195 checks, all passing. That the code's four line-terminator checks say the same as the pattern's `.` is now computed, not argued.
- **Lookaround and `\b`** (added 2026-11-10). A lookahead constrains everything after its position, so the translation builds the pattern from the right and intersects the rest with the lookahead's language (complemented when negative). A lookbehind does the same from the left. `\b` splits its alternative in two: a word character before and none after, or the reverse. A lookbehind or `\b` that comes after a lookahead is resolved against the item just before it when that is one character class, alone or repeated at least once; otherwise the pattern is rejected by name (`\b[a-z]*\b`). Compared with JavaScript on 14,873 texts per pattern and with the solver on at least 450 of them, for 15 patterns, among them `^(?=.*[0-9])(?=.*[a-z])(?!.*\s).{8,}$`, `\bstaff\b` with `i`, `\b\d{3}\b`, `(?<=^ab|c)d(?=e$|f)` and `foo(?=bar)\w+(?<=r)x`: 0 disagreements (Run).
- **`isDeskPassphrase`**: three lookaheads in the code, and in the spec a length test and three plain patterns. 5 conditions, 32 vectors, 16 infeasible, 16 cells + 63 boundary witnesses = 79 checks.
- **`mentionsStaff`**: `/\bstaff\b/i` in the code, and in the spec four alternatives that spell out what stands before and after the word. 2 conditions, 4 vectors, and the 2 where they would disagree are infeasible: the solver shows the two patterns accept the same texts. 2 cells + 32 boundary witnesses = 34 checks.
- **Captures** (added 2026-11-10). Reading a captured group stays rejected, but a group whose place does not depend on the text is a slice, and the tool now says which one. `input.slice(n, -m)` joined the vocabulary: "the slice is in L" is "n characters, then L, then m characters". For a pattern anchored at both ends in which everything before and after the group has a fixed length, the rejection reads: "whenever this pattern matches, group 1 is mark.slice(4, -5), so write: if (!/^[A-Z]{3} (.+) [0-9]{4}$/.test(mark)) return '<outcome>', then const <name> = mark.slice(...)" (Run, F32). For `^(\w+)@(\w+)$` it says that the group's place depends on the text. **`classifyShelfMark`** uses the test-then-slice form: 4 conditions, 16 vectors, 12 infeasible, 4 cells + 40 boundary witnesses = 44 checks.
- **Time limit.** Every query has a limit (20 s, `VERIFIABLE_QUERY_MS`). A query over it counts as unknown, and unknown blocks the claim: with a 300 ms limit the old encoding gave "125 cells came back unknown" and a REJECTED line (Run).
- **Solver memory.** The comparison harness ran out of the solver's 2 GB of WebAssembly memory after about 3,600 solver instances in one process. The largest inventory run so far makes about 700, so a much larger classifier set could hit this; not handled.
- **What the count depends on.** The cells depend only on the code and the spec. The number of boundary witnesses also depends on which witnesses the solver returns, because a witness that already sits on a boundary saves a query. The answers are cached per solver version, so the list is stable until that version changes.

### 2. Classifiers over several numbers

`tools/number-classifier.ts` admits two or more number inputs, each with its own type, with conditions that compare sums and differences of the inputs and integer literals. Each condition goes to Z3 as integer arithmetic. The tool takes one witness per truth vector, plus witnesses where each compared difference is −1, 0 and +1.

- **`classifyLoan(dueOn, today)`**: 3 conditions in the code (`today < dueOn`, `today <= dueOn`, `today <= dueOn + 7`) and 3 in the spec, written as differences. 64 vectors, 60 infeasible, 4 cells + 2 boundary witnesses = 6 checks, at the differences −1, 0, 1, 6, 7 and 8.
- **One probe per cell and boundary position.** Two witnesses in the same cell that sit at the same position relative to every boundary are one check. Applied to strings as well, this took `classifyCredential` from 168 checks to 129 with the same mutation result.
- **An input may be missing.** A parameter typed `<number type> | undefined` adds the condition `<input> === undefined`, and a comparison that reads a missing input is false, as in JavaScript. `classifyHold(holdUntil | undefined, today)`: 3 conditions, 8 vectors, 5 infeasible, 3 cells + 1 boundary witness = 4 checks: no hold date, and the differences −1, 0 and 1.
- **Integers are assumed.** NaN and fractions must be turned away before a number gets its type, which is what the next addition is for.

### 3. Inputs of type `unknown`

`tools/unknown-classifier.ts` admits one `unknown` input with conditions from `typeof <input> === '<type>'`, `=== null`, `=== undefined`, `Array.isArray` and `Number.isInteger`, `isSafeInteger`, `isFinite`, `isNaN`. No solver is needed: these conditions can't tell values apart inside 14 classes (undefined, null, boolean, NaN, infinity, fraction, safe integer, unsafe integer, string, bigint, symbol, function, array, object), so the tool evaluates one value per class and keeps one probe per distinct truth vector.

- The function may return a type predicate (`input is CurrentDay`). That is now the only way a branded value comes into being: the inventory rejects every cast and every non-null assertion in `src`.
- **`isCurrentDay`**: `Number.isSafeInteger(input)` in the code, `typeof` plus `isSafeInteger` in the spec, 3 checks: undefined, NaN, a safe integer.
- **Properties, at any depth.** `'<property>' in <value>` is a condition, every type test may read a property path (`input.book.copy`), and a value may be compared with a string, number or boolean literal. Each property is "absent" or one of the classes, plus the literals it is compared with. The enumeration works from the leaves up and keeps one value per distinguishable case of each property, so properties that the conditions treat alike do not multiply. More than 4096 cells is rejected. `isRenewalForm`: 7 conditions, 14 checks, among them `{ card: undefined, today: 0 }` and `{ card: 'a', today: NaN }`. `isHoldRequest` (kind is the text `hold`, and `book.copy` is a whole number): 10 conditions over the code and a spec that checks in another order, 23 checks.
- **Not covered:** array elements, and comparing a property with a number by `<` or `>`.

### 4. Adapter results that carry data

An adapter may resolve to a union of objects that each carry their own literal `kind`, such as `{ kind: 'found', loan } | { kind: 'none' } | { kind: 'unavailable' }`. The count stays one per kind plus the rethrow. The spec gives the full expected result per kind, and the driver compares it deeply.

- **New rule:** each variant is returned in exactly one place. Two catch statements returning the same variant would leave one of them without a check, so the tool rejects that.
- **`findLoan`**: 3 kinds + rethrow = 4 checks.

### 5. Guards in wiring

Wiring admits one kind of branch: a guard written as a statement of the handler, in one of three forms.

```ts
if (!isLibraryCard(req.card)) return refusal.unreadableCard   // a counted predicate
if (lookup.kind !== 'found') return lookupFailure[lookup.kind] // every other value leaves
if (state === 'overdue') return renewal.overdue                // one value leaves
```

- **Count.** Each guard has a computed set of exits: the values that leave. A handler has one check per exit plus one for the path past every guard. `handleRenewal` has 1 + 1 + 2 exits + 1 = 5 checks, where checking every combination of its stages would multiply instead.
- **Narrowing does the wiring.** After the first guard `req.card` is a `LibraryCard`, and after the second `req.today` is a `CurrentDay`, so the adapter and classifier calls compile only behind their guards.
- **Order is pinned.** The spec exports `order`, the guards in the order the requirement gives them, and the driver compares it with the code's.
- **Each check proves which exit it took.** The driver takes V8 block coverage (`Profiler.takePreciseCoverage`) around every handler check and requires that exactly the named guard returned. Node strips types in place, so V8's offsets are offsets in the TypeScript source. A deliberately mislabelled check, with the right status but leaving through the card guard instead of the day guard, failed with "the check for isCurrentDay(req.today) being false left handleRenewal through another exit" (Run). Under Stryker the source is instrumented, so the exit proof was skipped there and only the results were compared; since 2026-11-10 the proof reads the running function and runs there too (see "Four additions after the third round").
- **An unnamed error passing through the handler gets no check, on purpose.** Wiring has no `try`, and a `.catch(...)` on the adapter call is a call the tool does not admit (F27). So no code in the handler can change that path, and a check of it could never fail.

### Measured after the additions

- **Computed checks:** 569, all passing (as of 2026-11-10, with the contract, its adapter and `findHold`). New since the first field-test fixes: `isLibraryCard` 41, `isDeskPassphrase` 79, `mentionsStaff` 34, `classifyShelfMark` 44, `classifyLoan` 6, `classifyHold` 4, `isCurrentDay` 3, `isRenewalForm` 14, `isHoldRequest` 23, `findLoan` 4, `findHold` 3, `readShelfList` 3, the contract `node@24` 3, `refusal` 2, `lookupFailure` 2, `renewal` 4, `handleRenewal` 5. Changed: `classifyCredential` 195, against the requirement's own pattern.
- **Mutation:** 336 mutants, 330 killed. The 6 survivors are equivalent:
  - `header.slice(7)` → `header`, as before.
  - The `undefined` guard of `isLibraryCard` replaced by `false`: `.test(undefined)` tests the text `"undefined"`, which is not a card.
  - In `isRenewalForm`, the line `if (!('card' in input) || !('today' in input)) return false` replaced by `if (false)`, and its `||` replaced by `&&`; and in `isHoldRequest`, `if (!('book' in input)) return false` replaced by `if (false)`. The type tests that follow already fail on a missing property, so the `in` checks only serve the compiler's narrowing.
  - `$` dropped from the passphrase pattern: its `(?!.*\s)` already rejects every text with a line break, and without line breaks `.{8,}` reaches the end either way.
- **Seeded faults:** the 14 earlier ones (F1 to F14) are still stopped, and so are 25 new ones (`./faults.sh`, 11 minutes):

| Fault | What was changed | Stopped by |
|---|---|---|
| F15 | `[0-9]{6}` widened to `[0-9]{5,6}` in the card pattern | Stale check, then tests fail before and after |
| F16 | `^` dropped from the card pattern | Stale check, then tests fail before and after (neighbour witness) |
| F17 | `[A-Z]` narrowed to `[A-Y]` | Stale check, then tests fail before and after (range-end witness) |
| F18 | `today <= dueOn + 7` changed to `<` | Stale check, then tests fail before and after (difference 7) |
| F19 | `dueOn` and `today` swapped at the call site | Compiler rejects, and the handler check fails |
| F20 | `Number.isSafeInteger` weakened to `Number.isInteger` | Stale check. Before: 0 failures. After: fails on the unsafe integer |
| F21 | The data adapter stops returning `none` | Tool rejects (variant never returned), and tests fail |
| F22 | A second catch statement returns `unavailable` | Tool rejects (variant returned in 2 places). Tests pass: nothing provokes the new statement, which is why the rule exists |
| F23 | The day guard removed from the handler | Compiler rejects (`unknown` is not a `CurrentDay`), stale check, tests fail |
| F24 | The card and day guards swapped | Stale check. Before: 0 failures. After: the order pinned in the spec no longer matches |
| F25 | The day guard replaced by a cast | Tool rejects (cast), stale check, tests fail |
| F26 | A new lookup variant `blocked` | Compiler rejects the dispatch map and the spec, tool rejects (never returned), stale check |
| F27 | `.catch(...)` added to the adapter call in the handler | Tool rejects (a call that is not admitted, and a literal in wiring). Tests pass, because no check provokes it |
| F28 | `today <= holdUntil` changed to `<` | Stale check, then tests fail before and after (difference 0) |
| F29 | `Number.isSafeInteger(input.today)` weakened to a `typeof` test | Stale check, then tests fail before and after (`today: NaN`) |
| F30 | The `typeof input.card === 'string'` test dropped | Stale check, then tests fail before and after (`card: undefined`) |
| F31 | The flag `i` added to the card pattern | Stale check. Before: 0 failures, because no old witness has a lower-case letter. After: fails |
| F32 | `slice(4, -5)` replaced by reading group 1 of `exec` | Tool rejects, and names the cut: "group 1 is mark.slice(4, -5)". Tests pass, because the behaviour is the same |
| F33 | The lookahead `(?=.*[a-z])` dropped from the passphrase pattern | Stale check, then tests fail before and after |
| F34 | The second `\b` dropped from `/\bstaff\b/i` | Stale check, then tests fail before and after |
| F35 | The `input.kind !== 'hold'` test dropped | Stale check, then tests fail before and after |
| F36 | `slice(4, -5)` changed to `slice(3, -5)` | Stale check, then tests fail before and after |
| F37 | A second error class added to the contract's `throws` | Tool rejects the adapter (no catch statement for it), stale check, and the contract check fails |
| F38 | The contract's version changed to one that is not installed | Tool rejects the contract and the adapter that stands on it |
| F39 | A contract clause the library does not keep | The contract check fails against the real library |

## Library contracts

Added 2026-11-10. A library answer was the one thing the tools could only call open. A contract is one reviewed file per package and version, `spec/contracts/<package>@<version>.ts`, that lists per member what it throws and what it guarantees, each with code that shows it against the real library.

```ts
export const contract: Contract = {
  package: 'node',
  version: '24',
  members: {
    'JSON.parse': {
      throws: [{ error: SyntaxError, when: 'the text is not JSON', provoke: () => JSON.parse('[1,') }],
      ensures: [{ claim: 'a number too large for a double comes back as Infinity, not as an error',
                  check: () => assert.equal(JSON.parse('1e999'), Number.POSITIVE_INFINITY) }],
    },
  },
}
```

- **Read, never run, by the inventory.** The inventory and `diagnose` read a contract from its source text, so the file must be an object literal; only the driver runs it, under the project's own test runner.
- **Pinned to what is installed.** The inventory rejects a contract whose version is not the installed one (a shorter version such as `24` or `5.3` matches every release under it), whose file name differs from its package and version, or whose optional `source` file no longer has the recorded sha256. Run against Node itself and against an installed npm package: right version and hash accepted, wrong hash rejected, other version rejected.
- **Each clause is a computed check.** A contract is an obligation with one check per `throws` and per `ensures` entry, run against the real library. `node@24`: 3 checks.
- **The adapter must name exactly what the contract lists.** An adapter spec may export `port = { contract, member }`. Then every error class the contract lists needs its own catch statement, and the catch may name no other class. This ties the fake that the adapter checks use to the real library's behaviour. `readShelfList` stands on `JSON.parse`: 3 checks.
- **`diagnose` lists one exit per declared error.** On a function that calls `JSON.parse` directly, the report went from 2 exits to 3: the throw was invisible before, because calls to built-ins got no exit at all (Run).
- **Limits.** "Throws nothing else" is declared, not shown; the reconciliation now reports an error it sees at a call that the contract does not list. A call is matched to a member by its text as written. Since 2026-11-10 a guarantee may state the result's type, and `diagnose` then says which conditions it settles if the contract holds; that answers D6 as an explanation, not as a ground for removing a check. A clause can also be ruled out by an argument's type (see "Four additions after the third round").

## Reconciling an existing suite

Added 2026-11-10. `node tools/reconcile.ts --tests=<file>[,<file>]` says, for each existing test, which computed cells it reaches and which of them one of its assertions would notice.

**How.** Every counted unit is wrapped when the test runner loads it; no file of the project is changed or copied (see "Running on another project"). Then:

1. Each test runs alone once, and the wrapper records the cells it reaches. A cell is a decision input, a classifier truth vector, an adapter variant, an error an adapter passes on, or a map key. Because a classifier cell is a truth vector, a test's own inputs land in a cell even though they differ from the tool's witnesses.
2. For each reached cell, the suite runs once with that one cell returning a different valid outcome. A test checks the cell when an assertion of its own then fails. A test that only stops because later code throws is listed apart.
3. For each cell a test reached and did not notice, the tool searches: every other outcome of that cell, and the outcomes of counted units that the change newly reaches (see "Third field-test round" for why).
4. The suite runs once with every outcome changed.

**Verdicts, each with its evidence:** skipped; fails already; runs none of the counted code; cannot fail on the counted code (reaches cells, and no assertion notices any); an assertion notices n of the m cells it reaches.

**Pilot, on a suite of 8 tests written with typical flaws** (`legacy/renewal.test.ts`, 4 s):

| Test | Verdict | Evidence |
|---|---|---|
| renews a loan that is on time | notices 5 of 5 cells | card, day, lookup `found`, loan state, `renewal.onTime` |
| refuses a malformed day | notices 2 of 2 cells | both are card cells: `isLibraryCard: "M-0"` and `refusal.unreadableCard`. It never reaches the day check its title names |
| handles an unreachable catalog | cannot fail | reaches 4 cells; its one assertion is `typeof status === 'number'` |
| answers a refusal with a client error | cannot fail | reaches `refusal.unreadableCard`; `>= 400` holds for the other refusal too |
| classifies an overdue loan | notices 1 of 1 | `classifyLoan`, difference 8 |
| refuses an overdue loan | notices 5 of 5 | card, day, lookup `found`, loan state, `renewal.overdue` |
| renews a staff card | skipped | runs nothing |
| adds the grace period | runs none of the counted code | asserts `100 + 7 === 107` |

The same run measures the old suite: of the 25 cells in the 7 units it touches, it reaches 11 and its assertions notice 9. `isLibraryCard` has 7 cells and the suite notices 2.

**What a verdict allows.** "Cannot fail on the counted code" and "skipped" are the cases `/verifiable:coverage` may remove on this evidence. "Runs none of the counted code" allows nothing: the tool has no evidence about such a test. I first listed it as removable, and the third field test showed why that is wrong: 11 of 30 real tests got that verdict, and each of them guards behaviour outside the shapes. A test whose assertions notice cells duplicates computed checks. Whether it also notices something the cells do not model is settled by the mutation run: when the computed checks leave only equivalent mutants alive, no mutant remains that the old test alone could kill (inferred from that result, not run per test).

**Library calls and their options are cells too** since 2026-11-10; see "Four additions after the third round".

**Limits.** The runners are `node:test` and Vitest; Jest is not built. An assertion is recognized by the error it raises: `ERR_ASSERTION` under `node:test`, a failure message that starts with `AssertionError` under Vitest. Under `node:test`, a top-level test that shares its name with a nested test in the same file cannot be run alone, and the tool says so. Guard exits and boundary positions inside a cell are not changed separately. A wrong title is shown by the evidence, not judged.

**The tools now have tests of their own** (`node --test 'tooltest/*.test.ts'`, 42 tests then, 64 after the four additions and their field round): the reconciliation verdicts above are pinned, 20 patterns must read like JavaScript on 16,612 texts each, 6 patterns must be rejected by name, capture positions are checked, a second project with another layout must pass under both runners, and 8 inventory rules are tried on throwaway projects.

## Running on another project

Added 2026-11-10. Until then every tool assumed the pilot's folders.

**Settings.** A project may hold a `verifiable.json`; without one the pilot's layout applies. The root is `--root=<dir>`, else `VERIFIABLE_ROOT`, else the working directory. A setting the tools do not know is an error.

```json
{
  "include": ["app/**/*.ts"],
  "exclude": ["**/*.test.ts"],
  "shapes": {
    "decisions": "app/**/*.decision.ts",
    "classifiers": "app/**/*.classifier.ts",
    "adapters": "app/**/*.adapter.ts",
    "wiring": "app/**/*.handler.ts"
  },
  "specs": "checks",
  "obligations": "checks/obligations.json",
  "cache": ".verifiable-cache/z3.json"
}
```

- `include` minus `exclude` is the code under the claim. A file in it that matches no shape may hold types only; anything else is rejected, as before.
- The inventory reads the project's own `tsconfig.json`, so its module settings apply.
- Two units with one name are rejected, because a spec is found by the name of its unit.
- `outside` globs name files that are deliberately not under the claim: the inventory lists and counts them and says nothing else about them.
- `specs` is a folder, or a template such as `{dir}/{name}.spec.ts` for specs beside their module.

**The computed checks run under the project's runner.** The driver is `tools/driver.ts`, and a project gets a three-line entry file, written as `.mjs` so that the project's typecheck does not pull the tools in, that hands it the runner's `test` function. Under Vitest the source is transformed before it runs, so the proof of which exit a handler check took was skipped there at first; since 2026-11-10 it runs there as well.

**The reconciliation changes no file.** Under `node:test` a load hook (`module.registerHooks`) hands the runner the wrapped source of each counted unit. Under Vitest a generated config, written to `node_modules/.verifiable/` and removed afterwards, merges the project's own config with a plugin that does the same. Nested tests are told apart by their full path, and one is run alone by a pattern over that path.

**Measured on a second project** (`tooltest/fixtures/desk/`: shapes by file suffix, specs in `checks/`, `module: preserve` with bundler resolution, a Vitest suite of 10 tests, two of them with the same name in different `describe` blocks):

- Inventory: 67 checks, no rejection.
- Computed checks: 8 of 8 groups pass under `node:test` and under Vitest 5.1.0.
- Reconciliation under Vitest, 8 s: the same verdict for every test as the `node:test` run of the same suite in the pilot, which a tool test now compares.

**Limits.** Vitest was run at 5.1.0 here and 5.0.2 in the field test, where a package inside a workspace worked. A project whose Vitest config is a workspace of several projects was not tried. Under plain `node:test` the project's source must load with type stripping, which means erasable syntax and `.ts` import extensions.

## Third field-test round

2026-11-10, by the session that knows the real authentication guard, in a copy, with the tools run in place. The reshape is an auth change that has not been through the auth-change checks; nothing left the copy. Raw evidence stays outside this repository.

**What ran (Run there):**

| Step | Result |
|---|---|
| Settings in a package of a workspace | Loaded: shapes by suffix, specs in a test folder, a `tsconfig` that extends a workspace package |
| Inventory | 187 checks, 0 rejections, 0 unknown cells; 32.5 s uncached, 0.95 s cached |
| Reshape with the new shapes | 516 checks in round two became 187: the 216-input decision was replaced by 9 guards and 4 maps. The reshaped guard passes the whole existing suite, 48 of 48 |
| Contract for the token library | 5 guarantees, all hold against the real library |
| Computed checks under Vitest 5.0.2 | 16 of 16 groups pass in 1.9 s |
| Reconciliation of 30 existing tests | 3 min 8 s, every test run alone; 19 notice cells, 11 run none of the counted code |
| Mutation, Stryker 10.1.1 with its Vitest runner | 173 mutants, 152 killed; of 21 survivors 7 equivalent, 13 false, 1 real at runtime |
| `diagnose` on the final wiring | 13 exits, 10 decidable returns and 3 passed-on errors; 9 of 9 branch points decidable |

Its verdict: not usable on the real guard yet, for three reasons. Each is fixed below, and the fixes wait for its rerun.

**Fixed after the report** (Run here unless marked):

| Reported | Fix | Evidence |
|---|---|---|
| The inventory crashed on NodeNext `.js` import specifiers in specs | The inventory no longer runs any project code: intervals, `port` and contracts are read from the source text. The driver and the `node:test` runner resolve a missing `.js` to its `.ts` | Tool test: a spec that imports a value through a `.js` specifier |
| "Does not run the counted code" was listed as removable and matched 11 real tests | The verdict now reads "runs none of the counted code, so this tool has no evidence about it", and the rule above no longer allows removal | Wording |
| No contract attached when the call is declared in a package that another package depends on | A contract may name `via: '<package>'` to be found through the package that depends on it. `diagnose` matches a member by the call as written and says for each member how many calls it applied to, or that it matched none | Tool test with a package reachable only through another |
| A thrown class could not be declared when its `.name` differs from its export, or when it cannot be imported | A `throws` entry is named by the identifier written in the contract, and may be a predicate instead of a class. A catch statement may be `if (<counted classifier>(error)) return ...`, so an error known only by a field is a variant | Tool tests: admitted with a classifier, rejected otherwise |
| Stryker's Vitest runner reported 13 module-level map mutants as survivors | The driver now loads every unit before the tests are registered. Reproduced on the second project: 3 survivors before, 1 after, the known equivalent; 58 of 59 killed | Run. `vitest.related: false` is required, because the entry file imports units by computed path; with the default Stryker finds no tests |
| An absolute `--out` was written under the project | Absolute paths are kept | Read |
| The entry file pulled the tools into the package's typecheck | The entry file is `.mjs`; one type error in the tools under looser settings is fixed | Tool test runs the `.mjs` entry under Vitest |
| A pinned contract covers one source file | `source` may be a list | Read |
| The adapter check required the port to get the adapter's arguments unchanged | The spec may export `portArgs` | Read |
| Reconciliation had no evidence for a passed-on error, a one-key map, or a variant with no other variant to change to | A passed-on error is a cell: changing it makes the adapter return a variant instead. A cell with no other valid outcome is changed to one outside its type, and the row says so | Tool test: both cases noticed by an assertion |
| A cell was labelled by its witness only | The label gives the outcome: `isLibraryCard: "M-0" gives false` | Tool test |
| Settings had no "outside the claim" list, and specs could not sit beside their module | `outside` globs are listed and counted, not judged; `specs` may be a template such as `{dir}/{name}.spec.ts` | Tool tests |
| Capture advice only for a match bound to a `const`, and without the cut | The advice applies wherever the call stands and prints the full slice | Read |
| `strictNullChecks` off gave a misleading rejection | One rejection names the setting | Tool test |
| `diagnose` advised wrapping a shaped handler, and its regex text was stale | It reads the project's shape globs; text updated | Run |
| A tagged result in wiring needed a one-key map; a guard on a classifier result needed a `const` | A returned object may carry its literal `kind`; a guard may test a call | Tool test |

**The rerun** (Run there, same copy, without its own resolve hook): 6 of the 7 fixes held as claimed. The reshape grew from 187 to 201 checks with two predicate classifiers, the existing suite passes on it (32 of 32), `diagnose` on the original guard now shows the token call's declared error and prints which member it applied to, and Stryker has no false survivor left: 228 mutants, 217 killed, 10 equivalent, 1 real (the removed guard that only the exit proof would catch). Its verdict was still "not yet", for one new reason, fixed here:

| Reported in the rerun | Fix | Evidence |
|---|---|---|
| Changing a result without data into the one that carries data produced a malformed value, so four tests that exist to check a refusal looked unchecked | For an asynchronous adapter the replacement is the full result that its own spec gives for the other variant. Out-of-type changes are now listed on every row that reaches such a cell, noticed or not | Tool test: `free` becomes the spec's `held` result and the real assertion notices; a weak assertion still does not |
| `diagnose` matched a contract member by the text of the call alone, so a contract for one package claimed a call into another | A member applies only when something in the call comes from the contract's package; otherwise `diagnose` says the text matches and the package does not | Run: a probe contract for another package is "not applied" |
| The `.mjs` entry is not picked up where the Vitest `include` is `*.test.ts` | Alternative entry: a `.test.ts` that loads the driver through a variable (`await import(driverPath)`), which the compiler does not follow | Run under Vitest: 8 of 8 groups |
| A returned object in wiring admitted only `kind` as its literal field | Any text literal directly in a returned object is admitted | Read |
| Capture advice came with three generic rejections; `strictNullChecks` off came with three more | Each now stands alone | Tool test for the setting |

**The focused rerun** (Run there) confirmed those fixes and found the flaw under the first one: the replacement value came from the adapter's spec, so whether a test noticed depended on that fixture happening to pass the checks further down. With the fixture's owner changed and nothing else, the four tests no longer noticed the cell they exist for. Fixed here by making the reconciliation a search:

- A cell is noticed when some other outcome of it makes an assertion of the test fail. Every other outcome of the unit is tried, not only the first.
- When the change lets the test reach counted units it did not reach before, their outcomes are tried too, up to three changes together and 24 runs per test and cell. The payload of a changed result can only matter through such units, so the evidence no longer depends on the fixture's values.
- The row prints the combination that was needed: "findLoan: none becomes found, and classifyLoan: [-8,0] gives "overdue" becomes "onTime"" (Run, under both runners, for a test whose replacement loan the next check also refuses).
- A map entry is changed to another key's value, and when all values are equal to a value no key has.
- With `--units`, the verdict says it covers the selected units only.
- `diagnose` applies every contract whose package the call comes from, not only the first.

The pilot's legacy suite takes 32 s with the search, against 8 s without.

**The retry** (Run there, in two copies that differ only in a fixture value): 0 of 30 rows differ between the copies, so the full run no longer depends on the fixture. It also showed the search going too far: after a classifier's answer was changed, it went on into the units reached next and credited 2 tests with a cell they would only notice if two independent checks broke together. Fixed here: the search goes on into newly reached units only after an adapter result was replaced by one that carries data, because only then does replaced data flow into them. Under `--units` every unit stays wrapped, so the search can still reach the classifiers behind the selected unit. Both are pinned by tool tests, one of them a test that refuses a bad card on a bad day and must come out as "cannot fail".

**The confirmation run** (Run there): both over-credited rows are back to their earlier verdicts, no "noticed only under" line is left in the full run, and against the run before the search no row differs. Under `--units`, in the copy with the changed fixture, all four tests notice the cell through the printed combination. No new defect, gap or usability item.

**Where the field test stands.** Its answer to "would you use this on the real guard" went from no, to not yet, to: yes, with limits, as evidence, not for removing tests and not for calling the guard verified. The limits it would state to the owner of the code:

1. The claim covers the reshaped branch only; a second branch, the glue around one port and 8 files declared outside are not covered.
2. Under Vitest there is no exit proof.
3. Every "noticed only under another outcome" line must be read.
4. 10 tests of library options get no verdict about their purpose, and 4 tests that differ only inside the library cannot be told apart.
5. A contract's errors are declared, not shown to be all there are; guarantees mark no code dead.
6. The reshape is an auth change and needs the auth-change checks and an independent second pass before it leaves the copy.

With specs beside their modules, a mutation run must leave `*.spec.ts` out of its `mutate` globs, or the specs get mutated (49 extra survivors in the field).

**Open after that round, and what became of each** (built on 2026-11-10; see "Four additions after the third round"):

1. Under Vitest the exit proof was skipped, so a removed guard whose neighbours give the same output survived at runtime. Built: the proof runs under Vitest and inside a Stryker sandbox.
2. Existing tests that check a library option or a contract clause could not be linked to it; 10 such tests in the real suite stayed unclassified. Built: library cells in the reconciliation.
3. A contract could not scope a throw to the argument types of the call. Built.
4. Two branded numbers cannot be compared with `===` (TS2367); the difference `a - b === 0` works. Unchanged.
5. The conversions next to a `null` check (a date to a number, an id to a number) had no shape, and a brand cannot be cast. Built for numbers, dates and text of digits.
6. A guarantee marked no code as dead. Built in `diagnose` as "given ... if the contract holds", after the first wording ("dead") proved too strong in the field.
7. Three tests that differ only inside the library show identical evidence, because the adapter sees one result for all three. The tool now says so on each of them ("same evidence as"); telling them apart needs the library to expose the cause.
8. A library error that a well-typed call cannot provoke became a variant, a guard and a check that no input reaches. Built: the clause is ruled out by the argument's type, and the adapter must then drop it.

## Four additions after the third round

Added 2026-11-10. Each closes one item that the third field-test round left open. Run here unless marked; the fourth field-test round is recorded at the end of this section.

### 1. The exit proof runs under Vitest and inside a mutation sandbox

Before, the driver found each guard's `return` by its offset in the file on disk. That only matches the running code when Node strips the types in place, so under Vitest and under Stryker the proof was skipped.

- **How.** The driver now reads the running function itself (`Function.prototype.toString`), lists its own `return` statements in order, and looks each one up in V8's block coverage, counted from the start of that function. Transformed or instrumented code is read as it runs. The inventory no longer stores an offset.
- **Under Vitest 5.1.0** (Run, with the `forks` and the `threads` pool): V8 reports the handler under its own name, with a range exactly as long as the function's text. With the card guard and the day guard swapped and the inventory not rerun, the handler check fails with "the check for isLibraryCard(req.card) being false left handleRenewal through another exit". A tool test pins that.
- **Under Stryker's Vitest runner**, on the second project: the dry run passes with the proof switched on, and 58 of 59 mutants are killed, the survivor being the known equivalent.
- **When no proof can be had, the check fails.** It names the reason: no V8 inspector in the process, no function of that name and length in the coverage, or a number of `return` statements that does not fit the guards.
- **Not checked:** Vitest run with its own V8 coverage report switched on. Both would read the same counters.

### 2. The reconciliation links tests to library options and contract clauses

The third round left 10 tests of library options without a verdict about their purpose. `tools/reconcile.ts` now also changes what a library call gets and gives, one cell at a time.

- **Which calls.** Every call in the project's files, the files declared outside included, that a contract member applies to: it is written as the member is named, and something in the call comes from the contract's package. A member with no `throws` and no `ensures` is enough.
- **Clause cells.** A call either returns, or throws under one of the member's `throws` clauses. To change "returns", the tool makes the call throw the error of each clause, which it gets by running that clause's own `provoke` against the real library. To change "throws when A", it throws the error of every other clause.
- **Option cells.** Every property of an object-literal argument is a cell, at any depth, and so is every element of a list written in place. It is tried removed, so that the library's default applies (an element is removed from its list), and changed: a boolean negated, a number set to 0 and raised by 1, a text extended. A value that is not a literal is only tried removed.
- **What a row says.** For each library cell a test reaches: the changes under which one of its assertions fails, the changes it does not notice, and the changes that only make it throw. "Noticed when changed to false, not noticed when removed" means the test guards the value, and the value written is the library's default.
- **A contract gap is reported.** When a call throws an error that none of its clauses lists, the run ends with a `CONTRACT GAP` line naming the call, the error and the tests. This is the first evidence the tools give about "throws nothing else", which was only declared.
- **A contract that the suite contradicts is reported** (added after the fourth field round). Every value a wrapped call returns is tested against the member's result guarantees, and every error against its argument scopes (both in the next subsection). A violation ends the run with `CONTRACT REFUTED`, the call, what happened and the tests.
- **A member that no call uses is listed** as `NOT OBSERVED`, with the reason: a library that is passed in as an object is called through that object, not as the member.
- **Tests that cannot be told apart are named.** Two passing tests with the same reached cells and the same evidence get "same evidence as ...; nothing here tells them apart".
- **Verdicts.** A test that runs none of the counted code and notices a library cell reads "runs none of the counted code; an assertion notices n of the m library cells it reaches". "Cannot fail on the counted code" is given only when the test notices no library cell either.
- **No file is changed.** The calls are wrapped when the runner loads the file, as the counted units are. The contracts are loaded before the first test: by the preload under `node:test`, by a generated setup file under Vitest.

**Pilot** (`legacy/desk-command.test.ts`, 7 tests around `parseArgs` of Node 24, 11 s). The call sits in `src/ports/desk-words.ts`, a file declared outside the claim, with the options `strict: true` and `allowPositionals: false`.

| Test | Library evidence |
|---|---|
| reads a renewal command | notices "returns" under each of the 3 clauses; `strict` and `allowPositionals` reached, not noticed |
| refuses an option the desk does not know | reaches "throws when a word names an option that is not declared" and notices it under the other 2 clauses; `strict`: noticed when changed to false, not when removed |
| refuses a stray word | `allowPositionals`: noticed when changed to true, not when removed |
| refuses a card option without its value, and refuses a value given to the renew switch | the same clause and the same evidence, so each is listed as "same evidence as" the other |
| survives any words (asserts only that `kind` is a text) | cannot fail on the counted code; reaches 6 library cells and notices none |
| passes on a failure the desk does not name | `CONTRACT GAP`: `TypeError: Cannot read properties of null (reading 'length')`, which the contract does not list |

The same link under Vitest, on the second project: `strict` is "noticed when changed to false, not when removed" for the test that expects a refusal (tool test).

**A cache had to be worked around.** Vitest 5.1.0 kept transformed modules in `node_modules/.vitest-cache`, keyed by the file on disk and the config, not by what a `load` plugin returns. A second reconciliation with other wrapping got the first run's code, and showed no library cell at all. The generated config now carries a hash of the wrapped sources, so the key changes when the wrapping does (Run: a run with `--units`, then a full run, shows the library cells).

**Limits.** A call with an argument that awaits, or inside an optional chain, is not wrapped and is listed as `NOT OBSERVED`. An error raised while the arguments are evaluated counts as the call's. A call that only looks like a member, because the package's types did not load, is listed as `NOT OBSERVED` with that reason. `ensures` clauses without a result guarantee are not linked to tests. An adapter that reaches the library through an injected port is observed at the direct call, not at the port. A member without `throws` clauses has a "returns" cell that is reached and never changed, because there is nothing valid to change it to.

### 3. A contract can rule an error out, and can state what comes back

Both additions are declarations that the tools check on samples. Neither is a proof, and the output says so. The first version of the second one did not, and the fourth field round caught it: see "What the fourth round found".

- **An error scoped to an argument type.** A `throws` entry may add `argument: { index, path?, isNot: 'string' | 'number' | 'boolean' }`: the error is thrown only when that argument, or the property at that path inside it, is not of that type. The tools read the static type at every call of the member in the project.
  - `diagnose` lists no exit for the error at a call that passes the type, and prints `scoped line 9 join(…) gets no exit for TypeError (a segment is not text): its contract says it is thrown only when argument 2 is not a string, and here that is string`.
  - The inventory changes the adapter rule: when every call of the member passes the type, an adapter that stands on the member must not name the error. The rejection lists the calls and says "remove the statement and its variant". As long as one call may pass another type, the error stays required. This is what removes a variant, its guard and its check that no input reaches. If the declaration is wrong, the error passes through the adapter unchanged, as any error it does not name.
  - With no direct call of the member in the project's files, the one call the adapter makes through the object passed in counts as the call (added after the field rerun). With neither, nothing is ruled out.
  - When a test makes such a call throw the ruled-out error after all, the reconciliation prints `CONTRACT REFUTED` (tool test).
- **A guarantee about the result.** An `ensures` entry may add `result: { path?, is }`, with `is` one of `string`, `number`, `boolean`, `object`, `array`, `defined`. It is a claim about every call.
  - In a member that has such a claim, every `ensures` check must return what the member returned, and the driver tests every result claim on every one of those values. A contract that claims "what comes back is an object" beside a check that gets `null` fails with "the contract contradicts itself" (tool test).
  - The reconciliation tests the claims on every value the member returns while the existing suite runs.
  - `diagnose` follows a `const` that holds the member's result, also when it is destructured, and reads conditions on it: comparison with `undefined` or `null`, `typeof`, `Array.isArray`, and plain truth for an object or array. It prints `given line 6 parsed.values === undefined is always false if the contract holds: the values come back as an object [contract node@24]`, marks the exits behind such a condition `[not taken if the contract holds]`, does not count the condition as decidable, and ends the report with "a given or scoped line rests on what a contract declares and its checks sample; it explains an exit, and is no ground for removing a check".
- **Measured** (8 tool tests on throwaway projects): an adapter without the ruled-out error is admitted with 2 checks; one that names it is rejected; with one loosely typed call the error is required again and the adapter has 3 checks; `diagnose` prints 3 given lines, 3 exits not taken if the contract holds, no exit for the ruled-out error and one for the call behind a cast; a scope with a property path rules out one of two calls; a guarantee the library does not keep fails its own check; a guarantee that another check contradicts fails the contract.
- **Limits.** A guarantee that depends on the input cannot be stated, and must not be stated as a result claim. Scopes cover `string`, `number` and `boolean`. In shaped code a guarantee is used by giving the port's result its guaranteed type; the inventory does not compare that type with the guarantee. `diagnose` reads `const` only.

### 4. Conversions, a fifth shape

A value that changes its unit or its type without a decision had no shape: a date to a day number, minutes and seconds to seconds, an id that arrives as text to a number. Such code could not be wiring (a call, arithmetic), and could not create a branded number, because every cast is rejected.

- **The shape.** An exported function with one statement, `return <expression>`. The expression is built from the inputs, `<date>.getTime()`, `Number(<text of digits>)`, whole-number literals, `+ - * / %`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, and one cast to a branded number around the whole result. That cast is the one place in the code under the claim where a cast is admitted. Wiring may call a conversion. The glob is the optional setting `shapes.conversions`, by default `src/conversions/*.ts`.
- **Inputs.** Numbers that each have their own type; dates; and text of a branded type that a classifier gives through a type predicate, when every text that classifier accepts is 1 to 15 digits. The solver decides that last condition from the classifier's own code. A predicate that accepts `[0-9a-f]{1,4}` is rejected with a text that passes it and is not digits; a text type that no classifier gives is rejected too (tool test, added after the fourth field round).
- **The spec** exports `expected(...)` in the same vocabulary, written from the requirement.
- **What the tool computes.** One path has no cells, so the checks come from the expression's neighbours: every rounding swapped for each other one and removed, `+` and `-` swapped, `*` and `/` swapped, every literal moved by one, every input replaced by another input of its kind. For each neighbour the solver is asked for an input on which it and the code differ, and that input becomes a check. One more question asks for an input on which the code and the spec differ; if there is one it becomes a check, which then fails. The checks run the code and the spec in JavaScript.
- **Whole numbers only.** The solver must show that the result is a whole number for every whole-number input. With the rounding taken out of the fixture, the rejection reads "the conversion gives 1.1574074074074074e-8 for (1), and the classifiers that read its result count whole numbers only; round the result" (F42).
- **A date's conversion gives a plain number, never a branded one.** A date may be invalid, and then `getTime()` is NaN. The first version let the conversion cast that to a branded type and printed the assumption "the date is valid". On the real guard that assumption sat on a path that failed open: NaN compared with the current time is false, so an expired session counted as live. Now the cast is rejected for a conversion that reads a date. It returns a plain number, a predicate that tests `Number.isSafeInteger` gives it its type in a guard of the wiring, and the invalid date gets an exit and a check of its own. Each date input also gets a check with an invalid date, on which code and spec must agree.
- **The one assumption left is printed.** An input typed plain `number` gets an `ASSUMES` line: it is a whole number.
- **`dueDayOf(dueAt: Date): number`** is `Math.floor(dueAt.getTime() / 86_400_000)`, with a spec that divides by `24 * 60 * 60 * 1000`. 7 neighbours, none equivalent, 6 checks: 0, 1, −1, −86400001, 86399999 and the invalid date.
- **Encoding.** The first encoding used real numbers with `to_int`, and one question about `Math.trunc` came back unknown, which blocks the claim. Every value is now a fraction of a whole-number term over a constant, and every rounding is a whole-number division. A conversion that uses all four roundings and `%` computes with no unknown answer (tool test).
- **Limits.** The product of two inputs is rejected. Results of several values at once (an object) are not built: one conversion gives one number. The reconciliation does not change a conversion's result. Text other than digits has no conversion.

### Measured after the four additions

- **Computed checks:** 600, all passing: `dueDayOf` 6, `readDeskCommand` 5, three failure predicates 5 each, and the contract `node@24` now 8.
- **Tool tests:** 64 (`node --test 'tooltest/*.test.ts'`), 6 of them added with the fixes after the fourth field round.
- **Mutation:** 406 mutants, 400 killed (rerun after the fixes that followed the fourth field round). The 6 survivors are the equivalent ones listed under "Measured after the additions". The new units: `desk-command.ts` 17 of 17, `parse-failure.ts` 51 of 51, `due-day.ts` 2 of 2. Stryker makes two mutants for the whole conversion, so the mutation score says little about a conversion; F40 to F42 below were seeded by hand for that reason.
- **The file declared outside the claim is outside the mutation claim too.** With `src/ports/desk-words.ts` left in the `mutate` globs, all 12 of its mutants survived the computed checks, among them `strict: false` and `allowPositionals: true`. That is what "outside" means, and it is why the run above leaves the file out. The same two changes are the ones the reconciliation shows an existing test noticing.
- **Seeded faults:** all 43 are stopped, and both controls behave as before (`./faults.sh`, 12 minutes, rerun after the same fixes). The four new ones:

| Fault | What was changed | Stopped by |
|---|---|---|
| F40 | `Math.floor` changed to `Math.trunc` in the conversion | Stale check, then tests fail before and after (the check at −1) |
| F41 | The divisor `86_400_000` changed to `86_400` | Stale check, then tests fail before and after |
| F42 | The rounding removed | Tool rejects (the result may be a fraction), stale check, tests fail |
| F43 | A result guarantee changed to one the library does not keep (`values` is an array) | Stale check, then the contract check fails before and after |

### What the fourth round found

2026-11-10, by the session that knows the real authentication guard, in copies, with the tools run in place. The reshape is still an auth change that has not been through the auth-change checks; nothing left the copies. Raw evidence stays outside this repository. Every row is Run there unless marked.

| Step | Result |
|---|---|
| Inventory | The old obligations file was reported stale, as intended. After the rerun: 200 checks, 0 rejections |
| Exit proof under Vitest | 15 of 15 groups pass under the package's own config. Two guards swapped without rerunning the inventory: the handler check fails with "left ... through another exit" |
| Stryker 10.1.1, sandbox mode | 227 mutants, 217 killed, 10 survived. The last real survivor of round three (a guard replaced by `false`) is killed; all 10 survivors are the known equivalents |
| Library links | 32 tests in 3 files, 12 min 43 s. The main configuration call has 42 option cells, 14 noticed; a second configuration call 5 of 5. No contract gap |
| The 10 tests of library options | All 10 get library evidence. 8 notice exactly the option the hand mapping named, when it is removed and, for literals, when it is changed. 2 only partly |
| Tests that differ only inside the library | Two pairs are named as "same evidence as" each other, among them a token without a subject and a token past its expiry |
| Conversion | A date to a branded number was admitted with 2 checks. With it, all three ports are passed in unchanged and no glue is left around them: 204 checks, 17 groups, the existing suite 49 of 49 |

**Reported, most serious first, and what was changed** (Run here unless marked):

| Reported | Change | Evidence |
|---|---|---|
| A result guarantee was checked on the one value its own check returned and then used as if proven. `diagnose` called a reachable null check on a token payload dead, while four other checks of the same contract member got a null payload and passed | Every check of a member with a result claim must return the member's result, and every claim is tested on all of them. The reconciliation tests the claims on every value returned during the suite. `diagnose` says "given ... if the contract holds", never "dead", does not count the condition as decidable, and says it is no ground for removing a check | Tool tests: a contradicted claim fails the contract; a refuted claim is printed |
| A date's conversion carried NaN into a branded type; on the guard that path failed open | A conversion that reads a date may not cast. It returns a plain number, and a predicate gives it its type in a guard | Tool test: the cast is rejected, the plain form is admitted |
| A test that resets the module registry and imports again got no library evidence (cause inferred there) | The reconciliation's state is shared across module instances | Tool test under Vitest with `vi.resetModules()` |
| Stryker run in place failed its dry run: the driver knew a sandbox only by its path | Instrumented source is recognized by its content | Read; the field rerun tries it |
| "Same evidence as" depended on the order in which cells were recorded, and missed an identical pair | Compared without order | Read; the field rerun tries it |
| An argument scope could not name a property inside the argument | `path` in the scope | Tool test |
| Text to number was not built, and was the last unshaped line | Text of digits, shown by a classifier | Tool test |
| A member that applies to no call got no line | `NOT OBSERVED <member> of the contract ...` | Tool tests |
| A list was one option cell, so a single element of it was never removed | One cell per element | Tool test |
| A member without `throws` clauses was changed to a made-up error on every row | Its "returns" cell is reached and never changed | Tool test |
| 12 min 43 s | A changed cell reruns only the test files whose tests reach it | The field rerun measures it |

Not built: a guarantee that depends on the input. It cannot be stated as a result claim.

The cause of the first row is logged in the generation-cause ledger: a claim about every call was accepted on the evidence of one call, and the feature's own tests used only library members whose result does not depend on the input.

**The rerun** (Run there, same copies): the fixes hold.

| Item | Result on the real guard |
|---|---|
| Contradicted guarantee | The contract check fails with "the contract contradicts itself", naming the bad-token check and the claim. With a true claim and every check returning its result: 17 of 17 groups |
| Guarantee against the suite | Full reconciliation of the original guard, 8 min 34 s, ends with `CONTRACT REFUTED`, naming the call and the bad-token tests |
| `diagnose` | "given line N ... if the contract holds", 0 conditions counted as decidable, and the closing line |
| Module reset | The token-lifetime test now notices the expiry option when it is removed |
| Stryker in place | The dry run passes: 227 mutants, 217 killed, the same 10 equivalent survivors |
| "Same evidence as" | The identical pair that was missed before now name each other |
| Scope with a property path | On the original guard the ruled-out error loses its exit (15 exits become 14), and the inventory rejects the catch that still names it |
| Text of digits, and the date | A digits classifier (30 checks), its conversion (1), the date conversion as a plain number (2) and a safe-integer predicate (3) were admitted: 241 checks, 0 rejections, no `ASSUMES` line, 20 of 20 groups, the existing suite 52 of 52. A classifier that lets 16 digits through is rejected with the text `1000000000000000` |
| The fail-open path | Closed in the copy: the handler has two new exits, one for an invalid date and one for an owner text that is not digits |
| Unshaped code in the reshaped branch | 0 lines; all three ports are passed in unchanged |
| List elements | The test of one list element notices that element "removed from its list"; the options now have 46 cells, 16 noticed |
| Run time | 12 min 55 s against 12 min 43 s: no gain, because every test file builds the server and so reaches every option cell |

**New in the rerun, and what was changed** (Run here unless marked):

| Reported | Change |
|---|---|
| The scope did not reach a library that is passed in as an object: the adapter's own call was not counted, so the ruled-out variant could not go in the reshape | With no direct call of the member in the project, the one call the adapter makes through its first parameter counts as the call. Tool test |
| `diagnose` prints given lines from a contract that its own checks refute, because it reads the contract without running it | The closing line says so, and says to run the checks and the reconciliation first |
| `--units` dropped library evidence and the contract test without a word | The run ends with a `NOT OBSERVED with --units` line |
| A map cell was listed as "changed outside its type" on 17 rows, though its values differ | The line was printed for every test that reached the cell, because one of the changes tried was outside the type. It is now printed only when the change the test noticed was that one, or when every change tried was (Read here) |

Left as it is: the run time. Running several changes at once could make a timing-sensitive test fail and be counted as noticing.

**The confirmation run** (Run there): all four changes hold. In the reshape, the adapter that still named the ruled-out error is rejected with the adapter's own call listed as the only call of the member; with the catch, its variant, the guard and the check removed, 241 checks become 239 with 0 rejections, 20 of 20 groups, and the existing suite passes 52 of 52. The adapter passes the object the same arguments the member takes, so the rule read the right argument. No row carries the "outside its type" line any more (17 before), and every other piece of evidence is identical to the run before.

That run took 1 h 39 min of wall time for the same CPU time as the 12 min 55 s run. The cause is the machine, not the tool: its power log shows it sleeping and waking in maintenance cycles during that hour, the seeded-fault run here took 88 minutes in the same window for the same CPU time as its 12-minute runs, and a reconciliation timed here afterwards took 9.6 s against 10.9 s before (Run).

**Where the fourth round stands.** The answer on the real guard is unchanged: yes, with limits, as evidence only. Of the six limits from the third round:

1. Narrowed. The reshaped branch has no unshaped line left; a second branch and the files declared outside are still not covered.
2. Lifted. The exit proof runs under Vitest, in a Stryker sandbox and in place.
3. Stands as a reading rule, now for the library rows that only throw.
4. Mostly lifted. All 10 tests of library options have evidence. Open: one test cannot reach its clause, because the library is passed in as an object, and two pairs of tests are identical for the tool, and named as such.
5. Narrowed. A false guarantee is refuted by the contract's own checks or by the suite, a line that rests on a guarantee is labelled as such, and the variant that no input reaches could be removed in the reshape. A contract's errors are still declared, not shown to be all there are.
6. Stands. The reshape is an auth change and needs the auth-change checks and an independent second pass before it leaves the copy.

One rule was added by the field session and is adopted: a given or scoped line is used only after the contract's computed checks pass and the reconciliation prints no `CONTRACT REFUTED`, and never to remove a check.

## Helpers for `:mutation` and `:prune`

Added 2026-11-10. Neither helper runs a mutation test or deletes anything. No mutation run was made for them, at the author's instruction: the first was tried on the report of the last run above, the second on a fresh reconciliation, and both on handcrafted inputs in tool tests.

**`node tools/mutation.ts [--report=<file>]`** reads a mutation report in the JSON format that Stryker writes (`reports/mutation.json` by default) and sorts every surviving mutant:

- **open**: in code under the claim, with the unit it sits in and that unit's number of checks. An open survivor is an input the checks do not tell apart from the mutant.
- **explained**: it matches an entry in `<specs>/equivalent-mutants.json`, a reviewed list of `{ file, mutator, original, replacement, reason }`. An entry is matched by the mutated text, not by its line, so it survives edits elsewhere in the file.
- **outside**: in a file that is not under the claim. The helper says the file should not be in the mutate globs; `--mutate` prints the globs for the project (the code under the claim, minus excluded files, files declared outside and specs that sit beside their module).
- **stale**: an explanation that no surviving mutant matches any more.

It exits 1 on an open survivor, a stale explanation, or a mutant that was neither killed nor survived. On the pilot's report (Run): 406 mutants, 400 killed, 6 survived, all 6 open at first, each with its unit; with the six reasons from "Measured after the additions" written into `spec/equivalent-mutants.json`: 6 explained, 0 open, exit 0.

**`node tools/prune.ts [--rows=<file>]`** reads the rows that `reconcile.ts` wrote and prints a plan, in three lists:

- **may be removed**: a test that is skipped, or that gets the verdict "cannot fail on the counted code" and notices no library cell. These are the two cases the pruning rule allows.
- **duplicates computed checks, not removed on this evidence alone**: every cell the test notices has a computed check.
- **kept**: a test that guards a library cell, with the cells; a test the tool has no evidence about; a test that fails already; anything else, with its verdict.

Tests with identical evidence are listed as candidates to merge after a person has read them. On the pilot's four legacy suites, 23 tests (Run): 7 may be removed, 9 duplicate computed checks, 7 are kept, 6 of those for the library cells they guard, and 1 pair has identical evidence.

**Limits.** The prune plan rests on the reconciliation alone. A per-test kill matrix from a mutation run of the existing suite is not read, so "duplicates computed checks" is never turned into "may be removed". The report format was read from Stryker 10.1.1 with the command runner; a Stryker.NET report was not tried. 5 tool tests pin the two helpers (69 in total).

## What this does not cover

1. **The table can be wrong.** A person reviews the table against the prose requirement. That step is bounded and listed, but not removed. In the pilot one author wrote both the code and the specs, so independent authorship was not tested.
2. **Arithmetic, text, collections and dates** fit none of the first four shapes. Each needs its own shape before it can be admitted. Since 2026-11-10 the conversion shape admits arithmetic with rounding over whole numbers, dates and text of digits, one result at a time; products of two inputs, other text and collections are still outside. Collections could go through a checked per-element decision. Until then such code is outside the claim and must be counted as such.
3. **Adapters ran against a recording fake**, not a database. That establishes the mapping from outcome to variant, not database constraints, transactions or isolation.
4. **Concurrency and stale authorization** (permissions that change between read and write) are not covered.
5. **The tools are trusted code.** A bug in the inventory gives a wrong count. The solver translation checks itself on every run, and 64 tool tests pin the regex translation, the reconciliation verdicts and library links, a second project layout, the exit proof under Vitest, the conversion rules, the contract scopes and 8 other inventory rules; the remaining inventory rules are tested only through the seeded faults.
6. **Classifiers cover integers, strings within the vocabulary, and type tests on `unknown` values and their property paths.** Not built: reading a captured group whose place depends on the text, backreferences, lookaround inside groups, array elements, and arithmetic other than sums and differences. Brands are still cast in specs; in `src` a cast is rejected.
7. **UI rendering is not covered.** One proposal: make the view a function of a finite view state and check it over every state. Not tried.
8. **Mutation scores miss whole classes of fault.** Stryker has no mutator for swapped arguments, new constants or added branches. F1 to F10 were seeded by hand for that reason.
9. **Authorization in the pilot is a fixture, not an auth implementation.** It got none of the auth-change checks and must not be copied as one.
10. **Toolchain.** Stryker 10.1.1 crashes on TypeScript 7.0.2 (`ts.parseConfigFileTextToJson is not a function`) unless `tsconfigFile` points at a missing file. The inventory uses the TypeScript 6.0.3 compiler API, because the 7.0.2 package exports only `unstable/*` APIs.

## The `diagnose` command

`node tools/diagnose.ts <file.ts> [--at=<line where the function starts>]` reads one file with its own `tsconfig.json`. It works on code that is not yet in the shapes, and for each function it reports:

- every branch point (`if`, `?:`, `&&`, `||`, `??`, `?.`, `switch`, loops, `try`, a promise rejection handler), and whether it can be decided from finite inputs alone. A comparison of a number input with a number literal counts as decidable, because it cuts cells;
- for each branch that can't be decided that way, what it depends on: an open input with its type, string or array work, a library or project call, state read from outside the function, or a thrown value;
- merged failure sites, where several failure causes become one value (`.then(ok, () => undefined)`, `.catch(() => undefined)`, a `catch` that never reads the error);
- effects inside the logic, and reads of state from outside the function;
- reshape steps, each mapped to a shape. Nothing is suggested for code already in the adapter shape.

**Control, run on the pilot:** `authorize` 9 of 9 branch points decidable, `deriveRole` 4 of 4, `classifyAccount` 2 of 2. The wiring has no branch points at all, and `writeProvider` is recognized as already in the adapter shape.

**The guard of a real authentication module**, in a codebase outside this repository (its file had no uncommitted changes when the tool ran). It has 11 branch points, and **none** can be decided from finite inputs:

- every branch depends on a request header (`string | undefined`, then parsed with `.match` and `.split`) or on the answer of one of two calls into an authentication library, or of a local lookup helper;
- one line turns every failure of the token check into `undefined`, and the lookup helper does the same for every lookup failure;
- there are 2 effects inside the logic and 3 reads of state from outside the function.

That is the mechanism behind the gaps. Every branch reads a string or a library answer, so no list of cases can be complete. And because failures are merged, a test written for one rejection cause also passes when a different cause rejects the token (inferred, not run).

**Not built yet,** from the command you described:

1. Applying a reshape in a copy, guided by the pattern catalog below. That is model work, and the tool only checks it.
2. Checking the reshaped code with `inventory.ts`, so that it is admitted and its obligations are computed.
3. The exact test plan, which is that obligation list.
4. Reconciling the existing suite. Built on 2026-11-10 for `node:test`: see "Reconciling an existing suite".

**Known limits of `diagnose`:** it reads one file at a time. Local helpers are reported separately instead of being followed. Data flow is traced through `const` initializers only, not through reassigned `let` variables. Nothing tests it beyond the control above.

## Claims in the pattern documents, tested

Run in the job's scratch directory `claims/`, which is deleted along with the job. TypeScript claims used TypeScript 7.0.2, zod 4.6.7 and fast-check 4.10.2; the lint check used ESLint 10.14.0 with `@typescript-eslint/parser` 8.72.1 on TypeScript 6.0.3, because 8.72.1 refuses to run on TypeScript 7.0. .NET claims used SDK 10.0.201.

**TypeScript document**

| Claim | Result | Evidence |
|---|---|---|
| A state the types can't represent needs zero runtime tests | False for valid states | `getPaymentBadge` returning "Processing" for `SETTLED` compiles under the document's tsconfig and returns the wrong badge |
| The `never` guard breaks the build on a new variant | True | adding `REFUNDED` gives TS2345 |
| `Result` forces a `.ok` check before `.value` | True | TS2339 |
| `Result` makes every exit edge visible | False | a `Result`-typed `parseConfig` compiles and throws `SyntaxError` on `{` |
| The schema is the only way to mint a brand | False | `'not-a-uuid' as SessionId` and `Date.now() as UtcEpochSeconds` both compile, the second with the wrong unit |
| 100% basis paths, `V(G) = E − N + 2P` | `V(G)` is not the path count | `V(G)` = 3 with 4 executed paths; `V(G)` = 3 with 2; `(a && b) \|\| (c && d)` has `V(G)` = 5 with 7 |
| MC/DC needs c + 1 tests | True per decision, as measured | all 218 three-condition decisions need exactly 4; 400 random four-condition decisions need 5 |
| fast-check "accepts 100% of valid UUIDs" | False as stated: it samples | both of the document's properties pass. A planted bug at an extreme value (`ffff…`, or a leading `7`) was found in 200 of 200 runs; one at an interior value (characters 10–13 equal to `a1b2`) in 0 of 200 |
| The `TSAsExpression` ban exempts brand casts | False | the document's own selector flags both casts in its own Pattern 3.1 |
| The tsconfig baseline | Accepted | TypeScript 7.0.2 exits 0 with every listed option |
| `isSessionActive` has `V(G)` = 1 and needs nothing more | False | one basis-path test passes for both `>` and `>=`; three cells (99, 100, 101) catch `>=` |
| `sid: z.string().uuid()` | Wrong for OIDC | OIDC Back-Channel Logout 1.0 §2.1 says `sid` is "opaque to the RP" and has the syntax of an OAuth 2.0 Client Identifier. In the codebase of the field test the token carries a serial id as text in that claim, not a UUID (Read there) |

Two of my own predictions were wrong. fast-check does find extreme values reliably, and misses only interior ones. MC/DC's c + 1 holds for every decision I measured.

**.NET document**

| Claim | Result | Evidence |
|---|---|---|
| The code compiles as pasted | No | the interface's type-parameter list (`TError TUnderlying,`) fails to parse with CS1003/CS1001. This may be damage from the paste |
| `required` on positional record parameters | Syntax error | CS1003 and CS1001 on all 7 parameters |
| A private-constructor `abstract record` is closed, so a switch with no `_` arm only fails on a new state | False | CS8509 fires with all three states handled (`Sessions.cs:44`). The compiler doesn't treat the hierarchy as closed, so the document's two rules (no `_`, CS8509 as an error) can't both hold |
| `_ =>` on an enum keeps exhaustiveness | False | with `_`, a new enum member and a new state both compile, then throw at runtime (`ArgumentOutOfRangeException`, `UnreachableException`) |
| The document's code builds under its own props | No | 29 errors: CA1515 ×12, CA1062 ×5, CA1034 ×3, S1133 ×2, CA1028 ×2, CA1000 ×2, CA1303, CA1008, CS8509 |
| `BannedSymbols.txt` is enforced | No | the props never add it as `AdditionalFiles`, so there are 0 RS0030 warnings. With it added, `DateTime` and `Guid.NewGuid` are flagged, but the entries `M:System.Threading.Tasks.Task.Result` and `M:System.DateTimeOffset.get_UtcNow` match nothing |
| A `readonly record struct` wrapper has the primitive's memory layout | False | `SessionId` takes 20 bytes, `Guid` 16 |
| `Parse` is the only way to construct, and a default `Result` is banned | False | `default(SessionId)` and array elements compile (`IsValid` false); `default(Result<int, string>).Match` calls `onErr` with `null` |
| Working alternative for enums | Verified | with no `_` arm, CS8524 in `NoWarn` and CS8509 as an error, a new member breaks the build, and the unnamed value 99 throws `SwitchExpressionException` at runtime |

**.NET framework document (third).** It overlaps on seven points, all consistent with the tables above: an `abstract record` hierarchy isn't closed in C# 14, a `_` arm hides new enum members, struct `default` bypasses constructors, `Result` doesn't force handling, banned-API lists need build inputs, `V(G)` 3 against 4 paths, and one witness per path isn't the property. Its new claims:

| Claim | Result | Evidence |
|---|---|---|
| `CanApprove` has 8 combinations over 4 paths, holding 4, 2, 1 and 1 | True | traced over all 8 inputs |
| A sealed record with a private constructor stops ordinary callers from minting an empty `AccountId` | True for ordinary routes | `with { Value = Guid.Empty }` gives CS0200; JSON deserialization throws `NotSupportedException`. Only `RuntimeHelpers.GetUninitializedObject`, which is not an ordinary route, yields an empty value |
| Its own `ApprovalModule` switch | Contradicts its own enum rule | it ends in `_ =>`, so a new named member `Locked` compiles and maps silently to `InvalidProviderResult` |
| `Guid.CreateVersion7(timestamp)` still uses random fields | True | the same timestamp gives two different GUIDs |
| A caller's `checked` block doesn't change arithmetic inside a called method | True | the callee wraps to −2147483648; an inline `checked` throws `OverflowException` |
| CA2016 checks token forwarding only, not that every async method takes a token | True | it fires on a method that has a token and doesn't forward it, and not on a method without a token parameter |
| Nullable annotations insert no runtime check | True | `null!` passes through a non-nullable parameter |
| C# 15 `closed` hierarchies | True, on SDK 11.0.100-rc.3 (prerelease) | the switch is exhaustive with no `default` arm. A new unhandled descendant gives CS8509, a nullable input without a `null` arm gives CS8655, a descendant from another assembly gives CS9382, and `sealed closed` gives CS9381. CS8509 and CS8655 are warnings, so they break the build only when promoted to errors |
| C# 15 union types (named in the second and third documents) | Exhaustive, with one gap | `public union Pet(Cat, Dog, Bird)`; an unhandled new case gives CS8509 (a warning). `default(Pet)` compiles with no warning and throws `SwitchExpressionException` at runtime |

**TypeScript framework document (fourth).** It overlaps on six points, all consistent: brand casts bypass validation, `Result` neither forces handling nor stops throws, `never` exhaustiveness, `V(G)` 3 against 4 paths, c + 1 being per decision, and the `Brand` selector establishing nothing. Its new claims:

| Claim | Result | Evidence |
|---|---|---|
| `decide` has 6 input combinations over 5 paths, with both owner pairs sharing one | True | traced over all 6 inputs |
| `satisfies Record<Role, Record<Account, Approval>>` catches a missing table entry | True | TS2741 |
| A generator bounded at 2147483647 can't find a parser that rejects larger values | True | found in 0 of 200 runs |
| Discarding a `Result` needs a custom rule | True | `parseResourceId(42)` as a bare statement compiles (tsc exit 0) |
| `length` counts UTF-16 code units | True | 64 emoji are 128 units and are accepted; 65 are rejected |
| Typed ESLint rules can enforce the custom rules | Possible, with a toolchain limit | `@typescript-eslint/parser` 8.72.1 refuses TypeScript 7.0, so typed rules need the TypeScript 6 API for now |

Running the pilot tools on the fourth document's `decide` found a gap in `inventory.ts`: it rejected `decide` with "input facts is not a finite union", because it counted only unions of literals. A tagged union with finite payloads, as recommended by the second, third and fourth documents, is a finite domain of 6 here. `diagnose` read the same function correctly: 3 of 3 branch points decidable. Fixed the same day. `inventory.ts` now counts plain objects whose properties are finite (up to three levels deep), so `decide` is a pilot unit with 6 computed cases, a spec table and 20 of 20 mutants killed. Its switch has no `default` arm: the compiler (TS2366) and the spec table catch a new variant (F11), with no `never` guard needed.

**Interface conflict.** The third and fourth documents both propose `/verifiable:review`, `:check`, `:coverage`, `:paths`, `:mutation` and `:prune`, where `:coverage` only measures and never modifies tests. That contradicts the decision recorded on 2026-11-09, under which `/verifiable:coverage` runs the whole workflow, including reshaping the code and reconciling the suite. Resolved the same day: `:coverage` stays the workflow, `:paths`, `:mutation` and `:prune` are adopted, and `:review` and `:check` are declined (see "From here to skills").

## Field test on a real authentication module

On 2026-11-09 a separate session that knows the target codebase ran the tools on its authentication guard, reshaped the token branch in a copy of the pilot, and mapped its 32 existing tests. The raw evidence is kept outside this repository. Every finding below was run there unless marked Read.

**Defects in the tools:**

- **W1, length boundaries.** `.length > 9` got witnesses of lengths 0, 1 and 10 but none at 9, so the mutant `>` → `>=` survived while the unit counted as complete. Each cell needs boundary witnesses at c − 1, c and c + 1.
- **W2, one fake for every adapter.** The driver used one fake for all adapters, so a second adapter with a different port failed with a misleading message.
- **W3, catch-all in the adapter shape.** The catch-all turns a programming error (`TypeError`) into the outage variant: a merged failure built into the shape itself. The catch must name each domain error class and rethrow everything else.
- **D1–D7, in `diagnose`.**
  - An awaited call without a catch is an exit (500), but it isn't reported.
  - A pure regex predicate got "wrap in an adapter".
  - `new Date()` is a clock read, not string work.
  - `String(a) === String(b)` is a comparison between two inputs.
  - Two `?.` on one value counted as two decisions.
  - A check that the library makes impossible can't be detected without a library contract (Read).
  - `undefined` returned for two different causes isn't reported as merged.

**Gaps in the shapes**, confirmed or new:

- regular-expression character classes: a UUID and a 1–9-digit id could only be specified by length, so `abc` counted as an id;
- comparisons between two inputs: expiry against now, and user id against session owner;
- adapter variants that carry data: the session row, the user, the token payload;
- inputs of type `unknown`, such as decoded claims;
- staged decisions: a flat decision record needs every fact first, so lookups would run even for rejected tokens unless the facts become a staged tagged union, dispatched one stage at a time.

**What fitted:** a decision over six finite verdicts (576 cases, Stryker 42 of 42), a subject classifier (5 cases, 15 of 15), and a session-claim classifier (4 cases, 15 of 16, the survivor being W1).

**Mapping the 32 existing tests** (Read, using per-test branch maps, a Stryker kill matrix and hand mutants):

- 3 duplicate an obligation, and 6 duplicate one partly; in those six the expiry comparison is the missing two-input shape.
- 11 check a library option, such as the lifetime of a token or the revocation of sessions.
- 1 targets a check the library makes unreachable.
- 1 can't be told apart from another test without a change inside the library.
- 10 are outside the reshaped part.
- 0 can't fail.

Per-test coverage is blind to configuration values and lookup keys. Mutation testing one file misses settings that live in another, and no Stryker mutator swallows an error or changes a lookup key, so hand mutants found those.

**Also reported:**

- Stryker 10.1.1 under pnpm needs `--plugins @stryker-mutator/vitest-runner` and `--disableBail` to produce a per-test kill matrix.
- `vitest list --json` double-escapes quotes in test names.
- istanbul `binary-expr` arms record that an operand was evaluated, not which operand decided.
- That session's per-test branch-map script is kept at `research/verifiable-coverage-pilot/reference/per-test-branch-map.mjs`, with the names of its source files turned into an argument (not run here).

**UX:**

- Print exits with the conditions that reach them, not AST nodes.
- Name the missing shape instead of a generic phrase.
- REJECTED lines need the offending text and the pattern to use.
- Witnesses should be printable.
- `/verifiable:coverage` needs a reconciliation table: test, category, obligation or option, and the evidence behind each verdict.

## Fixes after the field test

All run on 2026-11-09. `diagnose` was rerun read-only on the same guard, where the other session keeps it.

| Item | Status | Evidence |
|---|---|---|
| W1 length boundaries | Fixed | boundary witnesses; the session-claim classifier went from 15 of 16 to 16 of 16 |
| W2 one fake for every adapter | Fixed | each adapter spec exports `fake(failure)` and `unnamed()`, and the driver names the missing export |
| W3 catch-all in the adapter shape | Fixed | the catch must use `if (error instanceof <Class>) return '<variant>'` statements ending in `throw error`. The pilot adapter has 4 cases, Stryker 10 of 10, and F9 and F14 are stopped |
| D1 thrown exits | Fixed | the awaited database lookup and the call of the local lookup helper are now exits |
| D2 pure predicate | Fixed | the pattern predicate now gets: "a pure function of its input; classify its input instead of wrapping it" |
| D3 clock read | Fixed | `new Date()`: "reads the clock or a random source; pass the value in" |
| D4 two-input comparison | Fixed | both comparisons: "two-input classifier (not built yet)" |
| D5 `?.` double count | Fixed | one branch point per receiver |
| D6 dead check behind a library contract | Half built | contracts exist and are checked against the library (see "Library contracts"); using a guarantee to mark a check dead is not built |
| D7 merged causes through return values | Fixed | merges with cause counts: 4, 2 and 2 in the guard, and 2 in its lookup helper. Merges on decidable conditions, such as `deny` in a finite decision, aren't reported |
| UX: exits | Fixed | every return, throw and may-throw call is listed with the conditions that reach it, decidable or open |
| UX: named missing shapes | Fixed | regular-expression character classes, inputs of type unknown, two-input comparisons, clock reads |
| UX: REJECTED text | Fixed | every REJECTED line ends with "found: <offending text>" |
| UX: printable witnesses | Fixed | the alphabet comes from the literals' characters plus one fresh printable character |
| UX: reconciliation table | Built for `node:test` | see "Reconciling an existing suite" |
| G1–G3 new shapes | Built later the same day | inputs of type unknown, staged facts, adapter variants that carry data; see "Five additions to the shapes" |

Pilot after the fixes: 268 computed checks, all passing. 155 mutants, 154 killed, and the survivor is equivalent. 14 seeded faults (F1 to F14), all stopped, plus the two controls.

### Second round

The same session reran its steps against a fresh copy (Run there; the guard's source was byte-identical to round one).

**Confirmed by the rerun:** the merges (4, 2, 2 causes, and 2 in the user lookup), the thrown exits, the clock read and both two-input comparisons. Expanded through the merges, the token branch gives that session's 12 hand-charted exits, plus one may-throw exit it wouldn't count.

**Reshape result:** with the new adapter rule and a fake per adapter, six units were admitted: token check 3, user lookup 4, session check 5, subject classifier 12, session-claim classifier 7, and the token decision 216. That totals 516 checks in the copy, all passing, with Stryker killing 88 of 88 on those units. The rethrow rule improved the design: a failed lookup became the rethrow obligation instead of a verdict, which shrank the decision's domain from 576 to 216. The obligations exposed 3 cases that no existing test covers.

**Fixed after round two** (run here; `diagnose` rerun read-only on the live guard):

| Item | Fix |
|---|---|
| `inventory.ts` crashed with ENOENT on a classifier without a spec | REJECTED line naming the spec file to write |
| A return with `?:` counted as one exit | one exit per arm; the authenticated outcome now appears |
| Returns inside callbacks counted as exits of the enclosing function | only returns and throws owned by the function count |
| Statements after a nested early return were "when always" and decidable | they carry `not (<that exit's conditions>)`, or `not (<if-condition>)` when the `if` always exits |
| `!x` behind `x = y?.z` counted as one cause | two causes: the receiver nullish and the property falsy (5 causes at the first merge) |
| Conditions truncated with `...` | printed in full, with compound ones parenthesized |
| REJECTED texts not actionable | the adapter rejection shows the resolved type and says data-carrying variants aren't supported yet; regex conditions get diagnose's wording; the classifier-input rejection names the two-input gap; string-classifier rejections list the allowed forms |

**Still open, with the design input from round two:**

- **May-throw noise from library and helper calls** (D6 and 2e). Built as far as declared errors go: see "Library contracts". A contract's guarantees are checked against the library but do not yet mark code dead.
- **Specs held to the code's vocabulary.** Built: a regex subset is translated for both code and specs. One limit was measured: a regex over a string that the classifier also slices and splits exceeds the solver's time limit.
- **Adapter variants must be string literals** (G3). Built: variants may be objects that carry a literal `kind` and data.
- **Wiring for staged facts** (G2). Built as guard statements instead of the planned per-stage dispatch maps, because a guard also narrows the types that the next stage needs.
- **Inputs of type `unknown`** (G1). Built for type tests; reading properties is still open.
- **Reconciliation table.** Built for `node:test`, by a different mechanism than the one asked for: instead of per-test branch coverage and syntactic mutants, each reached cell is made to return another outcome and the tool records which test's assertion notices. See "Reconciling an existing suite".

Updated test mapping (Read there): 3 duplicate, 7 partial, 11 library boundary, 1 misdirected, 1 leftover, 9 outside the reshape, 0 can't fail.

## Pattern catalog for reshape suggestions

| Pattern | Use | Correction from the tests |
|---|---|---|
| Brands and nominal wrappers | Adopt: every input gets its own type | `as` and `default` bypass the constructor, and a brand doesn't check units |
| Parse at the edge | Adopt: this is the classifier shape | the parser's own cells still need their checks |
| One union instead of several flag booleans | Adopt: it shrinks decision domains | — |
| `Result` instead of `throw` | Adopt for adapter variants | it doesn't stop throws from callees, so the adapter must catch them |
| Exhaustive unions (`never`, `Record<K, V>`, C# switch expressions) | Adopt | C# 14 class hierarchies aren't closed. For enums, use no `_` arm and keep CS8509 as an error. C# 15 `closed` and `union` are exhaustive once CS8509 and CS8655 are errors, but `default` of a union throws at runtime with no warning |
| Tagged unions with finite payloads | Adopt; `inventory.ts` counts them | count payload values, not just tags. With no `default` arm, a new variant fails TS2366 |
| Complete decision tables (`satisfies Record<K, Record<L, V>>`) | Adopt: a decision shape with no branches | the expected answers still come from the requirement, never from the table being tested |
| State transitions returning effects as data | Adopt: the wiring and effect-plan shapes | the executor keeps its own obligations; repeated transitions need invariants, not replay |
| Consuming every `Result` | Adopt, as a custom rule | TypeScript accepts a discarded `Result` |
| `V(G)`, path-count and MC/DC caps | Reject as completeness measures | `V(G)` is not the path count, and MC/DC's c + 1 is per decision |
| Property-based testing | Only for infinite domains, labelled as sampling | enumerate finite domains instead; interior bugs escape |
| 100% mutation score | Keep as one check | it misses swapped arguments, new branches and new constants (pilot F4–F6) |
| Banned-API lists | Adopt, with `AdditionalFiles` and property doc IDs | as pasted, the list enforces nothing. `` P:System.Threading.Tasks.Task`1.Result `` and `P:System.DateTimeOffset.UtcNow` were both enforced (RS0030) once added |

## From here to skills

One skill, `verifiable`, with the tools bundled as scripts. This was decided on 2026-11-09 and is tracked in `WORKBENCH.md`:

- **`/verifiable:coverage <target>`** runs the workflow on a target: `diagnose`, a reshape in a copy, `inventory` on the result, the exact test plan, and the reconciliation of the existing suite. It never writes test cases for code in the shapes, and a missing spec row is a failure, not a gap to guess at.
- **`/verifiable:paths <target>`** is read-only: it counts paths and input cells per function and marks where counting stops and guessing starts, with the reason (`diagnose` plus `inventory`).
- **`/verifiable:mutation <target>`** runs Stryker or Stryker.NET and turns each surviving mutant into an obligation or an explained equivalent.
- **`/verifiable:prune <target>`** removes or merges tests only with kill-matrix and obligation evidence. It never runs implicitly: `:coverage` removes only tests that provably can't fail, and asks before removing anything else unless the prompt said to.
- **`/verifiable:init`** adds the coding rules to the target project's `CLAUDE.md` and `AGENTS.md`: write code only in the shapes, run the inventory after every change, fix a rejection by reshaping the code rather than suppressing the rule, and report code that fits no shape as outside the claim, never as covered.
- **`/verifiable`** on its own switches the session into an assurance stance (decided 2026-11-09). From then on, software-assurance theory governs code and test generation, analysis and review, and outranks the model's default trade-offs toward speed, convenience and "good enough" coverage. Concretely: completion is defined by obligations, unknown results block claims, every claim carries its evidence class, tests come only from computed obligations, code is reshaped before more tests are added, and the model never weakens a requirement, a domain or a threshold to pass. Costs get stated, and only the user may trade a claim for them. If the project has no `verifiable` rules yet, it asks whether to run `/verifiable:init`.
- **Scope** is the code that logic, integration and e2e tests cover. Tooling and configuration files, such as `vitest.config.ts`, get no shape patterns; parameters that narrow the scope may come later. The `decorative-tests` skill stays for code outside the shapes.

The pilot verified the tool's rules, the counts and the fault results above. It did not verify that models follow the shapes on a real codebase, how much rewriting a real feature needs, or whether typical features fit the four shapes at all. Per the verify-before-skill-steps rule, those stay out of skill text until measured.

Next, in order (updated 2026-11-10, after the four additions):

1. Done: the fourth field-test round, on the four additions.
2. The skill, drafted through `tofui-skill-creator`, using only steps that the pilot and the field tests verified. The helpers for `/verifiable:mutation` and `/verifiable:prune` are built (see "Helpers for `:mutation` and `:prune`").
3. The remaining shapes: bounded collections, then effect plans inside a transaction.
4. A guarantee that depends on the input, and a faster reconciliation.

## The skill as landed

2026-11-10. The skill is `skills/development/verifiable/`: `SKILL.md`, four reference files, the rules text for `:init`, two entry-file templates, five thin command files, and `scripts/`, a copy of this pilot's `tools/`.

**Decided by the author, not to be reopened:**

- The name `verifiable` and six invocations: `/verifiable` (the assurance stance), `:paths`, `:coverage`, `:mutation`, `:prune`, `:init`. No `:review` and no `:check`.
- No pruning by default. `:coverage` removes only tests that are skipped or cannot fail; everything else goes through `:prune` or an explicit request.
- The model never chooses, counts or writes test cases for code in the shapes.
- Scope is application code under logic, integration and end-to-end tests; tooling and configuration files get no shape.
- The skill names no other skill.
- The pilot's fixtures are generic and may be committed.

**Maintaining it:**

- `scripts/` is a copy. Change `tools/` here first, run the gates, then copy the files into the skill.
- The gates: `node --test 'tooltest/*.test.ts'` (76 tests), `node --test 'test/*.test.ts'` (600 computed checks in 31 groups), `node tools/inventory.ts --check`, `./faults.sh` (43 seeded faults, 12 minutes), and the mutation run (400 of 406 killed at the last run, before the fixes that followed the skill's two test runs).
- The skill was tried by two fresh agents on an invented project (`evals/` in the skill), once. Their 38 notes led to 12 tool fixes and to changes in the skill text; the two prompts were not rerun afterwards.
- The final review ran once and all nine of its findings were applied. A second full review returns wording churn; re-check one topic only when an edit rewrites more than a paragraph.
- The five command files were copied by hand into the agent's commands folder; the catalog's installer installs skills and rules only. Of the five, only `paths` was invoked through its command file.

**Open:**

1. Installer support for command files, and the same for Codex (not checked).
2. Shapes: bounded collections, effects inside a transaction, the product of two inputs, text other than digits.
3. A guarantee that depends on the input.
4. A faster reconciliation for a suite whose every test file builds the application.
5. Reading a per-test kill matrix in the prune helper; a mutation report of Stryker.NET; a Jest runner.
