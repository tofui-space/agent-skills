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

## C# decision artifacts

Specs are JSON as described in [csharp/shapes.md](csharp/shapes.md).
Obligations have schema `verifiable.csharp/5`, backend `csharp-decision-v4`, source/spec hashes, the Roslyn informational version as `compiler`, the .NET runtime description as `runtime`, units and unsettled points.
Each unit has a fully qualified name, ordered parameter names, a `claim` (`every input` or `cells`), the `domains` of its parameters and record fields, a case count and the computed checks.
A domain lists the parameter name, or `<parameter>.<field>` for a record field, its type, its values and `unnamed`: for an enum the number that stands for every unnamed value, written as a string, and `null` for every other type.
The values are the cells a spec row can name: `false` and `true`, the member names and `#unnamed`, the ranges of an integer, or the listed strings with `#null` and `#other`.
A check holds an input array with one entry per parameter and an expected result.
An input is a JSON boolean for `bool`, a member name or `#unnamed` for an enum, the number tried for an integer, the string tried or JSON `null` for a string, and for a record an object with one property per field in declaration order.
The checks of an integer or a string hold the values tried, so one cell can appear in several checks.
An expected result is a JSON boolean or a member name.

The tool compares a freshly generated artifact with the saved artifact before execution.
Any change to the text of the source or spec, the Roslyn informational version or the runtime description makes it stale, even if behavior looks unchanged.
The hashes are taken over the decoded text, so adding a byte order mark, or saving the same text in another Unicode encoding with its byte order mark, does not.
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
