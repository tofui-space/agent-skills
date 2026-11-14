### C# scope

Apply these rules only to the standalone files listed under "Selected files".
An empty list means the scope is pending and no application code has been admitted.
Unlisted files are outside these rules.

Selected files (source, spec, obligations):

- none yet

Rules:

- The current checker admits only decisions and computed results over `bool` values, enums, numbers, strings and records of them, in its documented syntax.
  Unsupported application code remains outside the claim; do not impose the subset globally.
- Keep the listed spec and obligations file for each listed source file.
  After editing a listed file, recompute its inventory and run the stale check and compiled-method checks.
- An enum parameter or record field has an `#unnamed` cell for values no member names. Give it a spec row from the requirement, and never report a `cells` result as every input.
- A number or string input gets its cells from the `domains` of its spec. Write the ranges and the strings from the requirement, never from the cells `paths` prints, and give `#null`, `#other` and `#nan` a row from the requirement.
- Use `#any` in a row, or leave a record field out, only where the requirement makes no difference between the cells of that input.
- Write the formula of a computed result from the requirement, never from the code. The checker holds the code to the formula's operations and their grouping, so a formula that is equal only in exact arithmetic fails.
- When a new file is selected, add its row to the list before running its checks.
- Keep the application's own build and test evidence separate: the tool does not load its
  project settings, generated code, dependencies or compiled application assembly.
- Arithmetic other than `+`, `-`, `*` and `/`, calls such as `Math` functions, `float` and `decimal` values, string operations other than comparison with a constant, record classes, adapters, wiring, conversions and library contracts are
  unsupported. Never borrow TypeScript admission or numbers for them.
- C# reconciliation, pruning and Stryker.NET integration are unavailable. Keep existing tests.
