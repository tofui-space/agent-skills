# Reconciliation evidence

Read this before classifying or removing existing tests. The mechanism below is implemented only for TypeScript under Node and Vitest. C# has no reconciliation implementation; running its computed checks does not authorize pruning.

## Reading the reconciliation

For each test the tool runs it alone and records the cells it reaches: a decision input, a combination of conditions in a classifier, an adapter variant, an error an adapter passes on, a key of a dispatch map. Then it changes one cell at a time to another valid result and records whether an assertion of the test fails.

A cell is named by the sample input the inventory holds for it, not by the input the test used: a test that passes `'AB-123'` is shown as reaching `isStopId: "AA-000" gives true`, because both inputs fall into the same cell. The numbers differ from the inventory's for the same reason: the reconciliation counts cells, the inventory counts checks, and a cell can have several checks at its boundaries. Handlers have no row in the table at the end; their exits are not changed separately.

Lines you will see under a test:

- `checks`: the cells one of its assertions notices.
- `reaches without checking`: cells it runs through and does not notice.
- `throws, unasserted`: cells whose change only makes later code throw. The test stops, and no assertion of its own noticed.
- `noticed only under another outcome than the first tried`: the change that was needed, sometimes a combination. Read each of these lines; the evidence is real and narrower than a plain `checks`.
- `changed to an outcome outside its type, for lack of another`: weak evidence either way. A dispatch map of functions with one key always ends here; say so instead of reading the line as a finding about the test.
- `library`: evidence about a library call or one of its options. `noticed under: changed to false | not noticed under: removed, so the default applies` means the test guards the value, and the value written equals the library's default.
- `same evidence as`: another test with exactly the same evidence. Nothing in the tool tells the two apart; they may still differ inside a library.

Lines at the end of the run:

- `CONTRACT GAP`: a library call threw an error its contract does not list. The contract is incomplete: add the clause, with its `provoke`.
- `CONTRACT REFUTED`: a library call returned a value its contract's guarantee excludes, or threw an error its contract ruled out for that call. The contract is wrong: correct it before trusting anything that rests on it.
- `NOT OBSERVED`: a call or a contract member the tool could not observe, with the reason.

## What each verdict allows

| Verdict | Meaning | Allows |
|---|---|---|
| `skipped: it runs nothing` | The runner skips it | Removal |
| `cannot fail on the counted code: ...` | No assertion notices the modeled changes; behavior outside those cells remains unmeasured | Keep pending review of the test's remaining purpose; removal requires explicit user selection after that review |
| `an assertion notices n of the m cells it reaches; the computed checks cover each of them` | It duplicates computed checks as far as cells go | Nothing by itself. Whether it also guards something no cell models is not shown |
| `runs none of the counted code; an assertion notices n of the m library cells it reaches` | It guards a library call or option, which no computed check covers | Keep it |
| `runs none of the counted code, so this tool has no evidence about it` | It tests something outside the shapes | Nothing. This is not a finding against the test |
| `no assertion notices any ...; it only stops when a changed outcome makes later code throw` | It would fail, but not by an assertion of its own | Nothing; worth a look by a person |
| `fails only when several outcomes change at once; needs a look` | The single changes went unnoticed | Nothing |
| `fails already, before any change` | It does not pass on the code as it is | Repair first |
| `cannot be run alone: a nested test in its file has the same name` | The runner cannot select it | Rename one of the two and rerun |
| `no assertion notices any ... in the selected units; this says nothing about the other units` | A `--units` run | Nothing |

A test's title is not judged. When the evidence shows a test never reaches what its title names, say so with the evidence and leave the decision to the user.

For example, a test may call an admitted decision without asserting its result, then assert
the result of an unmodeled formatter. Changes to the decision's cells go unnoticed, yet
deleting the test would remove the formatter's protection. Read assertions and dependencies
before proposing deletion; `NOT OBSERVED` and outside code are gaps in the evidence, not
evidence that the test protects nothing. The prune plan keeps these rows with their evidence.

