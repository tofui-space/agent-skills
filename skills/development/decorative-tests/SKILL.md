---
name: decorative-tests
description: Distinguish decorative tests (tests that cannot fail on a real bug) from software tests, using seven named failure modes with deterministic detection where one exists. Use this skill EVERY time the task involves writing, generating, reviewing, trimming, or judging automated tests — unit, integration, API, authorization, validation — even when the user only says "add tests", "cover this", "is this suite any good", "too many tests", or "quiz me on the tests". Also invoke on "decorative tests", "/decorative-tests", "real tests", "test slop", "characterization tests", "redundant tests", "mutation testing", or when a generated suite looks large for the code it covers. Do NOT skip it because the request is small; single-file test requests are where decorative tests appear most.
---

# Decorative tests

A software test fails on some code change that no other test catches, and can say why it exists.
A decorative test cannot do one of those two things. Count is not the measure; a suite of 1000 tests
and a suite of 100 are judged the same way, one test at a time.

Two jobs, pick by context:

- Writing tests → follow **Generation rules**.
- Judging an existing suite → follow **Review procedure**.

Both use the same **Taxonomy**. The normative version of these rules, in standard wording, is
`references/standard.md`; use it when the user asks for a policy document or a rationale with sources. `references/adversarial-pass.md` is mandatory after every generation run. Read `references/mutation-tools.md` when a mutation tool is
available or should be proposed. Read `references/report-template.md` when producing a review.

Never commit. Never delete tests without an explicit go from the user. Never edit a failing test to
make it pass; report the failure.

## Taxonomy

Seven failure modes. Each generated test that a careful human would not have written falls into one.
Detection is deterministic where a tool exists; otherwise it needs a reader.

| Mode | Definition | Detect |
|---|---|---|
| Characterization | Expected value copied from current output; no spec or design intent behind it | No spec line or design decision cited |
| Pseudo-tested | Code runs, but removing its effect fails no assertion | Extreme mutation: replace method body with a constant, test still passes |
| Tautological | Assertion restates the implementation, so no shared bug can fail it | Same expression in test and code; mutant on shared logic survives |
| Redundant | Kills no mutant that another test does not already kill | Per-test mutation kill data |
| Over-specified | Asserts internals (call counts, private state, exact error strings) instead of observable outcome | Breaks on a refactor with no behaviour change |
| Evergreen | Cannot fail: wrong async handling, assertion on a copy, `skip`, `.only`, empty `expect` | Never seen red; fails-on-old-passes-on-new check |
| Data-only duplicate | Same rule, different input values | Identical kill set to another test |

Origins, for the user who wants sources: Characterization — Feathers 2004. Pseudo-tested — Niedermayr
2016, Vera-Pérez 2018 (Descartes). Over-specified — Meszaros, "fragile test". Evergreen — test-smell
literature, van Deursen 2001. Redundant — mutation-testing literature; TestEvo-Bench reports it per agent.

## Generation rules

The count of tests is emergent, not computed: the model keeps adding cases until a file "looks
complete". Replace that heuristic with an enumerable list, then derive one test per item.

1. **Rules table first.** Before writing any test, output a table of the rules the app must follow. The code is not a source of rules; it is
   only where you check whether a rule is already enforced.
   For request handlers: route × actor × expected result. For validators: one row per rule.
   For business logic: one row per branch that changes observable output.
2. **Mark provenance per row.** `spec` (a requirement names it), `decision` (the owner said so in
   this session), `code` (a check exists in the handler; the owner must confirm the check is right),
   or `convention` (assumed; nothing in the repo says so).
3. **Stop on unknown.** A row whose expected result the code and spec both leave open gets `?`.
   Ask the user. Do not pick a default.
4. **Wait for the table to be confirmed** when any row is `convention`, `code`, or `?`. Only rows
   marked `spec` or `decision` may proceed without confirmation.
5. **One test per row.** No test without a row. A comment on each test names the row and its
   provenance: `// rule: GET /invoices/:id, other user → 404 [code: invoices.ts:42]`.
6. **Observable outcomes only.** Status, body, persisted state, emitted events. Not call counts,
   not private fields, not exact error prose unless the prose is the contract.
7. **No data-only variations.** Two inputs that exercise the same rule are one test.
8. **No framework tests.** Do not test that the router routes or the ORM saves.
9. **Red first when possible.** If the code exists, temporarily break the rule under test and
   confirm the test fails, then restore. Report which tests were never seen red.
10. **Never `skip`, `.only`, `xit`, or delete an assertion** to reach green.
11. **Adversarial pass, every time.** After the tests are written, run the pass in
    `references/adversarial-pass.md` on every generated test. Use a fresh subagent when one is
    available: give it only the tests and the rules table, not the generation context. The pass
    ends with a table of tests it could defeat; those tests are rewritten or removed before the
    work is reported as done.

Example rules table, invented service:

| Route | Actor | Expected | Provenance |
|---|---|---|---|
| GET /invoices/:id | anonymous | 401 | convention |
| GET /invoices/:id | owner | 200 | code: invoices.ts:38 |
| GET /invoices/:id | other user | 404 | code: invoices.ts:42 |
| GET /invoices/:id | accountant | 200 | spec: INV-3 |
| GET /invoices/:id | admin | ? | ask |

Expected test count for this route: 4, plus 1 once the `?` is answered.

## Review procedure

Do not read the suite test by test as the first step. Derive the rules, then judge tests against
rules and against mutation data.

1. **Inventory.** Count tests per file. Note skips, `.only`, empty assertions (Evergreen candidates).
2. **Rules table from the tests.** For each test, extract the rule it claims to check. Group tests
   by rule. Tests sharing a rule are Data-only duplicate candidates.
3. **Mutation data, if a tool is present or the user accepts installing one.** See
   `references/mutation-tools.md`. Take per-test kill data. Tests with an empty unique-kill set are
   Redundant. Surviving mutants on lines the suite touches mark Pseudo-tested or Tautological tests.
   Surviving mutants on lines no test touches are gaps, not decorative tests; list them separately.
4. **Read only the residue.** Tests not resolved by steps 2 and 3. Apply the Taxonomy by reading.
5. **Report** using `references/report-template.md`. Every verdict names its mode and its evidence.
   A verdict with no evidence line is not a verdict; mark it "needs reader".
6. **Propose, do not act.** List proposed deletions and proposed new tests (one per surviving mutant
   or missing rule). Wait for the user before changing files.

What review cannot do: it cannot detect that the code is wrong. A surviving mutant means untested.
A test marked `code` that matches a buggy handler passes review. Only the user can flag the rule as
wrong, which is why the rules table goes in front of them before any test is trusted.

## When the user is tired or imprecise

They may say "make the tests good" or "too many tests". Do not ask them to restate. Run the
Generation rules or the Review procedure as the request implies, and put the rules table in front
of them. The table is the only thing they need to read.
