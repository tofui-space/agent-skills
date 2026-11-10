---
name: verifiable
description: Replace guessed tests with computed ones for TypeScript application code. A bundled tool admits only code written in five shapes (decision, classifier, adapter, wiring, conversion) and computes every check that code needs from its types and constants; a person reviews one small spec per unit; the model reshapes code and never chooses, counts or writes test cases. Use on `/verifiable` (assurance stance for the session) and on `/verifiable:paths`, `:coverage`, `:mutation`, `:prune` and `:init`. Use it too whenever the user asks which tests a piece of code needs, whether a suite is sufficient or complete, wants every path or input covered, asks why the paths of a function cannot be counted, wants an existing suite sorted into tests that guard something and tests that cannot fail, or wants surviving mutants turned into checks or explained. Not for other languages, UI rendering, performance or load tests, or one quick test the user asked for by name.
---

# Verifiable

Nobody can say which tests a piece of arbitrary code needs. Reading the code longer does not settle it, and generating more tests does not either, because a test written from the code can only repeat what the code already does.

This skill asks a different question: which code is allowed, so that a program can work out the checks? Code is written in five shapes. A tool reads the types and the constants of that code and lists every check it needs. The expected result of each check comes from a small spec that a person reviews against the requirement. One generic driver runs the checks under the project's own test runner.

Your part is to reshape code so the tool admits it, and to write specs from the requirement. You do not choose, count or write test cases for code in the shapes. If you catch yourself deciding that "these three cases should be enough", stop: that decision belongs to the tool.

## Contents

- Words
- What the claim covers
- `/verifiable`: the stance
- Commands
- Setup: tools, settings, entry file
- `/verifiable:paths`
- `/verifiable:coverage`
- `/verifiable:mutation`
- `/verifiable:prune`
- `/verifiable:init`
- Rules that hold in every command
- Reporting
- Reference files

## Words

- The **inventory** is the tool (`inventory.ts`) that admits code and computes its checks.
- A **check** is one computed input with its expected result. The tools print checks as "cases".
- A **cell** is a set of inputs that the conditions of the code and of the spec cannot tell apart. One check per cell is enough, which is why cells are what gets counted.
- A **unit** is one function or dispatch map that the tool admits.
- The **obligations file** is the computed list of every unit with its checks. The project commits it.
- **Paths** and **tests** are the words people arrive with. The answer to "how many tests does this need" is the number of checks, and it exists only for code in the shapes.

## What the claim covers

For code that the inventory admits, the claim is: every unit agrees with its spec on one input per cell of its input space, where the cells come from the unit's types and from the constants in the code and the spec together. For a decision over finite types that is every input. The tool computes the cells; a person answers for the spec.

The claim does not cover:

- code the project declares outside (it is listed and counted, and nothing else is said about it);
- whether the spec matches the requirement, which a person reviews;
- database constraints, transactions, concurrency, and UI rendering;
- anything a library does beyond what a reviewed contract declares.

Say which of these apply whenever you report a result. A green run of the computed checks is a statement about the admitted code and its specs, not about the application.

## `/verifiable`: the stance

`/verifiable` with no command switches the session into an assurance stance, and stays on until the user ends it. From then on software-assurance practice governs how you generate, analyse and review code and tests, and it outranks the usual trade-offs toward speed, convenience and "good enough" coverage. Concretely:

- Work is complete when the obligations are met, not when it looks finished. That means: every computed check passes, every rejection is resolved, every spec is reviewed.
- An unknown result blocks the claim it belongs to. A solver answer of unknown, a check that could not run, or a file you did not read is reported as such and never rounded up to a pass.
- Every claim carries its evidence class: Run (you executed it in this session and saw the output), Read (you read the code), or not checked.
- Tests for code in the shapes come only from computed obligations.
- Code is reshaped before more tests are added to it.
- You never weaken a requirement, a domain, a threshold or a rule of the tools to get a pass. If something cannot be met, say so and stop.
- State the cost of each step (time, files changed, review needed). Only the user may trade a claim for a cost.

After switching, list the five commands below in one line each, so the user has them at hand. If the project has no `verifiable` rules in its agent instructions yet, ask once whether to run `/verifiable:init`.

## Commands

A command arrives either through a command file, as `/verifiable:<name> <target>`, or as the first word after the skill name, as `/verifiable <name> <target>`. Treat both the same. Thin command files for the first form are in `assets/commands/`; they belong in the agent's commands folder under `verifiable/`.

| Command | What it does | Changes files |
|---|---|---|
| `:paths <target>` | Says per function whether its checks can be counted: the count where the code is in the shapes, otherwise what stops the count | No source file; may write the solver cache folder |
| `:coverage <target>` | The workflow: diagnose, reshape in a copy, admit, spec, compute and run the checks, reconcile the existing suite | Yes, in a copy |
| `:mutation <target>` | Sorts surviving mutants into open, explained and outside the claim | Specs, the obligations file, the list of explained mutants |
| `:prune <target>` | Plans which existing tests may be removed or merged, with the evidence, then removes what the evidence allows | Yes, tests |
| `:init` | Adds the coding rules to the project's agent instructions | Yes, instruction files |

A target is a file, a folder or a function; for a function, use its file and a line inside it. Daily work needs two of these: `:paths` to look, `:coverage` to act.

Asked without a command, answer with `:paths`. Never start `:coverage`, `:mutation` or `:prune` unless the user names it or asks for the change.

## Setup: tools, settings, entry file

Below, `<skill>` is the folder that holds this file and `<project>` is the root of the project under work.

**Requirements.** Node.js 24 or later, and a TypeScript project that compiles with `strictNullChecks`. Run `node --version` first. Below 24, say so and stop: the tools were not run there. They were run on Node 24.22. They bring their own TypeScript 6.0 compiler and the Z3 solver; the project's own TypeScript version does not matter to them.

**Install the tools' two dependencies once.** Look for `<skill>/scripts/node_modules` first; when it is there, skip this. Otherwise:

```sh
cd <skill>/scripts && pnpm install --frozen-lockfile --ignore-workspace
```

This writes `node_modules` into the skill's own `scripts` folder and nowhere else. pnpm is the package manager this was run with, and the lockfile is its; another package manager will resolve the two dependencies from `package.json` without it. If a tool stops with "Cannot find package 'ts6'", this step is missing.

**Run every tool with Node, from anywhere**, naming the project:

```sh
node <skill>/scripts/inventory.ts --root=<project>
```

A file argument may be relative to the project root.

**Settings.** A project may hold a `verifiable.json` at its root. Without one, the tools expect `src/decisions`, `src/classifiers`, `src/adapters`, `src/wiring`, `src/conversions` and specs in `spec/`. Read `references/tools.md` for every setting before you write the file; a setting the tools do not know is an error, by design.

**Entry file.** The computed checks run under the project's own runner through one small file. Copy `assets/entries/verifiable.node.test.mjs` (for `node:test`) or `assets/entries/verifiable.vitest.test.mjs` (for Vitest) to the project root, and set `VERIFIABLE_TOOLS=<skill>/scripts` in the environment of the command that runs it. The file names no path of this machine, so it can be committed. Give it a command of its own, such as a `test:computed` script, and keep it out of the glob of the project's ordinary test command: the entry file stops with an error when the variable is not set, and the ordinary tests should not depend on it.

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

Read `references/coverage.md` before the first step. It holds the detail of every step, the meaning of each reconciliation verdict, and the limits. The outline:

1. **Work in a copy.** Make a separate worktree or copy of the repository and do everything there. A reshape rewrites code that carries behaviour; it must be reviewable as one change, and the original must stay runnable for comparison. If the user says the folder is already a copy, work there.
2. **Diagnose** the target (as in `:paths`) and read its reshape steps. This needs no settings yet.
3. **Settings.** Write `verifiable.json` so that it names the code under the claim, the shape globs and the spec location. Declare as `outside` only what you will report as outside, and expect to adjust the file once the reshape shows what fits no shape.
4. **Reshape.** Read `references/shapes.md`, move the code into the shapes, and run the inventory until it prints no `REJECTED` line. Fix a rejection by changing the shape of the code. Never silence one with a cast, a suppression, or by moving code out of the claim to get a clean run.
5. **Specs.** Write one spec per unit from the requirement, in the form `references/shapes.md` gives for its shape. When you do not know the requirement, ask; do not copy the answer out of the code under check, because a spec derived from the code can only agree with it. When the user wants you to go on without an answer, take the existing behaviour and record the point in the spec's `unsettled` list, so the tool prints it and the report carries it.
6. **Library calls.** For each library call that the reshaped code depends on, write or reuse a contract (`references/contracts.md`).
7. **Compute and run.** Run the inventory (it writes the obligations file), then the computed checks through the entry file. Every check must pass. When code and spec disagree, the requirement decides which one changes.
8. **The existing suite must still pass** on the reshaped code. A test that fails now is evidence: either the reshape changed behaviour, or the test pinned something the requirement does not ask for. Find out which before touching the test.
9. **Reconcile the existing suite**: `node <skill>/scripts/reconcile.ts --root=<project> --tests=<file>[,<file>] [--runner=vitest]`. Each test gets a verdict with its evidence.
10. **Remove only what cannot fail.** Without being asked for more, remove exactly the tests whose verdict is "skipped" or "cannot fail on the counted code", and list each with its evidence. Everything else stays, and goes through `:prune` or an explicit request.
11. **Report** (see Reporting), and list the specs and contracts a person still has to review.

## `/verifiable:mutation`

A mutation run asks a different question from the computed checks: is there a small change to the code that no check notices? Read `references/tools.md`, section "`mutation.ts` and the mutation run", for the configuration that was run.

1. Print the mutate globs with `node <skill>/scripts/mutation.ts --root=<project> --mutate` and use them in the mutation tool's configuration, with the computed checks as its test command and its JSON reporter switched on. Code outside the claim does not belong in the run: no computed check covers it, so every mutant there survives and says nothing.
2. Run the mutation tool. This skill does not start it for you; say what the run costs and let the user decide when.
3. Sort the result: `node <skill>/scripts/mutation.ts --root=<project> [--report=<file>]`. Each surviving mutant is open (with the unit it sits in), explained, or outside the claim.
4. For each open survivor, find the input that tells the mutant from the original. If one exists, the spec is missing the condition that separates it: add that condition to the spec and rerun the inventory, which then computes the missing check. If no input can tell them apart, the mutant is equivalent: add an entry with the reason to the list of explained mutants, and tell the user which entries are new, because a person reviews those reasons.
5. Remove every explanation the tool calls stale. The tool exits 0 only when no survivor is open and no explanation is stale.

## `/verifiable:prune`

Pruning removes tests, so it runs only when asked, and only on evidence.

1. Reconcile the whole suite without `--units` (step 9 of `:coverage`), if there is no fresh reconciliation.
2. Print the plan: `node <skill>/scripts/prune.ts --root=<project> [--rows=<file>]`. It deletes nothing.
3. Show the plan to the user as it is: what may be removed, what duplicates computed checks, what is kept and why, and which tests have identical evidence.
4. Remove the tests under "may be removed". For "duplicates computed checks" and for tests with identical evidence, remove or merge only what the user names: the evidence shows that every cell such a test notices has a computed check, and does not show that it guards nothing else.
5. Run the suite and the computed checks again, and report what was removed with the evidence line of each test.

## `/verifiable:init`

Add the text of `assets/rules.md` to the project's agent instruction files, `CLAUDE.md` and `AGENTS.md`, under the heading it carries. Create a file that does not exist. If the heading is already there, replace that section and leave everything else untouched. Then show the user the lines you added.

## Rules that hold in every command

- **The tool counts, you do not.** For code in the shapes, the number and the inputs of the checks come from the inventory. Extra hand-written cases for such code are noise at best, and at worst they suggest a coverage the tool did not compute.
- **A rejection is information.** It says the code has a property the count cannot rest on. Reshape the code. Moving it to `outside` is honest only when you also report it as not covered.
- **Unknown blocks.** A solver answer of unknown, a check that could not run and a contract nobody reviewed are reported as open.
- **The spec comes from the requirement.** Code and spec written by the same hand from the same reading agree by construction. Where you wrote both, say so, and name the spec for review.
- **A line that rests on a contract is not a proof.** `diagnose` marks such lines `given` or `scoped`. Use them to explain an exit. Never remove a check because of one, and trust them only after the contract's computed checks pass and a reconciliation prints no `CONTRACT REFUTED`.
- **A reshape is a code change.** Passing checks show that the reshaped code agrees with its specs. They do not replace the review a change to sensitive code needs before it ships.
- **Nothing is deleted on a guess.** A test is removed only with the evidence the reconciliation gives for it.
- **A tool line is a claim like any other.** When the code you read contradicts what a tool printed, report both, say which one you checked by running, and do not pass the tool's number on as settled. The tools are code and can be wrong.
- **Say what a step costs** before a step that changes files or runs for minutes, in every command, not only under the stance.
- **The user decides.** An explicit instruction from the user wins over this skill. When it gives up a claim, say in one sentence what is lost, then do it. Against other skills, this skill decides how checks for code under the claim are produced and when a test may be removed; skills about wording decide how the report reads.

## Reporting

End every command with one report in plain language. The answer to what the user asked comes first, in a sentence. Then:

1. What ran, each line marked Run or Read, with the numbers the tools printed (checks, rejections, verdict counts). For `:paths` this is where the per-function findings go.
2. What is covered by the claim, and what is not: files declared outside, `ASSUMES` lines, units without a reviewed spec, contracts that are declared but not shown complete.
3. What a person still has to review: each new or changed spec, each `UNSETTLED` point, each new contract, each new explanation of a surviving mutant.
4. What you changed, and where the copy is.

A command that changed nothing says so in one line for items 3 and 4. When the user's own instructions limit how long a reply may be, give the answer and the counts in the reply, and say which tool output you can show on request.

Do not call code verified, safe or fully covered. Say what was computed and what was checked.

## Reference files

- `references/shapes.md`: the five shapes, what each may contain, the spec each needs, and how to fix the common rejections. Read it before reshaping code or writing a spec.
- `references/coverage.md`: every step of `:coverage` in detail, the reconciliation verdicts and what each allows, and what the workflow does not cover. Read it before running `:coverage` or `:prune`.
- `references/contracts.md`: library contracts, argument scopes and result guarantees. Read it when the code under work calls a library.
- `references/tools.md`: every tool with its options and output lines, the settings file, the mutation configuration that was run, and the toolchain facts that cost time when unknown. Read it before the first tool run in a project and whenever a tool prints something you do not recognise.
- `assets/rules.md`: the text `:init` writes.
- `assets/entries/`: the entry files for the computed checks.
- `assets/commands/`: the thin command files.
