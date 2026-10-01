---
description: Evidence discipline for code review — what counts as backing for a finding before it is asserted.
---

# Code review

This rule governs what may be asserted during a review, not what to look for.
A finding is a claim about the code, and it holds only as strongly as the evidence actually gathered for it.

## Read the code as it is written

* Evaluate the code that is present, not the code the construct resembles.
* Read the whole construct — every branch, guard, default, and early return — before judging it.
* A familiar shape is not proof of familiar behavior; the deviation from the canonical form is the thing worth finding.
* Names, types, and signatures state an intention; only the body states the behavior.
* When a finding depends on a definition you have not read, open it or drop the finding.

## What does not back a claim

* Prose next to code is not corroboration.
  A comment, docstring, commit message, pull request description, or changelog entry restates a claim; it does not confirm one.
* Inferred intent does not validate code or a code change.
  "This is clearly meant to do X" is not evidence that it does X.
* Recall is not evidence.
  A remembered API signature, default, version behavior, or library convention is unverified until you read it in this repository or in a source you opened.
* External unverifiable evidence is not high provenance.
  This covers an unnamed source, a source you did not open, and anything you cannot point the user to.

## Tag every claim before asserting it

Before stating a finding, decide what backs it:

* **read** — you opened the exact lines, and they say this.
* **cited** — a named source you opened in this session says this.
* **inferred** — you reasoned from surrounding code, naming, or apparent intent.
* **unverified** — recalled, assumed, or taken from a source you did not open.

Only **read** and **cited** claims may be asserted as findings.
State an **inferred** claim as an inference, in the same sentence that makes the claim.
Do not state an **unverified** claim; verify it or drop it.
A claim that rests on several pieces of evidence takes the weakest tag among them.

## Open every citation

* Read the file, line, symbol, test, issue, or document before citing it, in this session, at the version under review.
* Cite the location you read, not the location you expect to contain the thing.
* Treat a citation from earlier in the session as stale once the file has changed.
* When a citation cannot be opened, say so and mark the claim unverified.

## A null result is not a finding

* A search that returns little proves nothing until you know how the thing would be written.
* Before concluding something is absent, confirm the search could have found it: correct paths, correct file types, no excluded directories, and every plausible spelling, alias, re-export, or dynamically constructed form.
* Search failure and absence are different results; report which one you have.

## When a comment and the code disagree

* The code is the first finding and the comment is the second one.
* Report both; do not silently prefer either.
* Do not let local consistency expedite the assessment.
  A comment that matches the code confirms only that they match, never that either is correct.
