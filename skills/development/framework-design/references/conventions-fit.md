# Codebase convention fit

How to judge whether a codebase organization convention (layers, feature folders, vertical slices, Feature-Sliced Design, ports and adapters, onion or clean architecture, domain-driven design, modular monolith) fits a project's needs, with evidence from the code and its history rather than from the convention's reputation.

A convention is a decomposition decision. Judge it by what it does to change locality, depth, and information hiding [APOSD], [Parnas72], not by its name.

## Contents

- Conventions at a glance
- Method
- History measurements
- Misfit signals
- Migrating

## Conventions at a glance

| Convention | Organizes by | Optimizes | Costs | Fits when | Sources |
|---|---|---|---|---|---|
| Layers (presentation, domain, data) | Technical role | Separation of technical concerns; easy to start | A feature change touches every layer | Small applications, mostly data entry and display. Fowler recommends domain-oriented top-level modules that are internally layered for larger ones. | [Fowler-Layering] |
| Feature folders, package by feature | Feature | Change locality | Shared rules can be duplicated across features | Most applications past the first few features | [Fowler-Layering] |
| Vertical slices | Request or use case, "encapsulating and grouping all concerns from front-end to back" | Change locality per request; each slice picks its own complexity | Business rules shared by several slices get copied | Request-centered applications whose requests vary in complexity | [Bogard] |
| Feature-Sliced Design | Fixed layers (app, pages, widgets, features, entities, shared; processes is deprecated), imports only downward | Onboarding through a fixed taxonomy; checked by a linter (Steiger) | Debates over which layer a module belongs in | Frontends with many features and several contributors | [FSD] |
| Ports and adapters (hexagonal) | Application core against adapters for each driver and each piece of infrastructure | Testability; replaceable infrastructure | Indirection | Applications with several drivers (UI, API, jobs, tests) or replaceable infrastructure | [Cockburn-Hex] |
| Onion, clean architecture | Rings; source dependencies point inward only | Domain independent of frameworks | Mapping between rings; ceremony | Long-lived, domain-heavy systems | [Palermo], [Martin-Clean] |
| Domain-driven design, strategic | Bounded contexts and subdomains (core, supporting, generic), with a model per context | Consistent language; boundaries aligned with teams | Up-front modeling effort | Complex domains, several teams | [Evans], [Khononov-DDD] |
| Domain-driven design, tactical | Aggregates, entities, value objects, domain events, repositories | Invariants enforced in deep domain objects | Ceremony where there are few invariants | Areas with many business rules and state transitions; concentrate the effort on the core domain: "Make the core small. Apply top talent to the core domain" | [Evans], [Evans-Ref], [Vernon] |
| Modular monolith | Components with declared public interfaces inside one deployable | Boundaries without the cost of distribution | Needs enforcement, or boundaries erode | Several teams or areas, one deployment | [Brown-Modular] |
| Conventions the stack imposes | For example, file-based routing in a metaframework | Consistency with the stack's documentation and tools | Constrains where some code must live | Always present; reconcile, do not fight | `stacks.md` |

Mixing is normal and often right: domain-driven tactical patterns in the area with the most business rules, plain slices elsewhere, and the metaframework's routing conventions at the edge. Write the mix down as the project's convention, with where each part applies.

## Method

1. **Observe the convention as it is.** The directory tree to depth three; the import graph (from dependency-cruiser, import-linter, or the language's tooling); the entry points; where the last few features landed. A README's description of the architecture is a claim to check against these.
2. **Measure change locality and change coupling from history** (below).
3. **State the project's forces**: the complexity of the domain logic per area (rules, invariants, state transitions, or mostly reading and writing records); the kind of subdomain per area (core, supporting, generic) [Khononov-DDD]; the number of teams and who owns what; the expected lifetime; the deployment units; the conventions the stack imposes; and whether the codebase is itself a framework with consumers.
4. **Score candidate conventions** with the fit criteria in `tradeoffs.md`, using the current convention as the datum. Every non-zero cell cites a measurement, an observation, or a source.
5. **Prototype on one slice when the scores are close**: in a throwaway worktree, move one representative feature to the candidate convention and measure the same history-based and surface numbers (`prototyping.md`).
6. **Recommend a convention per area**, with the migration path and the architecture tests that will keep it (`enforcement.md`).

## History measurements

Run from the repository root. Each command reads history only. Module depth is two directory levels; adjust the `mod()` function for the project's layout.

Distinct modules touched per commit, over the last 300 non-merge commits (a distribution weighted toward 1 means changes are local):

```sh
git log --no-merges -n 300 --name-only --format='@@%h' \
| awk -F/ 'function mod(){return NF>=3 ? $1"/"$2 : (NF==2 ? $1 : "(root)")}
  /^@@/{if(c)print n; n=0; c=1; split("",s); next}
  NF{d=mod(); if(!(d in s)){s[d]=1; n++}}
  END{if(c)print n}' \
| sort -n | uniq -c
```

Module pairs that change together most often (change coupling [Tornhill]):

```sh
git log --no-merges -n 300 --name-only --format='@@%h' \
| awk -F/ 'function mod(){return NF>=3 ? $1"/"$2 : (NF==2 ? $1 : "(root)")}
  function flush(  a,b){for(a in m)for(b in m)if(a<b)p[a" + "b]++; split("",m)}
  /^@@/{flush(); next}
  NF{m[mod()]=1}
  END{flush(); for(k in p)print p[k], k}' \
| sort -rn | head -20
```

For a larger analysis, code-maat computes logical coupling from a version-control log (`-a coupling`) [Tornhill].

Without enough history (a new codebase, or a recent restructuring), these numbers do not exist yet; scores then rest on structure alone and are provisional, and structural coupling (imports) and change coupling can diverge, so say so in the report. A findability test (`prototyping.md`) is the substitute: readers locate a list of concepts in each candidate layout, and folders opened per concept break a tie [Practice-2026-11-4].

Read the results against the convention: in a layer-first structure, high coupling between layer directories of the same feature means a typical change crosses layers; in a feature-first structure, high coupling between two features means their boundary is drawn in the wrong place, or a shared rule is missing a home.

## Misfit signals

| Signal | Likely cause | Direction |
|---|---|---|
| A typical feature commit touches three or more top-level layer directories | Layer-first structure, with knowledge split by execution step [APOSD] | Feature folders or vertical slices, internally layered where needed |
| `shared`, `common`, or `utils` is the fastest-growing directory | Domain concepts without a home | Extract named domain modules |
| Domain-driven vocabulary, but services hold all logic and entities only hold data | Tactical patterns applied where there are few invariants, or misapplied | Plain slices for that area, or move the rules into the domain objects |
| The same business rule implemented in several slices | Information leakage [APOSD] | A domain module that the slices share |
| Import cycles between features | Boundaries drawn in the wrong place | Redraw boundaries using the change-coupling data |
| Several mapping layers with identical shapes | Shallow layers (problem-map A12) | Merge rings where nothing is hidden |
| Two teams edit the same directories every week | Boundaries do not match ownership [Conway], [Team-Topologies] | Align module boundaries with team boundaries, or the reverse |

## Migrating

- **Incrementally**: new work follows the new convention; an existing area moves when it is next changed substantially. A move of everything at once stops feature work and mixes structural changes with behavioral ones.
- **Document the boundary between the old and the new convention** while both exist, and have an architecture test enforce it, so the migration is visible and does not slide back.
- **Measure again after each moved area**, with the same commands, so the migration is judged by its effect on change locality.
