---
name: comment-driven-development
description: "The user hand-writes the interface comment; you derive the signature and implementation from it. Once loaded, stays active for the whole session and applies to every new unit of behavior — a new file, class, function, or method, including one added to an existing file — without being asked again. Invoke on 'comment-driven development', 'CDD', 'comments first', 'comment before code', 'docstring first', 'let me write the comments', 'prompt me for the comment instead', 'I want to understand the code you write', or when a user says generated code is theirs to own but they cannot explain it. Exempt: renames, moves, extractions, formatting, config, generated files, tests whose name already states the guarantee, and edits that introduce no new abstraction."
---

# Comment-Driven Development

The user writes the comments. You write the code that matches them.

This reverses the usual order twice over — comments before implementation, and the human before the machine — and both reversals are load-bearing.

**Comments written afterwards describe the implementation, because their author now knows it.** That is how a docstring ends up saying "increments the counter by one" above `increment()`. A comment written before the code has nothing to describe except the abstraction, because the abstraction is all that exists yet. Writing it is therefore a design act, not a documentation chore.

**It is also the cheapest design test available.** If the abstraction is hard to describe — if the description needs three paragraphs, or leans on implementation detail to make sense — the abstraction is wrong. That signal only fires before the code exists. Afterwards there is a working implementation to defend and the signal goes quiet.

**And with a model generating the code, whoever writes the comment did the design.** If the agent writes both, the user reviews an artifact they had no hand in shaping, which is a far weaker form of understanding than having specified it. The usual reassurance is that tests and review will catch what the user did not notice — but when the tests and the review are produced by the same class of system that wrote the code, they share its blind spots. The human-authored comment is then the only independent specification in the loop. That is what makes it worth the friction.

## Activation and scope

Invoked once, active for the rest of the session. Do not re-decide per unit and do not ask again whether the loop applies — the user turned it on.

**In scope — every new unit of behavior:** a new file or module, a new class, a new function or method, including one added to a file that already exists. Most design happens inside existing files; exempting them would exempt the point.

**Exempt — no new abstraction is being created:** renames, moves, extractions of existing code, formatting, dependency bumps, config and manifest edits, generated or vendored files, and mechanical edits that change how existing behavior is spelled rather than what it is. Also exempt: throwaway scripts you write for your own use inside a scratch directory, which are not the user's code to own.

**Tests follow the code they test.** A test case whose name already states the guarantee needs no comment — the name is the comment, and demanding one would stall any cycle where a failing test is written first on purpose. Test helpers, fixtures, and builders are ordinary units and stay in scope. Where a test encodes an invariant its name cannot carry, that sentence is the user's to write like any other.

**Existing behavior you are modifying** is not automatically in scope, but if a change alters a documented contract, the comment stating the new contract is written by the user before the code changes — the same rule, applied to the unit that already exists.

**Delegation does not lift the loop.** A subagent handed implementation work never loaded this skill, so delegating is the quietest way to bypass it. Scaffolding is never delegated. Implementation is delegated only once the comments exist, and the brief carries them as the specification, including that the comment wins wherever code and comment disagree.

On the first invocation, confirm in one line which mode is active and what is exempt. After that, run the loop silently.

## The loop

### 1. Scaffold — and leave the design undone

Write the smallest thing that holds a place: a named shell, an empty documentation block, and a body that fails loudly if called.

```python
def next_departure():
    """
    TODO(cdd) — write this comment. It decides the design.

    This unit exists because: the schedule screen needs the next sailing
    after a given moment, and the timetable has seasonal variants.

    Settle at least:
    - what a caller gets back, in the caller's terms, not the timetable's
    - what a caller must NOT have to know to use this
    - what happens when there is no next sailing
    - time zone and what "now" means here

    Rename the function if a better name falls out of writing this.
    """
    raise NotImplementedError
```

`references/scaffold-templates.md` has the equivalent shape for TypeScript, Go, Rust, Java, Kotlin, C#, and C++ — read it when the target language is not one you can scaffold idiomatically from memory, particularly for where the doc block sits relative to the declaration and which empty-body idiom compiles.

Three things make or break this step.

**The placeholder is a question, never a draft.** If you write plausible prose, the user will read it, agree with it, and approve it — and approving is not designing. Everything in the block is context the user does not have to re-derive (why this unit exists, what the task said) plus the specific questions this comment has to settle. Nothing in it is usable as an answer.

**No interface.** No parameters, no return type, no fields, no method list. Those are the design, and the comment produces them. A name is unavoidable — offer one from the task's own vocabulary and say plainly that it is provisional.

**Scaffold one coherent slice, not the whole plan.** The units that will appear in each other's comments — one module, one vertical slice — go out in one batch, so the user can see the shape while writing. Scaffolding twelve stubs for work that needs three is a way of committing the user to a decomposition they never agreed to.

### 2. Hand off and stop

Say which files have stubs, in what order they make sense to fill, and stop. Do not keep working on the pending units, do not draft "something to adjust", and do not prepare an implementation in the background to paste in once the comment lands — an implementation you already have will bend the comment towards itself.

While waiting you may finish exempt work that is independent of the pending units. Anything else waits.

### 3. Read the comment before generating from it

When the user reports back, read what they wrote and decide whether you can generate from it. Silence, a thumbs-up, or a one-word "ok" is not a comment: if the block is still the stub you wrote, the loop has not advanced, and saying so is more use than generating from nothing. You are checking two different things.

**Is it complete enough to build from?** The comment has to settle what a signature cannot: units, encodings, ranges, time zones; ownership and lifetime, including whether a returned value aliases internal state; the contract at the edges — empty input, absent result, concurrent use, ordering guarantees; side effects beyond the return value; and what the caller is being spared from knowing.

Where a gap would change observable behavior, ask — once, batched, naming each open point and what you would otherwise assume. Where it would only change implementation, choose, generate, and say in chat which way you went. Do not write the answer into the comment yourself.

**Does the comment reveal a design problem?** This is the payoff of writing it first, so say so when you see it:

- It restates the name and nothing more → there is no abstraction here yet, or the unit is trivial and that is fine — distinguish the two rather than accepting either silently.
- It has to describe the implementation to make sense → the abstraction is leaking. The interface is the thing to change, not the prose.
- It describes two or three unrelated jobs → this is two or three units.
- It is mostly modes, flags, and conditions → the interface is shallow; the complexity is being exported to every caller.

Report the observation and what you would change. The user decides; if they keep the design, build what they wrote.

### 4. Generate

**The comment is the specification.** Where code and comment disagree, the comment wins. If what it asks for is impossible or self-contradictory, stop and say which part, rather than quietly building the nearest achievable thing.

**The user's wording survives verbatim.** Fix obvious spelling and typing slips; change nothing else. Do not tighten, restructure, expand, translate into house docstring tags, or "make it consistent" — a comment the agent rewrote is a comment the user no longer wrote, and the ownership this skill exists to create is gone. Reformatting to a house style happens only when the user asks, and then show them the before and after.

Derive from the comment: the name, if writing it produced a better one; the parameters and their types; the return type; the error contract; and the implementation. Then report in chat what you derived and what you assumed — that belongs in the conversation, not in the file.

## Inline comments: stub, don't invent

A generated implementation usually contains a few decisions that the code cannot express — a bound, a workaround, an ordering that matters, a branch that exists for a reason nothing nearby states. Mark each one and leave it empty:

```python
    # TODO(cdd): why this window and not the whole timetable — one line, then delete this marker.
```

Stub the ones whose answer lives outside the code: an external requirement, a business rule, an upstream system's behavior, a constraint you cannot see from the repository. Those are genuinely the user's to write, and no one else can.

For decisions you made yourself while implementing, still stub rather than write — but offer your reasoning in chat so the user can use it, discard it, or override it. Writing the rationale straight into the file would mean inventing justification for a choice the user never made, and a stated reason nobody stands behind is worse than no comment at all.

Do not stub what the code already says clearly. A comment that narrates the line below it is noise, and producing it in bulk is a good way to get the whole practice abandoned.

**No `TODO(cdd)` marker survives.** Before reporting work finished, and before any commit, grep for the marker. Every one is either filled by the user or — with the user's agreement — removed as unnecessary. A leftover scaffolding marker is exactly the kind of open-ended TODO that rots in a codebase for years.

## Console mode

The default is in-file, because the comment's final home is the file: line breaks, width, and position relative to the code all change how it reads, and the user should see it where it will live.

Switch to console mode in three cases: a single small unit, a file that does not exist yet, or a user who says they are away from the editor. Ask the same content the stub would have carried, in chat. When the user answers, write the comment and the implementation together in one edit, with the comment exactly as typed apart from obvious typos, and show it in place so they can see how it reads in the file.

Everything else is unchanged: the comment still comes first, it is still the specification, and it is still theirs.

## Standing down

If the user says to just write a particular unit, do that, note it once, and do not raise it again for that unit. If they turn the skill off, it is off for the session. Explicit instruction outranks the loop every time — the practice exists to serve the user's understanding of their own code, and they are the judge of when it is worth the cost.

Against anything else that owns the order in which a unit gets created — a test written first, a spike, a scaffolding generator, another active instruction — that order stands, and the loop applies to what it produces rather than blocking it. Where the two genuinely cannot both hold, say in one line which you are following and why, instead of silently dropping either.
