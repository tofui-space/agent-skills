# Scaffold templates by language

Read this when scaffolding in a language whose documentation-comment placement or empty-body idiom you cannot write idiomatically from memory. Three things change per language and the rest of the loop does not: **where the doc block sits** relative to the declaration, **which empty body compiles or runs**, and **which comment syntax carries the `TODO(cdd)` inline marker**.

Every template below keeps the same invariants: a provisional name, no parameters, no return type, a block of questions rather than draft prose, and a body that fails loudly if something calls it before the user has written the comment.

## Python

Docstring inside the declaration. Rationale comments use `#`.

```python
def next_departure():
    """
    TODO(cdd) — write this comment. It decides the design.

    Exists because: <what the task needs from this unit>

    Settle at least: <the specific open questions>

    Rename if a better name falls out of writing this.
    """
    raise NotImplementedError
```

A class scaffold carries the class docstring and no methods — the methods are part of the interface, so they come out of the comment.

## TypeScript / JavaScript

`/** ... */` above the declaration for the interface comment; `//` for rationale.

```ts
/**
 * TODO(cdd) — write this comment. It decides the design.
 *
 * Exists because: ...
 * Settle at least: ...
 */
export function nextDeparture() {
  throw new Error("not implemented");
}
```

Leave the return type off entirely rather than writing `: unknown` — an annotation is a design decision, and the point is that it has not been made yet.

## Go

`//` above the declaration, no blank line between. Go convention starts the doc comment with the identifier name, which interacts with keeping the user's wording verbatim: put that convention in the stub as one of the things to settle, so the user writes an opening sentence that starts with the name. If they do not, ask — do not silently reword it into convention.

```go
// TODO(cdd) — write this comment. It decides the design.
//
// Exists because: ...
// Settle at least: ... (Go doc comments open with the identifier name,
// so start your first sentence with NextDeparture.)
func NextDeparture() {
	panic("not implemented")
}
```

Package-level scaffolds go above the `package` clause, or in `doc.go` when long.

## Rust

`///` above the item, `//!` for module- or crate-level. `todo!()` compiles in any return position, which is what makes it the right empty body here.

```rust
/// TODO(cdd) — write this comment. It decides the design.
///
/// Exists because: ...
/// Settle at least: ...
pub fn next_departure() {
    todo!()
}
```

## Java

Javadoc above the declaration.

```java
/**
 * TODO(cdd) — write this comment. It decides the design.
 *
 * Exists because: ...
 * Settle at least: ...
 */
public static Object nextDeparture() {
    throw new UnsupportedOperationException("not implemented");
}
```

Java forces a return type even on a stub. `Object` is a placeholder, not a proposal — say so when handing off, and replace it from the comment.

## Kotlin

KDoc above the declaration. `TODO()` returns `Nothing`, so it satisfies any declared return type and needs none.

```kotlin
/**
 * TODO(cdd) — write this comment. It decides the design.
 *
 * Exists because: ...
 * Settle at least: ...
 */
fun nextDeparture() = TODO()
```

## C#

XML documentation above the declaration. Wrap the user's prose in `<summary>` when you generate — that is structural markup around their words, not authored prose. Do not invent `<param>` or `<returns>` text they did not write; derive the tags' *names* from the signature you generate and ask the user to fill them, or leave the prose as one summary.

```csharp
/// <summary>
/// TODO(cdd) — write this comment. It decides the design.
///
/// Exists because: ...
/// Settle at least: ...
/// </summary>
public static object NextDeparture()
{
    throw new NotImplementedException();
}
```

## C++

`///` on the declaration in the header — that is where the contract belongs and where a reader looks for it. Implementation rationale goes on the definition.

```cpp
/// TODO(cdd) — write this comment. It decides the design.
///
/// Exists because: ...
/// Settle at least: ownership, lifetime, thread-safety, units,
/// and what invalidates the result.
auto next_departure() -> void;
```

C++ hides more in the type system than most languages surfaces, so the questions worth listing in the stub are usually ownership, lifetime, and invalidation.

## When the signature is not the user's to choose

Sometimes a new unit must implement an interface, trait, abstract base, or protocol that already exists — an override, a trait impl, a handler matching a framework's expected shape. The signature is then fixed by something outside this unit, and scaffolding it without parameters would be a lie.

Scaffold it with the required signature, and say in the handoff that the signature came from `<the interface it implements>` and is not provisional. The comment still comes first and still decides everything the signature does not: what this particular implementation guarantees beyond the interface's contract, what it does at the edges, and what callers of *this* implementation can rely on.

## Inline marker syntax

The `TODO(cdd)` marker has to be greppable in one pass across a mixed-language repository, so keep the token identical everywhere and vary only the comment syntax:

| Language | Marker line |
|---|---|
| Python, Ruby, shell | `# TODO(cdd): <the question>` |
| TypeScript, Go, Rust, Java, Kotlin, C#, C++ | `// TODO(cdd): <the question>` |
| XML, HTML | `<!-- TODO(cdd): <the question> -->` |

Before reporting work finished: `grep -rn 'TODO(cdd)' <changed paths>` and resolve every hit.
