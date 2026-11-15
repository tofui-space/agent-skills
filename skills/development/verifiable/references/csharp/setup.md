# C# setup and command mapping

This is an initial, restricted backend, not the TypeScript workflow translated to C#.
It admits all methods in one source file or rejects the file.
The file is checked standalone, or with `--project` as one of the files of its project, compiled with that project's settings.
It does not load a solution or invoke the application's compiled assembly.
Read [shapes.md](shapes.md) before selecting a target.

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
dotnet <tool> run --source=<file.cs> --project=<app.csproj> --spec=<spec.json> --out=<obligations.json>
```

All paths are explicit and resolve against the current directory. There is no C#
`verifiable.json`. Never pass C# files to `inventory.ts` or add language settings to it.
`capabilities` and `paths` write no files. `inventory` writes only `--out`: over an obligations file, or as a new file whose name ends with `obligations.json`.
With `--project`, every command builds the project first, with everything a build writes; the next section says how.
`check` and `run` rebuild the expected inventory in memory and reject stale artifacts.
`run` then compiles and executes the admitted source in-process against its spec.
Exit 1 means rejected input, stale artifacts, unsupported commands or a failing check;
exit 0 does not mean the spec has received human review.
Any other exit code means the tool itself failed, and nothing was admitted or checked.
On Windows the tool writes its lines in the code page of the console, so a file name with letters outside ASCII can arrive garbled where the output is read as UTF-8.
A very long chain or nesting in one method ends the tool that way, with a stack overflow.
In runs of `paths` with the debug build on .NET 10, 1,800 operands joined by `||` or by `&&` were admitted and 2,000 were not; 2,000 patterns joined by `or` were admitted and 2,400 were not.
2,000 operands joined by `+` in a result were admitted and 2,200 were not.
1,000 `else if` branches and 1,000 nested parentheses were admitted, and 10,000 of either were not.
A formula in a spec ends the tool the same way when it is nested that deep: 1,600 nested parentheses were read and 2,400 were not, and 2,000 minus signs in a row were read and 3,000 were not.

## A file inside its project

Use `--project=<app.csproj>` when the selected file names an enum, a record or a constant that another file of the project declares, or when it has `using` directives.
Every command takes it.
The selected file must be one of the files the project compiles, and it is still held to every rule of [shapes.md](shapes.md).

With `--project`, every command does four things before it looks at the selected file.

1. It builds the project with `dotnet build`, the command a person runs, and adds nothing to it. The build restores packages, builds the projects this one refers to, and runs every step of the project.
2. It asks the project's build a second time, without compiling anything, for the command line it gives the compiler (`dotnet msbuild` with the targets `BeforeBuild` and `Compile` and the properties `ProvideCommandLineArgs`, `SkipCompilerExecution`, `NonExistentFile` and `BuildProjectReferences=false`).
   From that command line it compiles the project in memory: the same source files, references, language version, defined symbols, path mapping and options, signed with the project's key.
   It runs the project's code generators itself, the way the compiler does.
3. It reads the program the build wrote and compares it with its own compilation: every type, field, property, event and method, instruction by instruction, with the methods each property and event names.
   If the two differ anywhere, the tool refuses. It never checks code that is not the code of the built program.
4. Only then does it read the selected file, and `run` executes the selected methods in the assembly that was compared.

- **`--configuration=<name>`:** the build configuration, as for `dotnet build -c`. Without it the project's default applies, usually `Debug`.
- **`--framework=<name>`:** the target framework, as for `dotnet build -f`. A project with several target frameworks needs it, and the build refuses a framework the project does not target.
- **What is stored:** the obligations file names the project file and the configuration and framework the build really used. A command that builds another configuration or framework finds the stored checks stale.
- **The SDK:** the tool starts the build through the `dotnet` command of the search path, in the project's folder, so it runs with the SDK that a `global.json` near the project selects.
  The tool compiles with its own compiler. When that compiler writes other instructions than the project's, the comparison fails and the tool refuses; build the tool with the SDK the project uses.

What the tool refuses, each with its reason in the message:

- a project that does not build;
- a built program that is not what the tool compiles from the same files and options. Causes seen so far: a build step that changes a file, an option or the assembly around the compiler; a code generator that writes something else on each run, such as the time of the build; a project that builds with another compiler version than the tool's, for example through a `global.json` that selects another SDK;
- a project that writes no program where its build says it does;
- a project whose build writes only a reference assembly (`ProduceOnlyReferenceAssembly`), which has no code to run;
- a project whose build instruments its code (the compiler option `/instrument`, for example for test coverage), because every method would then call code that was never admitted;
- `run` for a project that targets .NET Framework, a newer .NET than the tool runs on, or a processor type other than the tool's own, because the checks run in the tool's process and say what the code does there;
- a computed result in a project that compiles with overflow checks (`CheckForOverflowUnderflow`), because a formula is evaluated with arithmetic that wraps;
- a project with a module initializer, because the initializer would run before the first checked method;
- a source file that is no valid UTF-8 in a project that names no code page.

What must be reported with every result:

- Every command builds the project, `paths` and `check` included. The project's build steps, analyzers and code generators run, and the generators run a second time inside the tool. Run the tool only on a project you would build.
- The last line of `run` names the project file, the configuration, the framework, and the runtime and processor type the checks ran on. Repeat it; the result holds for those and for nothing else.
- The comparison covers code: types, fields, methods with their headers, and instructions. It does not cover attributes, resources or data that the instructions point to.
- The result holds for the build as it runs in this environment. A variable of the environment that the build reads, or a project file that tells the tool another output path than the one it ships, is not seen.

The source hash of the obligations file covers the selected file only.
A change in another file, in a referenced project or in the project file makes the obligations stale when it changes a cell or a check: a constant that a condition compares with, an enum member, a record field.
A changed constant inside a result expression changes no check, since expected values come from the spec; `check` then still answers `CURRENT`, and `run` fails with `the code computes ..., and the spec states ...`.
So after a change anywhere in the project, `run` is the command that answers, not `check`.

## Skill commands

- **`:paths`:** build the tool if needed (disclose build artifacts), then run `paths` on each
  selected file, with `--project` when the file belongs to a project and needs its types, constants or `using` directives. Counts are domain combinations, not traced control-flow paths.
  Report the claim word per method (`every input` or `cells`) and, for an enum parameter or record field, the unnamed cell.
  For a number or a string, say that the cells printed are the ones the code tells apart, and that the count can grow when a spec states its own cells.
  The count is for the inputs a condition reads; an input that nothing reads is tried side by side with the others, and its count joins the product once a spec row names one of its cells.
  For a `double`, name the `#nan` cell, which every `double` input has.
  No specs are checked or methods executed. If one method is unsupported, the whole file
  is rejected and has no admitted count. This version has no single-method line selector.
  When the rejected code cannot be reshaped into decisions, [beyond-enumeration.md](beyond-enumeration.md) says which other technique fits and what it leaves unchecked.
- **`:apply`:** follow [the shared workflow](../coverage.md) in a copy. A file of a project that holds only admitted declarations is checked where it is, with `--project`; say that the tool built the project to do so. If extraction is
  authorized, isolate pure decisions and computed results over `bool`, enums, numbers, strings and records of them into a file of their own while preserving the application's calling
  behavior. Run `paths`; write the requirement/spec; run `inventory`, `check`, and `run`.
  For a computed result, write each formula from the requirement, and report a failure that reads `the code computes ..., and the spec states ...` as a difference in the computation, not in one number.
  If the project has the C# rules installed, add the file's source, spec and obligations row to their list.
  Run the application's existing build and tests separately using its documented commands.
  Report these as separate evidence. Reconciliation is unavailable: keep existing tests
  and report the overall workflow as partial, even if every check passes.
  For a file checked with `--project`, repeat the differences from the project's build that the section above lists.
- **`:mutation` and `:prune`:** unsupported. Do not parse Stryker.NET with the TypeScript
  helper, infer equivalents, or delete tests. Report the missing integration.
- **`:init`:** use the common and C# rules assets. Fill the "Selected files" list with one
  row per selected file, or leave "none yet" when scope is pending. Do not impose
  the decision subset's rules on the entire application.

If extraction would change build semantics (conditional compilation, dependency injection, generated code), leave the code outside this checker and explain why.
The same holds for a project the tool refuses: do not copy its files into a standalone file to get around the refusal without saying what the copy leaves out.

## Check the backend itself

```sh
python <skill>/scripts/dotnet/test_backend.py
```

The regression script builds from the SDK-selected directory and creates fixtures and
outputs in a temporary `verifiable-workspace` directory outside the repository. It checks
successful execution, seeded wrong behavior, stale source/specs and unsupported constructs.
For a file inside a project it writes sample projects there, restores them and lets the tool build them; they have no package references, so no package is downloaded.
One of them is a small code generator built from the compiler assemblies of the SDK, one is signed with a key pair the test makes, and two have a build step that makes the built program differ from the files on disk.
It changes the project's settings and each other file one at a time and expects the cells, the checks or the run to follow, and it asserts the reason of every refused project.
One of these tests needs a .NET 11 SDK next to the .NET 10 SDK and is reported as skipped without it.
For numbers and strings it moves each boundary and changes each constant of its fixtures, one at a time, and expects a failing check every time.
For computed results it compares the expected value of every check with a second evaluation written in Python, and changes each operator, operand and grouping of its fixtures, in the code and in the spec.
Each rejection test asserts the reason, so removing one admission guard fails a test.
It also checks that the tool's `capabilities` output agrees with `scripts/capabilities.json`.
These regressions validate the tool subset; they do not review application requirements.
