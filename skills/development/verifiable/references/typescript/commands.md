# TypeScript commands

Use these procedures only after selecting the TypeScript backend and reading [setup.md](setup.md). `<skill>` is the skill directory; `<project>` is the target project. The shared evidence rules in `SKILL.md` apply throughout.

## `/verifiable:paths`

Read-only. It answers: can the checks of this code be counted, and if not, what stops the count?

1. For each file of the target, run `node <skill>/scripts/diagnose.ts <file.ts> --root=<project>` (add `--at=<a line inside the function>` for one function). It works on code that is in no shape yet. Per function it lists every exit with the conditions that reach it, every branch point as `decided` or `open`, the places where several failure causes become one value, effects inside the logic, reads of outside state, and the reshape steps.
2. If the project has a `verifiable.json` or any of the default shape folders, also run `node <skill>/scripts/inventory.ts --root=<project> --out=<a file outside the project>`. It prints one line per unit with its number of checks, and a `REJECTED` line for everything it does not admit. A unit printed as `not counted` has no count. The `--out` leaves the project's obligations file alone; the tool may still write its solver cache folder in the project, which holds no source and is not committed. Without a settings file and without those folders, skip this step and say that no unit is admitted yet.
3. Report per function:
   - where the count exists, the number of checks;
   - otherwise each `open` branch with what it depends on, in the tool's words, and the reshape steps;
   - every `no shape` step, by name. It means that part of the function cannot be counted in any shape, so the answer to "can this be counted" is "not all of it", whatever the other steps say;
   - what the next step would cost: `:coverage` rewrites the function in a copy, needs one spec per unit that a person reviews, and needs a review of the rewrite.
   Do not turn an open branch into a number by estimating.

## `/verifiable:coverage`

Follow [the shared workflow](../coverage.md) and [the TypeScript procedure](coverage.md).
The TypeScript procedure is the authoritative source for setup, execution, reconciliation
and permitted removals; keep those steps there rather than maintaining a second copy here.

## `/verifiable:mutation`

A mutation run asks a different question from the computed checks: is there a small change to the code that no check notices? Read `references/typescript/tools.md`, section "`mutation.ts` and the mutation run", for the configuration that was run.

1. Print the mutate globs with `node <skill>/scripts/mutation.ts --root=<project> --mutate` and use them in the mutation tool's configuration, with the computed checks as its test command and its JSON reporter switched on. Code outside the claim does not belong in the run: no computed check covers it, so every mutant there survives and says nothing.
2. Run the mutation tool. This skill does not start it for you; say what the run costs and let the user decide when.
3. Sort the result: `node <skill>/scripts/mutation.ts --root=<project> [--report=<file>]`. Each surviving mutant is open (with the unit it sits in), explained, or outside the claim.
4. For each open survivor, find the input that tells the mutant from the original. If one exists, the spec is missing the condition that separates it: add that condition to the spec and rerun the inventory, which then computes the missing check. If no input can tell them apart, the mutant is equivalent: add an entry with the reason to the list of explained mutants, and tell the user which entries are new, because a person reviews those reasons.
5. Remove every explanation the tool calls stale. The tool exits 0 only when no survivor is open and no explanation is stale.

## `/verifiable:prune`

Pruning removes tests, so it runs only when asked, and only on evidence.

1. Reconcile the whole suite without `--units` ([coverage step 9](coverage.md)), if there is no fresh reconciliation.
2. Print the plan: `node <skill>/scripts/prune.ts --root=<project> [--rows=<file>]`. It deletes nothing.
3. Show the plan to the user as it is: what may be removed, what duplicates computed checks, what is kept and why, and which tests have identical evidence.
4. Remove the skipped tests in "may be removed". Keep `cannot fail on the counted code` rows, duplicates and identical-evidence candidates until their assertions and dependencies have been reviewed. Explain what else each test protects or what is unobserved; remove or merge only those the user explicitly selects after that review. A pruning request alone does not select these candidates.
5. Run the suite and the computed checks again, and report what was removed with the evidence line of each test.

