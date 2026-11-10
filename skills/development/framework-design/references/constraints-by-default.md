# Constraints by default

A framework is the one place every application built on it passes through. A business constraint enforced there, on by default, holds in every application without each team remembering it; the same constraint left to each consumer holds only where someone remembered. "Ideally, libraries only expose an interface that makes writing code with common classes of security vulnerabilities impossible" [BSRS].

## Contents

- Principles
- Design rules
- Constraint catalog
- Adding or tightening a constraint in a published framework
- Verifying that a constraint holds

## Principles

- **Fail-safe defaults**: base access decisions on permission rather than exclusion [Saltzer-Schroeder].
- **Complete mediation**: check every access, at one point that every access passes [Saltzer-Schroeder].
- **Psychological acceptability**: the protected path must be the easy path, or people route around it [Saltzer-Schroeder]. Its framework form is the pit of success: consumers "simply fall into winning practices by using our platform and frameworks" [PitOfSuccess].
- **Safe by construction**: make the vulnerable code impossible to write through the API's types, instead of reviewing for it afterwards [Kern], [BSRS], [Wang-Bangert-Kern].
- **Secure by default, at no extra cost**: protections work out of the box, and security features such as logging or single sign-on are not sold as add-ons [CISA-SbD], [OWASP-PC].
- **Security belongs to the framework, not to each application**: a constraint that every application must remember to configure is a constraint most applications will lack [Practice-2026-11-2].

Where the law requires protection by design and by default (data protection), or accessibility conformance, those constraints are gates (G1 in `tradeoffs.md`), not weights. Each risk-reducing default also states where it stops helping: rich types turn into type gymnastics where the language lacks the features, so apply them at boundaries; fail-closed defaults can lock legitimate users out, so pair each with a documented recovery path.

## Design rules

1. **On by default**, including in the starter template, the documentation's first example, and every code generator the framework ships.
2. **One choke point per control**: enforce in the dispatch, binding, rendering, or query-building path that every request or operation passes, not in each consumer's handler. Function-level authorization (may this caller use this operation) and object-level authorization (may this caller act on this record) are separate controls [OWASP-API]: the first sits at dispatch; the second cannot, because dispatch does not know the record, so it sits in the shared data-access layer, not in each handler [Practice-2026-11-2].
3. **Fail closed**: an unknown input field is rejected or stripped; a missing configuration value stops startup; a route with no declared policy is denied, or receives the strictest protection common to all routes. Requiring every extension to declare a policy couples every extension to the policy model; applying the strictest default to undeclared routes keeps fail-closed behavior without that coupling. Absence of a declaration never means "no check" [Practice-2026-11-2].
4. **Explicit, narrow, named opt-out**: per call, route, or field, never one global switch; named for its risk, so that it is easy to search for and to flag in review. Some protections get no opt-out at all (security headers, for example); an opt-out exists only where a legitimate scenario needs one. Established examples: React's `dangerouslySetInnerHTML`, Angular's `DomSanitizer.bypassSecurityTrustHtml`, Django's `mark_safe` against its default autoescaping, Rails' strong parameters, which refuse mass assignment of attributes that are not explicitly permitted.
5. **Safe values have their own types**: escaped markup, constant query text, validated identifiers. The constructor that creates such a value from unchecked input is the opt-out, and lint can find every use of it. The W3C Trusted Types API applies this to the browser's DOM sinks [TrustedTypes].
6. **Visible configuration**: the framework can report which constraints are disabled, and where, for example in a startup log line or a report command.
7. **Declared once**: the business rule has one source of truth in the framework, not a copy per consumer.
8. **Versioned as a contract**: loosening a default is a security regression and never ships in a patch; tightening one is a behavioral break, rolled out as described below.
9. **Every entry point, including the in-process ones**: the data API that consumers' own code calls (hooks, actions, repositories, server functions) is an entry point too; apply the same access rules and tenant scope there by default, and give the trusted bypass its own explicitly named API [Practice-2026-11-2].
10. **Derived records get their own rule**: history, revisions, drafts, and pending edits get a read rule of their own, stricter by default than the row's, because a public row does not make its unpublished edits public [Practice-2026-11-2].
11. **One enforcement, not two**: when a wrapped library enforces its own copy of a constraint (its own rate limiter, its own session check), switch that copy off and enforce once at the framework's choke point, with lower layers declaring their budgets as data [Practice-2026-11-2].
12. **Rights from roles held on resources** rather than from an owner field, when ownership can move or its holder can leave [Practice-2026-11-2]. Permissions are declared in code and namespaced per extension; the assignment of roles is data.
13. **Hints follow the rule**: "what this user may do" hints sent to clients are computed by the same rule that enforces them, and documented as display hints, never as authorization.

## Constraint catalog

Constraints that frameworks commonly provide by default. For each, the default behavior, the shape of the opt-out, and the check.

| Constraint | Default | Opt-out shape | Check |
|---|---|---|---|
| Output encoding (cross-site scripting) | Templates and components escape every value | A named raw-output call, or a safe-markup type built from unchecked input | Lint rule flagging the raw call; DOM-sink restrictions such as Trusted Types |
| Query construction (injection) | Parameterized queries by construction | Raw query accepting only constant text or a typed trusted value | Type check; lint for string concatenation into queries |
| Request forgery | Token check on every state-changing request | Per-route exemption, named | Test enumerating state-changing routes |
| Mass assignment | Input binding only to explicitly permitted fields; unknown fields rejected or stripped (a decision to make once: rejecting is stricter, stripping tolerates clients that send more, and an extensibility guideline may forbid closed schemas). An allowlist of fields is not field-level authorization, which is a separate control [OWASP-API] | None, or a named "permit all" for internal tools | Lint for permit-all |
| Access control | Deny by default; function-level checks at dispatch, object-level checks in the data-access layer; an undeclared operation gets no endpoint and no client method, or the strictest common protection | A named "anonymous" marker per route | Architecture test: every registered route has a policy or the default protection |
| Output | Responses serialized through a required output schema, so unlisted fields never leave [Practice-2026-11-1] | None | Startup check: every endpoint has an output schema |
| Input validation | Schema at the boundary, parsed into typed values [King] | None | Type check: handlers receive parsed types only |
| Secrets and configuration | Validated at startup; secrets never logged; no default credentials | None | Startup check; log redaction test |
| Personal data | Marked fields redacted in logs and errors by default | Named unredact call for authorized use | Test: logs contain no marked field |
| Audit | Security-relevant events logged with a stable schema | None | Test per event kind |
| Tenancy isolation | Every query scoped to the current tenant | A named cross-tenant call | Architecture test: no unscoped data access outside one module |
| Limits | Request size, rate, timeouts, and page sizes bounded by default at request-facing endpoints, with truncation reported as a status, never silent; in-process queries are bounded by their caller | Per-route raise, named, with an upper bound | Startup check for unbounded settings |
| Destructive operations | Development schema sync only adds and stops on any statement that would lose data; destructive commands resolve identifiers in the narrowest namespace and refuse ambiguous ones | A named, explicit destructive command | Test: a removed declaration stops startup instead of dropping data |
| Transport and headers | Secure cookie flags, security headers, TLS required | Per-header override | Response header test |
| Error disclosure | Production errors hide internals | Development mode only | Test in production mode |
| Accessibility | Components require accessible names by type | None | Type check; lint |

## Adding or tightening a constraint in a published framework

Turning a constraint on breaks every consumer that relied on its absence. Roll it out in stages:

1. **Report-only, in a minor release**: the framework detects and reports violations without blocking them. The `Content-Security-Policy-Report-Only` header is a precedent from the web platform.
2. **Opt-in enforcement**, in the same or a later minor release, so that consumers can switch it on per application.
3. **Enforcement by default, in the next major**, with the migration steps and the opt-out documented.

For an actively exploited weakness, the security process (`release.md`) can override this schedule; say so in the advisory.

## Verifying that a constraint holds

- **Complete mediation test**: enumerate every entry point (routes, handlers, commands, server functions, message consumers, the in-process data API) and assert that each passes the choke point or carries the named opt-out. Enumerate at the point where requests are actually handled: a hook that runs at route registration can see fewer routes than one that runs per request.
- **Enforcement, not declaration**: a gate that is declared but not applied (a security requirement in the published contract with no check behind it) makes the contract claim a protection that does not exist; test the behavior, not the declaration.
- **Derived from declarations**: where a safety property depends on what an extension declares, derive it from the declaration and test that a misdeclared extension cannot weaken it.
- **Misuse scenarios** from `scenarios.md`, one per constraint, as tests and, where the type system can express them, as must-not-compile fixtures.
- **A lint rule or analyzer** that flags each opt-out, so that every use is visible in review (`enforcement.md`).
- **A default-configuration test**: a fresh application from the starter template has every constraint on.
