# Stacks, layers, and metaframeworks

How to tell the layers of a stack apart, how to plan single- and multi-language stacks, and what to check in TypeScript full-stack metaframeworks.

## Contents

- The layer model
- Distinguishing the layers of a real stack
- Single- and multi-language stacks
- Fast-development frameworks
- TypeScript full-stack metaframeworks
- Snapshot: metaframework layers as of 2026-11

## The layer model

Each layer has its own owner, release cycle, and surface. A metaframework is a framework built on other frameworks, which it composes into one model. Two kinds are common:

- **Frontend metaframeworks** build on a UI library and add routing, data loading, mutations, rendering modes, the server and client boundary, build integration, and deployment output.
- **Declarative backend metaframeworks** build on a server engine and application libraries, with no UI library: consumers declare entities, rules, and modules, and the framework derives tables, migrations, validated routes, access control, a published contract (such as an OpenAPI document), clients, and audit from those declarations. Their surface is mostly generated, which moves compatibility and constraint enforcement to the generator (problem-map A13).

| # | Layer | Owns | TypeScript full-stack examples |
|---|---|---|---|
| 1 | Language and type system | Syntax, types, compile-time rules | TypeScript and its compiler options |
| 2 | Runtime | The APIs available: file system, network, Web APIs | Node.js, Deno, Bun, edge runtimes; ECMA-429, the Minimum Common Web API, defines a subset common to server-side runtimes [WinterTC] |
| 3 | Build tooling | Bundling, transforms, development server, code splitting | Vite, Turbopack, webpack, Rspack and Rsbuild |
| 4 | UI library | Component model, rendering, hydration, state primitives | React, Vue, Svelte, Solid |
| 5 | Metaframework | Frontend: routing, data loading, mutations, rendering modes, server and client boundary, build integration. Declarative backend: the model derived from declarations, and everything generated from it | Frontend: Next.js, Nuxt, SvelteKit, SolidStart, React Router in framework mode, TanStack Start, Astro |
| 6 | Server engine and adapters | Request handling, the request and response model, output for each deployment target | Nitro; SvelteKit and Astro adapters; the Fetch API's `Request` and `Response` |
| 7 | Hosting platform | Runtime environment, caching, scaling, platform-specific features | |
| 8 | Application libraries | Data access, authentication, validation, state, background jobs | |
| 9 | Application conventions | Directory structure, module boundaries (`conventions-fit.md`) | |
| 10 | The application | | |

## Distinguishing the layers of a real stack

1. **Inventory.** List every layer from the manifest and lockfile (with versions), the configuration files (build tool, metaframework, type checker, linter), and the runtime entry point. Note what each layer re-exports from layers beneath it.
2. **Record owner and role per layer.** Who releases it, how often, and whether the user is its author or its consumer.
3. **Trace a symptom to the layer that owns the behavior.** Read the package names in the stack trace; find the configuration key that controls the behavior; find which layer's documentation defines the concept. A metaframework often triggers a lower layer's mechanism: a hydration mismatch is the UI library's mechanism, while the decision to render that route on the server is the metaframework's configuration.
4. **Record version coupling.** Which layer requires which versions of which other layer (peer dependency ranges, documented requirements). An upgrade of one layer is planned together with every layer coupled to it.
5. **Establish what each consumed layer enforces, per version, from its source.** Before relying on a host layer for a constraint (authentication, rate limits, security headers, request-forgery checks), read its source or documentation at the version in use and record what it enforces by default and on which entry points. Host metaframeworks often cover only their own entry points, or nothing by default [Practice-2026-11-2].
6. **Fix at the lowest layer you own.** For layers the user consumes, the options are: configure, extend through the layer's extension surface, wrap, replace, contribute upstream, or pin and wait (gate G4 in `tradeoffs.md`).
7. **Wrap deliberately.** Wrap a consumed layer when the application needs a narrower or more stable interface than the layer's own, and replacing the layer is plausible. Do not wrap a metaframework's core model (routing, data loading, rendering): the wrapper mirrors it, hides nothing, and has to follow every upgrade (problem-map A12). An anti-corruption layer pays where a foreign model would otherwise spread through the application [Evans].

## Single- and multi-language stacks

**Forces**: shared types and code (validation schemas, domain types) across client and server; the best ecosystem for each concern; team cognitive load [Team-Topologies]; the operational cost of each additional runtime; hiring.

**Single language end to end** (for example, TypeScript on client and server):

- One toolchain, and types shared across the boundary. tRPC builds "fully typesafe APIs without schemas or code generation" and is "designed for TypeScript monorepos" [tRPC]; metaframework server functions do the same within one application.
- The boundary is still a network boundary. Server code must be kept out of client bundles (see the boundary checks below), and client code from an earlier deployment may call server code from a later one: check how the metaframework handles version skew between deployed client and server.

**Multi-language** (for example, a TypeScript client with a backend in another language):

- An explicit contract (an OpenAPI document, protocol buffer definitions, a GraphQL schema) with code generated for each side. Protocol buffers' compiler, for instance, is "invoked at build time on .proto files to generate code in various programming languages" [Protobuf].
- The contract is published surface: `compatibility.md` applies to it.
- A backend for each frontend, coupled to one user experience, aggregates calls for that interface [Newman-BFF].

**The kinds of client decide the contract, not the number of languages.** Even in a single-language stack, prefer an explicit contract that is not tied to one language when clients outside the build exist or are planned (mobile apps, third parties, other services), because typed procedure calls bind every client to the server's language and build, and each procedure must repeat the access checks that a single write path applies once [Practice-2026-11-1].

**In-process bindings between languages** (a native core called from a managed or scripting runtime): cross the boundary once per operation, through one channel (for example a command queue and a state stream), and route offline and test paths through the same channel. Reject a binding layer that adds a language hop; adopt a binding generator only when the bridge surface is large. Prove the binding with a smoke check that returns a value only the far side can produce, built on the real target toolchain, since host integration tooling can impose structure the call path does not need [Practice-2026-11-6].

**A core that must outlive its hosts** (user interfaces, plugin hosts, platforms): build and test it as a headless library with no dependency on any host, and have CI build it alone; that isolated build is what enforces the one-way dependency [Practice-2026-11-6].

**Default**: one language until a concern requires another ecosystem (gate G3, criterion L4) or another team owns the other side [Conway]. Each additional language spends one of the few innovation tokens a team has [McKinley]. Alternate direction: polyglot programming, choosing the best language per concern [Ford-Polyglot], wins when the teams can carry the operational cost.

**Repository and deployment shape**: in one repository, a boundary's consumers can be changed in the same commit, so the boundary is public but not published, which lowers K3 and K4 in `tradeoffs.md` [Potvin-Levenberg]. Workspace-monorepo tooling pays when there are several deliverables in one package ecosystem; one application plus a core in another language is usually simpler as a flat root where each side keeps its own build (reasoned) [Practice-2026-11-6]. Start with one deployable and split later when the boundaries are known [Fowler-MonolithFirst], [DHH-Majestic].

## Fast-development frameworks

Integrated full-stack frameworks (Rails is the reference) ship data access, authentication, jobs, mail, and conventions as one system. The Rails Doctrine names the principles behind that speed, among them "Convention over Configuration", "The menu is omakase", "Value integrated systems", and "Progress over stability" [Rails-Doctrine].

When planning a fast-development stack, list which concerns the chosen framework owns and which the stack must assemble from separate application libraries (data access, authentication, validation, background jobs, mail). Each assembled library is a layer with its own release cycle, upgrade path, and constraint defaults, which counts against L5 and L7 in `tradeoffs.md`, and its conventions must be reconciled with the framework's.

## TypeScript full-stack metaframeworks

Questions to answer for each candidate, from its current documentation (`research.md`). These projects change their build layers and defaults between majors, often within a year; a fact older than the current major is stale.

| Concern | Questions |
|---|---|
| Server and client boundary | How is server-only code kept out of client bundles? Is a violation a build error? In React-based stacks, `'use client'` "introduces a server-client boundary in the module dependency tree", and `'use server'` marks server functions "that can be called from client-side code" [RSC]. Next.js raises a build-time error when a module importing `server-only` is imported into a client component. |
| Server functions and actions | Each one is callable from client code, so treat each as a public endpoint: validate its arguments as untrusted input, and either authorize inside it or, preferably when a backend pipeline exists, route the write through that pipeline so its single choke point applies (`constraints-by-default.md`). |
| Data loading and caching | Where does loading run? What is cached by default, and how is it invalidated? A caching default is a policy with consequences. |
| Rendering modes | Which modes exist per route (server rendering, static prerendering, client rendering, streaming, islands), and which is the default? [Rendering-Web], [Islands] |
| Deployment | Which targets and adapters exist? Which runtime APIs are available on each target? |
| Escape hatches | Plain HTTP handlers, a custom server, access to the build tool's configuration. |
| Upgrades | The breaking changes per major, the codemods offered, how long a major is supported. |
| Lock-in | Features that work only on one hosting platform. |
| Version skew | What happens when the client from one deployment calls the server of the next? |

**Choosing.** The team's UI library usually decides the family (L3). Within it, compare the routing and data model, platform coupling, and layer health with the stack criteria in `tradeoffs.md`, and walk the stack scenarios (deploy, upgrade, skew, failure) through each candidate (`scenarios.md`).

## Snapshot: metaframework layers as of 2026-11

Checked against each project's documentation on 2026-11-06. Recheck before relying on it.

| Metaframework | UI library | Build layer | Server layer and deployment |
|---|---|---|---|
| Next.js 16 | React | Turbopack by default for development and build; webpack opt-in | |
| Nuxt 4 | Vue | Vite by default | Nitro, built on h3 |
| SvelteKit | Svelte | Vite | Adapters (node, static, cloudflare, netlify, vercel, bun) |
| SolidStart 2 | Solid | Vite Environment API (Vinxi removed) | Nitro as an optional deployment plugin |
| React Router 8, framework mode | React | Vite plugin | |
| TanStack Start 1 | React or Solid | Vite or Rsbuild | Nitro or the Cloudflare Vite plugin |
| Astro 7 | Agnostic (React, Preact, Svelte, Vue, Solid, others) | Vite 8 with Rolldown | Adapters (cloudflare, netlify, node, vercel) |

Vite 8 replaced esbuild and Rollup with Rolldown as its single bundler [Vite8].
