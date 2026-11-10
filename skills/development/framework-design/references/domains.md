# Application domains

How frameworks serve different kinds of software. For each domain: what the framework typically owns (where control is inverted), the forces that dominate, the extension model, how gates and weights shift (`tradeoffs.md`), and established framework families to start research from. The families are starting points for `research.md`, not recommendations; check their current documentation before relying on any detail.

## Contents

- Web applications: APIs, frontends, backends for frontends, static sites
- Content and business systems: CMS, CRM, ERP
- Data visualization
- IoT and devices
- Mapping and geospatial
- Games
- Background jobs and workflows
- Low-code orchestration
- Asset management
- Mission control and operations dashboards
- Science and engineering
- AI engineering and machine learning
- Home automation hubs
- Personal AI assistants
- Music software

## Web applications: APIs, frontends, backends for frontends, static sites

- **APIs.** Owns request dispatch, routing, input binding, validation, and the middleware pipeline. Dominant forces: constraints by default (access control, validation, limits), a stable contract for clients, observability. Extension: middleware, handlers, plugins. Shifts: G1 covers every route; K3 rises for public APIs; L8 matters when choosing. For wire contracts across languages, see `stacks.md`.
- **Frontends.** Owns rendering, the component lifecycle, state propagation, and client routing. Dominant forces: device performance budgets, accessibility, bundle size (K10), hydration cost. See `ui-frameworks.md`.
- **Backends for frontends.** Owns aggregation for one user experience [Newman-BFF]. Dominant forces: latency, passing the user's identity through, versioning together with its frontend. In one repository with its frontend, its surface is public, not published.
- **Static sites.** Owns build-time rendering and the content pipeline. Dominant forces: build speed, authoring experience, little or no client JavaScript; islands for interactive parts [Islands].

## Content and business systems: CMS, CRM, ERP

Owns the content or data model, the administration interface, permissions, workflows, and an extension mechanism: modules, plugins, and hooks (for example, WordPress actions and filters, Drupal modules, Odoo modules). Dominant forces: an extension ecosystem that must keep working across many years of releases; data-model migrations; permissions and audit; multi-tenancy. Customization is the product, so K5 and K3 both rise; the data model itself is surface for data producers and readers (`compatibility.md`); plugin compatibility testing against each release belongs in `release.md`'s downstream tests.

## Data visualization

Owns the mapping from data to marks and encodings, scales, axes, layout, and interaction. A visualization framework should make honest display the default: never show more precision than the data supports (curated classes rather than a falsely precise score), and require stronger evidence for a reassuring label than for a warning [Practice-2026-11-9]. The design literature is the grammar of graphics [Wilkinson], its layered form [Wickham], and declarative grammars for interactive graphics such as Vega-Lite [Vega-Lite]. Dominant forces: a declarative specification (least power: analyzable, portable, easy to generate) against an imperative escape for custom charts [Least-Power]; accessible alternatives for charts; performance on large data. Extension: new marks, scales, transforms. Shifts: K5 rises for custom-chart audiences; K1 for dashboard authors.

## IoT and devices

Owns the device lifecycle, connectivity, messaging, over-the-air updates, and power management. Dominant forces: constrained memory and processing; intermittent connectivity; fleets running many versions at once, which makes version skew permanent; the security of updates; interoperability standards (for example Matter for smart-home devices, MQTT for messaging). Extension: drivers, components, integrations. Shifts: G1 includes signed and verified updates; K3 +1 because a fleet cannot upgrade at once; K7 +2; K10 +1 for footprint. Research: Zephyr, ESPHome, Matter, MQTT.

## Mapping and geospatial

Owns coordinate reference systems, projections, tiling, layers, and spatial indexing. Dominant forces: coordinate-system correctness (carry the reference system and units in types, problem-map C2); data volume; standards for formats and services (OGC). Extension: layers, data sources, renderers. Research: GDAL and PROJ for data and projections; MapLibre, OpenLayers, and Leaflet for display.

## Games

Owns the game loop, the update and render cadence, the scene or entity model, the asset pipeline, and input. Patterns: Game Loop, Update Method, Component, Event Queue [Nystrom]. Dominant forces: the frame budget, so allocations and indirection on the hot path matter; determinism for networking and replays; fast iteration with hot reload; content creators, not only programmers, as consumers. Extension: components and scripts, editor plugins. Shifts: K7 +2; K1 weighed for designers and artists as consumers; the scenario axes add "one frame at the budget limit".

## Background jobs and workflows

Owns scheduling, retries, persistence of job state, concurrency limits, and idempotency. Dominant forces: at-least-once delivery, which makes idempotency a constraint the framework should support by default; durable execution, where workflow code must be deterministic so it can be replayed [Temporal]; poison messages; observability of stuck work. Extension: job handlers, middleware. Shifts: G1 includes bounded retries and dead-letter handling; K2 +1; the failure axis in `scenarios.md` dominates the walkthrough.

## Low-code orchestration

Flow-based tools (Node-RED is the established example) own the flow runtime, message passing between nodes, and a visual editor. They have two surfaces for two audiences: the node API, an extension surface for developers, and the flow editor and flow file format, used by people who may not program. Dominant forces: compatibility of the node ecosystem; portability of saved flows (the flow file format is surface for data producers and readers); isolating user-supplied code; storing credentials. Shifts: K3 for the node API and the flow format; G1 for credential storage; K1 weighed for non-programmers.

## Asset management

Digital or physical asset systems own asset identity, metadata schemas, versions, storage, lifecycle states, permissions, and processing pipelines (ingest, conversion). Dominant forces: stable identity and provenance; metadata schemas that evolve under existing data; large binary storage; audit. Extension: metadata schemas, pipeline processors, storage back ends. Shifts: compatibility of stored data is the main G2 concern; audit is part of G1.

## Mission control and operations dashboards

Owns telemetry ingestion, time-series display, live updates, alarms, layout, and plugin views; NASA's Open MCT is an open-source framework for mission operations displays [OpenMCT], and Grafana extends through plugins for panels, data sources, and apps [Grafana]. Dominant forces: the correctness and freshness of what is displayed, because operators act on it; alarm fatigue; long-running operations. Shifts: K2 for display correctness; a constraint worth enforcing by default (reasoned, not sourced): stale or missing data is shown as stale or missing, never silently replaced by the last value. Durable state is authoritative and the live channel advisory: fetch a snapshot, subscribe, and refetch after a reconnect or any doubt; "no result" is never evidence of health [Practice-2026-11-2].

## Science and engineering

- **Research measurement and data analysis.** Owns the data model (arrays, units, metadata), analysis pipelines, and provenance. Dominant forces: reproducibility; units and coordinates; numerical stability; scientists as consumers, so ease of learning matters; interoperability between array libraries (the Python array API standard [ArrayAPI]). A change in numerical results is a behavioral break, even when no signature changes. Research: workflow frameworks such as Nextflow and Snakemake for pipelines.
- **Biotechnology.** Pipelines over large file-based datasets, file formats, and provenance. Regulated environments may require validation of the software itself; check the regulation that applies before choosing the release process.
- **Robotics.** Owns the node graph, message passing, timing, and hardware abstraction; ROS 2 organizes software as nodes communicating over topics, services, and actions [ROS2]. Dominant forces: real-time behavior, safety, parity between simulation and hardware.
- **Aerospace and defense.** Owns the component model, scheduling, commanding and telemetry, and fault protection; flight-software frameworks such as JPL's F´ and NASA's core Flight System [FPrime], [cFS]. Dominant forces: determinism; certification evidence, such as DO-178C for airborne software [DO-178C], with traceability from requirement to code to test; coding standards such as MISRA C; decades-long lifetimes. Shifts: G1 includes the certification evidence; K9 rises because verification dominates cost; K10 is strict, since every dependency must be qualified too.
- **Weather and environment.** Gridded multidimensional data, coordinate systems, very large arrays, and workflows. Dominant forces: data volume, community data standards (for example the CF conventions for NetCDF), reproducibility.
- **Model-based systems engineering.** Owns the model repository, the metamodel (SysML), views, and the programmatic interface. Dominant forces: model interchange between tools, traceability, metamodel evolution: the metamodel is surface for every model ever saved [SysML].
- **Physics simulation.** Owns the simulation kernel, geometry, physics models, and user hooks; Geant4 is a long-lived example in which the toolkit calls user-supplied action classes [Geant4]. Dominant forces: performance (K7), numerical correctness, extension of physics models by scientists, reproducibility through seeded randomness.

## AI engineering and machine learning

- **Machine-learning libraries** own the model or estimator interface, training loops, data pipelines, and hardware back ends. A uniform interface lets components compose: scikit-learn's estimators, predictors, and transformers share `fit`, `predict`, and `transform`, which makes pipelines and model selection generic [Buitinck]. Dominant forces: composition through uniform interfaces; reproducibility (seeds, versions); hardware back ends; fast-moving upstream research, in tension with stable APIs.
- **AI application frameworks** own model calls, tool calling, prompt assembly, retrieval, evaluation, and agent loops. Prompt text and tool descriptions are behavior, and therefore surface: changing them can change results as much as changing code. Dominant forces: model version skew; evaluation suites acting as the tests that pin behavior; constraints by default for data privacy and tool permissions, with least authority per tool [Miller-Ocap]; untrusted content arriving through retrieved data and tool results. Defaults worth building in [Practice-2026-11-7]: deterministic detection runs first and sets a floor, and the model only adds to it; recurring human verdicts become deterministic rules. Models handle language and explanation, deterministic computation handles numbers that must be reproducible. One model adapter is the only code that touches the model runtime, and the test-double point; the default test suite runs with no model and no network, and a small opt-in suite covers what a fake cannot. Model output enters storage as a structured proposal that a person accepts, edits, or rejects. A verifier model from a different family than the generator is less likely to share its blind spots (reasoned). Agents are configurations (model, effort, prompt, tools) chosen per task, not framework classes. The Model Context Protocol is an extension protocol in this space: hosts and their clients connect to servers that offer tools, resources, and prompts [MCP]. Its specification is versioned by date and its client-side features have changed between versions; name the specification version whenever a design depends on a feature.

## Home automation hubs

Hubs (Home Assistant is the established example) own the device integration model, the entity and state registry, automations, and the interface; integrations are the extension mechanism [HomeAssistant]. Dominant forces: a large integration ecosystem maintained by its community (K3, K5); local operation and privacy; upgrades that must not break the automations users wrote, which are consumer code; the security of devices on the local network.

## Personal AI assistants

A central assistant for one person's home and life owns the conversation loop, memory, the tool and connector registry, and permissions. Dominant forces: privacy and consent, enforced by default (data minimization, explicit permission per tool and per data source); least authority per tool [Miller-Ocap]; an audit trail of actions taken; confirmation before actions that are hard to reverse [Bezos]; provenance for every remembered fact; untrusted instructions arriving inside data. Shifts: G1 covers permissions and confirmation; K2 at 5; the misuse axis in `scenarios.md` includes instructions hidden in documents, messages, and web pages.

## Music software

Digital audio workstations, samplers, sequencers, and synthesizers own the real-time audio callback, the transport and timeline, plugin hosting, event scheduling, parameter automation, and saving and restoring state. Dominant forces:

- **A hard real-time audio thread**: no memory allocation, locks, or blocking I/O inside the audio callback [Bencina]. The framework's surface must make the real-time-safe path the default one, for example by separating the audio thread's interface from the user-interface thread's.
- **Sample-accurate timing** of events and automation.
- **Plugin format compatibility**: hosts and plugins meet through standard formats such as VST3, Audio Unit, and CLAP; JUCE is a widely used C++ framework for writing applications and plugins across those formats [AudioPlugins].
- **Long-lived files**: projects and presets must open years later, and automation refers to parameters by identifier, so parameter identifiers are surface that can never change.

Shifts: K7 +2, because a missed deadline is an audible dropout; G2 covers project, preset, and parameter-identifier compatibility; K3 +1.

Practice [Practice-2026-11-6]: assert real-time safety mechanically (an allocation counter around the audio path in tests); keep golden renders bit-exact except where platform math libraries sit in the signal path, and explain every changed golden; measure latency on target hardware, not in a simulator. Parameter surfaces for people who do not program follow what makes instruments approachable: macros that drive several internal parameters, values quantized to musically meaningful steps, fixed signal topologies instead of free routing, and a small budget of controls per page (cited, not reopened).
