# Review Heuristics

Load this reference when the implementation presents a persuasive claim whose evidentiary value needs to be tested.

These are **investigation prompts, not defect classifiers**. Finding a pattern below is never sufficient by itself for a finding.

## Authority laundering

**Pattern:** A source-shaped object is treated as proof: Jira ID, ADR number, standard name, URL, CVE, commit hash, package documentation, architecture label.

**Question:** Did you inspect the source, and does it actually require or justify this exact behavior?

**Failure mode:** provenance exists, therefore the proposition is assumed true.

**Do instead:** follow the reference. Separate existence, authenticity, applicability, and support for the claim.

---

## Explanation density

**Pattern:** The explanation is much more rigorous-looking than the executable invariant.

**Question:** Which executable operation makes each promised property true?

**Failure mode:** many correct-sounding sentences create an impression that a guarantee has been implemented.

**Do instead:** map every important guarantee to actual control flow, data flow, validation, synchronization, or constraint.

Long documentation is not suspicious by itself.

---

## Comment/code divergence

**Pattern:** A comment accurately describes a desirable implementation, while the code implements something weaker or different.

**Question:** If the comment vanished, what property would the executable code establish?

**Common examples:**
- "atomic" around multiple independent mutations;
- "authorized" before the authorization result is checked;
- "validated" when only syntax was checked;
- "sanitized" when values are merely escaped for a different context;
- "guaranteed" without an enforcing invariant.

---

## The design-decision shield

**Pattern:** A surprising behavior is defended by "intentional", "by design", "legacy compatibility", or "required by X".

**Question:** Where is the design decision, and does it cover this exact behavior?

**Failure mode:** rationale-shaped prose is accepted as requirement evidence.

**Do instead:** verify the design source. If unavailable, do not automatically classify the behavior as either bug or feature.

---

## Ticket-as-requirement

**Pattern:** A Jira/issue identifier appears next to an implementation choice.

**Question:** What does the ticket actually require?

An identifier proves that an identifier exists. It does not prove:
- acceptance criteria;
- current applicability;
- the implementation matches the ticket;
- the ticket was approved;
- the implementation's interpretation is correct.

---

## Self-fulfilling test oracle

**Pattern:** Test expectations are derived from the same logic or assumptions under test.

**Examples:**
- expected output produced by the same helper as production;
- mock configured to return exactly what the implementation assumes;
- fixture duplicates a mistaken constant;
- test asserts an intermediate implementation detail instead of required behavior.

**Question:** What independent fact could make this test fail if the implementation's assumption were wrong?

---

## Mock reality distortion

**Pattern:** A fake dependency is more permissive, synchronous, stable, or structurally different from the real dependency.

**Question:** Is the property being tested preserved by the mock?

Look especially at:
- authentication/authorization;
- transactionality;
- retries and idempotency;
- serialization;
- network errors;
- ordering;
- concurrency;
- database constraints.

---

## Compilation as correctness

**Pattern:** Types, linting, or compilation are implicitly used as proof of runtime semantics.

**Question:** Which correctness property is statically guaranteed, and which is merely type-compatible?

Type safety can remove classes of errors. It does not establish business semantics, authorization, correct units, correct ordering, or correct external assumptions.

---

## Plausible abstraction

**Pattern:** Names and layering make the code look architecturally deliberate.

**Question:** Does the abstraction preserve the required invariant, or merely give it a good name?

Inspect:
- wrapper methods that silently weaken contracts;
- adapters that discard information;
- "manager/service/provider" layers that add no enforcement;
- normalization helpers that do not normalize the risky dimension.

---

## Security placebo

**Pattern:** Security vocabulary or checks exist, but at the wrong boundary or time.

**Questions:**
- Is authorization checked before the protected effect?
- Is validation performed on the value actually consumed?
- Is encoding/sanitization correct for the destination context?
- Is the check enforced server-side at the trust boundary?
- Can another path bypass it?

Do not award correctness for the presence of a security-looking function.

---

## Error-path amnesia

**Pattern:** The happy path is heavily explained and tested while partial failure is semantically undefined.

**Inspect:**
- mutation before failure;
- retries after partial completion;
- swallowed exceptions;
- cleanup paths;
- default fallback behavior;
- state that can become externally visible before validation completes.

---

## Negative-space requirement

**Pattern:** The implementation proves what is allowed but never proves what must be forbidden.

**Inspect:**
- cross-tenant access;
- unauthorized roles;
- unknown enum values;
- unexpected state transitions;
- duplicates;
- stale versions;
- missing tenant/user context.

Positive tests are not evidence for negative guarantees unless the mechanism itself enforces them.

---

## Oracle naming

**Pattern:** Variables or helper names carry semantic authority: `isSafe`, `isValid`, `canAccess`, `trusted`, `normalized`.

**Question:** What exact predicate is computed?

Rename it mentally to the literal expression it represents. Review that expression, not the semantic promise of the identifier.

---

## Provenance-shaped hallucination

**Pattern:** A precise citation, API name, version, section number, or historical rationale makes a claim unusually believable.

**Question:** Can the provenance be checked? If checked, does it support the exact proposition?

Precision increases verifiability, not truth.

---

## Overdocumentation backfire

**Pattern:** Commentary states enough concrete guarantees that the executable code can be tested against the commentary and fails.

Use the prose as a source of hypotheses:
1. extract each promised invariant;
2. locate its enforcement;
3. trace counterexamples;
4. report only contradictions you can establish.

The comedy comes from the contrast. The finding comes from the evidence.
