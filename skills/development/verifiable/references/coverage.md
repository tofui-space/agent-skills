# Shared coverage workflow

Read this before `:coverage`, then the selected language's procedure. Capabilities differ;
never finish an unavailable stage by substituting an estimate or a different kind of test.

1. **Scope and cost.** Identify target language/project, supported shapes and runner, and
   unavailable stages before changing files. Explain reshape review and expected run costs.
2. **Work in a copy.** Use an isolated worktree/copy unless the user already supplied one.
   Keep the original runnable for comparison. Nothing here commits, merges or publishes.
3. **Diagnose.** Run the selected backend's admission/diagnosis command. Keep unsupported
   code visible. Its count is unknown under this tool, not zero.
4. **Reshape.** Apply the language's shape rules, preserving behavior and public callers.
   Run admission after each unit. Do not cast, suppress or exclude just to obtain a pass.
5. **Specify.** Write expected behavior from requirements in the language's spec format.
   Ask about missing requirements; record unsettled points if directed to preserve behavior.
6. **Contracts.** Where supported, document and exercise library assumptions. If calls are
   unsupported, report them outside the claim rather than inventing executable contracts.
7. **Compute and run.** Generate obligations, retain the freshness check, execute every
   computed check. Resolve disagreements using the requirement, not convenience.
8. **Existing suite.** Build/test the reshaped application using its established commands.
   Investigate failures before modifying tests. This evidence differs from standalone checks.
9. **Reconcile.** If implemented, observe the whole suite and classify with evidence.
   Otherwise report this stage unavailable and preserve every existing test.
10. **Remove only what the evidence permits.** Use [reconciliation.md](reconciliation.md)
    and the language procedure. Duplicated evidence alone does not authorize removal.
11. **Report.** State scope, counts, assumptions, unsupported stages and pending human review.
    If a requested stage was unavailable, report partial completion rather than full coverage.

## Language procedures

- [TypeScript coverage](typescript/coverage.md): the existing complete tool workflow.
- [C# setup](csharp/setup.md): Boolean decisions only; standalone compilation, no library
  contracts or reconciliation. Keep test files even if every computed check passes.
