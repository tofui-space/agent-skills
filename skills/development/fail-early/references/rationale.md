# Rationale per rule

Every example is invented. None describes a real project.

## 1. No source

**Reason.** An invented symbol and a real symbol read the same in generated code. A source requirement converts the question "is this real?" into a lookup with a yes/no result.
**Counts as a source:** a file in the repo, the installed package's types or source, a lockfile entry, fetched documentation, a changelog or issue that was read in this session.
**Example.** A task needs interval parsing. Recall suggests `parseInterval()` from the installed `chronoflux` package. The package's type file has no such export. Stop report, rule 1. The same applies to "the crash is a bug in `chronoflux` 3.2": without a changelog entry or an issue that was read, the claim is a hypothesis, and an upgrade based on it is a guess.

## 2. Two attempts

**Reason.** Each failed fix adds changes that the next fix must work around. After the second failure the working theory of the bug is likely wrong, and further fixes degrade the code.
**Counts as the same check:** the same command failing, even with a different message.
**Example.** `cargo test` fails on a lifetime error. Fix 1 adds a clone, and a different test fails. Fix 2 restructures the borrow, and the first test fails again. Stop report with both attempts.

## 3. Design ambiguity

**Reason.** A silent choice between two readings surfaces weeks later as design drift, after code depends on the choice.
**Boundary.** Ambiguity that changes a name or a message does not count. Ambiguity that changes a data shape, an ownership boundary, or a public interface counts.
**Example.** "Add archiving to orders." One reading is a boolean column. The other is a separate archive table with a retention job. Ask.

## 4. Broken foundation

**Reason.** Work built on an inconsistency copies the inconsistency. A task that starts with a failing import tends to end half-done, because the early failure consumes the session.
**Example.** The task adds an endpoint. Two existing endpoints return `{ items, total }` and a third returns a bare array. A fourth endpoint in either style makes the repair more expensive. Stop report: list the shapes and ask which one is the standard.

## 5. Workaround or changed check

**Reason.** A changed check reports green for red code. A workaround in production code hides an unsolved problem behind working output.
**Counts as a changed check:** a deleted or loosened assertion, `skip`, `only`, a mock of the unit under test, a stub that returns the expected value, a cast to a permissive type, a lint or type suppression, a raised timeout without a measured reason.
**Example.** A date test fails in one time zone. Pinning the test's time zone makes it pass and leaves the bug. Stop report, or fix the conversion.

## 6. No root cause

**Reason.** A symptom patch at one site leaves the same defect at the other sites and makes the code inconsistent.
**Example.** A dropdown is clipped. `overflow: visible` on the dropdown's parent hides the symptom. The cause is a stacking context created three ancestors up, and two other menus share it. Name the cause, search for the pattern, report all three sites, then fix.

## 7. Library docs first

**Reason.** Hand-written logic in a library's domain duplicates a maintained feature, and the duplicate lacks the library's edge-case handling.
**Example.** The repo uses a date library. A hand-written offset table for time zones breaks on daylight-saving changes. The library's docs list a zone-conversion function. If the docs are unreachable, that is rule 1.

## 8. Completion evidence

**Reason.** "Done" without command output is a claim. "Done" with command output is a fact the user can check in seconds. The list of unfinished parts prevents a half-finished task from reading as finished.
**The hook enforces the first half.** The list of unfinished parts is enforced by instruction only.

## 9. Test fails against broken code

**Reason.** A test that cannot fail passes every gate and misreports coverage.
**Method.** Break the code under test (invert a condition, return early), run the new test, show the failure, restore the code, show the pass.
**Example.** A test for `applyDiscount` asserts that the result "is a number". With the discount logic removed, the test still passes. The test verifies nothing.
