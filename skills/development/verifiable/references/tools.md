# The tools

Read this before the first tool run in a project, and whenever a tool prints a line you do not recognise. `<skill>` is the folder of the skill. Every tool takes the project root from `--root=<dir>`, else from the environment variable `VERIFIABLE_ROOT`, else from the working directory.

## Contents

- Settings: `verifiable.json`
- `inventory.ts`
- `diagnose.ts`
- The entry file and the driver
- `reconcile.ts`
- `mutation.ts` and the mutation run
- `prune.ts`
- Toolchain facts that cost time when unknown

## Settings: `verifiable.json`

Optional, at the project root. Every key is optional; a key the tools do not know is an error.

```json
{
  "include": ["app/**/*.ts"],
  "exclude": ["**/*.test.ts"],
  "outside": ["app/legacy/**"],
  "shapes": {
    "decisions": "app/**/*.decision.ts",
    "classifiers": "app/**/*.classifier.ts",
    "adapters": "app/**/*.adapter.ts",
    "wiring": "app/**/*.handler.ts",
    "conversions": "app/**/*.conversion.ts"
  },
  "specs": "checks",
  "obligations": "checks/obligations.json"
}
```

| Key | Meaning | Default |
|---|---|---|
| `include`, `exclude` | Globs; `include` minus `exclude` is the code the tools look at | `src/**/*.ts`, nothing excluded |
| `outside` | Globs for files that are deliberately not under the claim. They are listed and counted, and nothing else is said about them | none |
| `shapes` | One glob or list of globs per shape. When given, it must name `decisions`, `classifiers`, `adapters` and `wiring`; `conversions` is optional | `src/<shape>/*.ts` |
| `specs` | A folder, or a template such as `{dir}/{name}.spec.ts` for specs beside their module | `spec` |
| `contracts` | Folder of the library contracts | `contracts` under the specs folder |
| `obligations` | The computed list of checks. Commit it | `obligations.json` |
| `equivalents` | The reviewed list of explained surviving mutants | `equivalent-mutants.json` in the specs folder |
| `cache` | The solver's answers. Do not commit it | `.verifiable-cache/z3.json` |
| `tsconfig` | The project's TypeScript configuration | `tsconfig.json` |

With specs beside their modules, exclude the spec files from `include` (`"exclude": ["**/*.spec.ts"]`).

## `inventory.ts`

```sh
node <skill>/scripts/inventory.ts --root=<project> [--check] [--out=<file>] [--max-domain=<n>]
```

Reads the code under the claim and its specs, and writes the obligations file. Lines it prints:

- `<kind> <unit> <n> cases`: one per admitted unit, then `total`. A unit whose file or spec has a `REJECTED` line is printed as `not counted`, and the total then reads `total, admitted units only`.
- `REJECTED <file>:<line> <rule>; found: <text>`: something the tool does not admit. Exit code 1.
- `ASSUMES <file> <unit>: <text>`: an assumption the count rests on, such as a plain `number` input being a whole number. Report it.
- `UNSETTLED <spec file> <unit>: <text>`: a point of the requirement that the spec's `unsettled` export lists. Report it.
- `OUTSIDE <file>`: a file declared outside the claim.
- `STALE <file> differs from the code; rerun the inventory`: only with `--check`, which compares instead of writing. Exit code 1.

`--out=<file>` writes the list somewhere else and leaves the project's obligations file alone. The solver cache is still written under the project (the `cache` setting); it holds answers, no source.

Every unit needs its spec with the exports its shape requires; a missing spec or export is a `REJECTED` line that names the file and the exports. A rejection that says cells "came back unknown from the solver" blocks the claim for that unit: the solver ran out of its time limit per question (20 seconds; `VERIFIABLE_QUERY_MS` changes it). Simplify the unit's conditions or split the unit; do not treat unknown as feasible or infeasible.

The first run of a text classifier can take minutes. The answers are cached per solver version.

## `diagnose.ts`

```sh
node <skill>/scripts/diagnose.ts <file.ts> [--at=<a line inside the function>] [--root=<project>]
```

Reads one file with the project's TypeScript configuration. It changes nothing. A relative file is looked for in the working directory, then under `--root`. `--at` selects the innermost named function that holds the line, and says so when none does. Per function:

- a summary line: exits, how many are reached only through decidable conditions, branch points, how many are decidable, merged failure sites, effects, outside reads;
- `exit <n> line <l> <return|throw|may throw> <text> [decidable|open]` with `when <conditions>`;
- `decided line <l> <construct> <condition>`: a branch that finite inputs decide. `(number cell)` after the construct means a number compared with a literal, which a number classifier counts;
- `open line <l> <construct> <condition>` with `depends on <what>`: an open input with its type, a library or project call, state read from outside, a thrown value, a clock or random read, or an `untraced variable` (one declared with `let`, or without a value, whose content the tool does not follow);
- `merge line <l> ...`: several failure causes become one value;
- `effect line <l> ...`: an effect inside the logic;
- `reshape`: one step per finding, each naming the shape it leads to. A step that starts with `no shape` names code that no shape admits;
- `given` and `scoped` lines, and exits marked `[not taken if the contract holds]`, when a library contract applies (`references/contracts.md`). These rest on a declaration.

It reads one file at a time, reports local helpers separately, and follows values through `const` only; a branch on any other variable is reported as open. An `if` with `a || b` is one branch point for the whole condition and one for its left side, so the same comparison can appear under `open` as part of the whole and under `decided` on its own.

## The entry file and the driver

The computed checks are run by `<skill>/scripts/driver.ts`, which the project's runner reaches through an entry file. Templates are in `assets/entries/`. Both read the folder of the tools from the environment variable `VERIFIABLE_TOOLS`, and take the project root from the entry file's own folder; if the entry file does not sit at the project root, change the second argument of `register`.

```sh
VERIFIABLE_TOOLS=<skill>/scripts node --test verifiable.node.test.mjs
VERIFIABLE_TOOLS=<skill>/scripts <the project's Vitest command> run verifiable.vitest.test.mjs
```

Each unit is one test named `<kind> <unit>: <n> cases`. A group fails when a check fails, when the number of checks run differs from the obligations file, when a spec lacks an export the driver names, or when a handler check cannot prove which exit it took. The driver needs V8's inspector for that proof; it takes its own coverage, so do not combine it with a coverage report of the same run (not tried).

## `reconcile.ts`

```sh
node <skill>/scripts/reconcile.ts --root=<project> --tests=<file>[,<file>] [--runner=node|vitest] [--units=<name>[,<name>]] [--out=<file.jsonl>]
```

Runs an existing suite against the computed cells and prints one verdict per test, then a table of cells per unit, then `CONTRACT GAP`, `CONTRACT REFUTED` and `NOT OBSERVED` lines. It writes one JSON row per test to `reports/reconciliation.jsonl` under the project, or to `--out`. `references/coverage.md` explains the output.

- It needs a fresh obligations file: run the inventory first.
- It changes no source file of the project. It writes its rows under `reports/`, and under Vitest a temporary configuration into `node_modules/.verifiable/`, which it removes afterwards.
- `--units` limits the changed cells to the named units and observes no library call. Use it to look at one unit; use a full run for anything you report or prune on.
- Runs are serial on purpose: several at once could make a timing-sensitive test fail and be counted as noticing a change.

## `mutation.ts` and the mutation run

```sh
node <skill>/scripts/mutation.ts --root=<project> --mutate
node <skill>/scripts/mutation.ts --root=<project> [--report=<file>]
```

`--mutate` prints the globs to mutate: the code under the claim, minus excluded files, files declared outside, and specs beside their module. Without it, the tool reads a mutation report in the JSON format that Stryker writes (`reports/mutation.json` by default) and prints each surviving mutant as `open`, `explained` or `outside`, each `stale` explanation, and a summary. Exit code 1 when a survivor is open, an explanation is stale, or a mutant was neither killed nor survived.

An explanation is one entry in the list of explained mutants:

```json
{
  "file": "src/classifiers/library-card.ts",
  "mutator": "ConditionalExpression",
  "original": "header === undefined",
  "replacement": "false",
  "reason": "Without the guard the pattern is tested against the text \"undefined\", which is not a card, so the answer is false either way."
}
```

It is matched by the mutated text, not by its line. Copy `mutator`, `original` and `replacement` from the tool's `open` line.

The configuration that was run, with Stryker 10.1.1 and the computed checks as the only test (the test command must have `VERIFIABLE_TOOLS` in its environment):

```json
{
  "testRunner": "command",
  "commandRunner": { "command": "<the command that runs the entry file>" },
  "mutate": ["src/**/*.ts", "!src/ports/**"],
  "reporters": ["clear-text", "json"],
  "jsonReporter": { "fileName": "reports/mutation.json" },
  "coverageAnalysis": "off"
}
```

With Stryker's Vitest runner, set `"vitest": { "related": false }`: the entry file loads the units by computed path, and with the default Stryker finds no test for them. Both in a sandbox and in place the computed checks pass their dry run. A mutation report of another tool, or of Stryker.NET, was not tried.

## `prune.ts`

```sh
node <skill>/scripts/prune.ts --root=<project> [--rows=<file.jsonl>] [--out=<file.json>]
```

Reads the rows of a reconciliation and prints a plan in three lists (may be removed; duplicates computed checks; kept), then the groups of tests with identical evidence. It deletes nothing and writes the plan to `reports/prune-plan.json`. It does not read a per-test kill matrix of a mutation run, so a test that duplicates computed checks is never moved to "may be removed".

## Toolchain facts that cost time when unknown

- **Node.** The tools are TypeScript files that Node runs directly; they need Node 24 or later. Under `node:test` the project's own source must load the same way: erasable syntax only, and `.ts` import extensions (a `.js` specifier that has no file is resolved to its `.ts` by the tools).
- **TypeScript.** The tools use the TypeScript 6.0 compiler API from their own dependencies. The TypeScript 7.0 package does not offer that API.
- **Stryker on TypeScript 7.** Stryker 10.1.1 stops with `ts.parseConfigFileTextToJson is not a function` unless its `tsconfigFile` option points at a file that does not exist.
- **Vitest keeps transformed modules on disk** (`node_modules/.vitest-cache`), keyed by the file and the configuration. The reconciliation accounts for it. If you write a Vitest plugin of your own that changes what a module loads, the cache will serve the old code.
- **Vitest picks up `*.spec.ts` by default.** Spec files hold no tests; keep them out of the runner's `include`, or run the entry file by name.
- **Runners.** `node:test` and Vitest are built. Jest is not.
- **A solver in a long process.** One process that asks the solver several thousand questions can run out of its memory. A normal inventory stays far below that.
