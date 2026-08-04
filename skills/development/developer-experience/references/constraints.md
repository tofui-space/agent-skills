# Constraints — hard gates + DX↔risk alignment (orthogonal overlay)

> GATES, not reweights. DX optimizes strictly within these; never trades against them. Evaluated at protocol
> step 2. Also holds the alignment catalogue (step 5). Tags [E]/[C]/[O]; authoritative/primary sources for
> gate claims. Coverage in ../knowledge-map.json.

## How to use
1. Step 2 (gate): list regime(s) in force; pull non-negotiables; EXCLUDE any violating option (not a trade).
2. Step 5: prefer options in the Alignment catalogue; name the break-axis.

## Hard constraints by regime

### Security / attack surface  [C, primary]
- **OWASP Top 10:2021 A04 Insecure Design** — secure-by-design, threat modeling, secure patterns; maps the
  most CWEs of any category; an insecure design cannot be fixed by perfect implementation (the controls were
  never designed). OWASP ASVS for verification. https://owasp.org/Top10/2021/A04_2021-Insecure_Design/
- **Forbidden DX-for-convenience:** verbose errors leaking internals; broad privileges "to skip plumbing";
  dev-only auth bypasses that ship; trusting client input because the UI validates.

### Safety / real-time  [C, primary]
- **No dynamic allocation** post-init under MISRA C:2012 (21.3/21.4) and MISRA C++ (18-4-1); rationale:
  nondeterministic timing (defeats WCET), fragmentation, runtime OOM. Relevant to ISO 26262 (automotive),
  IEC 61508 (functional safety), DO-178C (avionics), IEC 62304 (medical), ECSS (space).
  https://arxiv.org/pdf/2112.12823 ; https://www.parasoft.com/learning-center/do-178c/static-analysis/
- **Real-time audio callback** — no allocation, locks, blocking syscalls, file/network I/O, or unbounded
  work on the audio thread; preallocate, communicate via lock-free structures (ring buffers, atomics). The
  deadline is the gate regardless of certification regime — a missed buffer is an audible defect. Inverts
  "use std containers / mutexes" DX reflexes on the hot path. [C] Bencina, "Real-time audio programming
  101: time waits for nothing"
  http://www.rossbencina.com/code/real-time-audio-programming-101-time-waits-for-nothing
- **Forbidden DX-for-convenience:** dynamic allocation after init, recursion, implicit conversions, any
  nondeterminism in hot/real-time paths.

### Regulatory / legal  [C, primary]
- **GDPR (EU 2016/679):** Art. 5(1)(c) data minimisation; Art. 17 erasure; Art. 25 data protection by design
  & by default (pseudonymisation, minimisation). https://gdpr-info.eu/
- **NIS2 (EU 2022/2555):** Art. 21 ten minimum risk-management measures incl. supply-chain + secure
  acquisition/development/maintenance; Art. 20 management accountability; 24h/72h/1-month incident reporting.
  Transposition uneven across member states — verify country specifics.
  https://eur-lex.europa.eu/eli/dir/2022/2555/oj/eng
- **DORA (EU 2022/2554):** financial-sector ICT operational resilience; applies from 17 Jan 2025. **Distinct
  from "DORA metrics" (DevOps Research & Assessment): deployment frequency, lead time, change-fail rate,
  MTTR — a DIFFERENT thing.** https://eur-lex.europa.eu/eli/reg/2022/2554/oj
- **EU Accessibility Act (EU 2019/882):** applies from 28 Jun 2025; conformance via EN 301 549 (currently
  incorporates WCAG 2.1 AA; verify pending update to 2.2). WCAG 2.2 is a W3C Recommendation (Oct 2023); AA is
  the de-facto legal target. https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng ; https://www.w3.org/TR/WCAG22/

## DX ↔ risk alignment catalogue
> Moves that lower BOTH friction and risk/attack/error surface. Prefer by default; name the break-axis.

- **Least privilege** — narrows blast radius + the surface to reason about. Break: over-fragmented perms add
  onboarding friction. [C]
- **Minimal / narrow interfaces** — fewer misuse paths, easier to learn (Stylos). Break: forces awkward
  multi-call ceremonies. [E/C]
- **Immutability** — easier reasoning, no aliasing bugs. Break: hot/real-time paths where copying costs. [C]
- **Strong/static typing + parse-don't-validate** — compiler carries proofs, fewer runtime errors. Break:
  non-idiomatic type gymnastics raise comprehension load. [O/C]
- **Fail-closed defaults** — safe under error; aligns with OWASP. Break: over-aggressive lockouts harm
  availability. [C]
- **Explicit data flow** — auditable/debuggable; aligns with GDPR accountability. Break: verbosity obscures
  intent. [C]
- **Fewer dependencies** — smaller supply-chain surface + less update friction. Break: reinventing
  well-vetted libs adds bugs/maintenance. See SLSA build levels. [O/C] https://slsa.dev
