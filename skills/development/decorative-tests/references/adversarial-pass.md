# Adversarial pass

Goal: for each generated test, try to make it pass while its rule is violated. A test that can be
defeated this way is decorative. The pass is done by a reviewer who did not write the tests; in
Claude Code, spawn a subagent and give it only the test files and the rules table.

The reviewer's stance: assume every test is decorative until it survives the attacks below.

## Attacks, in order, per test

1. **Kill the rule.** Identify the line in the code that enforces this test's rule (the rules table
   names it for `code` rows; find it for the others). Remove or invert that check. Run the test.
   Pass → defeated (Pseudo-tested or Tautological). Restore the code.

2. **Return a constant.** Replace the body of the function under test with `return <plausible
   constant>` (the happy-path value). Run the test. Pass → defeated (Pseudo-tested). Restore.

3. **Break the neighbour.** Change a different branch of the same handler. Run the test. Fail →
   the test asserts on something outside its rule (Over-specified) or two rules share one test.
   Restore.

4. **Strip the assertion.** Delete the test's assertions and run it. If the test cannot fail with
   no assertions in it at all, check the original for an assertion that never executes: wrong
   `await`, assertion inside a callback that never runs, `expect` on a copy, `try/catch` swallowing
   the failure. Any of these → defeated (Evergreen). Restore.

5. **Swap the actor or input.** For authorization and validation tests, run the same test with the
   actor or input it is supposed to reject. Pass → defeated: the fixture is not the case the rule
   names (typical: "other user" fixture that is actually the owner, or a fake token accepted by a
   mocked auth layer).

6. **Compare kill sets.** Where two tests trace to the same rule, apply attacks 1 and 2 with only
   one of them enabled at a time. Same outcome both ways → Data-only duplicate; keep one.

7. **Read the assertion once.** Only now read the assertion text. Flag: call counts, private state,
   exact error prose not required by the rule, and any expression that mirrors the implementation
   line for line.

## Output

A table, one row per test, then a one-line verdict.

| Test | Rule | Attack that defeated it | Mode | Fix |
|---|---|---|---|---|
| invoices.spec.ts:44 | GET /invoices/:id, other user → 404 | 5: fixture user is the owner | Evergreen | Use a second user fixture |
| invoices.spec.ts:61 | PATCH /invoices/:id, owner → 200 | 2: constant body still passes | Pseudo-tested | Assert persisted change, not status |

Verdict: N tests, D defeated, S survived. Defeated tests are not delivered as done.

## Rules for the reviewer

- Never leave the code modified. Every attack restores before the next.
- Never fix a test by weakening it. A fix must make the attack fail.
- Never mark a test survived because the attack was hard to set up. Record "attack not run" and
  the reason; that test is unresolved, not passed.
- If a mutation tool is configured, run it after this pass and reconcile: any surviving mutant on
  a line a test claims to cover contradicts a "survived" verdict here, and the tool wins.
