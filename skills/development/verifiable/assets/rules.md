## Verifiable code

Application code in this project is written so that a tool can compute its checks. These rules apply to every change to code under the claim (the files the project's `verifiable.json` includes).

- Write code only in the shapes the inventory admits: decision, classifier, adapter, wiring, conversion. A file that matches no shape holds types and re-exports only.
- Run the inventory after every change to such code. A `REJECTED` line means the change is not done.
- Fix a rejection by reshaping the code. Do not silence it with a cast, a non-null assertion, a suppression comment, or by moving code out of the claim.
- Code that fits no shape goes in a file declared outside the claim, and is reported as not covered, never as covered.
- Do not write test cases for code in the shapes. Its checks are computed from the types, the constants and the spec. When a check is missing, the spec is missing a condition.
- Write a spec from the requirement, not from the code. Where the requirement is unknown, ask.
- A result of unknown, a check that did not run and a spec nobody reviewed are open items. Report them as open.
- Remove an existing test only with the evidence of a reconciliation: it is skipped, or no change to what it reaches makes it fail.
