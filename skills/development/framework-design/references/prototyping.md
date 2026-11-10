# Prototyping design options

Build design options far enough to be checked by the toolchain (types, lint, build, run) and measured, so that a decision rests on evidence instead of argument. Prototypes are evidence, not product code: the chosen option enters the product through the normal design and review path, never by merging or copying the prototype.

One exception changes the rule: a prototype the user **designates as the specification** (a user-made interface prototype declared the build target, for example). It outranks prose documents that contradict it; record that precedence in the design record, and correct prose to match it rather than the reverse. A design-option prototype built by this method never gains that status on its own.

## Contents

- Two tiers
- When to prototype
- Scratch projects
- Throwaway worktrees
- Measurements
- Recording findings

## Two tiers

| Tier | Use when | Where |
|---|---|---|
| **Scratch project** | The question concerns a surface, a pattern, a type-level property, or a measurement on a small model; the design is still early. | A self-contained project directory outside the product's repository. |
| **Throwaway worktree** | The evidence needs the whole repository: integration with real modules, the real build and test suite, the impact of a migration, a cross-cutting refactor, surface reduction measured across real code. The design is mature enough that the open questions are about fit with the real code. | A git worktree on a throwaway branch, in a directory beside the repository. |

Start with a scratch project. Suggest a worktree when a scratch project cannot answer the question, or when the user needs to explore the options across the full repository themselves.

## When to prototype

Prototype whenever a question can be settled by running something, for directions in any state:

- **accepted**: prove that the chosen direction holds for the top scenarios before it is published;
- **visited**: explore a direction to learn what it costs;
- **revisited**: re-check an earlier direction because a condition changed (a new scenario, a new platform version, a new constraint);
- **refactor candidate**: measure the code before and after a proposed refactor;
- **surface reduction**: measure the current surface against a reduced one;
- **condition check**: gather evidence on whether a direction meets the conditions the user prefers, for example "no code generation", "top scenario under ten lines", "builds under the strictest compiler settings".

A close decision in `tradeoffs.md` whose deciding cells are only "reasoned" is a prototype candidate.

Two cases come before any other design work:

- **An unstable host API.** When the design depends on a host API marked unstable, experimental, or internal, run a go/no-go spike on that API first [Practice-2026-11-6].
- **Real-time or hardware-bound behavior.** Measure latency, timing, and resource use on the target hardware; emulators and simulators can change buffer sizes, scheduling, and timing, so their numbers are not evidence for the device (reasoned) [Practice-2026-11-6].

For layout questions, a findability test is a cheap prototype: give readers who have not seen the code a list of concepts and count where they look and how many folders they open per concept; when candidate layouts tie on where readers look, the count of folders opened per concept decides [Practice-2026-11-4].

## Scratch projects

**Location.** Outside the product's repository, for example in the session's scratch or temporary directory, so that nothing appears in the product's status, build, lint, or tests. Never write into the user's working tree or its repository configuration for a prototype. If the prototype needs the product's dependencies, install them in the scratch project at the product's versions, or suggest a throwaway worktree.

**Layout.** One directory per question, one subdirectory per option:

```
<scratch>/<question-slug>/
  QUESTION.md     the question, the conditions to check, the options, the scenario IDs
  scenarios/      consumer code per scenario, shared by all options where possible
  option-a/       the surface, the smallest implementation that runs, consumer code, tests
  option-b/
  FINDINGS.md     commands, outputs, measurements, conclusion
```

**Toolchain.** Use the product's language version, compiler strictness, lint configuration, and dependency versions, copied or pinned. A prototype on different settings is evidence about different settings; say so in the findings.

**Content.** Build only what the question needs: the signatures, the smallest implementation that lets the consumer code run, the consumer code for the scenarios, and tests.

**Misuse as must-not-compile fixtures.** A misuse that the design should reject at compile time gets a fixture that the check expects to fail:

- TypeScript: put `// @ts-expect-error` on the line above the misuse; the type check fails if the misuse compiles.
- Rust: a doctest marked `compile_fail`, or a compile-fail test with the `trybuild` crate.
- Other languages: a separate fixture file expected to fail the type check, run as its own command whose failure is the pass.

**Checks.** Run the type check, lint, build, and tests for every option; record each command and its exit status.

**Iterations.** Copy an option to `option-a.v2/` instead of editing it in place, so earlier results stay reproducible. Keep the scratch path in the design record, so that a later Change or Retro task can rerun it under new conditions.

## Throwaway worktrees

**Suggest; do not start unasked.** A worktree creates a branch and a directory in the user's repository. Propose it with the question, what each worktree will contain, the commands, how the results will be compared, and the cleanup. Run the commands only after the user agrees, or hand them over.

**Create one worktree per option, all from the same base commit:**

```sh
git worktree add -b proto/<question>/<option> ../<repo>-proto-<option> <base-commit>
```

Install dependencies inside each worktree; worktrees share the repository's history, not its installed packages or build output.

**Inside each worktree**, implement the option across the real code as far as the question needs, then run the product's full checks: type check, lint, build, tests, and the API report if the project has one (`release.md`). The user can open each worktree in an editor and explore it directly.

**Compare** each option with the base and with each other:

```sh
git diff --stat <base-commit> proto/<question>/<option>
git diff --stat proto/<question>/option-a proto/<question>/option-b
```

Add the API report difference, the test results, and the measurements below.

**Never merge a prototype branch.** Re-implement the chosen option through the normal path; the prototype branch is reference material.

**Cleanup is the user's decision**, because it deletes the worktree's files and the branch. Record the findings first. The commands:

```sh
git worktree remove ../<repo>-proto-<option>
git branch -D proto/<question>/<option>
```

## Measurements

Take the same measurements for every option, so the numbers compare:

| Measurement | How |
|---|---|
| Surface size | Exported declarations, from the API report tool in `release.md`, or by counting the exported declarations in the emitted declaration or interface files |
| Consumer code per scenario | Lines, and distinct imported names and types (concepts), for each scenario's consumer code |
| Required setup for the top scenario | Number of configuration keys or parameters a consumer must set |
| Misuse outcome | Fails to compile, fails at startup, fails at the call, or passes silently; and the length and clarity of the message |
| Change cost | For a refactor or a change scenario: files and lines touched, and the surface difference |
| Runtime | Only when runtime cost matters (K7): a small benchmark with its conditions stated |
| Checks | Exit status of type check, lint, build, and tests |

## Recording findings

`FINDINGS.md` in the scratch directory (or a findings section in the design record, for worktrees):

```
Question: <one line>
Conditions checked: <the user's preferred conditions, if any>
Base: <commit or toolchain versions>

| Measurement | Option A | Option B | Command |
|---|---|---|---|

Conclusion: <one or two sentences>
Still reasoned, not measured: <list>
```

Copy the conclusion and the table into the design record, and mark the matching cells in the tradeoff table as "measured".
