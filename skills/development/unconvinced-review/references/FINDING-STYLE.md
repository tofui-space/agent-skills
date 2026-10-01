# Finding Style

The output should read like a serious audit finding that accidentally has a very good title.

## Required structure

### <satirical title>

**Finding:** One precise sentence describing the defect without humor.

**Evidence:** Concrete code path, lines, commands, tests, or verified requirement source.

**Why it matters:** The real consequence, not a generic risk label.

**The story:** Two to five sentences. Set up what the code appears to promise, reveal what actually happens, and end on the contradiction.

**Confidence:** `confirmed`, `strongly-supported`, or `requirement-dependent`.

Do not include a fix.

## Title design

A good title compresses the contradiction.

Useful forms:

- **The Seatbelt Is Painted On**
- **The Jira Ticket Has Spoken**
- **A Beautifully Documented No-Op**
- **The Mock Passed the Test It Wrote for Itself**
- **Three Paragraphs, Zero Invariants**
- **The Authorization Check Arrives Fashionably Late**
- **Atomic, Except for the Atoms**
- **The Comment Has Achieved Transaction Isolation**
- **Schrödinger's Validation**
- **The Oracle Consulted Itself**
- **By Design, Pending Discovery of the Design**
- **The Provenance Is Immaculate; The Proposition Less So**
- **The Type Checker Has Declared the Business Logic Correct**
- **Please Do Not Look Behind the Abstraction**
- **The Safety Rail Is Installed After the Cliff**

Do not mechanically reuse these. Derive the title from the actual defect.

## Story mechanics

Prefer this three-beat structure:

1. **Promise:** describe the authoritative-looking story the implementation tells.
2. **Executable reality:** reveal the concrete behavior that contradicts it.
3. **Punchline:** restate the mismatch memorably.

Example:

### The Authorization Check Arrives Fashionably Late

**Finding:** The protected mutation executes before the authorization result is evaluated.

**Evidence:** `updateAccount()` performs the write before the branch that checks `canManageAccount`; the failing branch only changes the returned response.

**Why it matters:** A caller without the required permission can still modify the account even though the request is reported as unauthorized.

**The story:** The function has an authorization check, which is reassuring in the same way that locking the door after the burglary is reassuring. It carefully asks whether the caller may perform the operation immediately after performing it. Access control is therefore present, documented, and chronologically decorative.

**Confidence:** `confirmed`

The title and story are expendable. The first three fields are not.

## Humor constraints

Use:
- irony;
- understatement;
- literalizing an absurd implementation;
- anthropomorphizing the code, test, comment, or ticket;
- bureaucratic/formal phrasing applied to an obvious contradiction;
- callback to the implementation's own terminology.

Avoid:
- insults;
- profanity by default;
- claims about the author's intelligence;
- guessing that someone was lazy;
- alleging deliberate deception;
- mocking junior developers;
- jokes about protected/personal characteristics;
- jokes that obscure the defect.

The object of satire is the **artifact's contradiction**, not a person.

## Evidence language

Prefer:
- "The comment states X; the executable path does Y."
- "The ticket reference was inspected and requires X; this branch implements Y."
- "The test's expected value is derived from the same helper used by production."
- "The mock cannot exercise the failure mode because it is configured to always return X."
- "No inspected source establishes the claimed requirement."

Avoid:
- "Obviously AI-generated."
- "The model hallucinated."
- "The developer tried to hide..."
- "This is deceptive."
- "They clearly didn't understand..."
- "Probably copied from..."

Those may be narratives, not evidence.

## Confidence

**confirmed** — reproduced behavior, unavoidable code path, or direct contradiction with an inspected authoritative contract.

**strongly-supported** — code reasoning is clear and concrete, but runtime reproduction or an external dependency is not available.

**requirement-dependent** — the implementation conflicts with an asserted behavior, but the authoritative requirement cannot be independently established. Use sparingly; do not present it as a confirmed defect.

If confidence would be lower than `requirement-dependent`, omit the item.

## No-remediation rule

Do not append:
- "Fix:";
- "Recommendation:";
- "Suggested change:";
- patch snippets;
- replacement code;
- refactor advice.

The user asked for findings. Stop at the finding.
