---
name: verifiable
description: >-
  Compute checks for admitted application code from its input domains and reviewed specs.
  Use on /verifiable and its
  paths, apply, mutation, prune and init commands; when asked to build, rebuild, fix or test
  code correct by construction, or to apply the verifiable discipline; or when
  asked of TypeScript code which tests it needs, whether its checks can be counted, whether
  a suite is sufficient, or which existing tests actually guard behavior. For C#, only
  files of decisions and computed results over bool values, enums, numbers, strings and records of them, standalone or inside their project. Not for C# suite sufficiency, test strength or
  mutation questions, UI rendering, performance/load tests, other languages, or one quick
  test requested by name.
---

# Verifiable

What this skill is for: today people and models guess which tests a piece of code needs, and nobody can say whether those tests are enough.
For the code it admits, this skill ends the guessing: a program works out the complete list of checks from the code's inputs and a reviewed rule table, and the same inputs always give the same list.
Code is kept to forms where that is possible. The point of the forms is that everything can be checked, not that the code is simple.
Having tests, or being able to generate tests, is not the goal and never a reason to stop.
Code you write or rewrite is designed in the forms from the start.
Code the tool cannot count is reported as a dead end, as defined under Doing the work, with the tool's reason.

Write code in shapes whose checks a tool can compute. Expected results come from a separate
spec reviewed against the requirement. The agent reshapes code and writes specs; it does not
choose, count or add test cases for admitted code. A spec table describes the whole domain;
it is not a selection of representative test inputs.

Read [references/assurance.md](references/assurance.md) for the claim, vocabulary and limits.
A passing run establishes agreement with the supplied spec on computed inputs, within the
selected backend's admitted semantics. It does not establish that the spec is correct or
that the application is verified.

## Doing the work

When this skill is invoked and the user asks for code to be built, rebuilt, fixed, tested or made correct, in any words, run `:apply` on the code the request touches.
That includes `/verifiable` followed by a task in plain words, and "correct by construction".
The user does not need to know a command name.

Two words have a fixed meaning here:

- **Correct by construction:** the code is written in the forms, the tool computes its complete list of checks, and every check passes against a spec reviewed against the requirement.
  A design that only makes a property likely is not correct by construction.
- **Dead end:** a piece of code the tool does not count after a reshape was tried, or for which the diagnosis gives only `no shape` steps, named with the tool's own rejection or `no shape` step.
  It has no count, and no hand-picked tests stand in for one.

The steps, with a checkpoint with the user at each **Stop**:

1. Find the code the request touches and its requirement. For new code, write the requirement down first.
2. Run the selected backend's diagnosis on every function involved; for new code, on its first draft.
   Whether code fits the forms is the tool's verdict, never a reading.
3. Split the logic into pieces the forms take: classifiers for text, numbers and untyped values, decisions over finite values, an adapter around each outside call, and wiring that joins them.
   Keep loops, text building and side effects as thin plumbing that only calls the pieces.
   **Stop:** answer the request before anything else, in its own words rather than this skill's terms.
   If the behavior the request is about gets only `no shape` steps, it is a dead end: say so first, in one or two sentences, with the tool's reason.
   That is the answer to the request, so do not turn it into a choice the user has to make again.
   Pieces that fit but are not that behavior come after it, one line each: what checking them would prove, and that it would not cover the behavior asked about.
   Otherwise show the pieces, any dead ends with the tool's reasons, and the cost, and go on when the user agrees.
   Ask one question per message, worded so that a plain "yes" cannot answer two things.
4. Reshape in a copy. Run the inventory after each piece and fix each rejection by reshaping.
5. Write one spec per piece from the requirement. **Stop:** the user reviews the specs.
6. Compute the checks, run them, and run the existing suite.
7. Report per piece: the tool's count and result, or dead end with the tool's reason.

Do not add hand-picked tests for code under the request and present them as its checks.
Where the project's own guidance asks for tests of a dead end, write them as it says and report them as hand-picked and not counted.

## Select a language before acting

Resolve the target file and its owning project. Read only the corresponding profile:

| Target | Setup and capabilities | Executable scope |
|---|---|---|
| TypeScript | [typescript/setup.md](references/typescript/setup.md) | Existing five-shape tools; Node and Vitest runners |
| C# | [csharp/setup.md](references/csharp/setup.md) | Decisions and computed results over `bool`, enums, numbers, strings and records of them only, in a standalone file or a file of a project; no solution loading, no test runner |
| Mixed repository | Select each target's profile separately | Keep inventories, specs and results separate |
| Other language | No backend | Report unsupported; do not invent counts |

Machine-readable support is in [capabilities.json](scripts/capabilities.json).
`node <skill>/scripts/capabilities.mjs <typescript|csharp>` prints one profile without
installing either backend. This reports implementation support, not installed dependencies
or admission of the target. Setup checks those separately. Do not add a `language` key to
the existing TypeScript `verifiable.json`: its schema rejects unknown keys.

For C#, check a file where it is with `--project` when it holds only admitted declarations.
Inspect project settings and dependencies before extracting a standalone file.
An unsupported command blocks its claim. Name the missing capability and supported next step.
Do not translate C# to TypeScript, guess cases, or transfer another project's evidence.
These limits govern only the claims this skill makes.
For C# code the tool rejects after a reshape was tried, report it as a dead end with the tool's reason and leave the question to other testing guidance.
When the user asks what to use on such code instead, read [C# beyond enumeration](references/csharp/beyond-enumeration.md) before naming a technique, and repeat its limits with the name.

## Commands

Accept `/verifiable:<name> <target>` and `/verifiable <name> <target>`. The command files in
`assets/commands/` use the same routing. A target is a file, folder or function; a profile
may support narrower targets. `:coverage` is the former name of `:apply` and runs it.
A request to build, change, fix or test code runs `:apply` (see Doing the work).
A question about what can be counted, with no such request, runs `:paths`.
A bare `/verifiable` with nothing after it activates the stance below.

| Command | Procedure | C# limit |
|---|---|---|
| `:paths` | Read-only admission/count diagnosis | Whole file, standalone or in its project; no exit tracing |
| `:apply` | Doing the work: [shared workflow](references/coverage.md), then language procedure | Decisions and computed results over `bool`, enums, numbers, strings and records of them only; reconciliation unavailable |
| `:mutation` | Sort surviving mutants using the selected backend | Unsupported; no Stryker.NET integration |
| `:prune` | Reconcile, show evidence, remove only what it permits | Unsupported; no C# reconciliation |
| `:init` | Install scoped instructions below | Only restricted C# scope may be named |

Read [TypeScript commands](references/typescript/commands.md) for that backend's procedures
and [C# setup](references/csharp/setup.md) for its CLI and command mapping.
Do not start mutation or pruning unless the user names it.
Before any step that writes files or runs longer than about a minute (a build, an inventory, a reconciliation, a mutation run), state its expected time, the files it changes and the human review it needs.

## `/verifiable`: the stance

A bare invocation activates the stance until the user ends it. Work is complete when the
requested obligations are met: computed checks pass, rejections are resolved, and specs
are reviewed. Unknown results, unavailable capabilities and unreviewed specs remain open.
Every claim carries its evidence class: **Run** (executed this session), **Read** (inspected),
or **not checked**. Never weaken a requirement, domain, threshold or admission rule to get
a pass. Only the user may trade a claim for a cost; state what is lost if they do.

Ask in one question which code to apply the skill to, and list the five commands above in one line each, including the selected language's limits.
If the project has no verifiable instructions, ask once whether to run `:init`.

## `/verifiable:init`

Read `assets/rules.md` and the selected language's rules: `assets/typescript/rules.md` or
`assets/csharp/rules.md`. Add the common section and applicable language subsection to
`CLAUDE.md` and `AGENTS.md`, creating missing files. Replace existing verifiable sections
without changing unrelated instructions. In mixed repositories, scope each subsection to
its owning project and preserve the other language's section. State the files under the
claim; if no target has been selected, say the scope is pending. Show the installed text.
This does not configure or admit any code.
C# has no settings file, so the C# subsection's file list is the only record of its scope.
Write one row per selected file there, naming its source, spec and obligations paths.
When `:apply` later selects another C# file, add its row in the same place.

## Evidence rules

Explicit user instructions take precedence; state which assurance claim is lost if they
narrow this workflow. Invoking this skill is the user's instruction for that task: for the
code under the request, this skill's computation and pruning rules take precedence over
generic testing guidance and over project guidance about tests, which applies only to dead
ends. Guidance about prose still governs report wording.

- **The tool counts.** Unsupported code has no count under this skill. It is not zero and
  is not implicitly covered. Whether code fits the forms is also the tool's verdict: run the
  diagnosis or the inventory before saying code is outside.
- **A rejection is information.** Reshape to meet the rule. Do not silence it with casts,
  suppressions or moving code out of scope to get a clean run. Code that still remains outside
  is a dead end (see Doing the work): list it with the tool's reason and exclude it from the claim.
- **The spec comes from the requirement.** Ask when it is unknown. If the user asks to use
  existing behavior, record the uncertainty in `unsettled`. Where you wrote both code and
  spec, disclose that independent review is still needed.
- **Contracts have limits.** Read the language's contract reference when a piece calls a
  library function. TypeScript `given` or `scoped` lines cannot remove checks; trust their premises
  only after contract checks pass and reconciliation shows no refutation. C# has no contract
  execution yet.
- **A reshape needs review.** Spec agreement does not establish behavior preservation.
  Run the existing suite; investigate failures before changing tests.
- **Pruning needs evidence.** Read [reconciliation.md](references/reconciliation.md).
  Remove nothing on guessed redundancy, passing computed checks or mutation score alone.
  A test that notices no counted-cell change may still guard unmodeled behavior. Keep it
  unless the user selects it for removal after its remaining purpose has been reviewed.
- **Tools can be wrong.** Report contradictions between inspected code and tool output,
  distinguishing what was run from what was read. Unknown never becomes pass.

## Reporting

Lead with the answer. Report:

1. Language, backend and precise scope; what ran or was read, and the tool's counts.
   Under `:apply`, one line per piece: its count and result, or dead end with the tool's reason.
2. Unsupported work, outside files, assumptions, rejections and checks that did not run.
3. Specs, unsettled requirements, contracts and mutant explanations still needing review.
4. Changes, location of the working copy, and existing-suite/reconciliation status.

A read-only command says no files changed except any documented solver cache. Never call
code verified, safe or fully covered. C# results must say they did not check the
application build or reconcile its tests, and whether the file was checked standalone or with its project.
They also repeat the claim word the tool printed per method, `every input` or `cells`. Report successful stages separately from an
incomplete `:apply`.

## References loaded only when needed

- Reshaping/specs: [TypeScript shapes](references/typescript/shapes.md) or [C# shapes](references/csharp/shapes.md).
- Library assumptions: [TypeScript contracts](references/typescript/contracts.md) or [C# contracts](references/csharp/contracts.md).
- Tool options/output: [TypeScript tools](references/typescript/tools.md) or C# setup.
- Reading artifacts or extending a backend: [formats](references/formats.md).
- C# code no shape admits (state over steps, concurrency, repeatable results, floating point beyond comparison and the four operations):
  [C# beyond enumeration](references/csharp/beyond-enumeration.md).
- Extending C# semantics: [C# evidence](references/csharp/evidence.md). Primary sources and
  executable checks are separate evidence.
