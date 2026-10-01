# Cryptic patterns — 12 patterns

Scan the source for each pattern. Every example is invented.

| # | Pattern | Cryptic example | Rewrite |
|---|---|---|---|
| 1 | Telegraphic fragment | `Cache miss → retry storm. Fix: jitter.` | Cache misses make many clients retry at the same moment. Fix: add a random delay (jitter) to each retry. |
| 2 | Symbol in place of a verb | `v2 ⇒ breaking for FE` | Version 2 breaks the frontend. |
| 3 | Status symbols | `lint ✓ tests ✗ types ~` | Linting passes. Tests fail. Type checking passes with warnings. |
| 4 | Coined label | `the stale-mirror issue` | Resolve from the session: "The read replica returns data up to 30 seconds old." |
| 5 | Session reference | `same as option 2 above` | Replace with the content of option 2. |
| 6 | Claude skill or tool name | `distill it, then run no-confabulation` | Summarize the text. Then flag every sentence that has no checkable meaning. |
| 7 | Implied verdict | `A is simpler; B scales.` | Decision: use A. Reason: the expected load stays below B's advantage point. (Confirm the decision with the user if the session does not state it.) |
| 8 | Stacked slashes and parentheses | `config (env/file/flag) precedence (last wins?)` | Configuration comes from three sources: environment variables, a file, and command-line flags. Uncertain: the last source read probably takes precedence. |
| 9 | Undefined abbreviation | `SoT for DoD is the tracker` | The issue tracker is the single source of truth for the definition of done. |
| 10 | Bare hedge marker | `works (mostly)` | Works in all tested cases except concurrent writes. (State the exception, or mark the claim "Uncertain".) |
| 11 | Fragment-only bullet tree | `- auth` / `  - tokens` / `    - rotate?` | Open question: should the authentication module rotate its tokens? |
| 12 | Vague file pointer | `see the spec` | See `docs/spec/payments.md`, section "Refunds". |

## Two warnings

**Arrows carry several meanings.** `A → B` can mean "A causes B", "A, then B", "A becomes B", or "A calls B". Pick the meaning from context. If context does not decide it, ask.

**A coined label can look like a real term.** Labels such as "Tier-B fields" or "the drift problem" read like established vocabulary. Check whether the term exists outside the session before keeping it.
