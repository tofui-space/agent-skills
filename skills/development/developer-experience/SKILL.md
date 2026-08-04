---
name: developer-experience
description: >-
  Reason about developer experience (DX) as friction-minimization across the developer lifecycle, using an
  Activity × Mechanism model and CONDITIONAL rules — never a good/bad checklist. Use this skill EVERY time
  the user writes "DX" or "developer experience", AND on any DX-adjacent task even when DX is not named:
  refactoring, code review, API or interface design, project scaffolding, choosing a library or pattern,
  naming, file/module organization, or deciding between implementation options. Provides four explicit
  paths — DX-review, DX-redesign, DX-decide, DX-elicit — plus a default silent mode that improves reasoning
  without emitting a DX section. Do not skip this skill just because the task looks routine; routine
  code-shaping decisions are exactly where the shallow DX reflex does damage.
---

# Developer Experience

## Why this skill exists

Your trained reflex on "DX" fires a checklist: boilerplate bad, modular good, library good, structure good,
reusable helpers good, comments good, coupling bad, long code bad, short code good, conventions good. **Every
item on that list is conditional.** The research record (see references/) repeatedly shows the right answer
flips on context — code volatility, reader expertise, team size/maturity, and (critically) whether coupling
is *structural* or *logical/co-change*. There is no DX handbook because the answer genuinely depends.

This skill does not give rules. It gives a **model** for locating the decision, a **protocol** that forces
context and constraints before judgment, and a knowledge base of **conditional rules** — each of the form
*prefer X when …, prefer not-X when …, overridden by …*. A bare verdict ("extract the duplication") is the
failure mode this skill exists to prevent.

## The model: Activity × Mechanism

DX is the friction developers encounter across the lifecycle. Locate any decision on two axes.

**Axis 1 — Activity (what is being done, and how often).** Friction is paid per activity: onboarding,
implementing, reading/exploring, understanding design, extending, maintaining, updating dependencies,
reviewing, refactoring, testing, debugging/analyzing. **Weight by frequency in the actual context** —
optimizing a rare activity at the expense of a frequent one is the most common DX mistake. (A shared library
is read/reviewed far more than written; a throwaway script is written once.)

**Axis 2 — Mechanism (why it is friction).** The empirically-distilled DevEx dimensions explain *why* a
choice helps or hurts, rather than asserting *that* it does. [E]
- **Feedback loops** — speed and quality of response to an action (build, test, types, review turnaround).
- **Cognitive load** — mental processing the task demands; minimize *extraneous* load (incidental
  complexity), protect capacity for *intrinsic* load (the real problem).
- **Flow state** — ability to stay in energized focus; interruptions and slow loops break it.
(Noda, Storey, Forsgren, Greiler, ACM Queue 2023; predictive evidence in "DevEx in Action" 2024 — see
references/mechanisms.md.)

Good DX = shorter feedback loops, lower extraneous cognitive load, protected flow — **for the activities that
dominate this context.** Every conditional rule names the mechanism it loads, which is the durable "why."

**Overlays (not the spine):**
- **Altitude** — code / API / architecture / tooling / documentation. A *tag* on each rule, because most DX
  knowledge spans altitudes. Not an organizing silo (siloing duplicates cross-cutting knowledge).
- **Constraint regime** — safety/real-time, security/attack-surface, regulatory/legal. Hard **gates**
  evaluated first; they can invert an otherwise-correct DX move. See references/constraints.md.

**Context is a per-claim modifier, not a category:** language/framework idiom, platform, team
size/seniority/turnover, codebase maturity. These flip the conditional rules. See references/contexts.md.

## Reasoning protocol (apply on every DX-relevant decision, including the silent default)

1. **Name the context.** Language, framework, platform, domain, team, maturity. Infer from the code/repo or
   ask — do not assume.
2. **Gate — establish hard constraints.** Safety/real-time, security/attack-surface, regulatory/legal
   (GDPR, NIS2, DORA, ECSS, sector standards). **DX optimizes strictly within these and never trades against
   them.** A friction win that widens attack surface, breaks determinism, or violates a legal obligation is
   excluded, not weighed. See references/constraints.md.
3. **Identify the dominant activities and their frequencies** for *this* code (Axis 1).
4. **For each relevant tradeoff, retrieve the conditional rule** (references/tradeoffs.md) and **resolve it
   against context and the mechanism it loads (Axis 2).** Never apply a bare reflex. If a rule is missing or
   `low`-confidence, say so.
5. **Minimize total weighted friction within the gate.** The right choice rarely scores best on a single
   activity. **Prefer directions where DX and risk-reduction align** (narrow interfaces, least privilege,
   immutability, strong typing, parse-don't-validate, fewer dependencies) — and **name the axis where the
   alignment breaks** (e.g. non-idiomatic type encodings raise comprehension load). See constraints.md.
6. **If genuinely underdetermined** — the rule does not resolve it, context does not disambiguate, no
   defensible default — go to **DX-elicit**. Do not flip a coin or fall back to the reflex.

In the silent default mode this runs **internally**: you produce better-shaped code or a better-reasoned
recommendation, and do **not** emit a "DX analysis" section. Lecturing on a routine refactor is itself
friction.

## Conditional rules, not reflexes

The knowledge base (references/tradeoffs.md) stores every tradeoff in one shape:

> **prefer X when [conditioning axes]; prefer not-X when […]; overridden by [constraint regime].**
> Tagged with the mechanism it loads and its altitude; carries context modifiers, a confidence label, and
> sources.

Examples of the *shape* (full, sourced entries live in tradeoffs.md):
- *Duplication vs. abstraction:* prefer duplication when the pattern is volatile or not yet understood;
  prefer abstraction when logic is stable, high-churn, and shared. The cost of the wrong abstraction exceeds
  the cost of duplication. Conditioning axes: volatility, discoverability, maintenance overhead.
- *Coupling:* the reflex counts **structural** references, but the friction driver is **logical/co-change**
  coupling — and the two often diverge empirically. Draw boundaries to minimize cross-boundary co-change,
  not call-graph structure.
- *Comments:* prefer comments for **why**/intent/constraints; prefer self-documenting code for **what**.
  Reader expertise modifies the level (juniors want more).

Reflexes ("short is good", "low coupling is good", "more docs is better") are rejected as rules. They are at
best the *X* in a conditional whose *when* you still have to establish.

## DX vs. adjacent principles

DX overlaps these but is not equivalent. Two relationships matter, plus alignment.

- **Hard constraints (DX is subordinate):** safety/real-time (determinism, bounded latency, no dynamic
  allocation under MISRA/DO-178C/ISO 26262; audio-callback discipline — no alloc/locks/blocking on the
  audio thread), security (least privilege, server-side-only tokens, OWASP
  secure-by-design), regulatory/legal (GDPR, NIS2, DORA, EAA/WCAG). Not friction line-items — they bound the
  solution space. See constraints.md.
- **Alignment (prefer — DX *and* risk-reduction together):** narrow interfaces, least privilege,
  immutability, strong typing, parse-don't-validate, fail-closed defaults, fewer dependencies. Take these by
  default; name the break-axis.
- **Soft tension (resolve by weight):** KISS overlaps DX (lower understanding load) but also serves security
  and performance — ally, not synonym. Performance: hot paths earn readability cost, cold paths do not.
  Correctness: types/validation add ceremony now, cut analyzing/maintaining later — usually net-positive,
  often an alignment case.

## Paths

Default is silent context-enhancement (above). Users invoke explicit paths by name or intent.

### DX-review
Trigger: "DX-review", or assess the DX of an existing artifact. Establish context + gate; walk the dominant
activities; for each, name concrete friction points and the **mechanism** they load (feedback loop /
cognitive load / flow). Weight by activity frequency; lead with the highest-weighted. Friction findings, not
style nits.

### DX-redesign
Trigger: "DX-redesign", or restructure for DX. Run DX-review first. Propose changes that lower total
weighted friction; for **each** change state the activity it helps and **what friction it trades** elsewhere.
A redesign with no stated tradeoff is a red flag.

### DX-decide
Trigger: "DX-decide", or two-plus options where DX is a deciding factor. Do **not** re-litigate on general
merit. Find the **DX differentiator**: the activity (and mechanism) on which the options diverge. State which
wins, by how much, and the cost elsewhere. If DX-equivalent, say so and hand back to non-DX criteria.

### DX-elicit
Trigger: protocol step 6 (underdetermined), or "DX-elicit". Present **2–3 concrete contrasting examples**
(real code/structure/interface choices, not abstract labels). Ask which the user leans toward (tappable),
then ask **why** (free text). The *why* is the payload — a reusable judgment that patches the gap no handbook
covers. Apply it to the current decision; if it recurs, surface it for promotion to the user's
preferences/memory. Two asks (choice tappable, rationale prose) — do not collapse to one.

## References

Organized by the model's primitives — **not** by domain or altitude (those duplicate cross-cutting
knowledge). Read what the task needs:

- `references/mechanisms.md` — the three friction mechanisms (feedback loops, cognitive load, flow): the
  durable "why" layer. The foundations and evidence for the model.
- `references/activities.md` — the lifecycle activities: what friction dominates each, which mechanism it
  loads, and frequency drivers. Axis 1.
- `references/tradeoffs.md` — the **conditional-rule knowledge base** (DRY/abstraction, comments, complexity,
  coupling, naming, conventions, API design, architecture/boundaries, docs). Each entry is one rule,
  altitude-tagged, mechanism-tagged, context-modified, with confidence + sources. **Single source of truth.**
- `references/contexts.md` — context modifiers (language/framework, platform, team, maturity) that flip the
  rules. Includes per-language rows (Python, C#/.NET, C/C++, Rust, Go, Zig) and framework rows (React/Next/
  Vite/TanStack/tRPC, FastAPI/Litestar/DRF, Axum/Actix, Minimal API/Razor Pages/EF Core, OpenAPI, Web
  Components, …), plus the regulated/safety-critical row, which points into constraints.md. **Read the
  matching language row whenever the task names or implies a language.**
- `references/constraints.md` — hard-constraint **gates** (safety/real-time, security, regulatory) + the
  **DX↔risk alignment** catalogue, each alignment with its break-axis.

**Confidence tags.** Evolving territory; every claim in the references is labeled. Carry the tag when you
cite it.
- `[E]` empirical — study, data, or research (note `[E-perceptual]` for self-report).
- `[C]` consensus — broad practitioner or official-ecosystem-doc agreement, not formally studied.
- `[O]` opinion — individual or contested practitioner view.
- `(contested)` — marked inline where actively disputed.

## Knowledge map

`knowledge-map.json` is the canonical coverage ledger — one entry per rule / mechanism / activity /
constraint regime / context modifier, with status, depth, richness, source count+tier, confidence, and
created/modified timestamps.
- **At runtime:** surface an entry's confidence when a review/decision leans on it; never present a `stub` as
  settled. 
- **When improving the skill:** the `stub`/`seeded`/`low`-confidence entries are the work queue. Bump
  depth/richness/sources/confidence/modified as you deepen them, and keep the map in sync with the files.
