# The coverage workflow in detail

Read this before running `/verifiable:coverage` or `/verifiable:prune`. `<skill>` is the folder of the skill and `<project>` the root of the copy you work in.

## Contents

- Before you start
- Steps 1 to 11
- Reading the reconciliation
- What each verdict allows
- What the workflow does not cover

## Before you start

Tell the user what the workflow costs and let them decide: a reshape changes production code, so it needs a review of its own; the first inventory of a text classifier can take minutes, because a solver computes the cells (later runs read a cache); a reconciliation runs the existing suite once per test and once or more per reached cell.

## Steps

**1. Work in a copy.** Create a separate worktree or copy of the repository. Everything below happens there. Nothing in this workflow commits, merges or pushes; what happens to the copy afterwards is the user's decision.

**2. Diagnose.** Run `node <skill>/scripts/diagnose.ts <file.ts> --root=<project>` on each file of the target. It needs no settings file. Read:

- the `exit` lines: every way out of each function, with the conditions that reach it, marked `[decidable]` or `[open]`;
- the `open` lines: each branch that finite inputs do not decide, and what it depends on;
- the `merge` lines: places where several failure causes become one value. For a `catch` that never reads the error, the reshape step is an adapter with one variant per cause. For a condition such as `a || b` that returns one value for two causes, the step is a classifier, and it applies only if the requirement tells the causes apart; when it does not, one outcome for both is right;
- the `reshape` list: one step per finding, each naming the shape it leads to. A `no shape` step names code that stays outside the claim.

**3. Settings.** Write `<project>/verifiable.json` (`references/tools.md` lists every setting). Name the code under the claim with `include` and `exclude`, the shape globs, and the spec location. Use `outside` for files that hold runtime code which fits no shape and which you are not reshaping now. Each such file is listed and counted in every inventory run; report the count. You will know what ends up outside only after the reshape, so come back to this file then.

**4. Reshape.** Follow the reshape list with `references/shapes.md` open. The usual order: classifiers first (they turn open inputs into finite values), then adapters (one per outside call, each cause its own variant), then decisions, then the wiring that joins them with guards and dispatch maps. Run `node <skill>/scripts/inventory.ts --root=<project>` after each unit. Go on only when it prints no `REJECTED` line for that unit.

A rejection names the rule and the offending text. Fix it by reshaping. If a piece of code fits no shape, leave it in a file declared outside and say so in the report; never cast, suppress or restructure only to make the line disappear.

To keep the path that other code imports from, leave the old file in place holding only re-exports of the reshaped pieces. Such a file is admitted under the claim.

**5. Specs.** For each unit write the spec its shape needs, from the requirement. Where the requirement is not written down, ask the user what the code is meant to do in the cases the tool lists; do not answer from the code. Start each spec with a `requirement` export in plain words. Where the user told you to go on without an answer, keep the existing behaviour and list the point in the spec's `unsettled` export; the inventory prints it as `UNSETTLED`.

**6. Library calls.** A contract is for a call into a package the project depends on, or into Node's modules, whose errors or results the reshaped code relies on. Write one, and tie the adapter's spec to it (`references/contracts.md`). No contract is needed for the built-ins of the shape vocabularies (a pattern's `test`, `Number.isSafeInteger`), nor for a call through an object the project itself defines and passes in.

**7. Compute and run.** Run the inventory once more; it writes the obligations file. Then run the computed checks through the entry file, under the project's runner, with `VERIFIABLE_TOOLS=<skill>/scripts` set. Each unit is one group; the group fails when a check fails or when the number of checks run differs from the obligations file.

A failing check prints the input, the expected and the actual result. Decide from the requirement which side is wrong. Changing a spec so that it agrees with the code, without a reason from the requirement, turns the check into a copy of the code.

Keep the stale check in the project's checks, next to the computed checks: `node "$VERIFIABLE_TOOLS/inventory.ts" --root=<project> --check`. It fails with `STALE` when the code no longer matches the obligations file. Without it a later edit can hide behind an old list: a moved boundary in a number classifier passes the computed checks until the list is recomputed.

**8. The existing suite.** Run it on the reshaped code. It must pass before you go on.

**9. Reconcile.** Run `node <skill>/scripts/reconcile.ts --root=<project> --tests=<file>[,<file>]`, with `--runner=vitest` for a Vitest suite. Give it the whole suite and no `--units`; with `--units` no library call is observed and the verdicts cover the named units only. No source file of the project is changed: the tool wraps the counted units and the observed library calls when the runner loads them. It writes its rows to `reports/reconciliation.jsonl` under the project unless `--out` names another place; keep that folder out of version control.

**10. Remove what cannot fail.** Remove the tests whose verdict is `skipped` or starts with `cannot fail on the counted code`, and list each with its evidence line. Remove nothing else unless the user asked for it.

**11. Report**, as the skill's Reporting section says. Add the reconciliation counts per verdict, and the lines the next section tells you to read out.

## Reading the reconciliation

For each test the tool runs it alone and records the cells it reaches: a decision input, a combination of conditions in a classifier, an adapter variant, an error an adapter passes on, a key of a dispatch map. Then it changes one cell at a time to another valid result and records whether an assertion of the test fails.

A cell is named by the sample input the inventory holds for it, not by the input the test used: a test that passes `'AB-123'` is shown as reaching `isStopId: "AA-000" gives true`, because both inputs fall into the same cell. The numbers differ from the inventory's for the same reason: the reconciliation counts cells, the inventory counts checks, and a cell can have several checks at its boundaries. Handlers have no row in the table at the end; their exits are not changed separately.

Lines you will see under a test:

- `checks`: the cells one of its assertions notices.
- `reaches without checking`: cells it runs through and does not notice.
- `throws, unasserted`: cells whose change only makes later code throw. The test stops, and no assertion of its own noticed.
- `noticed only under another outcome than the first tried`: the change that was needed, sometimes a combination. Read each of these lines; the evidence is real and narrower than a plain `checks`.
- `changed to an outcome outside its type, for lack of another`: weak evidence either way. A dispatch map of functions with one key always ends here; say so instead of reading the line as a finding about the test.
- `library`: evidence about a library call or one of its options. `noticed under: changed to false | not noticed under: removed, so the default applies` means the test guards the value, and the value written equals the library's default.
- `same evidence as`: another test with exactly the same evidence. Nothing in the tool tells the two apart; they may still differ inside a library.

Lines at the end of the run:

- `CONTRACT GAP`: a library call threw an error its contract does not list. The contract is incomplete: add the clause, with its `provoke`.
- `CONTRACT REFUTED`: a library call returned a value its contract's guarantee excludes, or threw an error its contract ruled out for that call. The contract is wrong: correct it before trusting anything that rests on it.
- `NOT OBSERVED`: a call or a contract member the tool could not observe, with the reason.

## What each verdict allows

| Verdict | Meaning | Allows |
|---|---|---|
| `skipped: it runs nothing` | The runner skips it | Removal |
| `cannot fail on the counted code: ...` | It reaches cells, and no change to any of them makes an assertion fail; it also notices no library cell | Removal |
| `an assertion notices n of the m cells it reaches; the computed checks cover each of them` | It duplicates computed checks as far as cells go | Nothing by itself. Whether it also guards something no cell models is not shown |
| `runs none of the counted code; an assertion notices n of the m library cells it reaches` | It guards a library call or option, which no computed check covers | Keep it |
| `runs none of the counted code, so this tool has no evidence about it` | It tests something outside the shapes | Nothing. This is not a finding against the test |
| `no assertion notices any ...; it only stops when a changed outcome makes later code throw` | It would fail, but not by an assertion of its own | Nothing; worth a look by a person |
| `fails only when several outcomes change at once; needs a look` | The single changes went unnoticed | Nothing |
| `fails already, before any change` | It does not pass on the code as it is | Repair first |
| `cannot be run alone: a nested test in its file has the same name` | The runner cannot select it | Rename one of the two and rerun |
| `no assertion notices any ... in the selected units; this says nothing about the other units` | A `--units` run | Nothing |

A test's title is not judged. When the evidence shows a test never reaches what its title names, say so with the evidence and leave the decision to the user.

## What the workflow does not cover

Say these when they apply:

- **The spec can be wrong.** A person reviews it against the requirement. Where you wrote both code and spec, that review has not happened yet.
- **Adapters run against a fake port.** The checks show the mapping from each outcome to its variant, not what a real database or service does.
- **Library behaviour beyond the contract.** A contract's errors are declared and sampled, not shown to be all there are.
- **Text, arithmetic and collections outside the vocabularies** have no shape: products of two inputs, text other than digits read as a number, array elements, loops over collections.
- **Concurrency, transactions and state that changes between a read and a write.**
- **UI rendering.**
- **Tests of other runners.** The reconciliation runs `node:test` and Vitest suites. Under `node:test` the project's source must load with Node's type stripping.
- **Speed on a suite whose every test file builds the whole application.** Each observed option is then reached by every file, and the run time is cells times changes times suite. Expect many minutes there, and say so before starting.
