---
name: unconvinced-review
description: "Manual-only evidence-first review of code known or suspected to be AI-generated. Use only when the user explicitly asks for Unconvinced Review, or explicitly requests this skeptical/satirical AI-code review. Scrutinize authoritative-looking comments, tests, tickets, provenance, and explanations as claims rather than evidence. Report only evidence-backed findings as memorable satirical stories; never modify or fix the code."
compatibility: "Agent Skills-compatible clients. Manual invocation recommended. For hard session isolation in Claude Code, use the Claude Code variant with context: fork."
metadata:
  version: "0.1.0"
  category: "code-review"
---

# Unconvinced Review

Review code under a temporary falsification-oriented lens. The purpose is to resist being persuaded by the *appearance* of correctness and to test what the code, tests, comments, and cited requirements actually establish.

This is a review skill, not a fixing skill.

## Activation boundary

Use this skill only when the user explicitly invokes or requests **Unconvinced Review**, or clearly asks for this specific skeptical/satirical review of AI-generated code.

Do not silently apply this stance to ordinary code review.

The skeptical stance is local to this invocation. It is not a personality, worldview, or prior about the author, the repository, AI-generated code in general, or later work.

When the review ends:
- retain only factual conclusions supported by evidence;
- treat satirical titles and stories as presentation, not evidence;
- do not carry suspicion, cynicism, or adversarial framing into later tasks;
- if a later task depends on a finding, re-evaluate the factual core normally.

## Core rule

> Trust nothing merely because it looks authoritative. Distrust nothing merely because it looks AI-generated.

Treat apparent authority as a claim that may need verification.

The following are **not evidence by themselves**:
- confident or expert-sounding prose;
- explanation density;
- comments, docstrings, ADR-like prose, or architecture terminology;
- a Jira/issue/ticket identifier;
- a commit, URL, citation, CVE, standard, or provenance-looking reference;
- names such as `validated`, `safe`, `authorized`, `atomic`, `sanitized`, or `guaranteed`;
- phrases such as "by design", "intentional", "required", "safe", "cannot happen", or "according to the specification";
- the existence of tests;
- green tests whose oracle is not independent of the implementation;
- mocks, fixtures, generated schemas, or helper functions that merely restate the implementation's assumptions;
- compilation, type-checking, linting, or formatting success.

Do not infer that any of these are false. Verify the claim they imply.

## Non-goals

Do not:
- modify source code;
- produce patches;
- "clean up" nearby code;
- refactor;
- fix findings;
- add tests;
- rewrite comments;
- propose implementation details unless the user separately asks after the review;
- infer AI authorship from style;
- infer incompetence, laziness, dishonesty, malicious intent, or an attempt to deceive;
- turn suspicious style into a finding;
- inflate the number of findings.

A finding exists only when there is a factual problem or a materially unsupported claim with a concrete review consequence.

## Review workflow

### 1. Establish scope

Identify the review target: diff, commit, PR, files, or user-specified area.

Read the actual code before forming conclusions. Inspect enough surrounding code to understand control flow, data flow, invariants, callers, and externally visible behavior.

If the user provides requirements, tickets, design documents, comments, or citations, treat them as sources to inspect rather than conclusions to inherit.

### 2. Separate claims from behavior

For each important assertion made by the implementation, ask:

1. What exactly is being claimed?
2. Where is the claim asserted: code, comment, test, ticket, name, documentation, provenance?
3. What independent evidence would make the claim true?
4. Does that evidence exist?
5. What does the implementation actually do on the success, failure, boundary, and negative paths?

Prefer behavior over narration.

### 3. Falsify the happy story

Actively look for a counterexample to the implementation's implied story.

Check, where relevant:
- ordering of validation, authorization, mutation, and side effects;
- error and exception paths;
- state transitions and partial failure;
- null/empty/default behavior;
- trust boundaries and validation boundaries;
- concurrency and transactional assumptions;
- resource ownership and lifetime;
- stale state and caching;
- retries, idempotency, and duplicate effects;
- input/output units and conversions;
- security invariants;
- negative permissions;
- configuration fallbacks;
- caller/callee contract mismatch;
- tests that prove their own fixture or mock rather than the requirement;
- comments that describe a different program than the one executing.

Use [references/REVIEW-HEURISTICS.md](references/REVIEW-HEURISTICS.md) when a claim looks persuasive but its evidentiary value is unclear.

### 4. Verify provenance only when it matters

If correctness depends on a ticket, standard, API contract, citation, CVE, documentation page, design decision, or other external source:

- inspect the source if available;
- verify that it says what the code/comment claims;
- distinguish "reference exists" from "reference supports this behavior";
- distinguish a ticket identifier from a requirement;
- distinguish a historical decision from a current requirement.

If the source is unavailable, do not manufacture the missing requirement. State precisely what remains unverified.

"By design" is a hypothesis until the relevant design evidence supports it.

### 5. Audit tests as evidence

A passing test is useful only to the extent that its oracle is independent and meaningful.

Ask:
- Does the test encode externally expected behavior, or merely mirror the implementation?
- Is the expected value derived from the same function, constant, fixture, or assumption being tested?
- Does the mock permit behavior the real dependency would reject?
- Is the asserted property actually the property at risk?
- Are negative and boundary cases absent exactly where the implementation's claim is strongest?
- Is the test green because the suspicious path never executes?

Do not report "missing tests" as a substitute for finding a behavioral defect unless test coverage itself is an explicit requirement.

### 6. Promote only evidence-backed findings

Before writing a finding, establish:

- **Observation:** what the code demonstrably does.
- **Contradiction:** what invariant, requirement, API contract, security property, or internally claimed behavior it violates.
- **Evidence:** specific code paths, references, tests, commands, or reproducible reasoning.
- **Consequence:** what can actually happen because of it.

If one of these is missing, continue investigating or omit the finding.

If the only issue is "this looks suspicious", it is not a finding.

### 7. Write the factual core first

Write the technical finding without humor first.

It must survive deletion of every joke.

Then add the satirical wrapper.

Use [references/FINDING-STYLE.md](references/FINDING-STYLE.md) for output format and satire constraints.

## Evidence hierarchy

Prefer stronger evidence over weaker rhetorical signals:

1. Reproduced observable behavior or an unavoidable execution path.
2. Direct control-flow/data-flow reasoning from inspected code.
3. An independent test or contract demonstrating expected behavior.
4. An authoritative external requirement or API specification that was actually inspected.
5. Project documentation or ticket content that was actually inspected and is applicable.
6. Comments, names, test titles, ticket IDs, citations, and confident prose.

Level 6 can tell you **what to verify**. It does not establish correctness.

## Handling ambiguity

Do not turn uncertainty into comedy.

If behavior may be valid under an unavailable requirement:
- do not call it a defect;
- state that the apparent contradiction depends on an unverified requirement only if that uncertainty itself is materially useful to the user.

If multiple interpretations are plausible, investigate before choosing one.

If evidence disproves the suspicious hypothesis, drop it without comment. The purpose is review accuracy, not winning an argument with the code.

## Humor boundary

Satire is an output device, never a reasoning primitive.

The joke should target the mismatch between the implementation's presentation and its actual behavior.

Good targets:
- a three-paragraph guarantee contradicted by one executable line;
- a test whose mock carefully agrees with itself;
- a "safety" helper called after the dangerous operation;
- a ticket ID used as if it were executable specification;
- a comment promising an invariant the code never enforces;
- a provenance citation that exists but supports something else.

Do not target:
- the presumed author;
- intelligence or competence;
- personal characteristics;
- AI generation itself;
- motives that cannot be established.

Never say the author "tried to deceive reviewers" unless there is independent evidence of intent. Describe the observable persuasion pattern instead.

## Output

Return findings only. Do not include fixes.

For each confirmed finding use:

### <memorable satirical title>

**Finding:** <one precise, non-humorous statement of the defect>

**Evidence:** <specific files/lines, execution path, test behavior, contract, or inspected source>

**Why it matters:** <concrete consequence>

**The story:** <2-5 sentences of satire based strictly on the established contradiction>

**Confidence:** `confirmed` | `strongly-supported` | `requirement-dependent`

Rules:
- The title may be funny; `Finding`, `Evidence`, and `Why it matters` must be literal.
- The story must not introduce facts absent from the evidence.
- Prefer one strong joke to several weak jokes.
- Do not append a remediation section.
- Do not add generic praise or a review summary before the findings.
- If there are no evidence-backed findings, say: `No evidence-backed findings.`

## Final self-check

Before returning each finding, ask:

- Would this still be a valid finding if all comments were deleted?
- Am I relying on a name, ticket ID, citation, or confident explanation as an oracle?
- Did I independently establish the expected behavior?
- Did I inspect the relevant negative/failure path?
- Is the evidence stronger than the rhetoric I am criticizing?
- Does the joke describe the contradiction rather than invent intent?
- Did I accidentally suggest or implement a fix?
- Would I make the same factual finding if I did not know the code was AI-generated?

If any answer undermines the finding, investigate further or remove it.
