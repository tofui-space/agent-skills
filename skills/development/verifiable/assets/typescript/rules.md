### TypeScript scope

These rules apply only to TypeScript files selected by this project's `verifiable.json`.

- Use the inventory's admitted decision, classifier, adapter, wiring and conversion shapes.
  Unshaped files under the claim hold types and re-exports only.
- Run the inventory after changing admitted code, keep the obligations current, and run
  computed checks under the configured Node or Vitest entry file.
- Do not silence rejections with casts, non-null assertions or suppressions.
- Reconcile existing tests before removing any; a successful computed run is insufficient.
  Keep tests that notice no counted-cell changes: review what else their assertions protect
  and obtain explicit user selection before removal. Only skipped tests are removable by
  default in the coverage workflow.
- The TypeScript toolchain does not analyze C# or provide Stryker.NET integration.
