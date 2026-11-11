# C# setup and command mapping

This is an initial, restricted backend, not the TypeScript workflow translated to C#.
It admits all methods in one standalone source file or rejects the file. It does not load
a `.csproj` or solution, run source generators, honor application build settings, or invoke
the application's compiled assembly. Read [shapes.md](shapes.md) before selecting a target.

## Build once

Requires a stable .NET 10 SDK and runtime. Choose an absolute temporary build directory
outside the repository, denoted `<build>`. From `<skill>/scripts/dotnet`, run:

```sh
dotnet --version
dotnet build --nologo --artifacts-path <build>
```

Build from that directory so `global.json` selects a stable 10.0 feature band. The project
uses Roslyn assemblies shipped with the SDK and needs no third-party NuGet packages.
Build writes intermediate files and binaries under `<build>`; neither belongs in the skill.
The tool assembly is `<build>/bin/Verifiable/debug/Verifiable.dll`.
Below `<tool>` denotes that assembly. Quote paths containing spaces.

```sh
dotnet <tool> capabilities
dotnet <tool> paths --source=<file.cs>
dotnet <tool> inventory --source=<file.cs> --spec=<spec.json> --out=<obligations.json>
dotnet <tool> check --source=<file.cs> --spec=<spec.json> --out=<obligations.json>
dotnet <tool> run --source=<file.cs> --spec=<spec.json> --out=<obligations.json>
```

All paths are explicit and resolve against the current directory. There is no C#
`verifiable.json`. Never pass C# files to `inventory.ts` or add language settings to it.
`capabilities` and `paths` write no files. `inventory` writes only `--out`.
`check` and `run` rebuild the expected inventory in memory and reject stale artifacts.
`run` then compiles and executes the admitted source in-process against its spec.
Exit 1 means rejected input, stale artifacts, unsupported commands or a failing check;
exit 0 does not mean the spec has received human review.

## Skill commands

- **`:paths`:** build the tool if needed (disclose build artifacts), then run `paths` on each
  selected standalone file. Counts are domain combinations, not traced control-flow paths.
  No specs are checked or methods executed. If one method is unsupported, the whole file
  is rejected and has no admitted count. This version has no single-method line selector.
- **`:coverage`:** follow [the shared workflow](../coverage.md) in a copy. If extraction is
  authorized, isolate pure Boolean decisions while preserving the application's calling
  behavior. Run `paths`; write the requirement/spec; run `inventory`, `check`, and `run`.
  If the project has the C# rules installed, add the file's source, spec and obligations row to their list.
  Run the application's existing build and tests separately using its documented commands.
  Report these as separate evidence. Reconciliation is unavailable: keep existing tests
  and report the overall workflow as partial, even if every standalone check passes.
- **`:mutation` and `:prune`:** unsupported. Do not parse Stryker.NET with the TypeScript
  helper, infer equivalents, or delete tests. Report the missing integration.
- **`:init`:** use the common and C# rules assets. Fill the "Selected files" list with one
  row per selected file, or leave "none yet" when scope is pending. Do not impose
  Boolean-only rules on the entire application.

If extraction would change build semantics (conditional compilation, dependency injection, generated code), leave the code outside this checker and explain why.

## Check the backend itself

```sh
python <skill>/scripts/dotnet/test_backend.py
```

The regression script builds from the SDK-selected directory and creates fixtures and
outputs in a temporary `verifiable-workspace` directory outside the repository. It checks
successful execution, seeded wrong behavior, stale source/specs and unsupported constructs.
Each rejection test asserts the reason, so removing one admission guard fails a test.
It also checks that the tool's `capabilities` output agrees with `scripts/capabilities.json`.
These regressions validate the tool subset; they do not review application requirements.
