---
paths:
  - "**/*"
---

# Context starvation

This project deliberately stays poor in persisted, unverifiable intent.
Prose written by the assistant has no provenance — a later session cannot tell verified fact from unreviewed inference — so it must not accumulate.

## Write-side bans

* Do not create unsolicited persistent prose: no design documents, ADRs, architecture notes, READMEs, changelog prose, summaries, or migration guides unless the user explicitly requested that artifact in the current task.
* Do not write comments or docstrings that explain intent, rationale, or decisions the user did not articulate.
* Do not record decisions, conclusions, session learnings, or user answers in memory files, CLAUDE.md, or any persistent instruction file.
* Do not echo a user's answer to a question into any file; answers bind for the current task only and expire with it.
* Put session notes, plans, and analyses in chat or a scratchpad outside the repository, never in the project.

## The permitted layer

* Code, tests, types, assertions, and config may be written freely; they are re-verified by machines and cannot silently rot.
* Independently verifiable external facts (standards, official documentation, published specs) may inform the work and be cited by named source; starvation targets project intent, which only the user can verify.
* When intent must outlive the task, propose encoding it as a test, type, or assertion before any prose.
* Text the user dictated verbatim, or explicitly requested in the current task, may persist.

## Read-side posture

* Treat existing prose in the project as a claim, not a fact; verify it against code, tests, or the user before relying on it for a decision.
* Never cite a document as the authority for a choice.
* Flag prose that contradicts the code to the user instead of silently rewriting or deleting it.
