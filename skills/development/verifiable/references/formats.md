# Artifacts and backend boundaries

Read this when consuming tool output or extending a backend. Shared terms are unit,
obligation, check, rejection, assumption, outside scope and unsettled requirement. Shared
terms do not imply interchangeable executable formats.

## Existing TypeScript artifacts

Preserve the current `verifiable.json`, TypeScript spec/contract modules, obligations JSON,
and reconciliation JSONL formats. Their definitions remain in `scripts/project.ts`,
`scripts/inventory.ts`, `scripts/reconcile.ts` and the TypeScript references. Existing
entry files resolve `VERIFIABLE_TOOLS` to `scripts/`. No language selector is accepted by
that project configuration. Do not migrate consumers to an invented common schema.

## C# Boolean artifacts

Specs are JSON as described in [csharp/shapes.md](csharp/shapes.md).
Obligations have schema `verifiable.csharp/2`, backend `csharp-boolean-v1`, source/spec hashes, the Roslyn informational version as `compiler`, the .NET runtime description as `runtime`, units and unsettled points.
Each unit has a fully qualified name, ordered parameter names, case count and computed checks with typed Boolean input arrays and expected results.

The tool compares a freshly generated artifact with the saved artifact before execution.
Any change to the source or spec content, the Roslyn informational version or the runtime description makes it stale, even if behavior looks unchanged.
A rebuild of the tool itself is not recorded; only the backend constant identifies its semantics.
Recompute; do not edit hashes or counts by hand.
The backend constant must change when admission or enumeration semantics change, and the schema when the artifact's fields change. Human review remains separate
from programmatic validation; the artifact contains no automatic review certification.

Keep each selected C# source/spec/artifact triple separate. Never merge C# counts into a
TypeScript inventory or reinterpret one backend's rejection as another backend's admission.

## Future shared formats

Share report vocabulary before analysis implementations. A future common envelope should
identify language, backend/version, source scope, compiler settings and evidence status.
Language payloads must retain their value semantics: do not serialize all integers through
JavaScript `number`, erase null/default distinctions, or flatten exceptional outcomes into
ordinary return values. Introduce a versioned common schema only with working consumers
and compatibility tests; the current artifacts above remain distinct.
