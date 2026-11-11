### C# scope

Apply these rules only to the standalone decision files listed under "Selected files".
An empty list means the scope is pending and no application code has been admitted.
Unlisted files are outside these rules.

Selected files (source, spec, obligations):

- none yet

Rules:

- The current checker admits only public static Boolean decisions in its documented syntax.
  Unsupported application code remains outside the claim; do not impose the subset globally.
- Keep the listed spec and obligations file for each listed source file.
  After editing a listed file, recompute its inventory and run the stale check and compiled-method checks.
- When a new file is selected, add its row to the list before running its checks.
- Keep the application's own build and test evidence separate: the tool does not load its
  project settings, generated code, dependencies or compiled application assembly.
- Enums, numeric classifiers, adapters, wiring, conversions and library contracts are
  unsupported. Never borrow TypeScript admission or numbers for them.
- C# reconciliation, pruning and Stryker.NET integration are unavailable. Keep existing tests.
