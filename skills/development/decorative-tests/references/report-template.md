# Review report template

Use this exact structure. Every verdict carries a mode from the Taxonomy and an evidence line.
No evidence line → mark `needs reader` instead of guessing.

```
# Test review: <scope>

## Verdict
<one sentence: N tests, M software tests, K decorative, G gaps. What to do first.>

## Inventory
| File | Tests | Skipped / .only | Empty assertions |
|---|---|---|---|

## Rules table
| Rule | Tests claiming it | Provenance | Confirmed by user |
|---|---|---|---|
<one row per distinct rule; provenance = code | spec | convention | ?>

## Decorative tests
| Test | Mode | Evidence |
|---|---|---|
<Evidence examples: "kills 0 unique mutants (report: mutant #12 also killed by X)",
 "asserts on mock call count, not response", "body replaced with `return true`, still passes",
 "same kill set as invoices.spec.ts:44">

## Gaps
| Location | Surviving mutant or missing rule | Proposed test (one line) |
|---|---|---|

## Needs reader
<tests no tool or table resolved; say what a human should check in one line each>

## Proposed actions
- Delete: <list>
- Add: <list>
- Ask the user: <open rules from the table>

Nothing above has been applied. Waiting for your go.
```

Keep the Verdict to one sentence. The user reads the Verdict and the Rules table; the rest is for
follow-up.
