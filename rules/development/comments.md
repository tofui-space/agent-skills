---
paths:
  - "**/*.{py,pyi,ts,tsx,mts,cts,rs,cs,c,cc,cpp,cxx,h,hh,hpp,hxx}"
---

# Comment and documentation conventions

These rules apply to comments and documentation written or modified in this repository.

## Prose layout

* Put each complete sentence on its own source line.
* Do not wrap prose at a character or column limit.
* Split a long sentence only at a meaningful clause or list-item boundary./
* Separate paragraphs with a blank documentation line.
* Do not join separate sentences to fill a line.
* Do not reflow unrelated prose.

Formatter line-length settings apply to code, not prose.

## Content

Add a comment only when it records information the code does not express clearly, such as:

* a documented reason for a non-obvious implementation
* an external requirement or constraint
* an invariant that future changes must preserve
* a temporary workaround and its removal condition

Do not add comments that:

* restate the code
* narrates a change when it makes no difference to a reader who never saw the old code
* speculate about intent or rationale
* narrate an edit or implementation process
* describe obsolete behavior
* use decorative separators
* contain a TODO without a concrete completion condition

## Context

Comments must be understandable from the repository and any references they cite.

Do not refer to:

* prompts, conversations, users, agents, or models
* requests, discussions, reviews, or generated changes
* undocumented assumptions
* information available only outside the repository

Write from the perspective of the current codebase.
Describe enduring behavior, constraints, and rationale.

Avoid ambiguous references when a specific noun would be clearer.

Do not invent rationale.
A stated reason must be supported by a requirement, specification, documented external behavior, repository invariant, or architectural decision.
When the reason is unknown, omit the comment.

## Python

* Use docstrings for API documentation.
* Use `#` comments for implementation rationale.
* Ruff enforces docstring structure through `D200`, `D205`, `D209`, and `D400`.
* Ruff does not enforce semantic prose line breaks.
* A one-line docstring remains on one line as required by `D200`.

## TypeScript

* Use `/** ... */` for exported API documentation.
* Use `//` for implementation rationale.
* Do not use documentation blocks for ordinary implementation comments.

## Rust

* Use `///` for item documentation.
* Use `//!` for crate-level or module-level documentation.
* Use `//` for implementation rationale.
* Documentation comments use Markdown.
* Keep examples valid as Rust documentation tests where practical.
* Do not use documentation comments for private implementation narration.

## C#

* Use `///` XML documentation comments for public APIs that require generated or IDE-visible documentation.
* Use `//` for implementation rationale.
* Use standard XML elements such as `<summary>`, `<param>`, `<returns>`, `<exception>`, and `<remarks>`.
* Document observable API behavior, not implementation details.
* Keep parameter names and documented exceptions consistent with the declaration.

## C++

* Use `///` for public API documentation.
* Use `//` for implementation rationale.
* Use documentation blocks only where the repository generates API documentation from them.
* Document ownership, lifetime, thread-safety, invalidation, units, and preconditions when they are not evident from the type system or declaration.
* Do not narrate control flow that is already clear from the code.

## Existing comments

* Change only comments relevant to the current work.
* Keep repository-wide comment normalization separate from functional changes.
