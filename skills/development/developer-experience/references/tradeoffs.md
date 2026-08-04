# Tradeoffs — the conditional-rule knowledge base (single source of truth)

> Every entry is ONE rule: prefer X when … / prefer not-X when … / overridden by …. Tagged [altitude] and
> {mechanism}. Context modifiers flip the rule (see contexts.md). Tags: [E] empirical · [E-perceptual]
> self-report · [C] consensus · [O] opinion · (contested). Coverage in ../knowledge-map.json.
> NOTE: altitude is a TAG here, not a silo — cross-altitude rules live once.

## Duplication vs. abstraction (DRY)  [code/design] {cognitive load}
- **Rule:** prefer duplication when the pattern is volatile or not-yet-understood; prefer abstraction when
  the logic is stable, high-churn, and genuinely shared. The wrong abstraction costs more than duplication —
  it is re-inlined only with pain across every dependent.
- **Conditioning axes:** volatility/traffic, discoverability of the duplication, maintenance overhead of
  keeping copies in sync, whether similarity is real or accidental.
- **Failure mode:** retaining an ill-fitting abstraction by piling on parameters/conditionals. Fix: inline
  back, then re-derive. Narrow stable helpers (parse/format/validate) rarely suffer this.
- [O strong consensus] (contested at the exact-duplication edge). Metz, "The Wrong Abstraction"
  https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction ;
  https://algocademy.com/blog/why-your-code-duplication-isnt-always-bad-a-pragmatic-approach-to-the-dry-principle/

## Comments vs. self-documenting code  [code] {cognitive load}
- **Rule:** prefer comments for **why** / intent / non-obvious constraints / external links; prefer
  self-documenting code (names, structure) for **what**. Redundant what-comments rot and mislead.
- **Context modifier:** reader expertise — students/juniors benefit from more documentation; seniors lean
  "less is more". Adjust to the team that will read it.
- [E + O] Diva readability study (expertise effect); Springer "developers talking about code quality" 2023
  https://link.springer.com/article/10.1007/s10664-023-10381-0

## Function length / complexity metrics  [code] {cognitive load}
- **Rule:** do NOT treat line count or cyclomatic complexity as a DX target. CC is largely a proxy for size,
  weak at predicting defects/comprehension beyond LOC; useful only as a smell flag. Optimize the reader's
  call-stack depth, not the line count — one long linear readable function can beat five indirections.
- [E, metric contested] Shepperd, "A critique of cyclomatic complexity" 1988
  https://www.researchgate.net/publication/3407068_A_Critique_of_Cyclomatic_Complexity_as_a_Software_Metric ;
  CACM "From Code Complexity Metrics to Program Comprehension"
  https://cacm.acm.org/research/from-code-complexity-metrics-to-program-comprehension/

## Coupling: structural vs. logical/co-change  [code/architecture] {cognitive load}
- **Rule:** the reflex counts **structural** coupling (call-graph references); the friction driver is
  **logical/co-change** coupling (artifacts that change together in history) — and the two often DIVERGE
  empirically. Draw boundaries to minimize cross-boundary co-change; decouple change-INDEPENDENT seams,
  tolerate coupling inside an always-changes-together unit.
- **Evidence:** change coupling predicts defects and improves bug-prediction beyond code metrics
  (D'Ambros, Lanza, Robbes 2009); cross-module co-changes correlate with defects more than within-module;
  structurally-coupled entities frequently do NOT co-evolve (Oliva & Gerosa). Change coupling needs history —
  greenfield projects have only structural analysis. [E]
  https://www.semanticscholar.org/paper/On-the-Relationship-Between-Change-Coupling-and-D'Ambros-Lanza/937b72f93fe2cb74549b08f1f984c0b9e723e580 ;
  https://www.ime.usp.br/~gerosa/papers/Wiese2015_Chapter_AnEmpiricalStudyOfTheRelationB.pdf

## Naming / identifiers  [code] {cognitive load}
- **Rule:** prefer full words over abbreviations/single letters; identifiers are ~70% of source characters,
  so naming is a primary comprehension lever. Comprehension speed rose ~19% with full-word identifiers.
- **Context modifier:** experienced devs tie short names to long-term-memory concepts, softening the penalty.
- [E] Lawrie et al. "What's in a name?" (ICPC 2006); Hofmeister, Siegmund, Holt (SANER 2017)
  https://link.springer.com/article/10.1007/s10664-018-9621-x ; Deissenboeck & Pizka 2006 (70% figure).

## Conventions / consistency  [code/all] {cognitive load}
- **Rule:** prefer a convention when it matches ecosystem idiom and is discoverable/documented; do NOT invent
  a new local convention unless its payoff exceeds its learning + maintenance cost. Age, prevalence, novelty
  are proxies for fit, not fit itself (old can be cargo-culted; common can be wrong here; new can be right).
- [C/O] DEPTH TODO: source against ecosystem style-guide rationale.

## API / interface design  [API] {cognitive load, feedback loops}
- **Rule:** prefer interfaces with few/no required constructor parameters, the needed class reachable from
  the obvious starting object, and constructors over factories. Apply least astonishment.
- **Evidence:** programmers more effective with APIs not requiring constructor params (Stylos & Clarke 2007);
  method placement affects learnability (Stylos & Myers 2008); factory pattern hurt usability vs constructors
  (Ellis, Stylos, Myers 2007). [E] https://www.cs.cmu.edu/~NatProg/papers/FSE2008-p105-stylos.pdf

## Make illegal states unrepresentable / parse, don't validate  [API/code] {cognitive load}  (ALIGNMENT)
- **Rule:** prefer parsing untrusted input ONCE at the boundary into a constrained type, so downstream code
  relies on the type's guarantee. Lowers analyzing/maintaining friction AND shrinks bug/vuln surface (see
  constraints.md alignment).
- **Break-axis:** in languages without rich types, faked via smart constructors; non-idiomatic type
  gymnastics RAISE comprehension load — alignment is real but bounded by ecosystem idiom.
- [O strong consensus in typed-FP] King 2019 https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ ;
  Minsky "make illegal states unrepresentable"; Feldman "impossible states impossible".

## Architecture: microservices vs. monolith vs. modular monolith  [architecture] {all}
- **Rule:** prefer a (modular) monolith for small teams and simple/uncertain scale — simpler build, deploy,
  debug, lower operational + cognitive load; prefer microservices for large, multi-team systems needing
  independent deployability, fault isolation, and per-service elastic scale. It is a context decision, not a
  maturity ladder.
- **Evidence:** SLRs converge on "context-dependent"; documented reversals (Amazon Prime Video reported ~90%
  infra cost cut moving distributed→monolith) show trade-offs are real; modular monolith gives logical
  modularity without distribution overhead but no per-module elastic scale. Long-term case study: tech debt
  grew faster in microservices; bad service-cut boundaries were the critical maintenance risk. [E mixed/grey]
  https://www.mdpi.com/2079-9292/13/8/1452 ; https://doi.org/10.3390/fi17110496
- **Overridden by:** OWASP — overly complex architectures expand attack surface.

## Module boundaries / Conway / Team Topologies  [architecture] {cognitive load}
- **Rule:** size software for **team cognitive load**, not the reverse; design teams to produce the
  architecture you want (reverse-Conway); split along **fracture planes** (domain, change frequency,
  compliance) aligned to bounded contexts (DDD). Platform "golden paths" cut extraneous load.
- **Context modifier:** the org/communication structure wins over intended architecture if they conflict.
- [C/O] Skelton & Pais, Team Topologies https://teamtopologies.com/ ; Conway 1968.

## Documentation: Diátaxis + ADRs  [documentation] {cognitive load}
- **Rule:** do NOT target doc volume; match doc TYPE to NEED. Diátaxis: tutorials (learn), how-to (task),
  reference (look-up), explanation (why) — mixing types on one page is the top cause of confusing docs.
  Capture architecturally-significant decisions as ADRs (title/status/context/decision/consequences;
  immutable, superseded not edited, in version control) — the *why* code cannot hold.
- [C] Diátaxis https://diataxis.fr/ ; Nygard ADRs https://martinfowler.com/bliki/ArchitectureDecisionRecord.html ;
  https://adr.github.io/

## Tooling / dev loop / platform  [tooling] {feedback loops, flow}
- **Rule:** treat inner-loop feedback speed (edit→test/type/lint) and reproducible local env as first-order
  DX, not nice-to-haves; reduce EXTRANEOUS load via golden paths / thinnest-viable-platform. Adding tooling
  that raises load is a net loss.
- [C/E] DevEx feedback-loops dimension; Spotify Golden Paths + Backstage
  https://engineering.atspotify.com/2020/08/how-we-use-golden-paths-to-solve-fragmentation-in-our-software-ecosystem
- DEPTH TODO: build-time thresholds, flaky-test cost.
