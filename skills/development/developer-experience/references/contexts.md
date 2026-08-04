# Context modifiers (orthogonal)

> NOT a knowledge store and NOT a silo. Context is a per-claim MODIFIER that flips the conditional rules in
> tradeoffs.md (soft); constraints.md GATES (hard). Use to adjust which way a rule resolves. Tags [E]/[C]/[O].
> Coverage in ../knowledge-map.json.

## The axes (each flips rules)
- **Language / framework idiom** — idiom fit dominates conventions and the parse-don't-validate break-axis.
  Per-language and per-framework rows below.
- **Platform** — frontend / backend / embedded / audio-realtime / scientific-numeric / CLI / library /
  data-ML shift defaults (libraries weight API stability + usability higher; embedded and audio forbid
  dynamic allocation in hot paths — gate in constraints.md; data/ML weights reproducibility).
- **Team** — size, seniority, distribution, turnover. High turnover raises value of full-word names, docs,
  ADRs; senior teams tolerate terser code; cognitive load drives team-sized boundaries (Team Topologies).
- **Maturity** — prototype vs. load-bearing production. Flips the duplication/abstraction and test-coverage
  calculus; early code optimizes change rate, mature code optimizes safe modification by others.

## How a modifier is applied
When resolving a tradeoff rule, state the modifier inline: e.g. "for a load-bearing service with high
turnover, prefer full-word names + ADRs (onboarding-weighted)".

## Language rows
> Each row states how the ecosystem's idiom shifts tradeoffs.md rule DEFAULTS and where alignment
> break-axes (constraints.md) move. Version-specific behavior rots — verify against current official docs
> before leaning on a versioned claim.

- **Python** — Gradual typing: the strong-typing / parse-don't-validate alignment applies **at boundaries**
  (pydantic models, dataclasses, typed public APIs), not as whole-codebase type gymnastics; forcing full
  annotation onto untyped internals raises extraneous load for little proof value. [C] No compile step: the
  inner loop is fast by default, but type/lint signal exists only if a checker (mypy/pyright) + linter run
  in the inner loop — treat them as the compile step, or the feedback-loops mechanism silently degrades to
  runtime errors. [C] PEP 8 + stdlib idiom are unusually strong ecosystem conventions; local-convention
  budget is near zero. [C] https://peps.python.org/pep-0008/ Runtime access control is non-idiomatic
  (underscore convention); API misuse-resistance leans on types + naming, not enforcement. [C]
- **C# / .NET (modern)** — Analyzer-first ecosystem: Roslyn analyzers + nullable reference types put the
  typing alignment into the inner loop at near-zero idiom cost in new code; enabling NRT across legacy code
  is a migration project, not a default flip. [C] `record` types make the immutability alignment cheap. [C]
  Official conventions (learn.microsoft.com) are discoverable and complete — deviating costs more than in
  convention-light ecosystems. [C] Minimal APIs vs controllers is an activity-frequency call: Minimal APIs
  cut ceremony for small/focused services; controller conventions + filters pay off as endpoint count and
  team size grow. [C]
- **C / C++** — Compile time IS the feedback loop: template/header-heavy abstraction carries an inner-loop
  cost most languages don't have, so the duplication-vs-abstraction rule gains a build-time axis. [C] No
  universal package manager: the fewer-dependencies alignment weighs heavier (updating-deps friction stays
  high even with vcpkg/Conan). [C] RAII + smart pointers are the DX↔safety alignment carriers; raw owning
  pointers lose on both axes. [C] Undefined behavior makes sanitizers + warnings-as-errors first-order
  feedback-loop investments, not optional hygiene. [C] Audio/real-time work: hard gate in constraints.md
  (audio-callback discipline) inverts "use std containers / mutexes" reflexes on the hot path.
- **Rust** — The compiler is the primary feedback loop: ownership + types front-load cognitive load at
  write time and refund it at maintain/refactor time — the ceremony-now-vs-later rule resolves toward types
  more strongly than in any other listed ecosystem. [C] Parse-don't-validate and
  illegal-states-unrepresentable are native idiom; the non-idiomatic-gymnastics break-axis largely
  disappears. [C] Borrow checker raises onboarding friction — the team-seniority modifier weighs heavier.
  [C] Compile time is the cost side; macro/generic-heavy code pays it in the inner loop. [C] rustfmt +
  clippy + Cargo + API guidelines hard-default the convention rule to ecosystem.
  https://rust-lang.github.io/api-guidelines/ [C]
- **Go** — Enforced simplicity: gofmt removes the formatting-convention question entirely; local-convention
  budget is zero by design. [C] "A little copying is better than a little dependency" — the DRY default
  shifts toward duplication relative to other ecosystems. [C] https://go-proverbs.github.io/ Explicit error
  returns are idiomatic; extraneous-load arguments against the verbosity lose to idiom fit. [C] Fast
  compiles + built-in test/vet/pprof give a strong inner loop with no tooling assembly. [C] stdlib-first
  culture (net/http): the fewer-dependencies alignment is cheap; reach for a framework only when
  routing/middleware needs outgrow the stdlib. [C]
- **Zig** — same explicitness-over-magic lineage as Go/Rust (comptime instead of macros/templates, explicit
  allocators, no hidden control flow or allocations): the model and alignment catalogue transfer directly.
  Young ecosystem: std APIs and conventions still move between releases — pin the toolchain, expect
  updating-deps friction, verify everything against current docs. [C/O]

## Framework rows
> Modifier-grade notes only — how the framework shifts rule defaults. Not tutorials. Fast-moving territory:
> confidence capped at [C], verify current docs.

**TypeScript / JS**
- *React* — component model + hooks rules; colocation (markup/logic/style together) is the idiom, which
  flips the separation-of-concerns reflex. Tailwind (v4) extends the same colocation idiom to styling.
- *Next.js (App Router)* — the server/client component boundary is both a file-organization modifier and a
  security-adjacent line: secrets and tokens stay server-side (gate, constraints.md security). RSC changes
  where data-fetching friction lives.
- *Vite* — inner-loop tool; its existence is why the feedback-loops mechanism defaults to "fast dev server
  assumed" in this ecosystem. *Ladle* applies the same inner-loop logic to component isolation.
- *TanStack (Router/Query/Table/Form/Start)* — headless + type-safe: typed search params, typed queries =
  parse-don't-validate carriers at the UI boundary.
- *Drizzle vs Prisma* — SQL-transparent TS schema vs DSL + codegen. Codegen adds a feedback-loop stage;
  Drizzle keeps the SQL mental model (lower extraneous load for SQL-fluent teams, higher for others).
- *Fastify vs Express* — schema-first validation (JSON Schema at the boundary) vs minimal middleware.
  Fastify aligns with parse-don't-validate; Express pushes validation discipline onto the team.
- *tRPC / ts-rest* — end-to-end type contract collapses API-drift friction (feedback loop: compile-time
  contract errors) but couples client/server versioning — monorepo/same-team modifier. ts-rest keeps an
  OpenAPI-compatible contract; tRPC does not.
- *React Aria* — carrier for the accessibility gate (EAA / WCAG, constraints.md) with headless DX.
- *Astro* — islands / server-first: ship-JS-on-request default aligns performance and cognitive load for
  content-heavy sites.
- *Web Components* — platform-native: longevity and framework-agnosticism (reuse across the frameworks
  above) vs weaker SSR/tooling DX and Shadow DOM styling friction. A dependency-count alignment play with a
  feedback-loop cost. [C]

**Python (web)**
- *FastAPI / Litestar* — pydantic parsing at the request boundary = the idiomatic parse-don't-validate
  carrier; typed DI; OpenAPI generated from the types (contract stays in code, single source of truth).
- *Django REST Framework* — convention-heavy; serializer/viewset ceremony pays off inside a large Django
  app (conventions discoverable, team-scale), reads as pure extraneous load in a small standalone API.

**API contracts**
- *OpenAPI 3.1+* — 3.1 aligned with standard JSON Schema (one schema dialect to know). Contract-first vs
  code-first is a feedback-loop + team-boundary decision: code-first (FastAPI, ts-rest) keeps one source of
  truth in code; contract-first suits multi-team / polyglot boundaries where the contract is the interface.

**Rust (web/UI)**
- *Axum* — tower middleware ecosystem; extractors = typed boundary parsing (parse-don't-validate native).
- *Actix Web* — mature, performance-oriented; larger API surface, actor heritage.
- *Dioxus* — React-like RSX across platforms; young-ecosystem caveat (same as Zig row: pin, verify).

**C# / .NET (web)**
- *Razor Pages* — page-oriented server rendering: form-heavy admin UIs with low JS-toolchain load.
- *EF Core* — LINQ readability vs SQL transparency (same axis as Drizzle/Prisma); migrations behave like an
  updating-dependencies activity — budget friction there.

**Go** — net/http covered in the language row.

## Regulated / safety-critical row
- **Reweights:** toward understanding + reviewing (audit, traceability raise the cost of being wrong).
- **Gate:** points into constraints.md (safety/real-time incl. audio callbacks, regulatory/legal). This row
  only reweights; the gate lives there.

<!-- Pending depth: per-platform default profiles; empirical sources for language-row claims (currently [C] from official ecosystem docs/proverbs). -->
