# Research areas for generic requirements

Read this at the start of Phase 3. It lists the areas where hand-written specs most often go silent, what to look for in each, and which sources count. Not every area applies to every subject; the framing round and the stack decide. When an area is skipped, say so in the research note under "Not yet researched" so the gap is visible.

## How to research an area

1. Identify the primary source for the stack found in Phase 1: the framework's official documentation, the platform vendor's reference, the standard's own text. Always write the version of the standard you cite; numbering changes between versions.
2. Read what the source states as a default, a requirement, or a recommended practice for this area.
3. Turn each relevant statement into one candidate line: the item as it would be written in the document, the source with section, and a recommended verdict.
4. Mark anything that has no primary source as `industry practice, no standard cited`. It can still be proposed; the label is what keeps it honest.
5. Cap candidates per area at five for the first pass. Depth comes from the user asking for more, not from the first round being exhaustive.

Source classes, in order of trust:

1. Standards bodies and specifications: W3C, IETF RFCs, ISO, NIST, OWASP.
2. Official documentation of the framework, runtime, database, or platform in use, at the installed version.
3. Vendor guidance from the hosting or cloud provider in use.
4. Widely adopted community checklists, only as leads to one of the above.

Blog posts, forum answers, and aggregator sites are leads, not sources. A candidate built only on one of these is labeled as industry practice.

## The areas

### Actors, access, and authorization

Look for: role model (who can do what), authentication method already in the codebase, session lifetime, password or credential rules, account lifecycle (invite, disable, delete).
Sources: OWASP ASVS chapters on authentication and session management; framework auth documentation.
Often missed: what an unauthenticated user can see; what happens to a user's data when the account is deleted.

### Input validation and error handling

Look for: validation at the boundary, error response format, user-facing error wording, retry and idempotency for writes, partial-failure behavior.
Sources: RFC 9457 for HTTP APIs; framework validation and error-handling docs; OWASP ASVS input validation chapter.
Often missed: duplicate submissions; what the user sees when a dependency is down.

### Data: model, retention, privacy

Look for: what personal data is stored, for how long, who can export or delete it, backup and restore expectations, audit needs.
Sources: applicable data-protection law for the deployment region (read the primary legal text, not summaries); database vendor docs on backups; OWASP ASVS data protection chapter.
Often missed: retention of logs and notifications, not just primary records; test data containing real data.

### Security beyond auth

Look for: transport security, secrets handling, dependency update policy, rate limiting, content security for web UIs, file upload rules.
Sources: OWASP ASVS; OWASP Top 10 as a lead; framework security documentation; platform docs for secrets.
Often missed: rate limiting on unauthenticated endpoints; upload size and type limits.

### Accessibility

Look for: target conformance level, keyboard operation, focus management, color contrast, form labeling, motion and animation preferences.
Sources: W3C WCAG (current version) and the ARIA Authoring Practices Guide; component library accessibility docs.
Often missed: the conformance level is never named, so nothing is testable.

### Internationalization and localization

Look for: languages supported at first release, date, number, and currency formats, text expansion in layout, right-to-left, time zones.
Sources: framework i18n docs; Unicode CLDR for locale data; W3C internationalization guidance.
Often missed: time zones on server-side scheduling; sorting and case-folding rules per locale.

### API and interface conventions

Look for: naming, versioning, pagination, filtering, response envelope, deprecation policy, documentation format.
Sources: the API style guide already in the repository if any; OpenAPI specification; framework routing docs.
Often missed: how breaking changes are announced; maximum page size.

### Performance and capacity

Look for: latency targets per operation class, expected concurrent users, data volume at one year, payload size limits, timeouts.
Sources: platform limits documentation; framework performance docs; web performance guidance from W3C or the browser vendors for UIs.
Often missed: a number. "Fast" appears in the spec and nothing is measurable.

### Reliability and operations

Look for: availability target, deployment shape, health checks, graceful shutdown, backup schedule, runbook expectations.
Sources: platform or cloud vendor reliability documentation; framework deployment docs.
Often missed: what happens during a deploy; who is paged.

### Observability: logging, metrics, tracing

Look for: log format, correlation IDs, what must never be logged, metric names for the core operations, trace propagation.
Sources: OpenTelemetry specification; framework logging docs; platform logging limits.
Often missed: personal data in logs; log retention.

### Testing and quality gates

Look for: test levels expected (unit, integration, end-to-end), coverage expectations if any, what blocks a merge, contract tests for external dependencies.
Sources: the repository's existing CI config and test layout first; framework testing docs.
Often missed: how external services are faked in tests.

### Delivery: CI, environments, release

Look for: environments (dev, staging, production), promotion rules, feature flags, migration policy, rollback expectations.
Sources: existing CI config; platform deployment docs; framework migration docs.
Often missed: whether a migration may be destructive; who approves a production release.

### Documentation and support

Look for: what documentation ships with the release, in-product help, changelog policy, support channel and response expectations.
Sources: repository conventions; documentation tooling in use.
Often missed: who updates the docs when behavior changes.

### Licensing and third-party terms

Look for: license of the project itself, license compatibility of dependencies, terms of any external API used, attribution requirements.
Sources: the license texts themselves; the SPDX license list; the external provider's terms page.
Often missed: an external API's rate or usage terms that bound the design.

## Area selection by subject

| Subject | Areas to research first | Usually inherited |
|---|---|---|
| Feature in an existing codebase | Data, error handling, access, testing | Everything recorded in existing constraints |
| New service in an existing system | Above, plus API conventions, observability, delivery | Accessibility and i18n if there is no UI; security baseline if system-wide |
| New project | All, in the order listed above | Nothing |

When the user asks for "just the essentials", research data, error handling, and security beyond auth, and list the rest as not yet researched.
