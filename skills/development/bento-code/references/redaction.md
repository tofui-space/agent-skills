# Redacted workspaces

Main agent only. Use a redacted workspace when an agent must work against code whose
implementation it must not see, and ordering cannot keep the implementation from existing
yet (for example, documenting or testing existing code that has no written contract).

## Rules

- Build it with a script or tool wherever one exists. Redact by hand only what no tool
  covers, and say which parts were hand-redacted in the redaction map.
- Put it under `<workspace-dir>/agents/<agent-name>/`, never inside the repository, never
  with version-control metadata.
- Replace function bodies with a body that carries no behavior and still type-checks:

  ```ts
  export function lateFee(loan: Loan): Money {
    throw new Error("<redacted: body of lateFee>");
  }
  ```

  Never return a static value. A placeholder value is false information and becomes an
  anchor for whatever the agent writes.
- Remove private members entirely.
- Remove imports that the public signatures do not need; they reveal dependencies.
- Remove comments that are not part of the contract. Keep docstrings on public members
  only when the agent is allowed to see the existing contract.
- Keep names. Names are part of the interface; they also leak intent. Record that in the
  redaction map when a name reveals implementation (`getCachedEntry` reveals a cache).
- Prose: replace a hidden section with `<redacted section>`. Use a description such as
  `<section about retry timing>` only when the agent is meant to know the topic exists.

## Tools

| Language | Command | Notes |
|---|---|---|
| TypeScript | `tsc --declaration --emitDeclarationOnly --outDir <ws>` | Emits `.d.ts` files: signatures without bodies. Private members appear as `private x;` without types — remove them. |
| Python | `stubgen -o <ws> <package>` (from mypy) | Emits `.pyi` stubs. Private names are excluded unless `--include-private` is given. |
| Other | hand-redact with the rules above | Record the method as `hand` in the redaction map. |

## Redaction map

Write `<run-dir>/redaction-map.md` (main only) for every redacted workspace:

```markdown
## <agent-name>
- source: <repo paths>
- method: <tool and command> | hand
- removed: bodies, private members, imports, comments, <other>
- kept: names, public signatures, <other>
- known leaks: <names or structure that reveal implementation, or "none noted">
```
