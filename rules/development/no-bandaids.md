---
description: >-
  Investigate shared causes after code review findings, including a single finding,
  before recommending or implementing permanent fixes. Test causal predictions
  beyond reported cases and preserve evidence across context changes.
---

# No bandaids

After a review yields findings, or review findings are supplied, investigate shared causes before recommending permanent fixes, implementing them, or concluding the review.
Start without another prompt, even for one finding; skip this pass when there are no findings.
Scale investigation effort to the finding’s impact and causal uncertainty. A short investigation is sufficient when the mechanism, affected paths, and responsible boundary are directly established.

Explicit user instructions govern scope; this rule supplements other workflows while preserving their stricter evidence gates and required report formats.
In review-only tasks, investigate and recommend without changing source.
Within authorized scope, reversible diagnostic probes may precede or support the investigation.
An explicit request for immediate containment permits mitigation first: label the cause unresolved and resume investigation before a permanent repair.

Seek a solution that removes the failure mechanism, making the confirmed findings symptoms of a cause that no longer operates.
A fix, implementation change, redesign, refactor, or rewrite can achieve this; size does not establish depth.

## Contents

- Bound the pass
- Rebuild the causal context
- Find the mechanism
- Challenge the proposed solution
- Remove the cause
- Verify independently of the patch

## Bound the pass

One pass covers the findings that started it.
A defect found during the pass that the same mechanism does not explain is reported with its evidence; this rule neither investigates nor fixes it in this pass, and it does not start another.
A finding raised by any review of this pass's own change, including a hook's or plugin's review, counts, once confirmed against current source, as a failed verification of that change, not as a new finding; an unconfirmed one is reported as unsupported.
Each finding gets at most three accounts of its cause; when the prediction of the third fails, record the cause as unresolved, with the failed predictions, and make no permanent fix for it.
Each cause gets at most three fix attempts, an attempt being the changes made before the next verification; when the third fails verification, stop editing for that cause and report the note, the failed predictions, and the unresolved counterexamples.

## Rebuild the causal context

- Verify findings and suggested fixes against current source and contracts; distinguish confirmed defects, unsupported claims, and intentional behavior.
  Reconstruct the execution path instead of inheriting the explanation that generated the code or last patch.
- Keep a compact conversation or scratchpad note: finding, violated invariant, source locations, candidate cause, contrary evidence, next discriminating check, accounts tried, fix attempts made.
  Separate observations from hypotheses; repository documentation requires a request.
- Retrieve callers, state owners, and contracts needed to distinguish hypotheses; neither a diff nor a large context dump substitutes for tracing relationships.
- After compaction, handoff, or a failed fix attempt, refresh the note from source and test results before the next attempt.
  Preserve unresolved counterexamples rather than summarizing them as “root cause found.”

## Find the mechanism

Trace each confirmed symptom to the decision, representation, state transition, or ownership boundary that enables it.
For a candidate shared cause, identify the violated invariant and show how the mechanism produces each finding, using code or observable behavior.
Similar wording or nearby files do not establish causation.

Compare the shared-cause hypothesis with independent defects and seek a counterexample to the grouping.
For one finding, inspect other consumers or transitions exposed to its mechanism.
Keep separate causes separate, retaining each finding's severity and consequences.

## Challenge the proposed solution

Before accepting a candidate, predict an additional consequence beyond the review examples, then inspect or exercise the relevant caller, boundary value, operation ordering, failure path, or entry point.
Predict before searching to avoid fitting the theory to a convenient discovery.
Check a valid neighboring case or competing explanation for overreach.

Count additional defects as support only when the same mechanism explains them.
A failed prediction requires revising the account, within the limit under Bound the pass; if no additional case exists or can be checked, state that limit.
Neither invent symptoms nor claim all unknown symptoms are covered.
Follow demonstrated causal connections; stop when relevant paths are accounted for and further searching no longer distinguishes causes or changes the solution.
Inaccessible dependencies remain uncertainties.

## Remove the cause

Choose the simplest coherent change that enforces the invariant at its responsible boundary across affected paths in scope.
Explain why each grouped symptom becomes impossible through that mechanism.
Prefer eliminating invalid states, conflicting authority, or repeated decisions; wrapping scattered patches in a shared helper alone does not achieve this.

Check bypasses and compatibility obligations.
When implementing, remove obsolete workarounds, exercise affected callers, and retain guards enforcing legitimate boundary contracts.
If no shared cause survives, make independently justified fixes and explain the separation.
For a solution exceeding authorized scope, provide the concrete proposal and missing decision.

## Verify independently of the patch

Derive expected behavior from the contract, independently of the patch.
For implemented fixes, reproduce reported and additionally confirmed symptoms on the original mechanism, then show they pass after the change; also preserve valid behavior.
Exercise representative inputs or transitions before making a class-wide claim.
Preserve assertion strength and exercise the responsible boundary; unrelated green tests cannot close a defect.
When execution is unavailable, report untested claims subject to the active evidence gates.
Preserve pre-existing changes when reproducing the original mechanism. Use an isolated copy if necessary; if the relevant pre-fix state cannot be reconstructed safely, report that verification limit.

Within the required report format, retain individual findings and add their evidenced causes, chosen solution, additional confirmed symptoms, other defects found, verification results, and unresolved limits.
