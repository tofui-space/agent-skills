# Mechanisms — the "why" layer (Axis 2)

> The three friction mechanisms from the DevEx framework. They explain WHY a choice is good/bad DX, which is
> more durable than asserting THAT it is. Every tradeoff rule names the mechanism it loads.
> Tags: [E] empirical · [E-perceptual] self-report · [C] consensus · [O] opinion · (contested).

## Foundations
- DX concept origin: Fagerholm & Münch 2012 — three dimensions from the "trilogy of mind": cognition,
  affect, conation. [E] https://arxiv.org/abs/1312.1452
- Actionable DX Framework (think/feel/value): Greiler, Storey, Noda, IEEE TSE 2022. [E]
  https://arxiv.org/pdf/2205.06352
- DevEx three dimensions (this model's Axis 2): Noda, Storey, Forsgren, Greiler, ACM Queue 2023 — 25
  sociotechnical factors distilled to feedback loops, cognitive load, flow. [C synth E]
  https://queue.acm.org/detail.cfm?id=3595878
- Predictive evidence: "DevEx in Action", ACM Queue 2023/24 (PLS-SEM, n=219). Flow + low cognitive load
  fully predict outcomes; feedback loops partially. Self-reported magnitudes (perceptual): high code
  understanding ~+42% felt productivity; intuitive tools ~+50% felt innovation; protected deep-work time
  ~+50% felt productivity; fast Q&A teams ~50% less tech debt. [E-perceptual] (selection bias: DevEx-engaged
  firms) https://queue.acm.org/detail.cfm?id=3639443
- SPACE (don't reduce productivity to one metric): Forsgren et al., ACM Queue 2021. [C]
  https://queue.acm.org/detail.cfm?id=3454124
- Developer (un)happiness: Graziotin et al. 2018 — top blockers: being stuck, time pressure, bad code
  quality. [E] https://www.sciencedirect.com/science/article/pii/S0164121218300323
- Theory: Sweller, cognitive load (1988) — intrinsic / extraneous / germane load; Csikszentmihalyi, flow.

## Feedback loops
Speed + quality of response to an action: build, test, type-check, lint, review turnaround, env setup, deploy.
Slow loops interrupt, force task-switching, and break flow. Optimize the HIGH-FREQUENCY loop (inner-loop
edit→signal) before the rare one. Adding tooling can itself raise cognitive load — net effect matters. [E/C]
DEPTH TODO: quantitative inner-loop/build-time thresholds; flaky-test cost on flow.

## Cognitive load
Mental processing the task demands. Minimize **extraneous** load (incidental complexity: indirection to
chase, undocumented conventions, tooling sprawl); preserve capacity for **intrinsic** load (the real
problem). Most code-shaping tradeoffs are really extraneous-load arguments. Platform "golden paths" exist to
cut extraneous load. [E/C]

## Flow state
Sustained focus. Protected by long uninterrupted blocks and fast feedback; destroyed by interruptions,
context-switches, and waiting. Strongest predictor of perceived outcomes in DevEx-in-Action. [E-perceptual]
