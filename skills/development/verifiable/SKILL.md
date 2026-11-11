---
name: verifiable
description: >-
  Compute checks for admitted application code from its input domains and reviewed specs.
  Use on /verifiable and its paths, coverage, mutation, prune and init commands, or when
  asked of TypeScript code which tests it needs, whether its checks can be counted, whether
  a suite is sufficient, or which existing tests actually guard behavior. For C#, only
  standalone Boolean decision files. Not for C# suite sufficiency, test strength or
  mutation questions, UI rendering, performance/load tests, other languages, or one quick
  test requested by name.
---

# Verifiable

Write code in shapes whose checks a tool can compute. Expected results come from a separate
spec reviewed against the requirement. The agent reshapes code and writes specs; it does not
choose, count or add test cases for admitted code. A spec table describes the whole domain;
it is not a selection of representative test inputs.

Read [references/assurance.md](references/assurance.md) for the claim, vocabulary and limits.
A passing run establishes agreement with the supplied spec on computed inputs, within the
selected backend's admitted semantics. It does not establish that the spec is correct or
that the application is verified.

## Select a language before acting

Resolve the target file and its owning project. Read only the corresponding profile:

| Target | Setup and capabilities | Executable scope |
|---|---|---|
| TypeScript | [typescript/setup.md](references/typescript/setup.md) | Existing five-shape tools; Node and Vitest runners |
| C# | [csharp/setup.md](references/csharp/setup.md) | Standalone Boolean decisions only; no solution/project loading |
| Mixed repository | Select each target's profile separately | Keep inventories, specs and results separate |
| Other language | No backend | Report unsupported; do not invent counts |

Machine-readable support is in [capabilities.json](scripts/capabilities.json).
`node <skill>/scripts/capabilities.mjs <typescript|csharp>` prints one profile without
installing either backend. This reports implementation support, not installed dependencies
or admission of the target. Setup checks those separately. Do not add a `language` key to
the existing TypeScript `verifiable.json`: its schema rejects unknown keys.

For C#, inspect project settings and dependencies before extracting a standalone file.
An unsupported command blocks its claim. Name the missing capability and supported next step.
Do not translate C# to TypeScript, guess cases, or transfer another project's evidence.
These limits govern only the claims this skill makes.
For C# code outside the Boolean subset, say it is unsupported here and leave the question to other testing guidance.

## Commands

Accept `/verifiable:<name> <target>` and `/verifiable <name> <target>`. The command files in
`assets/commands/` use the same routing. A target is a file, folder or function; a profile
may support narrower targets. A question about code without a command defaults to `:paths`.
A bare `/verifiable` activates the stance below instead.

| Command | Procedure | C# limit |
|---|---|---|
| `:paths` | Read-only admission/count diagnosis | Whole standalone file; no exit tracing |
| `:coverage` | [Shared workflow](references/coverage.md), then language procedure | Boolean decisions only; reconciliation unavailable |
| `:mutation` | Sort surviving mutants using the selected backend | Unsupported; no Stryker.NET integration |
| `:prune` | Reconcile, show evidence, remove only what it permits | Unsupported; no C# reconciliation |
| `:init` | Install scoped instructions below | Only restricted C# scope may be named |

Read [TypeScript commands](references/typescript/commands.md) for that backend's procedures
and [C# setup](references/csharp/setup.md) for its CLI and command mapping.
Do not start coverage, mutation or pruning unless the user names it or asks for the change.
Before any step that writes files or runs longer than about a minute (a build, an inventory, a reconciliation, a mutation run), state its expected time, the files it changes and the human review it needs.

## `/verifiable`: the stance

A bare invocation activates the stance until the user ends it. Work is complete when the
requested obligations are met: computed checks pass, rejections are resolved, and specs
are reviewed. Unknown results, unavailable capabilities and unreviewed specs remain open.
Every claim carries its evidence class: **Run** (executed this session), **Read** (inspected),
or **not checked**. Never weaken a requirement, domain, threshold or admission rule to get
a pass. Only the user may trade a claim for a cost; state what is lost if they do.

List the five commands above in one line each, including the selected language's limits.
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
When `:coverage` later selects another C# file, add its row in the same place.

## Evidence rules

Explicit user instructions take precedence; state which assurance claim is lost if they
narrow this workflow. For admitted code, this skill's computation and pruning rules take
precedence over generic testing guidance. Guidance about prose still governs report wording.

- **The tool counts.** Unsupported code has no count under this skill. It is not zero and
  is not implicitly covered.
- **A rejection is information.** Reshape to meet the rule. Do not silence it with casts,
  suppressions or moving code out of scope to get a clean run. If code truly remains outside,
  list it and exclude it from the claim explicitly.
- **The spec comes from the requirement.** Ask when it is unknown. If the user asks to use
  existing behavior, record the uncertainty in `unsettled`. Where you wrote both code and
  spec, disclose that independent review is still needed.
- **Contracts have limits.** Read the language's contract reference when library behavior
  matters. TypeScript `given` or `scoped` lines cannot remove checks; trust their premises
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
2. Unsupported work, outside files, assumptions, rejections and checks that did not run.
3. Specs, unsettled requirements, contracts and mutant explanations still needing review.
4. Changes, location of the working copy, and existing-suite/reconciliation status.

A read-only command says no files changed except any documented solver cache. Never call
code verified, safe or fully covered. C# standalone results must say they did not check the
application build or reconcile its tests. Report successful stages separately from an
incomplete overall coverage workflow.

## References loaded only when needed

- Reshaping/specs: [TypeScript shapes](references/typescript/shapes.md) or [C# shapes](references/csharp/shapes.md).
- Library assumptions: [TypeScript contracts](references/typescript/contracts.md) or [C# contracts](references/csharp/contracts.md).
- Tool options/output: [TypeScript tools](references/typescript/tools.md) or C# setup.
- Reading artifacts or extending a backend: [formats](references/formats.md).
- Extending C# semantics: [C# evidence](references/csharp/evidence.md). Primary sources and
  executable checks are separate evidence.
