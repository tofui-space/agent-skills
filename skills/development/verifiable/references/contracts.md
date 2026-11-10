# Library contracts

Read this when the code under work calls a library. A library's answer is the one thing the tools cannot count: its code is not in the shapes. A contract is a reviewed statement of what one library member throws and what it gives back, with code that shows each statement against the installed library.

## Contents

- The file
- What the tools do with it
- An error ruled out by an argument's type
- A guarantee about the result
- What a contract is not

## The file

One file per package and version, `<contracts folder>/<package>@<version>.ts`, by default under the specs folder in `contracts/`. Node's own modules are the package `node`. It exports one object literal, so that the tools can read it without running it:

```ts
import assert from 'node:assert/strict'

export const contract = {
  package: 'node',
  version: '24',
  members: {
    'JSON.parse': {
      throws: [
        { error: SyntaxError, when: 'the text is not JSON', provoke: () => JSON.parse('[1,') },
      ],
      ensures: [
        {
          claim: 'an array in the text comes back as an array with the same elements',
          check: () => assert.deepEqual(JSON.parse('["a",2]'), ['a', 2]),
        },
      ],
    },
  },
}
```

- A **member** is named exactly as the code writes the call: `JSON.parse`, `parseArgs`, `client.send`.
- A **`throws` entry** names the error by a class or by a predicate (a classifier of the error, when the library gives no class to test), says when it is thrown, and holds a `provoke` that makes the real library throw it.
- An **`ensures` entry** holds a claim in words and a `check` that shows it on the real library.
- **`version`** is the installed version, or a prefix of it (`24`, `5.3`). The inventory rejects a contract whose version is not installed, whose file name differs from its package and version, or that cannot find its package. For a package that only another package depends on, add `via: '<that package>'`.
- **`source`** may pin one or more files of the package by sha256, `{ file, sha256 }`, so a changed file invalidates the review.

Write a contract from the library's documentation or source for the installed version, and name that source in the file. The person who reviews the contract checks it against that source.

## What the tools do with it

- **Each clause is a computed check.** The contract is a unit with one check per `throws` and per `ensures` entry, run against the real library under the project's runner.
- **An adapter can stand on a member.** When the adapter's spec exports `port = { contract: '<package>@<version>', member: '<name>' }`, the adapter's catch must name exactly the errors the member lists: one statement each, and no other. This ties the fake that the adapter's checks use to what the real library does.
- **`diagnose` lists one exit per declared error** at every call of the member that is not inside a `try`.
- **The reconciliation observes the calls.** Each call of a member in the project's files gets cells: it returns, or it throws under one of the clauses. Each property of an object-literal argument, and each element of a list written in place, is an option cell. `references/coverage.md` explains the lines this produces. A member with empty `throws` and `ensures` is enough to get option cells.

A call counts as a call of the member when it is written as the member is named and something in it comes from the contract's package. A library that is passed in as an object is called through that object; the reconciliation then prints `NOT OBSERVED` for the member.

## An error ruled out by an argument's type

A `throws` entry may add `argument: { index, path?, isNot }`, with `isNot` one of `'string'`, `'number'`, `'boolean'`: the error is thrown only when that argument, or the property at that path inside it, is not of that type.

```ts
{ error: TypeError, when: 'a segment is not text', provoke: () => join('shelf', 5 as never), argument: { index: 1, isNot: 'string' } }
```

The tools read the static type of the argument at every call of the member:

- `diagnose` lists no exit for the error at a call that passes the type, and prints a `scoped` line.
- When every call of the member in the project passes the type, an adapter that stands on the member must not name the error; the inventory rejects the catch statement and tells you to remove it and its variant. With no direct call of the member, the one call the adapter makes through its port counts.
- As long as one call may pass another type, the error stays required.

This is how a variant that no input can reach is removed, together with its guard and its check. The scope is a declaration: if it is wrong, the error passes through the adapter unchanged, like any error it does not name. When a test makes such a call throw the ruled-out error, the reconciliation prints `CONTRACT REFUTED`.

## A guarantee about the result

An `ensures` entry may add `result: { path?, is }`, with `is` one of `'string'`, `'number'`, `'boolean'`, `'object'`, `'array'`, `'defined'`. It is a claim about every call of the member.

- In a member with such a claim, every `ensures` check must return what the member returned, and every result claim is tested on each of those values. A contract that claims "what comes back is an object" next to a check that gets `null` fails with "the contract contradicts itself".
- The reconciliation tests each claim on every value the member returns while the existing suite runs.
- `diagnose` follows a `const` that holds the result and prints `given line N <condition> is always false if the contract holds`, and marks exits behind such a condition `[not taken if the contract holds]`.

**Do not state a guarantee that depends on the input.** "For text that holds a JSON object, what comes back is an object" is not a result claim; stated as one it is false, because the text `null` comes back as `null`, and it would make `diagnose` describe a reachable check as never taken.

**A `given` or `scoped` line explains an exit. It is never a ground for removing a check.** Trust such a line only after the contract's computed checks pass and a reconciliation of the suite prints no `CONTRACT REFUTED`. `diagnose` reads the contract without running it, so it prints these lines even from a contract that its own checks refute.

## What a contract is not

- **Not a proof that the library throws nothing else.** The reconciliation reports an unlisted error when a test happens to provoke one (`CONTRACT GAP`); it cannot show there is none.
- **Not a substitute for typing.** When a guarantee holds, give the port's result the guaranteed type; the inventory does not compare that type with the contract.
- **Not linked to tests clause by clause for `ensures` entries** without a result claim.
