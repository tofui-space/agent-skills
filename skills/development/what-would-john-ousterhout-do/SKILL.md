---
name: what-would-john-ousterhout-do
description: Apply John Ousterhout's "A Philosophy of Software Design" (2nd ed.) as a structured method to review specific code for complexity problems or to guide the design of a specific module, interface, or abstraction. Trigger ONLY when the user issues it as a command aimed at concrete code or a concrete design task — "what would John Ousterhout do (with this)", "WWJOD", "/ousterhout", "Ousterhout review", "APOSD review". Do NOT trigger when the user merely discusses, asks about, or cites Ousterhout, APOSD, or software design philosophy without requesting a review or design ("what does Ousterhout say about comments?" is discussion — answer directly). Do NOT trigger proactively on general refactoring, code review, or API design requests that don't invoke it.
---

# What Would John Ousterhout Do

Apply the design philosophy from *A Philosophy of Software Design* (John Ousterhout, 2nd edition) to a concrete problem the user brings: either **review** existing code/architecture, or **guide** a design that does not exist yet.

The skill exists because generic "clean code" advice often pulls in the wrong direction (many tiny classes, comment-free code, defensive checks everywhere). Ousterhout's framework is specific and sometimes contrarian; apply *his* positions, not a blend of popular opinion. Where his advice conflicts with common practice (e.g., "modules should be deep" vs. "classes should be small"; "comments are essential" vs. "good code is self-documenting"), take his side and say so explicitly.

## Core thesis — hold this frame throughout

**Complexity is the single enemy.** Complexity is anything about the structure of a system that makes it hard to understand or modify. It has two causes:

1. **Dependencies** — code cannot be understood or changed in isolation.
2. **Obscurity** — important information is not obvious from the code.

And three symptoms, in increasing severity:

1. **Change amplification** — a simple change requires edits in many places.
2. **Cognitive load** — how much a developer must know to complete a task.
3. **Unknown unknowns** — it is not obvious what must be changed or known. The worst symptom: you find out via bugs.

Every recommendation you make must trace back to reducing dependencies or obscurity. If you cannot state which one a suggestion reduces, drop the suggestion.

**Complexity is incremental.** No single decision makes a system unmaintainable; hundreds of small ones do. Therefore a "zero-tolerance" stance on small complexities is justified — but weigh it against the reverse: churning working code for marginal gains has its own cost. Recommend change when the complexity is load-bearing (on a change path, in a public interface, repeated), not merely aesthetic.

## Mode selection

Determine which mode applies before responding:

- User shows existing code, a diff, or an architecture and asks for judgment → **Review mode**.
- User describes a problem, feature, or module that does not exist yet → **Design mode**.
- Both present (e.g., "here's my current code, how should I restructure it") → Review mode first to name the problems, then Design mode for the target shape.

## Review mode

1. **Read for symptoms first, style never.** Ignore formatting, naming conventions, idiom preferences unless they cause obscurity. Hunt for change amplification, cognitive load, unknown unknowns.
2. **Sweep the red-flag catalog.** Read `references/red-flags.md` and check the code against each flag. Do not report flags mechanically — a pass-through method inside an anti-corruption layer is doing its job; the flag applies when the method adds no abstraction *and* serves no boundary purpose.
3. **Rank findings by blast radius.** Interface problems outrank implementation problems: a shallow public interface taxes every caller forever; an ugly private method taxes one file. Report in that order.
4. **For each finding, give the Ousterhout diagnosis, the cost, and the concrete fix.** Format per finding:
   - **Flag**: which red flag (or principle violation), by its book name.
   - **Where**: file/function/interface.
   - **Cost**: which complexity symptom it produces, for whom (caller, maintainer, future change X).
   - **Fix**: the specific restructuring, with a sketch of the resulting interface if the fix changes one.
5. **Say what is good.** Ousterhout's method is comparative — "working code isn't enough" cuts both ways. If a module is genuinely deep, say so and say why, so the user preserves it during refactoring.
6. **End with a verdict**: is this tactical or strategic code, and what is the single highest-leverage change.

## Design mode

1. **Define the module's abstraction before its code.** Ask (or infer and state): what problem does this module solve for its callers? What should callers *not* have to know? The answer to the second question is the information to hide.
2. **Design it twice.** Produce at least two radically different designs — not variations of one idea. For each, state interface sketch, information hidden, information leaked, and how the main anticipated changes would land. Then pick one and justify the pick in terms of dependencies and obscurity. Present both designs to the user; the comparison teaches more than the winner.
3. **Make modules deep.** Interface small, functionality large. Prefer one deep module over three shallow ones even if the deep one has a longer implementation. Concretely: fewer public methods with more complete semantics; sensible defaults so the common case needs near-zero configuration ("the common case should be simple").
4. **Somewhat general-purpose.** Design the interface for the general problem class, implement only today's need. Test: would the interface change if a plausible second use case arrived? If yes, generalize the interface now — not the implementation.
5. **Pull complexity downward.** When complexity must exist, put it in the implementation, not the interface. It is more important for a module to have a simple interface than a simple implementation. Configuration parameters are a red flag here: each one exports a decision upward to someone with less context.
6. **Define errors out of existence.** Before designing error handling, redesign the operations so errors cannot occur (e.g., delete-nonexistent-file is a no-op success; substring out-of-range clamps). For errors that remain: mask at low level, or aggregate to one handler. Exceptions in the interface are part of the interface — each one makes the module shallower.
7. **Different layer, different abstraction.** If two adjacent layers have similar interfaces, one of them is not earning its existence. Merge or deepen.
8. **Comments are part of the design.** Specify, for the chosen design, what the interface comment must say: the abstraction, the contract, the things not deducible from signatures (units, ownership, invariants, whether null/None is allowed). Comments describe what code cannot: intent and abstraction. "Self-documenting code" is, in Ousterhout's words, a delusion for anything beyond trivial methods.

## Positions to hold under pushback

These are places Ousterhout deliberately contradicts popular advice. Do not soften them into consensus mush; present them as his position with his reasoning, and let the user disagree:

- **Depth over length.** "Classes/methods should be small" is not a goal. Splitting a deep method into shallow fragments *adds* complexity (more interfaces, more places to look). Split only when the pieces are independently useful abstractions (subdivision) or when a general-purpose core separates from special-purpose wrappers.
- **Comments are not failure.** Write interface comments for every public class and method; write implementation comments for non-obvious *why*. Comment-repeats-code is the failure mode, not commenting itself.
- **Tactical tornadoes are net-negative.** Speed-first programming that ships fast and leaks complexity costs more within months. The strategic investment Ousterhout recommends is 10–20% of development time on design quality, continuously — not big-bang rewrites.
- **Exceptions are complexity.** Throwing an exception is often the easy path for the module author and the expensive path for every caller. Prefer redefining semantics so the exceptional case is normal.

## Scope discipline

- Stay language-agnostic in principle, concrete in examples. Use the user's language and stack for all sketches.
- Do not rename things, restyle code, or apply lint-level opinions unless naming causes obscurity ("Vague Name" / "Hard to Pick Name" flags). A name that is hard to pick is a design signal — say what it signals, don't just propose a better name.
- Do not invoke other methodologies (Clean Code, SOLID, DDD) as authority. If the user's codebase already follows one and Ousterhout conflicts with it, name the conflict explicitly and give his reasoning; the user decides.
- If the code sample is too small to judge depth (a single function with no callers visible), say so and review what is judgeable — usually the interface contract and error semantics — instead of speculating about the rest of the system.

## Output shape

Verdict first, findings ranked by blast radius, sketches in the user's language, and a closing "single highest-leverage change" statement. Keep prose tight; the value is in the diagnosis-cost-fix chain, not in restating the book.
