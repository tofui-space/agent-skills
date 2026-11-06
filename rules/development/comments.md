---
paths:
  - "**/*.{py,pyi,ts,tsx,mts,cts,js,jsx,mjs,cjs,rs,go,cs,kt,kts,java,c,cc,cpp,cxx,ixx,cppm,inl,ipp,h,hh,hpp,hxx,xml}"
---

# Comment and documentation conventions

These rules apply to comments and documentation written or modified in this repository.

## Contents

- Prose layout
- Content
- Context
- Python
- TypeScript and JavaScript
- Rust
- Go
- C
- C#
- C++
- Kotlin
- Java
- Android
- Existing comments

## Prose layout

When the repository's formatter, linter, or style guide sets a line length for comments or reflows them, follow it; the rules below apply where it leaves the layout open.
Tools that do this include clang-format with `ReflowComments`, google-java-format, ktfmt, detekt `MaxLineLength`, Checkstyle `LineLength`, and Ruff `E501` and `W505`.

* Put each complete sentence on its own source line.
* Do not wrap prose at a character or column limit.
* Split a long sentence only at a meaningful clause or list-item boundary.
* Separate paragraphs with a blank documentation line.
* Do not join separate sentences to fill a line.
* Do not reflow unrelated prose.

## Content

Add an implementation comment only when it records information the code does not express clearly, such as:

* a documented reason for a non-obvious implementation
* an external requirement or constraint
* an invariant that future changes must preserve
* a temporary workaround and its removal condition

Do not add comments that:

* restate the code
* narrate a change when it makes no difference to a reader who never saw the old code
* speculate about intent or rationale
* narrate an edit or implementation process
* describe obsolete behavior
* use decorative separators
* contain a TODO without a concrete completion condition

Doc comments on public declarations follow the language sections below.

## Context

Comments must be understandable from the repository and any references they cite.

A comment documenting a module, function, method, or class is the abstract interface to the implementation and should not restate the implementation details; only provide the user with the necessary information on how to use it.

Do not refer to:

* the conversation, prompt, or AI agent that produced the change, or the person who requested it
* requests, discussions, reviews, or generated changes
* undocumented assumptions
* information a reader cannot reach from the comment, such as an uncited conversation or a ticket without an ID or link

Write from the perspective of the current codebase.
Describe enduring behavior, constraints, and rationale.

Avoid ambiguous references when a specific noun would be clearer.

Do not invent rationale.
A stated reason must be supported by a requirement, specification, documented external behavior, repository invariant, or architectural decision.
When the reason is unknown, omit the comment.

## Python

* Use docstrings for API documentation.
* Use `#` comments for implementation rationale.
* Begin a docstring with a one-sentence summary on its first line, followed by a blank line when more text follows (PEP 257).
* A docstring that is only a summary keeps its opening and closing quotes on the same line.
* When the repository selects them, Ruff checks docstring structure through `D200`, `D205`, `D209`, and `D400`.
* Ruff does not enforce semantic prose line breaks.

## TypeScript and JavaScript

* Use `/** ... */` for exported API documentation.
* Use `//` for implementation rationale.
* Do not use documentation blocks for ordinary implementation comments.
* In TypeScript, write `@param name - description`, with no JSDoc `{type}` or `[name]`; TSDoc reports both (`tsdoc-param-tag-with-invalid-type`, `tsdoc-param-tag-with-invalid-optional-name`).
* In JavaScript, JSDoc `{type}` annotations are the type declarations the TypeScript checker reads, so update them with the code they describe.

## Rust

* Use `///` for item documentation.
* Use `//!` for crate-level or module-level documentation.
* Use `//` for implementation rationale.
* Documentation comments use Markdown.
* Keep examples valid as Rust documentation tests where practical.
* Do not use documentation comments for private implementation narration.

## Go

* Use `//` for both documentation and implementation rationale; Go has no separate documentation syntax.
* Begin a doc comment with the name of the identifier it documents, directly above the declaration, with no blank line between.
* Document every exported identifier, and each unexported type or function whose behavior is not obvious.
* Put package documentation above a single `package` clause, or in `doc.go` when it is long.
* Document the sentinel errors and error types a function can return, and whether a value is safe for concurrent use.
* Document goroutine ownership and cancellation: who starts it, what stops it, which context governs it.
* Doc comment syntax makes indented lines code blocks, and `gofmt` reformats them as code, so do not indent prose.
* Use `//` for doc comments; reserve `/* ... */` for package comments.

## C

* Use the documentation comment style the repository already uses: Doxygen `/** ... */` or `///`, or kernel-doc `/** ... */` in kernel-style code.
* Use documentation blocks only where the repository generates API documentation from them.
* Use `//` or `/* ... */` for implementation rationale; code compiled as C89 or C90 accepts only `/* ... */`.
* A `.h` header that C sources include follows this section, even when C++ sources include it too.
* In kernel-doc, state the `Context:` (whether the function can sleep, and which locks it takes or expects held) and the `Return:` value.

## C#

* Use `///` XML documentation comments for public APIs that require generated or IDE-visible documentation.
* Use `//` for implementation rationale.
* Use standard XML elements such as `<summary>`, `<param>`, `<returns>`, `<exception>`, and `<remarks>`.
* Document observable API behavior, not implementation details.
* Keep parameter names and documented exceptions consistent with the declaration.
* Document cancellation, disposal, and thread-affinity requirements that the signature does not express.
* Do not restate nullability that the nullable reference type annotations already state.

## C++

* Use `///` for public API documentation.
* Use `//` for implementation rationale.
* Use documentation blocks only where the repository generates API documentation from them.
* Document ownership, lifetime, thread-safety, invalidation, units, and preconditions when they are not evident from the type system or declaration.
* Document the exception and error contract, including functions that are `noexcept` by intent rather than by declaration.
* Document why a template constraint, specialization, or overload exists when the mechanism is not self-evident.
* Keep header documentation on the declaration, and rationale on the definition, so a reader of the header sees the contract once.
* Do not narrate control flow that is already clear from the code.

## Kotlin

* Use `/** ... */` KDoc for public and internal API documentation.
* Use `//` for implementation rationale.
* Describe parameters and the return value in the prose, linking each parameter as `[name]`; use `@param` and `@return` only for a description too long for the prose, or where the codebase follows the AndroidX Compose API guidelines, which require `@param`.
* Use `@throws`, `@receiver`, and `@sample` where they apply, and reference symbols as `[Symbol]`.
* Document the threading and suspension contract: which dispatcher a `suspend` function expects, and how it responds to cancellation.
* Document nullability only where the type system cannot, such as platform types crossing a Java boundary.
* Do not document an override that adds nothing to the declaration it overrides.
* Do not repeat a default value, visibility, or type that the declaration already states.

## Java

* Use `/** ... */` Javadoc, or `///` Markdown Javadoc on JDK 23 and later, for public and protected API documentation.
* Use `//` for implementation rationale.
* Use `@param`, `@return`, `@throws`, `{@link}`, and `{@code}`.
* Document thread-safety, mutability, and ownership of returned collections and arrays.
* Document unchecked exceptions a caller is expected to handle, alongside the declared checked ones.
* Do not restate what `@Override`, `@Nullable`, or a functional interface already states.

## Android

These rules apply to Android sources in any of the languages above.

* Document an API-level branch with the behavior each branch provides, not the version number alone, which `Build.VERSION` already states.
* Record the requirement behind a permission check or a `@RequiresPermission` annotation.
* Give every `@SuppressLint` and lint baseline suppression a reason and a removal condition.
* Document lifecycle ownership: the scope a coroutine or listener is bound to, and what tears it down.
* Document the required thread when no `@MainThread`, `@WorkerThread`, or `@AnyThread` annotation expresses it.
* For a composable, document state ownership, hoisting expectations, and side effects; do not narrate the emitted UI tree.
* In resource XML, use `<!-- -->` comments to record why a value exists — a platform constraint, a design token, a locale requirement — not what it is.
* Do not comment generated sources, including view bindings and build configuration fields.

## Existing comments

* Change only comments relevant to the current work.
* Keep repository-wide comment normalization separate from functional changes.
