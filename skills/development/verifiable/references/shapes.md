# The five shapes

Read this before you reshape code or write a spec. Every rule here is one the inventory enforces; when the inventory and this file disagree, the inventory is right and this file is out of date.

## Contents

- Rules for all code under the claim
- Decision
- Classifier
- Adapter
- Wiring
- Conversion
- Where a spec lives
- Common rejections and the reshape that fixes each

## Rules for all code under the claim

- **A file is in one shape, decided by its path.** The shape globs are in the project's settings. A file under the claim that matches no shape may hold types, imports and re-exports only. A file of re-exports is how a reshaped module keeps its public path: the old file re-exports the handler from its new place.
- **Every input gets its own type.** Two inputs of one type can be swapped and the code still compiles, so the tool rejects them. Use distinct literal unions (`'onTime' | 'overdue'`) and branded types for numbers and text (`number & { readonly brand: 'DueDay' }`).
- **No cast and no non-null assertion.** The counts rest on the types. A branded value comes into being in two ways only: a classifier that returns a type predicate, or the one cast a conversion may hold.
- **Unit names are unique**, because a spec is found by the name of its unit.

## Decision

A pure function from finite inputs to a finite result.

- **May contain:** `if`, `switch`, `?:`, `&&`, `||`, comparisons with literals, returns of literals.
- **May not contain:** loops, `try`, `await`, calls, computed access, `this`, assignment, or a read of anything declared outside the function.
- **Inputs:** positional parameters, or one object parameter. Each is a union of literals, a boolean, or an object of such values (up to three levels). A tagged union with finite payloads counts.
- **Result:** a union of literals.
- **What the tool computes:** every combination of input values. The number of checks is the product of the value counts. More than 4096 is rejected: split the decision in two, joined by an intermediate finite type.

**Spec:** a table.

```ts
export const requirement =
  'A loan may be renewed once. A reference copy is never renewed.'

export const rows = [
  { input: ['lending', 'notRenewed'], outcome: 'renew' },
  { input: ['lending', 'renewedOnce'], outcome: 'refuse' },
  { input: ['reference', 'notRenewed'], outcome: 'refuse' },
  { input: ['reference', 'renewedOnce'], outcome: 'refuse' },
]
```

For an object parameter, `input` is that object. A table may give `otherwise` as the result of every row it does not list; it must then also export `reviewedDomain`, the values of each input at the time the default was reviewed, so that a new value cannot slip silently under the default:

```ts
export const otherwise = 'refuse'
export const reviewedDomain = {
  copy: ['lending', 'reference'],
  renewals: ['notRenewed', 'renewedOnce'],
}
export const rows = [{ input: { copy: 'lending', renewals: 'notRenewed' }, outcome: 'renew' }]
```

## Classifier

The only place where a number, a text or an `unknown` value becomes a finite value. Statements are `if (<condition>) return <literal>` and one final `return` of a literal, of `<condition> ? <a> : <b>`, or of a condition. There are four kinds, chosen by the parameter types. A classifier of any kind may return a type predicate (`value is <BrandedType>`); its results are then `true` and `false`.

**One number compared with literals.** The spec is a table of intervals that covers every whole number exactly once; for a predicate the outcomes are `true` and `false`. The constants of the code and of the spec together cut the whole numbers into cells, and the tool checks one number per cell. Moving a boundary in the code changes the cells, which is why the stale check must run: against an old obligations file a moved boundary can pass. For a parameter typed plain `number` the inventory prints an `ASSUMES` line (it is a whole number); a value that may be a fraction or NaN needs a predicate in front.

```ts
export const intervals = [
  { min: Number.NEGATIVE_INFINITY, max: -1, outcome: 'invalid' },
  { min: 0, max: 2, outcome: 'fewCopies' },
  { min: 3, max: Number.POSITIVE_INFINITY, outcome: 'manyCopies' },
]
```

**Several numbers**, each with its own type, each optionally `| undefined`. Conditions compare sums and differences of the inputs and whole-number literals, or test `<input> === undefined`. The spec is a function `expected(...)` with the same parameters, in the same vocabulary, written from the requirement:

```ts
export function expected(dueOn: number, today: number) {
  if (today - dueOn > 7) return 'overdue'
  if (today - dueOn > 0) return 'inGrace'
  return 'onTime'
}
```

**One text**, `string` or `string | undefined`. When it may be undefined, the first statement is `if (<input> === undefined) return <literal>`. Conditions are `startsWith`, `endsWith`, `includes`, `=== '<literal>'`, `.length` and `.split('<c>').length` compared with a whole number, and `/pattern/.test(<input>)`, on the input or on a `const x = <input>.slice(n)` or `.slice(n, -m)`. At most 12 distinct conditions over code and spec together. The spec is `expected(<input>)` in the same vocabulary.

The pattern subset: literal characters, `.`, `\d \w \s` and their negations, bracket classes with ranges, groups (plain, non-capturing, named), `|`, the quantifiers `? * + {n} {n,} {n,m}`, `^` at the start and `$` at the end, lookahead, lookbehind and `\b` outside groups, and the flags `i` and `s`. Rejected by name: backreferences, a lookaround inside a group, other flags, Unicode property escapes, an anchor in the middle. `match`, `exec` and `search` are rejected because they read what a group captured; when the group's place does not depend on the text, the rejection names the `slice` that replaces it.

**One `unknown` value.** Conditions are `typeof <value> === '<type>'`, `=== null`, `=== undefined`, `Array.isArray`, `Number.isInteger`, `isSafeInteger`, `isFinite`, `isNaN`, `'<property>' in <value>`, and comparison with a text, number or boolean literal, on the input or on a property path under it. The function may return a type predicate, which is how a branded value is made:

```ts
export function isDueDay(input: unknown): input is DueDay {
  return Number.isSafeInteger(input)
}
```

The spec is `expected(input: unknown)` in the same vocabulary. More than 4096 cells is rejected. Array elements are not covered. Comparison with a literal means `===` and `!==`; there is no `<` or `>` on an `unknown` value. "A whole number from 1 to 99" therefore takes two units, a predicate here that tests `Number.isSafeInteger` and a number classifier for the range, and two guards in the wiring.

**What the tool computes for the last three kinds:** every combination of true and false over the conditions of code and spec together that some input can reach, one input for each, plus inputs at each boundary. For text and several numbers a solver finds the inputs; an answer of unknown blocks the claim.

## Adapter

The only place with input, output and exceptions. It turns every outcome of one call into a named variant.

- **Body:** exactly one `try`/`catch`. No branch in the `try` block.
- **Catch:** statements of the form `if (error instanceof <ErrorClass>) return <variant>` or `if (<a classifier of the error>(error)) return <variant>`, and a last statement `throw error`. An error the adapter does not name passes through unchanged; it is never reported as a variant.
- **Result:** a union of text literals, or of objects that each carry their own literal `kind` and may carry data. Each variant is returned in exactly one place.
- **First parameter:** the port, the object the call goes through, so that a fake can stand in for it.
- **The file** holds exported adapters, the error classes they name, written `class <Name> extends <ErrorClass> {}`, and types such as the port's. Anything else is rejected.

```ts
export async function findLoan(catalog: LoanCatalog, card: LibraryCard): Promise<LoanLookup> {
  try {
    const loan = await catalog.loanFor(card)
    return { kind: 'found', loan }
  } catch (error) {
    if (error instanceof NoOpenLoan) return { kind: 'none' }
    if (error instanceof CatalogUnavailable) return { kind: 'unavailable' }
    throw error
  }
}
```

**What the tool computes:** one check per variant, plus one for the error that passes through.

**Spec:** `args` (the arguments after the port); `fake(failure)` returning `{ db, calls }`, where `db` is a port whose method pushes the list of arguments it received onto `calls`, then throws what `failure()` returns, or answers when that is `undefined`; `provoke` with one entry per variant, each a function that returns the error to throw or `undefined`; `unnamed()` returning an error the adapter must pass on; and, when a variant carries data, `expected` with the full result per variant. After each check `calls` must hold exactly one entry, equal to `args`. `portArgs` may state the arguments the port must receive when they differ from `args`. `port = { contract, member }` ties the adapter to a library contract (`references/contracts.md`).

## Wiring

Straight-line glue between the other shapes.

- **The file** holds exported handlers, exported dispatch maps and types.
- **May contain:** calls to decisions, classifiers, adapters and conversions; module-level `export const <name>: Record<<FiniteKey>, <V>>` dispatch maps, reads from them, and calls through them (`map[key](...)` or `map.key(...)`); and guards.
- **Prefer plain values in a dispatch map.** A map of functions is admitted, but the reconciliation can only swap one function for another key's, and for a map with one key it has nothing valid to swap in, so its evidence about existing tests is weak there.
- **A guard** is a statement of the handler in one of three forms, each ending in a `return`:

```ts
if (!isLibraryCard(req.card)) return refusal.unreadableCard    // a counted predicate
if (lookup.kind !== 'found') return lookupFailure[lookup.kind]  // every other value leaves
if (state === 'overdue') return renewal.overdue                 // one value leaves
```

- **May not contain:** any other `if`, `?:`, `&&`, `||`, `??`, loops, `try`, optional chaining, or a literal outside a dispatch map. Two exceptions: the literal a guard compares with, and a text literal written directly in a returned object. A parameter object may not have two fields of one type.

A guard also narrows the types, so the calls behind it compile only behind it. That is what keeps a lookup from running for a request the first check already refused.

**What the tool computes:** one check per key of each dispatch map; for each handler one check per value that leaves at each guard, plus one for the path past every guard. Each handler check also proves, from V8's coverage of the running function, that it left through the guard it names.

**Spec for a dispatch map:** `expected`, the value per key. When the values are functions, add `observe(value)`, which runs one and returns what to compare.

**Spec for a handler:** `observe` and `expected` for the path past every guard; `order`, the guards in the order the requirement gives them, each written as the code writes its subject; and `exits`, with one `{ observe, expected }` per guard and leaving value. Every `observe` is a function that receives the handler, calls it, and returns (or resolves to) the value that is compared deeply with `expected`. A small helper keeps them short:

```ts
const run = (req: Request, failure?: () => Error) => async (handle: Handler) => {
  const { db, calls } = recordingCatalog(failure)
  const status = await handle(req, { catalog: db })
  return { status, calls }
}

export const observe = run({ card: 'M-000001' })
export const expected = { status: 200, calls: [['M-000001']] }
export const order = ['isLibraryCard(req.card)', 'lookup.kind']
export const exits = {
  'isLibraryCard(req.card)': { false: { observe: run({ card: 'M-1' }), expected: { status: 401, calls: [] } } },
  'lookup.kind': {
    none: { observe: run({ card: 'M-000001' }, () => new NoOpenLoan('none')), expected: { status: 404, calls: [['M-000001']] } },
  },
}
```

## Conversion

A value that changes its unit or its type without a decision: a date to a day number, minutes and seconds to seconds, an id that arrives as digits to a number.

- **Body:** one statement, `return <expression>`.
- **Expression:** the inputs, `<date>.getTime()`, `Number(<text of digits>)`, whole-number literals, `+ - * / %`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, and at most one cast to a branded number around the whole result.
- **Inputs:** numbers that each have their own type; dates; text of a branded type that some classifier gives through a type predicate and shows to be 1 to 15 digits.
- **Rejected:** the product of two inputs; a result that may be a fraction ("round the result"); a divisor that is not made of literals.
- **A conversion that reads a date returns a plain number, never a branded one.** A date may be invalid, and then `getTime()` is NaN, which would carry the branded type into a classifier that counts whole numbers only. Let a predicate that tests `Number.isSafeInteger` give the number its type in a guard of the wiring, so the invalid date gets an exit and a check of its own.

**What the tool computes:** one path has no cells, so the checks come from the expression's neighbours (each rounding swapped or removed, `+` and `-` swapped, `*` and `/` swapped, each literal moved by one, each input replaced by another of its kind): for each neighbour, an input on which it and the code differ. One more input is sought on which the code and the spec differ; if it exists it becomes a check, which fails. Each date input gets a check with an invalid date.

**Spec:** `expected(...)` in the same vocabulary, written from the requirement, for example `Math.floor(dueAt.getTime() / (24 * 60 * 60 * 1000))`.

The inventory prints an `ASSUMES` line for each input typed plain `number`: it is assumed to be a whole number. Report those lines.

## What fits no shape

Some code has no shape, and the honest place for it is a file declared outside the claim, reported as not covered:

- **A text built from a value**, such as `` `${minutes} min` ``. No shape returns it: a decision and a classifier return a finite set of literals, wiring holds no template, a conversion returns a number. Keep the counted part finite instead: return the value as data beside a literal tag, for example `{ kind: 'minutes', minutes }`, and build the text in a small file outside the claim. `diagnose` names such a line as `no shape`.
- **The product of two inputs**, and arithmetic with fractions.
- **Loops over collections**, and anything that reads array elements.
- **Text read as a number** unless a classifier has shown it to be digits.
- **Concurrent or timed behaviour.**

When part of a function fits no shape, say so before starting a reshape; it changes what the user gets for the cost.

## Where a spec lives

By default `<specs folder>/<unit name>.spec.ts`. The project's settings may instead give a template such as `{dir}/{name}.spec.ts` for specs beside their module. Start every spec with `export const requirement = '<the requirement in one or two sentences>'`. The tools do not read it; the person reviewing the spec does, and it is what the rest of the spec is checked against.

When the requirement does not settle a point and you took the answer from the existing code, say so in the spec: `export const unsettled = ['which refusal is shown when both the stop and the line are wrong']`. The inventory prints one `UNSETTLED` line per point. A check that rests on such a point can only repeat the code, so report every one of them.

## Common rejections and the reshape that fixes each

| The inventory says | Reshape |
|---|---|
| `runtime code outside the shapes` | Move the code into a file of the shape it fits. If it fits none, declare the file outside and report it as not covered |
| `call in a pure shape`, `reads <x> from outside the function` | Pass the value in as an input. A clock or a random source is read at the edge and passed down |
| `return type is not a finite union`, `input <x> is not a finite union` | Put a classifier in front, so the decision sees a finite value |
| `two inputs share a type, so swapped arguments would compile` | Give each input its own literal union or branded type |
| `domain of <n> exceeds 4096` | Split the decision in two, joined by an intermediate finite type |
| `an adapter body is exactly one try/catch`, `branch inside an adapter try block` | Move the decision that follows the call into a classifier or decision, and call both from wiring |
| `the catch must end with: throw <error>` | Name each error the requirement knows; let every other error pass through |
| `variant <v> is returned in <n> places` | Give each return its own variant |
| `branch in wiring`, `short-circuit branch in wiring`, `optional chaining in wiring` | Turn the condition into a classifier or decision and write a guard on its result, or a dispatch map on its value |
| `literal in wiring outside a dispatch map` | Put the value in a dispatch map keyed by the finite value that selects it |
| `a cast or non-null assertion bypasses the types` | Narrow with a classifier that returns a type predicate, or brand a number in a conversion |
| `unsupported condition or return` in a classifier | Rewrite the condition in the vocabulary above. For a captured group, use the `slice` the rejection names |
| `no spec: write <file> exporting ...`, `the spec of <unit> does not export ...` | Write the spec from the requirement, in the form above. A unit without its spec is not counted |
| `an adapter file holds ...`, `a wiring file holds ...` | Move the helper, constant or class to the shape it belongs to; an error class stays in the adapter's file in the form `class <Name> extends <ErrorClass> {}` |
| `a dispatch map is exported, so that its check can read it` | Add `export` |
| `literal in wiring outside a dispatch map`, for a template text | See "What fits no shape": return the value as data beside a literal tag |
