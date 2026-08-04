# Activities — the lifecycle layer (Axis 1)

> Friction is paid per activity. Weight by FREQUENCY in context. Each activity: what creates friction, which
> mechanism it chiefly loads. Tags [E]/[C]/[O]. WIDE-SWEEP: seeded; most need depth.

## Weighting rule
Identify the 2–3 highest-frequency activities for THIS code, then optimize for those. Optimizing a rare
activity at a frequent one's expense is the most common DX error. Frequency varies enormously by context
(shared library: read/reviewed >> written; prototype: written, rarely reviewed).

## Activities
- **Onboarding** — time to first correct change. Loads: cognitive load (system mental model), feedback loops
  (env setup). Helped by discoverable docs (Diátaxis), full-word names, ADRs. [C/E]
- **Implementing** — writing against existing code. Loads: cognitive load, feedback loops (inner loop).
- **Reading / exploring** — navigating to find/understand. Loads: cognitive load. Extraction-for-brevity can
  raise it (call-stack chasing). [O]
- **Understanding design** — intent, invariants, why. Loads: cognitive load. ~+42% felt productivity when
  high (DevEx in Action). [E-perceptual]
- **Extending** — adding along the grain. Loads: cognitive load; depends on boundary fit.
- **Maintaining** — fixing/adjusting over time. Loads: cognitive load. Dominant in mature products.
- **Updating dependencies** — surviving upstream change + security patches. Loads: feedback loops,
  cognitive load. DEPTH TODO: supply-chain friction quantification.
- **Reviewing** — reading a change well enough to approve. Empirically mostly about **understanding** the
  change + knowledge transfer + team awareness, NOT defect-finding. Tools poorly support understanding needs.
  [E] Bacchelli & Bird 2013, https://www.microsoft.com/en-us/research/publication/expectations-outcomes-and-challenges-of-modern-code-review/
- **Refactoring** — restructure without behavior change. Loads: feedback loops (test trust), cognitive load.
- **Testing** — writing/running/trusting/changing tests. Loads: feedback loops (speed, flakiness). DEPTH TODO.
- **Debugging / analyzing** — Loads: feedback loops, flow. Cross-boundary debugging is costly in distributed
  systems. DEPTH TODO: observability DX.
