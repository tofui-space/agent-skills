# C# project loading, test-framework execution and mutation sorting: primary-source findings

Date of research: 2026-11-11.
Scope: what a restricted C# decision checker would need in order to load real projects, run its checks under MSTest, sort a mutation report, and reconcile existing tests.
Nothing in this document was executed.
Every claim rests either on documentation prose or on source code that was read and not run, and each row says which.

## (a) Summary for a meeting

As of 2026-11-11, .NET 11 (released 2026-11-10, default language C# 15) and .NET 10 (default language C# 14) are the two supported releases, and .NET 8 and .NET 9 reached end of support on 2026-11-10.
MSTest is at 4.5.3 and Microsoft.Testing.Platform (MTP) is at 2.5.3, both published on 2026-11-11.
`dotnet test` uses VSTest unless `global.json` (SDK 10 and later) or an environment variable (SDK 11) selects MTP.
The compiler platform's MSBuild workspace opens a real project through a separate build process and, as read in its source, takes parse options, compilation options, references and analyzer references from the project's own compiler command line, and runs the project's source generators.
A check that runs inside the project's compilation as an analyzer can read a spec as an additional file, but the published analyzer rules ban file access, process creation and loading assemblies from bytes, so that route can inspect code and cannot execute it.
MSTest can enumerate computed rows through dynamic data sources, each unfolded row is a separately selectable test, and MTP documents JSON discovery, selection by test identifier, numbered exit codes and TRX output.
Stryker.NET 5.1.0 writes a JSON report whose field names match the shared mutation-testing report schema that StrykerJS also uses, records which tests covered and killed each mutant, and labels its MTP runner a preview.
No first-party source was found that reports which lines a single test executed.
The nearest documented mechanisms are a coverage session that can be snapshotted and reset, and running one test per process.
Section (d) proposes experiments for every point that rests on reading alone.

## (b) Findings per question

### How to read the tables

`cited` means the source was opened on 2026-11-11 and contains the quoted text.
`read` is used only for files in the local repository that were opened on the same day.
`unverified` means the claim was recalled or its source could not be opened.
Each claim starts with the kind of evidence: `Docs` for documentation prose, `Code` for source code read and not run, `Registry` for package registry data, `Schema` for a schema file.
Documentation prose is a claim by its author and is not proof of behaviour.
Source code was read on the default branch on 2026-11-11, which is not necessarily the code inside a released package.
Pages published on learn.microsoft.com under `/dotnet` were read as their source files in the `dotnet/docs` repository, branch `main`, and not as rendered pages.
Package pages on nuget.org were read through a fetch tool that returns a summary, so the quoted text for those rows is the tool's rendering of the page.
Package versions were also read directly from the registry's registration index, which is JSON.
Quotes of table rows join the cells with a slash.

### Q0. Baseline read from the local repository

Paths in this table are relative to the directory that holds the checker.

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| L1 | Code: the C# backend parses one source file with a fixed language version and does not read project settings. | `scripts/dotnet/Program.cs` line 72 | `var tree = CSharpSyntaxTree.ParseText(source, new CSharpParseOptions(LanguageVersion.CSharp14));` | read |
| L2 | Code: the backend rejects any preprocessor directive, using directive, extern alias and assembly attribute. | `scripts/dotnet/Program.cs` lines 74 to 76 | `Require(!root.DescendantTrivia().Any(t => t.IsDirective), "preprocessor directives are unsupported");` | read |
| L3 | Code: the backend compiles against the tool's own runtime assemblies and not against the application's references. | `scripts/dotnet/Program.cs` lines 79 to 83 | `var referencePaths = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES"))?.Split(Path.PathSeparator)` | read |
| L4 | Code: the backend runs the admitted methods by emitting to memory and loading the result into a collectible load context inside the tool process. | `scripts/dotnet/Program.cs` lines 166 and 169 | `var assembly = context.LoadFromStream(emitted);` inside a context created with `isCollectible: true` | read |
| L5 | Code: the backend's own capability list names project loading, reconciliation, mutation, pruning and test-runner integration as unsupported. | `scripts/dotnet/Program.cs` lines 53 to 54 | `unsupported = new[] { "project-loading", "classifiers", "adapters", "wiring", "conversions", "contracts", "reconcile", "mutation", "prune", "test-runner-integration" }` | read |
| L6 | Code: the tool project references the compiler assemblies that ship inside the SDK and declares no package reference. | the project file in `scripts/dotnet`, lines 11 to 18 | `<HintPath>$(MSBuildSDKsPath)/../Roslyn/bincore/Microsoft.CodeAnalysis.dll</HintPath>` | read |
| L7 | Code: the TypeScript mutation helper reads only `files`, and per mutant `mutatorName`, `replacement`, `status` and `location.start` and `location.end` with `line` and `column`. | `scripts/mutation.ts` lines 8 to 19 (types `Position`, `Mutant`, `Report`) | `type Mutant = { readonly mutatorName: string; readonly replacement?: string; readonly status: string; readonly location: { readonly start: Position; readonly end: Position } }` (line breaks removed) | read |
| L8 | Code: the helper counts `Survived` and `NoCoverage` as alive, and `Killed` and `Timeout` as killed. | `scripts/mutation.ts` lines 38 and 114 to 117 | `const alive = new Set(['Survived', 'NoCoverage'])` | read |
| L9 | Code: the helper accepts absolute or root-relative file keys and recovers the original text from the report's own `source` using one-based line and column. | `scripts/mutation.ts` lines 40 to 45, 110 and 119 to 123 | `isAbsolute(name) ? name : join(project.root, name)` | read |
| L10 | Code: the helper finds the unit that holds a survivor with the TypeScript parser, so that step is language specific. | `scripts/mutation.ts` lines 47 to 67 | `const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true)` | read |

`scripts/dotnet/Program.cs`, the project file and `global.json` in `scripts/dotnet`, `references/csharp/setup.md` and `scripts/mutation.ts` were read in full.
`scripts/reconcile.ts` was read for its first 140 lines of 887, which is not enough to state what it does beyond its exported types.

### Q1. Current platform state

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q1-1 | Docs: .NET 11 is released and in active support as a Standard Term Support release. | https://raw.githubusercontent.com/dotnet/core/main/releases.md | Table row: ".NET 11.0 / November 10, 2026 / STS / Active / 11.0.0 / November 14, 2028". | cited |
| Q1-2 | Registry: the release index lists 11.0.0 with SDK 11.0.100, and 10.0.15 with SDK 10.0.404, both dated 2026-11-10 and both in the active phase. | https://raw.githubusercontent.com/dotnet/core/main/release-notes/releases-index.json | Field values read: channel 11.0, latest-release 11.0.0, latest-sdk 11.0.100, support-phase active, release-type sts, eol-date 2028-11-14; channel 10.0, latest-release 10.0.15, latest-sdk 10.0.404, support-phase active, release-type lts, eol-date 2028-11-14. | cited |
| Q1-3 | Docs: .NET 10 is the supported Long Term Support release. | https://raw.githubusercontent.com/dotnet/core/main/releases.md | Table row: ".NET 10.0 / November 11, 2025 / LTS / Active / 10.0.15 / November 14, 2028". | cited |
| Q1-4 | Docs: .NET 9 and .NET 8 are listed as end of life with end of support on 2026-11-10. | https://raw.githubusercontent.com/dotnet/core/main/releases.md | Table rows under "End-of-life releases": ".NET 9.0 / November 12, 2024 / STS / 9.0.23 / November 10, 2026" and ".NET 8.0 / November 14, 2023 / LTS / 8.0.34 / November 10, 2026". | cited |
| Q1-5 | Docs: the default language version is C# 15 for .NET 11 and C# 14 for .NET 10. | https://raw.githubusercontent.com/dotnet/docs/main/docs/csharp/language-reference/includes/default-langversion-table.md | Table rows: ".NET / 11.x / C# 15" and ".NET / 10.x / C# 14". | cited |
| Q1-6 | Docs: using a language version newer than the one tied to the target framework is unsupported. | https://raw.githubusercontent.com/dotnet/docs/main/docs/csharp/language-reference/language-versioning.md | "C# 15 is supported only on .NET 11 and newer versions. C# 14 is supported only on .NET 10 and newer versions." | cited |
| Q1-7 | Registry: MSTest 4.5.3 is the latest stable version, published 2026-11-11. | https://www.nuget.org/packages/MSTest | Page title "NuGet Gallery / MSTest 4.5.3" and "Last updated 11/11/2026". | cited |
| Q1-8 | Registry: the MSTest package for net8.0 and net9.0 depends on the VSTest SDK package, the MTP coverage and TRX extensions, the adapter and the framework. | https://www.nuget.org/packages/MSTest | Dependency list as rendered: "Microsoft.NET.Test.Sdk >= 18.10.2", "Microsoft.Testing.Extensions.CodeCoverage >= 18.12.0", "Microsoft.Testing.Extensions.TrxReport >= 2.5.3", "MSTest.TestAdapter >= 4.5.3", "MSTest.TestFramework >= 4.5.3". | cited |
| Q1-9 | Registry: Microsoft.Testing.Platform 2.5.3 is the latest stable version, published 2026-11-11. | https://www.nuget.org/packages/Microsoft.Testing.Platform | "Last updated: 11/11/2026" with version 2.5.3 at the top of the list; assets for .NETStandard 2.0, net8.0 and net9.0. | cited |
| Q1-10 | Docs: the repository release for tag v4.5.3 pairs MSTest 4.5.3 with MTP 2.5.3. | https://api.github.com/repos/microsoft/testfx/releases?per_page=6 | "See MSTest 4.5.3 release notes [here](...). See Microsoft.Testing.Platform (MTP) 2.5.3 release notes [here](...)." (link targets shortened) | cited |
| Q1-11 | Registry: MSTest.Sdk, MSTest.TestFramework, MSTest.TestAdapter, Microsoft.Testing.Extensions.TrxReport and Microsoft.Testing.Platform.MSBuild are on the same release line (4.5.3 or 2.5.3, 2026-11-11), and Microsoft.NET.Test.Sdk is at 18.12.0 (2026-11-11). | https://api.nuget.org/v3/registration5-gz-semver2/mstest.sdk/index.json (same path pattern for the other package ids) | Registration entries read: version 4.5.3, published 2026-11-11, listed true. | cited |
| Q1-12 | Docs: `dotnet test` has two modes, and VSTest is the default. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-with-dotnet-test.md | "*VSTest* mode: This is the default mode for `dotnet test` and was the only mode available before the .NET 10 SDK." | cited |
| Q1-13 | Docs: MTP mode is selected by a `test.runner` entry in `global.json`, available since SDK 10. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tools/dotnet-test.md | "With the .NET 10 SDK and later versions, select Microsoft.Testing.Platform (MTP) in the `global.json` file" followed by `{ "test": { "runner": "Microsoft.Testing.Platform" } }`. | cited |
| Q1-14 | Docs: `VSTest` is a valid value of the same setting and may be omitted. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tools/dotnet-test.md | "`VSTest` is a valid value for test runner. It is the current default and can be omitted." | cited |
| Q1-15 | Docs: from .NET 11 an environment variable selects the runner and overrides `global.json`. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tools/dotnet-test.md | "Starting with .NET 11, set the `DOTNET_TEST_RUNNER` environment variable to select the runner without changing `global.json`. The environment variable accepts `VSTest` or `Microsoft.Testing.Platform`, without regard to case, and overrides the `global.json` value" | cited |
| Q1-16 | Docs: when neither setting selects a runner, VSTest is used. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tools/dotnet-test.md | "If neither setting selects a runner, `dotnet test` uses VSTest." | cited |
| Q1-17 | Docs: MTP mode needs MTP 1.7 or later and fails for a project that supports only VSTest. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-with-dotnet-test.md | "This mode is only compatible with MTP version 1.7.0 and later." and "If your test project supports VSTest but does not support MTP, an error will be generated." | cited |
| Q1-18 | Docs: an MTP test project is built as an executable and is run directly. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-run-and-debug.md | "MTP test projects are built as executables that can be run (or debugged) directly. There's no extra test running console or command." | cited |
| Q1-19 | Docs: MTP is embedded in the test project and needs neither `vstest.console` nor `dotnet test`. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-intro.md | "MTP is embedded directly in your test projects, and there's no other app dependencies, such as `vstest.console` or `dotnet test` needed to run your tests." | cited |
| Q1-20 | Docs: `MSTest.Sdk` replaces `Microsoft.NET.Sdk` as the project SDK and enables MTP by default. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-running-tests.md | "`MSTest.Sdk` replaces `Microsoft.NET.Sdk` as the project SDK, and MTP is enabled by default:" | cited |
| Q1-21 | Docs: an `MSTest.Sdk` project switches back to VSTest with one property. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-sdk.md | "By default, MSTest SDK relies on MTP, but you can switch to VSTest by adding the property `<UseVSTest>true</UseVSTest>`." (link markup removed) | cited |
| Q1-22 | Docs: without `MSTest.Sdk`, MTP is enabled by a property and an executable output type. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-running-tests.md | "Add the `EnableMSTestRunner` property and set `OutputType` to `Exe` in your project file." | cited |
| Q1-23 | Docs: `MSTest.Sdk` works only on top of `Microsoft.NET.Sdk`. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-running-tests.md | "`MSTest.Sdk` works only when your project can use `Microsoft.NET.Sdk` as its base SDK." | cited |
| Q1-24 | Docs: MTP supports .NET 8 and later and .NET Framework 4.6.2 and later. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-intro.md | "MTP supports .NET (.NET 8 and later), .NET Framework (versions 4.6.2 and later), and targets NETStandard 2.0 for maximum compatibility with other runtimes." | cited |
| Q1-25 | Docs: mixing VSTest and MTP test projects in one solution or run is not supported. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/test-platforms-overview.md | "Don't mix VSTest-based and MTP-based .NET test projects in the same solution or run configuration because that scenario isn't supported." | cited |
| Q1-26 | Docs: running MTP projects through VSTest mode is described as legacy and scheduled for removal in MTP 2 on SDK 10. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-with-dotnet-test.md | "Running MTP projects under VSTest mode is considered legacy in favor of the newer experience in .NET 10 SDK. The support of running under this mode will be removed in MTP version 2 if run with .NET 10 SDK." | cited |
| Q1-27 | Docs: MTP does not create isolated load contexts and does not use custom assembly resolvers. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-intro.md | "The test runtime does not interfere with the test framework code, it does not create isolated contexts like `AppDomain` or `AssemblyLoadContext`, and it does not use reflection or custom assembly resolvers." | cited |


### Q2. Loading a real project into the compiler platform

#### Q2a. The MSBuild workspace and the MSBuild locator

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q2-1 | Registry: `Microsoft.CodeAnalysis.Workspaces.MSBuild` 5.9.0 is the latest stable version (2026-08-17) and targets .NET 10.0 and .NET Framework 4.7.2. | https://www.nuget.org/packages/Microsoft.CodeAnalysis.Workspaces.MSBuild | ".NET Compiler Platform ("Roslyn") support for analyzing MSBuild projects and solutions." and "Last updated 8/17/2026". | cited |
| Q2-2 | Registry: the package's listed dependencies include `Microsoft.Build.Framework` and `Microsoft.CodeAnalysis.Workspaces.Common`, and do not list `Microsoft.Build` or `Microsoft.Build.Locator`. | https://www.nuget.org/packages/Microsoft.CodeAnalysis.Workspaces.MSBuild | net10.0 dependency list as rendered: "Microsoft.Build.Framework (>= 17.11.48)", "Microsoft.CodeAnalysis.Workspaces.Common (= 5.9.0)". | cited |
| Q2-3 | Registry: `Microsoft.CodeAnalysis.CSharp.Workspaces` and `Microsoft.CodeAnalysis.CSharp` are also at 5.9.0 (2026-08-17). | https://api.nuget.org/v3/registration5-gz-semver2/microsoft.codeanalysis.csharp.workspaces/index.json | Registration entry read: version 5.9.0, published 2026-08-17, listed true. | cited |
| Q2-4 | Code: the workspace starts a separate build-host process with `dotnet` and a roll-forward policy, and does not evaluate the project in the calling process. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/BuildHostProcessManager.cs | `AddArgument(processStartInfo, "--roll-forward");` then `AddArgument(processStartInfo, "LatestMajor");` | cited |
| Q2-5 | Code: the build host, not the caller, finds an SDK for the project's directory and registers MSBuild. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/BuildHost/NetCoreBuildHost.cs and https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/BuildHost/AbstractBuildHost.cs | `WorkingDirectory = Path.GetDirectoryName(projectOrSolutionFilePath),` and `MSBuildLocator.RegisterMSBuildPath(instance.Path);` | cited |
| Q2-6 | Code: the build host logs a critical message and returns no MSBuild when no SDK fits. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/BuildHost/NetCoreBuildHost.cs | `Logger.LogCritical("No compatible MSBuild instance could be found.");` | cited |
| Q2-7 | Code: the build host runs a design-time build that asks for the compiler command line and skips the compiler. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/BuildHost/Build/ProjectBuildManager.cs | `{ PropertyNames.ProvideCommandLineArgs, bool.TrueString },` and `{ PropertyNames.SkipCompilerExecution, bool.TrueString },` | cited |
| Q2-8 | Code: the same build sets design-time mode, does not build project references, and continues after errors. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/BuildHost/Build/ProjectBuildManager.cs | `{ PropertyNames.BuildProjectReferences, bool.FalseString },` and `{ PropertyNames.ContinueOnError, PropertyValues.ErrorAndContinue },` | cited |
| Q2-9 | Code: the targets that are run are `Compile` and `CoreCompile`. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/BuildHost/Build/ProjectBuildManager.cs | `var requiredTargets = new[] { TargetNames.Compile, TargetNames.CoreCompile };` | cited |
| Q2-10 | Code: the C# compiler arguments are read from the `CscCommandLineArgs` items that the compile target produces. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/BuildHost/MSBuild/CSharp/CSharpProjectCommandLineReader.cs and https://raw.githubusercontent.com/dotnet/roslyn/main/src/Compilers/Core/MSBuildTask/Microsoft.CSharp.Core.targets | `=> executedProject.GetItems(ItemNames.CscCommandLineArgs);` and `<Output TaskParameter="CommandLineArgs" ItemName="CscCommandLineArgs" />` | cited |
| Q2-11 | Code: the compile target passes the project's nullable setting, language version, defined constants, warnings-as-errors setting, analyzers and additional files to the compiler task. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Compilers/Core/MSBuildTask/Microsoft.CSharp.Core.targets | `Nullable="$(Nullable)"`, `LangVersion="$(LangVersion)"`, `DefineConstants="$(DefineConstants)"`, `TreatWarningsAsErrors="$(TreatWarningsAsErrors)"`, `Analyzers="@(Analyzer)"`, `AdditionalFiles="@(AdditionalFiles)"` | cited |
| Q2-12 | Code: the compiler task turns the nullable setting into a command-line switch. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Compilers/Core/MSBuildTask/Csc.cs | `commandLine.AppendSwitchIfNotNull("/nullable:", Nullable);` | cited |
| Q2-13 | Code: the workspace builds the project's parse options and compilation options by parsing that command line. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildProjectLoader.Worker.cs | `parseOptions = commandLineArgs.ParseOptions;` and `compilationOptions = commandLineArgs.CompilationOptions` | cited |
| Q2-14 | Code: the workspace forces documentation comments to be parsed, which changes one parse option from what the build used. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildProjectLoader.Worker.cs | `parseOptions = parseOptions.WithDocumentationMode(DocumentationMode.Parse);` | cited |
| Q2-15 | Code: metadata references, analyzer references, additional documents and analyzer-config documents are placed on the loaded project. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildProjectLoader.Worker.cs | `metadataReferences: resolvedReferences.MetadataReferences,` and `analyzerReferences: analyzerReferences,` | cited |
| Q2-16 | Code: when the compiler gave no arguments, a fallback reader rebuilds a shorter argument list from evaluated properties, and in that reader no `nullable` argument was found. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/BuildHost/MSBuild/CSharp/CSharpCommandLineArgumentReader.cs | `AddIfNotNullOrWhiteSpace("langversion", Project.ReadPropertyString(PropertyNames.LangVersion));` (a case-insensitive search for `nullable` in this file, in `CommandLineArgumentReader.cs` and in `ProjectInstanceReader.cs` returned no line) | cited |
| Q2-17 | Code: load diagnostics are collected on a public `Diagnostics` property of the workspace. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildWorkspace.cs | `public ImmutableList<WorkspaceDiagnostic> Diagnostics => Reporter.Diagnostics;` | cited |
| Q2-18 | Code: failures for the project that was asked for are set to throw, and failures for projects found through references are logged while `SkipUnrecognizedProjects` keeps its default of true. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildProjectLoader.cs | `var requestedProjectOptions = DiagnosticReportingOptions.ThrowForAll;` and `public bool SkipUnrecognizedProjects { get; set; } = true;` | cited |
| Q2-19 | Code: referenced projects are opened as source by default and are replaced by their built assemblies only on request. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildProjectLoader.cs and https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildWorkspace.cs | `public bool LoadMetadataForReferencedProjects { get; set; } = false;` and the comment "Determines if metadata from existing output assemblies is loaded instead of opening referenced projects." | cited |
| Q2-20 | Code: the workspace layer runs the generator driver and adds the generated trees to the compilation it returns. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/Core/Portable/Workspace/Solution/SolutionCompilationState.RegularCompilationTracker_Generators.cs | `generatorDriver = generatorDriver.RunGenerators(compilationToRunGeneratorsOn, ShouldGeneratorRun, cancellationToken);` and `var compilationWithGeneratedFiles = compilationWithoutGeneratedFiles.AddSyntaxTrees(` | cited |
| Q2-21 | Code: generated documents are exposed through a separate call and are not part of `Documents`. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/Core/Portable/Workspace/Solution/Project.cs | Comment: "All the regular documents associated with this project. Documents produced from source generators are returned by `GetSourceGeneratedDocumentsAsync(CancellationToken)`." (reference markup simplified) | cited |
| Q2-22 | Code: analyzer assemblies named by the project become analyzer file references that are loaded on demand. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildProjectLoader.Worker.cs | `? (AnalyzerReference)new AnalyzerFileReference(path, analyzerLoader)` and `: new UnresolvedAnalyzerReference(path))` | cited |
| Q2-23 | Code: analyzers are attached to a compilation by an explicit call. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Compilers/Core/Portable/DiagnosticAnalyzer/DiagnosticAnalyzerExtensions.cs | Comment: "Returns a new compilation with attached diagnostic analyzers." on `public static CompilationWithAnalyzers WithAnalyzers(this Compilation compilation, ImmutableArray<DiagnosticAnalyzer> analyzers, AnalyzerOptions? options = null)` | cited |
| Q2-24 | Code: `OpenProjectAsync` also accepts a single C# file as a file-based app. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/Workspaces/MSBuild/Core/MSBuild/MSBuildWorkspace.cs | Comment: "Supports file-based apps too (just pass the path to the entry point C# file as `projectFilePath`)." (reference markup simplified) | cited |
| Q2-25 | Registry: `Microsoft.Build.Locator` 1.11.2 is the latest stable version (2025-11-25) and targets .NET 8.0 and .NET Framework 4.6. | https://www.nuget.org/packages/Microsoft.Build.Locator | "Microsoft.Build.Locator helps you locate and register MSBuild assemblies provided with Visual Studio or the .NET SDK." | cited |
| Q2-26 | Docs: an application that uses the locator must not ship MSBuild's own assemblies. | https://learn.microsoft.com/en-us/visualstudio/msbuild/find-and-use-msbuild-versions | "To make sure that MSBuild loads from a central location, you must not distribute its assemblies with your application." | cited |
| Q2-27 | Docs: MSBuild package references must exclude runtime assets, and the locator package must not. | https://learn.microsoft.com/en-us/visualstudio/msbuild/find-and-use-msbuild-versions | "Specify `ExcludeAssets=runtime` to tell NuGet that the assemblies are needed only at build time, and shouldn't be copied to the output directory." and "Don't specify `ExcludeAssets=runtime` for the Microsoft.Build.Locator package." | cited |
| Q2-28 | Docs: the method that calls the locator must not mention any MSBuild type. | https://learn.microsoft.com/en-us/visualstudio/msbuild/find-and-use-msbuild-versions | "You can't reference any MSBuild types (from the `Microsoft.Build` namespace) in the method that calls MSBuildLocator." | cited |
| Q2-29 | Docs: on .NET the locator finds only the MSBuild that ships in .NET SDK installations. | https://learn.microsoft.com/en-us/visualstudio/msbuild/find-and-use-msbuild-versions | "However, the .NET Core version can only find instances of MSBuild built with .NET Core, the MSBuild used by `dotnet.exe` in .NET SDK installations, not Visual Studio installations or Visual Studio Build Tools installations." | cited |

Claims Q2-4 to Q2-24 rest on source code read on branch `main` and not on the 5.9.0 package.
Whether the 5.9.0 package behaves the same is not established.

#### Q2b. Reading project settings without the workspace

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q2-30 | Docs: `-getProperty` and `-getItem` print values after evaluation without running a build. | https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild-command-line-reference | "Write out the value of the property or properties after evaluation, without executing the build, or if either the `-targets` option or the `-getTargetResult` option is used, write out the values after the build." | cited |
| Q2-31 | Docs: the options exist from MSBuild 17.8. | https://learn.microsoft.com/en-us/visualstudio/msbuild/evaluate-items-and-properties | "The following command-line options are available in MSBuild 17.8 and later." | cited |
| Q2-32 | Docs: with a target named, the values are those after the target ran. | https://learn.microsoft.com/en-us/visualstudio/msbuild/evaluate-items-and-properties | "If the `-target` option is specified, then the property or item values returned are the values after the build is finished, that is, after all requested targets have run to completion." | cited |
| Q2-33 | Docs: one property prints as plain text, and several properties or any item print as JSON. | https://learn.microsoft.com/en-us/visualstudio/msbuild/evaluate-items-and-properties | "If you use `-getProperty` to request multiple properties, or use `-getItem` or `-getTargetResult`, the output is in a JSON format. Items are emitted with their associated metadata." | cited |
| Q2-34 | Docs: the options work through the `dotnet` commands as well as `MSBuild.exe`. | https://learn.microsoft.com/en-us/visualstudio/msbuild/evaluate-items-and-properties | "You can use these commands with `MSBuild.exe` or with `dotnet build`, or other `dotnet` commands such as `dotnet publish`." | cited |
| Q2-35 | Docs: properties are evaluated before items, so a property that depends on items differs before and after a target runs. | https://learn.microsoft.com/en-us/visualstudio/msbuild/evaluate-items-and-properties | "Be aware that properties are evaluated before items, so if you're using `-getProperty` for a property that references an item, you get a different output depending on whether or not you're getting the result before or after item evaluation occurs." | cited |
| Q2-36 | Docs: the binary logger writes `msbuild.binlog` by default and does not collect C# source files. | https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild-command-line-reference | "By default the file is in the current directory and named *msbuild.binlog*." and "**Note**: the logger doesn't collect non-MSBuild source files such as `.cs`, `.cpp`, and so on." | cited |
| Q2-37 | Docs: a binary log holds final property values, items with metadata, and task inputs and outputs. | https://learn.microsoft.com/en-us/visualstudio/msbuild/obtaining-build-logs-with-msbuild | List under "The binary log includes the following information from a build": "Properties, their final value, and any property reassignments", "Items, their metadata, and any item updates or removals", "Task inputs and outputs". | cited |
| Q2-38 | Docs: a binary log can be replayed through MSBuild so that other loggers receive its events. | https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild-command-line-reference | "A *.binlog* file can be "played back" by passing it to *msbuild.exe* as an argument instead of a project/solution. Other loggers receive the information contained in the log file as if the original build was happening." | cited |
| Q2-39 | Docs: generator output stays in memory unless a property asks for it on disk. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/project-sdk/msbuild-props.md | "Set this property to `true` to enable this behavior. By default, source generator output exists only in memory and isn't written to disk." | cited |

#### Q2c. Running the check inside the project's own compilation

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q2-40 | Docs: an analyzer receives extra non-source files that the project declares. | https://raw.githubusercontent.com/dotnet/roslyn/main/docs/analyzers/Using%20Additional%20Files.md | "To support these scenarios the C# and Visual Basic compilers can accept additional, non-source text files as inputs." | cited |
| Q2-41 | Docs: a project declares such a file with the `AdditionalFiles` item, and an analyzer reads it from its options. | https://raw.githubusercontent.com/dotnet/roslyn/main/docs/analyzers/Using%20Additional%20Files.md | `<AdditionalFiles Include="terms.txt" />` and `ImmutableArray<AdditionalText> additionFiles = context.Options.AdditionalFiles;` | cited |
| Q2-42 | Docs: rule RS1035 marks a list of APIs as banned in analyzers, with severity error. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/RoslynAnalyzers/Microsoft.CodeAnalysis.Analyzers/Microsoft.CodeAnalysis.Analyzers.md | "The symbol has been marked as banned for use in analyzers, and an alternate should be used instead." with the table row "Severity / Error". | cited |
| Q2-43 | Code: the banned list covers file and directory access. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/RoslynAnalyzers/Microsoft.CodeAnalysis.Analyzers/Core/AnalyzerBannedSymbols.txt | `T:System.IO.File; Do not do file IO in analyzers` and `T:System.IO.Directory; Do not do file IO in analyzers` | cited |
| Q2-44 | Code: the banned list covers processes, the console and environment variables. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/RoslynAnalyzers/Microsoft.CodeAnalysis.Analyzers/Core/AnalyzerBannedSymbols.txt | `T:System.Diagnostics.Process; Analyzers should not inspect or create processes` and `T:System.Environment; Analyzers should not read their settings directly from environment variables` | cited |
| Q2-45 | Code: the banned list covers loading an assembly from bytes or by name, which is what executing freshly compiled code would need. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/RoslynAnalyzers/Microsoft.CodeAnalysis.Analyzers/Core/AnalyzerBannedSymbols.txt | `M:System.Reflection.Assembly.Load(System.Byte[]); Analyzers should only load their dependencies via standard runtime mechanisms` | cited |
| Q2-46 | Code: the banned list covers randomness and the older generator interfaces. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/RoslynAnalyzers/Microsoft.CodeAnalysis.Analyzers/Core/AnalyzerBannedSymbols.txt | `T:System.Random; Analyzers should be deterministic` and `T:Microsoft.CodeAnalysis.GeneratorExecutionContext; Non-incremental source generators should not be used, implement IIncrementalGenerator instead` | cited |
| Q2-47 | Code: the ban is a build-time rule on the analyzer author's project and is applied only when that project sets a property to true. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/RoslynAnalyzers/Microsoft.CodeAnalysis.Analyzers/Core/MetaAnalyzers/SymbolIsBannedInAnalyzersAnalyzer.cs | `var propertyValue = compilationContext.Options.GetMSBuildPropertyValue(MSBuildPropertyOptionNames.EnforceExtendedAnalyzerRules, compilation);` then `if (propertyValue != "true")` | cited |
| Q2-48 | Docs: rule RS1036 asks every analyzer or generator project to set that property. | https://raw.githubusercontent.com/dotnet/roslyn/main/src/RoslynAnalyzers/Microsoft.CodeAnalysis.Analyzers/Microsoft.CodeAnalysis.Analyzers.md | "A project containing analyzers or source generators should specify the property '\<EnforceExtendedAnalyzerRules>true\</EnforceExtendedAnalyzerRules>'." | cited |
| Q2-49 | Docs: a compilation-end action runs once, after the analyzer's other actions. | https://raw.githubusercontent.com/dotnet/roslyn/main/docs/analyzers/Analyzer%20Actions%20Semantics.md | "A compilation end action is invoked once, after all other applicable actions of an analyzer have been invoked." | cited |
| Q2-50 | Docs: a host may never run an end action for a given compilation. | https://raw.githubusercontent.com/dotnet/roslyn/main/docs/analyzers/Analyzer%20Actions%20Semantics.md | "In such cases, it is possible for a compilation start action to run without its corresponding compilation end actions ever running for a given compilation, and likewise a code block start action can run without its corresponding code block end actions ever running." | cited |
| Q2-51 | Docs: the order of analyzer actions is not guaranteed, apart from start and end actions. | https://raw.githubusercontent.com/dotnet/roslyn/main/docs/analyzers/Analyzer%20Actions%20Semantics.md | "There are no ordering constraints for the invocations of any actions, except those introduced by start and end actions (compilation start, compilation end, symbol start, symbol end, operation block start, operation block end, code bock start, and code block end actions)." | cited |
| Q2-52 | Docs: analyzers should target .NET Standard 2.0. | https://raw.githubusercontent.com/dotnet/docs/main/docs/csharp/roslyn-sdk/tutorials/how-to-write-csharp-analyzer-code-fix.md | "Analyzers should target .NET Standard 2.0 because they can run in .NET Core environment (command line builds) and .NET Framework environment (Visual Studio)." | cited |
| Q2-53 | Docs: incremental generators are required to be deterministic. | https://raw.githubusercontent.com/dotnet/roslyn/main/docs/features/incremental-generators.md | "While we have generally said that the execute method in an `ISourceGenerator` should be deterministic, incremental generators actively _require_ this property to be true." | cited |
| Q2-54 | Docs: reporting diagnostics from a generator is discouraged in favour of a separate analyzer. | https://raw.githubusercontent.com/dotnet/roslyn/main/docs/features/incremental-generators.cookbook.md | "We do not recommend issuing diagnostics within generators. It is possible, but doing so without breaking incrementality is advanced topic beyond the scope of this cookbook." | cited |
| Q2-55 | Docs: a generator can combine additional files with the project's parse options. | https://raw.githubusercontent.com/dotnet/roslyn/main/docs/features/incremental-generators.md | `IncrementalValuesProvider<(AdditionalText, ParseOptions)> combined = additionalTexts.Combine(initContext.ParseOptionsProvider);` | cited |

### Q3. Executing checks against the project's built code

#### Q3a. Loading a built assembly

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q3-1 | Docs: a load context isolates loaded code and its dependencies and supports unloading. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/dependency-loading/understanding-assemblyloadcontext.md | "To support dynamic code loading and unloading, it creates an isolated context for loading code and its dependencies in their own `AssemblyLoadContext` instance." (reference markup simplified) | cited |
| Q3-2 | Docs: the dependency resolver maps assembly names to paths from the `.deps.json` file of the given library. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tutorials/creating-app-with-plugin-support.md | "It resolves assemblies and native libraries to their relative paths based on the *.deps.json* file for the class library whose path was passed to the `AssemblyDependencyResolver` constructor." | cited |
| Q3-3 | Docs: two types with the same name from two load contexts are different types. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/dependency-loading/understanding-assemblyloadcontext.md | "When two `AssemblyLoadContext` instances contain type definitions with the same `name`, they're not the same type. They're the same type if and only if they come from the same `Assembly` instance." (reference markup simplified) | cited |
| Q3-4 | Docs: static members of types in a custom load context are reached by reflection. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/dependency-loading/understanding-assemblyloadcontext.md | "Types loaded into a custom `AssemblyLoadContext` are isolated from types in other contexts, so you must use reflection to access their static members from outside the context." (reference markup simplified) | cited |
| Q3-5 | Docs: a library copies all its dependencies to its output only when a property is set, so a plain library's output folder may be incomplete. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tutorials/creating-app-with-plugin-support.md | "The `<EnableDynamicLoading>true</EnableDynamicLoading>` prepares the project so that it can be used as a plugin. Among other things, this will copy all of its dependencies to the output of the project." | cited |
| Q3-6 | Docs: dependency resolution from `.deps.json` is unreliable for a library that targets .NET Standard. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tutorials/creating-app-with-plugin-support.md | "Specifically, your plugins should target a runtime, such as .NET 10, instead of a version of .NET Standard." | cited |

#### Q3b. MSTest data-driven tests as a driver

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q3-7 | Docs: `DynamicData` supplies rows from a method, property or field. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "The data source can be a method or property and, starting with MSTest v3.11, a field." | cited |
| Q3-8 | Docs: the rows may be tuples, `TestDataRow<T>` or `object[]`. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "The data source can return any `IEnumerable<T>` where `T` is one of the types listed in the following table." | cited |
| Q3-9 | Docs: the data source may live in a different class from the test. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | `[DynamicData(nameof(TestDataProvider.GetTestData), typeof(TestDataProvider))]` | cited |
| Q3-10 | Docs: `TestDataRow<T>` gives each row its own display name, categories and ignore message. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "**Custom display names**: Set a unique display name per test case using the `DisplayName` property." (reference markup simplified) | cited |
| Q3-11 | Docs: a custom attribute that implements `ITestDataSource` can supply rows from any logic, including files. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "Implement this interface when you need behavior that the built-in attributes don't support, such as generating test data based on environment variables, configuration files, or other runtime conditions." | cited |
| Q3-12 | Docs: the interface has two members. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | Table rows: "`GetData(MethodInfo)` / Returns test data as `IEnumerable<object?[]>`" and "`GetDisplayName(MethodInfo, object?[]?)` / Returns the display name for a test case". | cited |
| Q3-13 | Docs: data sources are evaluated during discovery, before any assembly or class initialisation. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "This evaluation happens *before* any of the regular MSTest lifecycle hooks run—`AssemblyInitialize`, `ClassInitialize`, and other setup methods haven't executed yet." | cited |
| Q3-14 | Docs: an unfolded row is its own test entry and can be run and filtered alone. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "**Unfolded tests**: Each data row appears as a separate, independent test entry in Test Explorer and TRX. You can run, debug, or filter individual test cases." | cited |
| Q3-15 | Docs: folded rows share one test entry and cannot be selected one by one. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "One entry appears in TRX, with multiple results associated with that single test case. You can't run or filter individual data rows independently." | cited |
| Q3-16 | Docs: a data source that throws during discovery is folded whatever the configured strategy. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "When MSTest evaluates a data source during discovery and the evaluation throws an exception, the test falls back to a folded state regardless of the configured unfolding strategy." | cited |
| Q3-17 | Docs: the default strategy is chosen by the framework. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | Table row: "`Auto` (default) / MSTest determines the best unfolding strategy." | cited |
| Q3-18 | Docs: a test method may be generic, with type arguments inferred from the row values. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-writing-tests-data-driven.md | "Starting with MSTest v3.8, a `TestMethod` can have type parameters. The framework infers type arguments from `DataRow` or `DynamicData` values:" | cited |

#### Q3c. Running one test alone, exit codes and result files

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q3-19 | Docs: the `--filter` expression has the form property, operator, value, joined with `&` and the vertical bar. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/selective-unit-tests.md | "**Expression** is in the format `<Property><Operator><Value>[\|&<Expression>]`." | cited |
| Q3-20 | Docs: MSTest supports six filter properties. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/selective-unit-tests.md | Table row: "MSTest / `FullyQualifiedName` `Name` `ClassName` `Priority` `TestCategory` `Id`" (line-break markup removed). | cited |
| Q3-21 | Docs: the operators are exact match, not exact match, contains and does not contain. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/selective-unit-tests.md | "`=` exact match", "`!=`not exact match", "`~` contains", "`!~` doesn't contain". | cited |
| Q3-22 | Docs: one MSTest case can be selected by its discovered identifier. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/selective-unit-tests.md | Table row: "`dotnet test --filter "Id=<guid>"` / Runs the test case whose discovered `TestCase.Id` value exactly matches the GUID." | cited |
| Q3-23 | Docs: with `vstest.console.exe` the option is spelled differently. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/selective-unit-tests.md | "If you're using `vstest.console.exe`, replace `--filter` with `--testcasefilter:`." | cited |
| Q3-24 | Docs: an MSTest MTP test application takes the same `--filter` directly. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-running-tests.md | `dotnet Contoso.MyTests.dll --filter "FullyQualifiedName~UnitTest1\|TestCategory=CategoryA"` | cited |
| Q3-25 | Docs: MTP 2.3.0 and later can list tests as JSON. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-cli-options.md | "Starting with MTP 2.3.0, use `--list-tests json` to discover tests as a machine-readable JSON document instead of parsing the human-readable list:" | cited |
| Q3-26 | Docs: the JSON discovery document gives each test a `uid` and a `displayName`. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-cli-options.md | "The document contains a `schemaVersion` and a `tests` array. Each test includes `uid` and `displayName`." | cited |
| Q3-27 | Docs: tests are then selected by those identifiers. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-cli-options.md | "Filters the tests to run by their test node UIDs. Accepts one or more UIDs." and "Use the discovered UIDs with `--filter-uid` to run selected tests." (link markup removed) | cited |
| Q3-28 | Docs: the text form of the test list is not meant to be parsed. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-mstest-running-tests.md | "Read the JSON document, then run selected tests with `--filter-uid`. The text format isn't a machine-readable API." | cited |
| Q3-29 | Docs: MTP exit code 0 means every chosen test ran and none failed, and 2 means at least one test failed. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-troubleshooting.md | "The `0` exit code indicates success. All tests that were chosen to run ran to completion and there were no errors." and "An exit code of `2` is used to indicate that there was at least one test failure." | cited |
| Q3-30 | Docs: MTP exit code 5 means invalid arguments and 8 means no tests were discovered. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-troubleshooting.md | "The exit code `5` indicates that the command-line arguments passed to the test app were invalid." and "The exit code `8` indicates that the test session discovered no tests, or that every selected test was skipped under the strict `--zero-tests-policy`." | cited |
| Q3-31 | Docs: an option from an extension that the test application did not register fails with exit code 5. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-cli-options.md | "If a test application doesn't register the extension, the run fails with exit code 5 because the option is unrecognized." | cited |
| Q3-32 | Docs: under VSTest the exit code is 0 or 1 only. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tools/dotnet-test-vstest.md | "When you run tests through the VSTest path, `dotnet test` reports the outcome with one of two exit codes:" and "The underlying `vstest.console` process never returns any other value." | cited |
| Q3-33 | Docs: under VSTest a run that selects zero tests returns 0 unless a run setting changes that. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tools/dotnet-test-vstest.md | "When discovery finds no matching tests, the run prints a warning rather than an error and still returns `0` by default." | cited |
| Q3-34 | Docs: under MTP the TRX report needs its extension package and the `--report-trx` option. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-test-reports.md | "This extension requires the Microsoft.Testing.Extensions.TrxReport NuGet package." and the option row "`--report-trx` / Generates the TRX report." (link markup removed) | cited |
| Q3-35 | Docs: from MTP 2.3.0 the default TRX file name is deterministic. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-test-reports.md | "Starting with MTP 2.3.0, the default is the deterministic `{asm}_{tfm}_{arch}.trx` form; before MTP 2.3.0, the default was `<UserName>_<MachineName>_<yyyy-MM-dd_HH_mm_ss.fffffff>.trx`." | cited |
| Q3-36 | Docs: reports go to the test results directory, which an option sets. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-test-reports.md | "Every report extension writes its file to the test results directory, which you can set with the `--results-directory` option." (link markup removed) | cited |
| Q3-37 | Docs: under VSTest a TRX file is produced by a logger option. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tools/dotnet-test-vstest.md | `dotnet test --logger "trx;logfilename=testResults.trx"` | cited |
| Q3-38 | Docs: MTP also has an experimental JSON report in the Common Test Report Format, and the registry lists its package only as a pre-release. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-test-reports.md and https://api.nuget.org/v3/registration5-gz-semver2/microsoft.testing.extensions.ctrfreport/index.json | "Available in MTP starting with version 2.3.0. This extension is experimental, and its options and output format might change in a future version." Registration entries read: no stable version, latest 1.0.0-alpha.26561.10 (2026-11-11). | cited |
| Q3-39 | Docs: TRX keeps one final result per test. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-test-reports.md | "TRX and JUnit reports keep one final result per test instead of recording every attempt." | cited |
| Q3-40 | Docs: in MTP mode `dotnet test` can run already-built test modules without evaluating a project. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-troubleshooting.md | "This option selects built test modules without project evaluation." (about `dotnet test --test-modules <EXPRESSION>`) | cited |
| Q3-41 | Docs: MTP has a JSON-RPC server mode in which a client runs tests by identifier. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-server-mode.md | "MTP server mode lets an editor, IDE, custom test UI, or other test tool launch a test application and drive discovery and execution through JSON-RPC." | cited |
| Q3-42 | Docs: a first-party source-only client for that mode exists from MTP 2.4. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-server-mode.md | "MTP 2.4 provides a canonical JSON-RPC client. Add the Microsoft.Testing.Platform.ServerMode.Client.Sources package." (link markup removed) | cited |
| Q3-43 | Docs: reusing one test process for several requests depends on a capability that the client must check. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-server-mode.md | "The helper starts a separate test process for discovery and execution, so it doesn't require `MtpServerCapabilities.MultiRequestSupport`. To reuse a process, check that capability after `InitializeAsync` before you issue multiple requests." | cited |


### Q4. Stryker.NET

#### Q4a. Version, installation and configuration

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q4-1 | Registry: `dotnet-stryker` 5.1.0 is the latest stable version, published 2026-11-10, and the package targets .NET 10.0. | https://www.nuget.org/packages/dotnet-stryker | "dotnet tool install --global dotnet-stryker --version 5.1.0" and "This package targets .NET 10.0. The package is compatible with this framework or higher." | cited |
| Q4-2 | Docs: the change log dates 5.1.0 on 2026-11-10 and 5.0.0 on 2026-09-11. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/CHANGELOG.md | Headings "# [5.1.0](...) (2026-11-10)" and "# [5.0.0](...) (2026-09-11)" (link targets shortened). | cited |
| Q4-3 | Docs: the tool is installed as a .NET tool, globally or through a local tool manifest. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/getting-started.md | `dotnet tool install -g dotnet-stryker` and, after `dotnet new tool-manifest`, `dotnet tool install dotnet-stryker` | cited |
| Q4-4 | Docs: the tool needs the .NET 10 runtime, and the application under test does not have to target it. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/getting-started.md | "Stryker requires the dotnet 10 runtime or newer" and "Your application does not need to target dotnet 10 or newer." | cited |
| Q4-5 | Docs: the tool is run from the test project's directory. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "You run stryker from the test project directory." | cited |
| Q4-6 | Docs: the configuration file is `stryker-config.json` (or YAML) with one top-level section. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "To use a config file create a file called `stryker-config.json` in the (unit test) project folder and add a configuration section called stryker-config." | cited |
| Q4-7 | Code: the configuration keys include `mutate`, `reporters`, `test-runner`, `test-case-filter`, `coverage-analysis`, `project`, `solution`, `test-projects`, `report-file-name`, `language-version` and `ignore-mutations`. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.CLI/Stryker.CLI/FileBasedInput.cs | `[JsonPropertyName("mutate")]`, `[JsonPropertyName("reporters")]`, `[JsonPropertyName("test-runner")]`, `[JsonPropertyName("coverage-analysis")]` | cited |
| Q4-8 | Docs: `mutate` takes glob patterns, a leading `!` excludes, and only files of the project count. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "Only source files part of your project will be taken into account." and "You can add an `!` in front of the pattern to exclude instead of include matching files." | cited |
| Q4-9 | Docs: with both include and exclude patterns, a file is mutated when it matches an include and no exclude. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "If both include and exclude patterns are provided, only the files that match an include pattern but not also an exclude pattern will be included. The order of the patterns is irrelevant." | cited |
| Q4-10 | Docs: a pattern can also name a character span inside a file. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | `dotnet stryker -m "MyFolder/MyService.cs{10..100}"` | cited |
| Q4-11 | Docs: the default reporters are `html` and `progress`, and `json` is one of the available reporters. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "Default: `html, progress`" and "Config file: `"reporters": ['html', 'json', 'progress']`" | cited |
| Q4-12 | Docs: the test runner defaults to VSTest, and the MTP runner is a preview. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "Default: `vstest`" and "The Microsoft Test Platform (MTP) test runner is currently in preview. Results should be verified as this feature is still being tested." | cited |
| Q4-13 | Docs: release 5.0.0 added per-test coverage analysis and test information in the JSON report for the MTP runner. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/CHANGELOG.md | "**MTP:** Support `perTest` and `perTestInIsolation` coverage analysis" and "Add test information to html/json report for MTP test runner" | cited |
| Q4-14 | Docs: release 5.1.0 lists MTP fixes for concurrent writes to the mutant-control file and for test names in the report. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/CHANGELOG.md | "**mtp:** Concurrency issue with multiple processes writing to the same mutant-control file" and "**mtp:** drop parameter types from MTP test's fully qualified name in report" | cited |
| Q4-15 | Docs: a test filter uses the `dotnet test --filter` syntax, and with MTP it is passed to test applications that have a `--filter` option, such as MSTest. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "When using Microsoft Testing Platform, the filter is passed to test applications that expose the `--filter` command-line option (for example MSTest and NUnit)." | cited |
| Q4-16 | Docs: the language version defaults to the project's setting, and release 5.1.0 lists that as a new feature. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md and https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/CHANGELOG.md | "Default: project setting" and "**compilation:** follow project C# language version" | cited |
| Q4-17 | Code: the tool's own integration fixture for MSTest on MTP uses the MSTest SDK, the MTP runner, the JSON reporter and isolated per-test coverage. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/integrationtest/TargetProjects/MicrosoftTestPlatform/UnitTests.MSTest/stryker-config.json | `"test-runner": "MTP",` and `"coverage-analysis": "perTestInIsolation"` | cited |

#### Q4b. The JSON report and its schema

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q4-18 | Docs: the JSON reporter writes one file with the data of the last run. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/reporters.md and https://stryker-mutator.io/docs/stryker-net/reporters/ | "This reporter outputs a json file with all mutation testrun info of the last run. The json is also used for the HTML reporter, but using this reporter you could use the file for your own purposes." | cited |
| Q4-19 | Code: the JSON file is written to `<output path>/reports/<report file name>.json`. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/JsonReporter.cs and https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Configuration/Options/StrykerOptions.cs | `var filename = _options.ReportFileName + ".json";` with `var reportPath = Path.Combine(_options.ReportPath, filename);` and `public string ReportPath => Path.Combine(OutputPath ?? ".", "reports");` | cited |
| Q4-20 | Docs: the report file name defaults to `mutation-report`, and an option changes the output path. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "Default: `mutation-report`" and "Changes the output path for Stryker logs and reports. This can be an absolute or relative path." | cited |
| Q4-21 | Docs: the default output folder is stated only for the Markdown reporter. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/reporters.md | "This reporter outputs a Markdown formatted summary file called `mutation-report.md` (by default) in the `StrykerOutput/{date-time}/reports` directory." | cited |
| Q4-22 | Schema: the shared report schema is titled `MutationTestResult` and requires `schemaVersion`, `thresholds` and `files`. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/src/mutation-testing-report-schema.json | Values read: `"title": "MutationTestResult"`, `"required": ["schemaVersion", "thresholds", "files"]`; other top-level properties: `config`, `testFiles`, `projectRoot`, `performance`, `framework`, `system`. | cited |
| Q4-23 | Schema: the schema package is at version 3.9.0. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/package.json | `"name": "mutation-testing-report-schema"` and `"version": "3.9.0"` | cited |
| Q4-24 | Schema: `files` maps a file path to an object that requires `language`, `source` and `mutants`, and the key is described as a relative path. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/src/mutation-testing-report-schema.json | "Mutated file, with the relative path of the file as the key." with `"required": ["language", "source", "mutants"]` | cited |
| Q4-25 | Schema: a mutant requires `id`, `mutatorName`, `location` and `status`. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/src/mutation-testing-report-schema.json | `"required": ["id", "mutatorName", "location", "status"]`; optional properties read: `replacement`, `coveredBy`, `killedBy`, `static`, `statusReason`, `description`, `testsCompleted`, `duration`. | cited |
| Q4-26 | Schema: `status` has eight allowed values. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/src/mutation-testing-report-schema.json | `"enum": ["Killed", "Survived", "NoCoverage", "CompileError", "RuntimeError", "Timeout", "Ignored", "Pending"]` | cited |
| Q4-27 | Schema: line and column start at one, the start is inclusive and the end is exclusive. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/src/mutation-testing-report-schema.json | "Position of a mutation. Both line and column start at one." and "A location with start and end. Start is inclusive, end is exclusive." | cited |
| Q4-28 | Schema: `coveredBy` and `killedBy` are lists of test ids, and `coveredBy` may be left out. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/src/mutation-testing-report-schema.json | "The test ids that covered this mutant. If a mutation testing framework doesn't measure this information, it can simply be left out." | cited |
| Q4-29 | Schema: `killedBy` may hold only the first failing test. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/src/mutation-testing-report-schema.json | "The test ids that killed this mutant. It is a best practice to "bail" on first failing test, in which case you can fill this array with that one test." | cited |
| Q4-30 | Schema: `testFiles` is keyed by file path or class name, and each test requires `id` and `name`. | https://raw.githubusercontent.com/stryker-mutator/mutation-testing-elements/master/packages/report-schema/src/mutation-testing-report-schema.json | "Test file definitions by file path OR class name." with test `"required": ["id", "name"]` | cited |
| Q4-31 | Docs: StrykerJS states that its JSON reporter follows this schema. | https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/docs/plugins.md | "json: Outputs a JSON file with all mutation test run info of the last run according to the mutation testing report schema." (link markup removed) | cited |
| Q4-32 | Code: the StrykerJS API package (10.1.1) depends on the schema package at 3.8.4. | https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/api/package.json | `"mutation-testing-report-schema": "3.8.4"` | cited |
| Q4-33 | Docs: StrykerJS writes its JSON report to `reports/mutation/mutation.json` by default. | https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/docs/configuration.md | "Default: `{ fileName: "reports/mutation/mutation.json" }`" | cited |
| Q4-34 | Code: the Stryker.NET report object has the properties `SchemaVersion` (set to "2"), `Thresholds`, `ProjectRoot`, `Files` and `TestFiles`, serialised in camel case with nulls omitted. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/JsonReport.cs and https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/JsonReportSerialization.cs | `public string SchemaVersion { get; init; } = "2";` and `PropertyNamingPolicy = JsonNamingPolicy.CamelCase,` | cited |
| Q4-35 | Code: a Stryker.NET mutant has `Id`, `MutatorName`, `Description`, `Replacement`, `Location`, `Status`, `StatusReason`, `Static`, `CoveredBy`, `KilledBy`, `TestsCompleted` and `Duration`. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/SourceFiles/JsonMutant.cs | `MutatorName = mutant.Mutation.DisplayName;` and `Replacement = mutant.Mutation.ReplacementNode.ToString();` | cited |
| Q4-36 | Code: the status string is the name of an enum member, and the enum has the same eight names as the schema. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/SourceFiles/JsonMutant.cs and https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Abstractions/MutantStatus.cs | `Status = mutant.ResultStatus.ToString();` with enum members `Pending, Killed, Survived, Timeout, CompileError, Ignored, NoCoverage, RuntimeError` | cited |
| Q4-37 | Code: the location is one-based and comes from the mapped line span of the original syntax node. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/Location.cs and https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/SourceFiles/JsonMutant.cs | `Line = location.StartLinePosition.Line + 1,` and `Location = new Location(mutant.Mutation.OriginalNode.GetLocation().GetMappedLineSpan());` | cited |
| Q4-38 | Code: Stryker.NET keys `files` by the file's `FullPath`, where the schema text says relative path. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/JsonReport.cs | `return new Dictionary<string, ISourceFile> { { fileComponent.FullPath, new SourceFile(fileComponent) } };` | cited |
| Q4-39 | Code: each file entry carries the whole source text and the language `cs`. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/SourceFiles/SourceFile.cs | `Source = file.SourceCode;` and `Language = "cs";` | cited |
| Q4-40 | Code: a file excluded by the `mutate` patterns still appears in the report, with placeholder source and no mutants. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/SourceFiles/SourceFile.cs | `public static SourceFile Ignored => new() { Source = "File ignored by mutate filter", Language = "none", Mutants = new HashSet<IJsonMutant>() };` | cited |
| Q4-41 | Code: `coveredBy` and `killedBy` are filled from the covering and killing tests of each mutant. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/SourceFiles/JsonMutant.cs | `CoveredBy = mutant.CoveringTests.GetIdentifiers()?.Select(g => g.ToString());` and `KilledBy = mutant.KillingTests.GetIdentifiers()?.Select(g => g.ToString());` | cited |
| Q4-42 | Docs: the published mutant states define survived, no coverage, timeout and the error states. | https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/ | "When all tests passed while this mutant was active, the mutant survived." and "The mutant isn't covered by one of your tests and survived as a result." | cited |
| Q4-43 | Docs: the published metrics count killed plus timeout as detected, and survived plus no coverage as undetected. | https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/ | "Detected (`killed + timeout`): The number of mutants detected by your tests." and "Undetected (`survived + no coverage`): The number of mutants that are not detected by your tests." (as rendered by the fetch tool) | cited |

The Stryker.NET documentation that was read does not say that its JSON report follows the shared schema.
The match in Q4-34 to Q4-37 is between field names in source code and the schema, read and not run.

#### Q4c. How mutants are activated and covered

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q4-44 | Docs: Stryker.NET compiles all mutants into one build and switches between them at run time (mutant schemata). | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/technical-reference/research.md | "This technique places all mutations inside if statements." and "Stryker.NET has chosen the path of mutant schemata." | cited |
| Q4-45 | Docs: a mutated expression calls a control helper with the mutant's id. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/technical-reference/mutant-schemata.md | `Two = (MutantControl.IsActive(0) ? (One - 1) : (One + 1))` | cited |
| Q4-46 | Code: the helper that is injected into the mutated assembly selects the active mutant by an environment variable for VSTest and by a file for MTP. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/InjectedHelpers/MutantControl.cs | Comment: "It supports both environment variable-based control (for VSTest runner) and file-based control (for MTP runner with process reuse)." | cited |
| Q4-47 | Code: while coverage is being captured, the helper records the mutant id and reports it as inactive. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/InjectedHelpers/MutantControl.cs | `if (CaptureCoverage)` then `RegisterCoverage(id);` and `return false;` | cited |
| Q4-48 | Docs: mutants that do not compile are rolled back and marked, and the document and the enum name that state differently. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/technical-reference/mutant-schemata.md and https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Abstractions/MutantStatus.cs | Document: "The mutant that linked to that piece of code gets the status `builderror`." Enum member: `CompileError`. | cited |
| Q4-49 | Docs: constant values are not mutated. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/technical-reference/mutant-schemata.md | "A drawback of mutant schemata is that Stryker.NET cannot mutate constant values." | cited |
| Q4-50 | Docs: coverage analysis defaults to `perTest`, which records the mutants each test covers. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "Default: `perTest`" and "**perTest**: capture the list of mutants covered by each test. For every mutant that has tests, only the tests that cover the mutant are used to test a mutant." | cited |
| Q4-51 | Docs: `perTestInIsolation` runs each test in its own run for more accurate coverage at a higher start-up cost. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "**perTestInIsolation**: like 'perTest', but running each test in an isolated run. This results in more accurate coverage information for some mutants (see below), at the expense of a longer startup time." | cited |
| Q4-52 | Docs: mutants without covering tests are reported as `NoCoverage` in `perTest` mode. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "Mutants without tests are reported as `NoCoverage`. Fastest option." | cited |
| Q4-53 | Docs: in `perTest` mode, mutants inside static initialisers are run against all tests. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "When using `perTest` mode, mutants that are executed as part of some static constructor/initializer are run against all tests as Stryker cannot reliably capture coverage for those." | cited |
| Q4-54 | Docs: the project asks users to re-run without coverage analysis when a survivor looks suspicious. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "If you identify a suspicious survivor, run Stryker again without coverage analysis and report an issue if this mutant is killed by this run." | cited |
| Q4-55 | Code: for MTP per-test coverage the runner passes file names to the test process through environment variables. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.TestRunner.MicrosoftTestPlatform/MicrosoftTestingPlatformRunner.cs | `envVars["STRYKER_COVERAGE_FILE"] = Path.GetFileName(GetPerTestCoverageFilePath(assembly));` | cited |

### Q5. Feasibility facts for per-test reconciliation

| ID | Claim | Source URL | Quote | Tag |
| --- | --- | --- | --- | --- |
| Q5-1 | Docs: the first-party MTP coverage extension collects coverage for a run and writes one file in `coverage`, `xml` or `cobertura` format. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-code-coverage.md | Option rows: "`--coverage` / Collect the code coverage using dotnet-coverage tool." and "`--coverage-output-format` / Output file format. Supported values are: `coverage`, `xml`, and `cobertura`. Default is `coverage`." | cited |
| Q5-2 | Registry: `Microsoft.Testing.Extensions.CodeCoverage` and `dotnet-coverage` are at 18.12.0 (2026-10-06), and `Microsoft.CodeCoverage` is at 18.12.0 (2026-11-11). | https://api.nuget.org/v3/registration5-gz-semver2/microsoft.testing.extensions.codecoverage/index.json (same path pattern for the other package ids) | Registration entries read: version 18.12.0, listed true. | cited |
| Q5-3 | Docs: `dotnet-coverage collect` measures any .NET process and its child processes. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/additional-tools/dotnet-coverage.md | "The `collect` command is used to collect code coverage data for any .NET process and its subprocesses." | cited |
| Q5-4 | Docs: the collector can run as a server that other commands connect to by session id. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/additional-tools/dotnet-coverage.md | "The `collect` command hosts a server for code coverage collection. Clients can connect to the server via `connect` command." | cited |
| Q5-5 | Docs: a snapshot writes a coverage file for a running session and can clear the counters afterwards. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/additional-tools/dotnet-coverage.md | "Creates a coverage file for existing code coverage collection." and "Clears existing coverage information after a coverage file is created." (the `-r\|--reset` option) | cited |
| Q5-6 | Docs: under VSTest, coverage is collected with a data collector option. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/tools/dotnet-test-vstest.md | "For example you can collect code coverage by using the `--collect "Code Coverage"` option." and "To collect code coverage you can also use Coverlet by using the `--collect "XPlat Code Coverage"` option." (link markup removed) | cited |
| Q5-7 | Docs: Coverlet rewrites the assemblies before the run, records hits to a temporary file, and builds the result after the run. | https://raw.githubusercontent.com/coverlet-coverage/coverlet/master/README.md | "Instruments the selected assemblies by inserting code to record sequence point hits to a temporary file." and "Generate the coverage result from the hits information and write it to a file." | cited |
| Q5-8 | Docs: Coverlet has an MTP extension, enabled by a flag. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-code-coverage.md and https://raw.githubusercontent.com/coverlet-coverage/coverlet/master/Documentation/Coverlet.MTP.Integration.md | "The Coverlet Microsoft Testing Platform Integration (`coverlet.MTP`) is a native extension for MTP that implements `coverlet.collector` functionality." | cited |
| Q5-9 | Registry: `coverlet.collector`, `coverlet.msbuild`, `coverlet.MTP` and `coverlet.console` are at 10.1.0 (2026-09-27). | https://api.nuget.org/v3/registration5-gz-semver2/coverlet.mtp/index.json (same path pattern for the other package ids) | Registration entries read: version 10.1.0, published 2026-09-27, listed true. | cited |
| Q5-10 | Docs: under MTP Coverlet cannot instrument the test assembly itself. | https://raw.githubusercontent.com/coverlet-coverage/coverlet/master/Documentation/Coverlet.MTP.Integration.md | "In the MTP model the test assembly is also the controller process." and "Because the controller executable is already in use when instrumentation runs, attempting to rewrite that assembly causes instrumentation of the test/controller assembly to fail." | cited |
| Q5-11 | Docs: an MTP test application runs all tests in the executable unless a filter is given, so one test alone is one process start with a filter. | https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-run-and-debug.md | "MTP test project are built as executables, and can be run directly. This runs all the tests in the given executable, unless a filter is provided." | cited |
| Q5-12 | Docs: the only per-test coverage found in the allowed sources is Stryker.NET's, and it records covered mutants, not covered lines. | https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/docs/configuration.md | "**perTest**: capture the list of mutants covered by each test." | cited |

No sentence was found in the pages listed in Q5-1 to Q5-10 that describes coverage attributed to a single test.
The searches are listed in section (c).


## (c) Could not be established

### Sources that could not be opened

* The API reference page for the MSBuild workspace class on learn.microsoft.com returned HTTP 404 for four URL forms (`/dotnet/api/microsoft.codeanalysis.msbuild.msbuildworkspace` with no view, and with `view=roslyn-dotnet`, `view=roslyn-dotnet-4.13.0` and `view=roslyn-dotnet-4.14.0`).
  The class was read in source instead (Q2-17, Q2-19, Q2-24).
* The repository of the MSBuild locator is outside the allowed source list and was not opened.
  The locator rows rest on its learn.microsoft.com page and its package page (Q2-25 to Q2-29).
* The repository of the first-party code coverage tool is outside the allowed source list and was not opened.

### Claims with no source

* Whether `Project.GetCompilationAsync` on a project loaded by the MSBuild workspace runs analyzers.
  Only the explicit `WithAnalyzers` call was found (Q2-23), and absence of an automatic run was not shown.
* Whether the MSBuild workspace needs `dotnet restore` to have run first, and what it reports when it has not.
  No statement was found in the files read.
* Whether the 5.9.0 workspace package contains the build-host design read on branch `main` (Q2-4 to Q2-9).
* Whether a workspace package of one compiler version can load a project whose SDK ships a different compiler version, and whether the project's analyzers and generators then load.
* Whether the SDK folder that the tool already references (L6) contains the workspace assemblies, which would avoid a package reference.
* Which properties are safe to set from the command line to obtain `CscCommandLineArgs` outside the workspace.
  The property names are read from source (Q2-7), and no documentation page for them was opened.
* A first-party programmatic reader for binary logs.
  Only the logger, its contents and replay were found (Q2-36 to Q2-38).
* Whether the published analyzer rules are enforced by the compiler when an analyzer runs.
  The source read shows a build-time rule on the analyzer's own project (Q2-47), and nothing was found about run-time enforcement.
* How MSTest derives the identifier and name of one `DynamicData` row, whether the identifier is stable across builds, and whether a VSTest `--filter` can select one row.
  The documentation says only that unfolded rows can be filtered (Q3-14) and that an `Id` property exists (Q3-22).
* Whether MTP 2.x has already removed support for running through VSTest mode on SDK 10.
  The page states the removal in the future tense (Q1-26).
* The default output folder of the Stryker.NET JSON reporter.
  The source gives `<output path>/reports/` (Q4-19), the documentation names `StrykerOutput/{date-time}/reports` only for the Markdown reporter (Q4-21), and the code that sets the default output path was not found in the four files searched (`StrykerCLI.cs`, `ConfigBuilder.cs`, `StrykerInputs.cs`, `OutputPathInput.cs`).
* Whether Stryker.NET file keys are absolute paths.
  The property is named `FullPath` (Q4-38), and its value was not traced.
* Whether Stryker.NET documents conformance of its JSON report to the shared schema.
  No such sentence was found in `docs/reporters.md`, `docs/configuration.md` or the repository `README.md`.
* Whether Stryker.NET mutator names and replacement texts are stable between versions, which matters for explanations keyed on them.
* How Stryker.NET treats code under conditional compilation, generated code and partial methods.
  This was not researched.
* A first-party mechanism that reports which lines one test executed.
  Search failure, not proof of absence.
* The cost of running one test alone.
  No primary source gives a figure.
* Whether the MSTest SDK registers the coverage extension by default, which decides whether `--coverage` is accepted (Q3-31).
  The MSTest package lists it as a dependency (Q1-8), and the SDK's own defaults were not read.

### Searches that were run

* Text search for `per test`, `per-test`, `each test`, `individual test`, `test impact` and `which tests` in the source of four documentation pages: the `dotnet-coverage` reference, the unit-testing code coverage page, the MTP code coverage page and the mutation testing page.
  Result: no matching line.
* Text search for `per test`, `per-test`, `each test`, `single test`, `individual test` and `which test` in six Coverlet documents (`README.md`, VSTest integration, MSBuild integration, global tool, known issues, MTP integration), and for `per test`, `per-test`, `test impact`, `per-method` and `test case` in its roadmap and architecture documents.
  Result: two unrelated lines.
* One web search limited to learn.microsoft.com for per-test code coverage with the first-party coverage tools.
  Result: pages about whole-run coverage only.
* One web search limited to github.com for per-test coverage in Coverlet.
  Result: no issue or document of the Coverlet repository on the subject.
* Text search for `nullable` in three workspace source files (Q2-16).
* Text search for `StrykerOutput` in four Stryker.NET source files.
  Result: one comment about baselines.

### Coverage of the reading

Read in full: the `dotnet test` conceptual page, the `dotnet test` command page, the language version pages and tables, the MTP overview page, `MSBuildWorkspace.cs` lines 1 to 330, `MSBuildProjectLoader.Worker.cs` lines 150 to 435, the analyzer banned-symbol list, the Stryker.NET JSON reporter, mutant, location, position and status files, the Stryker.NET mutant-schemata page, the Stryker.NET getting-started page for lines 1 to 75 of 97, and the four learn.microsoft.com MSBuild pages.
Sampled by text search and by reading the matching sections: every other file named in section (b).
Never opened: the VSTest repository, the MTP source code, the MSTest source code, the MSBuild source code, the StrykerJS source code, and the release notes of .NET 11.

## (d) Proposed experiments

None of these was run.
The machine has .NET SDK 10.0.400, Windows 11 and Node 24.
Commands are PowerShell, one per line, run from a new empty directory outside any repository, called `exp` below.
Each experiment names the claims it would confirm or refute.

### Files shared by the experiments

`exp/global.json`:

```json
{
  "sdk": { "version": "10.0.400", "rollForward": "latestFeature" },
  "test": { "runner": "Microsoft.Testing.Platform" }
}
```

`exp/global.vstest.json`:

```json
{
  "sdk": { "version": "10.0.400", "rollForward": "latestFeature" }
}
```

`exp/Target/Target.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>13</LangVersion>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <DefineConstants Condition="'$(NoFeatureX)' != 'true'">$(DefineConstants);FEATURE_X</DefineConstants>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Primitives" Version="10.0.1" />
  </ItemGroup>
  <ItemGroup Condition="'$(WithSpecAnalyzer)' == 'true'">
    <Analyzer Include="..\SpecAnalyzer\bin\Release\netstandard2.0\SpecAnalyzer.dll" />
    <AdditionalFiles Include="Decision.spec.json" />
  </ItemGroup>
</Project>
```

`exp/Target/Decision.cs`:

```csharp
using System.Text.RegularExpressions;
using Microsoft.Extensions.Primitives;

namespace Target;

public static partial class Decision
{
#if FEATURE_X
    public static bool Allowed(bool member, bool banned) => member && !banned;
#else
    public static bool Allowed(bool member, bool banned) => member;
#endif

    [GeneratedRegex("^a+$")]
    public static partial Regex Pattern();
}

public static class Uses
{
    public static bool HasText(string text) => new StringSegment(text).HasValue;
}
```

`exp/Target/Decision.spec.json`:

```json
{ "units": {} }
```

Version 10.0.1 of `Microsoft.Extensions.Primitives` is taken from the dependency list in Q2-1 and was not checked on its own package page.

### E1. What the installed SDK ships

Confirms or refutes: the open point about workspace assemblies inside the SDK, and gives the compiler version needed by E5.

```powershell
dotnet --list-sdks
Get-ChildItem "$env:ProgramFiles\dotnet\sdk\10.0.400\Roslyn\bincore" -Filter "Microsoft.CodeAnalysis*.dll" | ForEach-Object { "$($_.Name) $($_.VersionInfo.ProductVersion)" }
```

Record whether `Microsoft.CodeAnalysis.Workspaces.dll` and `Microsoft.CodeAnalysis.Workspaces.MSBuild.dll` are listed, and the product version of `Microsoft.CodeAnalysis.CSharp.dll`.

### E2. Evaluated properties and items without a build

Confirms or refutes: Q2-30, Q2-33, Q2-34, Q2-35.

```powershell
dotnet msbuild Target/Target.csproj -getProperty:LangVersion
dotnet msbuild Target/Target.csproj -getProperty:TargetFramework,LangVersion,Nullable,DefineConstants,TreatWarningsAsErrors,TargetPath
dotnet msbuild Target/Target.csproj -getProperty:DefineConstants -p:NoFeatureX=true
dotnet msbuild Target/Target.csproj -getItem:Compile,Analyzer,AdditionalFiles
```

Record whether the first command prints plain text and the others JSON, whether `FEATURE_X` appears and disappears, and whether the commands work before any restore.

### E3. The compiler command line without the workspace

Confirms or refutes: Q2-7, Q2-10, Q2-11, Q2-12, Q2-32.

```powershell
dotnet restore Target/Target.csproj
dotnet msbuild Target/Target.csproj -t:Compile -p:ProvideCommandLineArgs=true -p:SkipCompilerExecution=true -p:DesignTimeBuild=true -getItem:CscCommandLineArgs
```

Record whether the output lists `/nullable:enable`, `/langversion:13`, a `/define:` entry with `FEATURE_X`, a `/warnaserror` entry, `/reference:` entries and `/analyzer:` entries, and whether `Target/bin` stays empty.

### E4. Loading the project with the MSBuild workspace

Confirms or refutes: Q2-1 to Q2-6, Q2-13 to Q2-22, and the open points about restore and version alignment.

`exp/Loader/Loader.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.Workspaces.MSBuild" Version="5.9.0" />
    <PackageReference Include="Microsoft.CodeAnalysis.CSharp.Workspaces" Version="5.9.0" />
  </ItemGroup>
</Project>
```

`exp/Loader/Program.cs`:

```csharp
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.MSBuild;

using var workspace = MSBuildWorkspace.Create();
Project project;
try
{
    project = await workspace.OpenProjectAsync(args[0]);
}
catch (Exception e)
{
    Console.WriteLine($"THROWN {e.GetType().FullName}: {e.Message}");
    PrintWorkspaceDiagnostics();
    return 1;
}
PrintWorkspaceDiagnostics();
var parse = (CSharpParseOptions)project.ParseOptions!;
Console.WriteLine($"LANGVERSION {parse.LanguageVersion}");
Console.WriteLine($"SYMBOLS {string.Join(",", parse.PreprocessorSymbolNames)}");
var options = (CSharpCompilationOptions)project.CompilationOptions!;
Console.WriteLine($"NULLABLE {options.NullableContextOptions}");
Console.WriteLine($"GENERALDIAGNOSTIC {options.GeneralDiagnosticOption}");
Console.WriteLine($"METADATAREFERENCES {project.MetadataReferences.Count}");
foreach (var reference in project.AnalyzerReferences)
    Console.WriteLine($"ANALYZERREFERENCE {reference.GetType().Name} {Path.GetFileName(reference.FullPath)}");
var generated = (await project.GetSourceGeneratedDocumentsAsync()).ToList();
Console.WriteLine($"GENERATEDDOCUMENTS {generated.Count}");
var compilation = (await project.GetCompilationAsync())!;
Console.WriteLine($"SYNTAXTREES {compilation.SyntaxTrees.Count()}");
foreach (var diagnostic in compilation.GetDiagnostics().Where(d => d.Severity == DiagnosticSeverity.Error))
    Console.WriteLine($"ERROR {diagnostic}");
foreach (var tree in compilation.SyntaxTrees.Where(t => Path.GetFileName(t.FilePath) == "Decision.cs"))
    foreach (var method in tree.GetRoot().DescendantNodes().OfType<MethodDeclarationSyntax>())
        Console.WriteLine($"METHOD {method.Identifier.Text} {method.ExpressionBody?.Expression}");
using var stream = new MemoryStream();
Console.WriteLine($"EMIT {compilation.Emit(stream).Success}");
return 0;

void PrintWorkspaceDiagnostics()
{
    foreach (var diagnostic in workspace.Diagnostics)
        Console.WriteLine($"WORKSPACE {diagnostic.Kind}: {diagnostic.Message}");
}
```

```powershell
dotnet build Loader/Loader.csproj -c Release
dotnet restore Target/Target.csproj
dotnet Loader/bin/Release/net10.0/Loader.dll Target/Target.csproj
Remove-Item -Recurse -Force Target/obj, Target/bin -ErrorAction SilentlyContinue
dotnet Loader/bin/Release/net10.0/Loader.dll Target/Target.csproj
dotnet Loader/bin/Release/net10.0/Loader.dll Target/Missing.csproj
```

Record for the restored run: language version 13, the symbol `FEATURE_X`, nullable `Enable`, the general diagnostic option, the count of generated documents (more than zero means the regular-expression generator ran), the active body of `Allowed`, and whether emit succeeds.
Record for the unrestored run and for the missing file whether the failure is an exception, a workspace diagnostic, compilation errors, or silence.
Record whether the program works with no call to the MSBuild locator and no locator package.

### E5. A check inside the compilation as an analyzer

Confirms or refutes: Q2-40 to Q2-52.

`exp/SpecAnalyzer/SpecAnalyzer.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netstandard2.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <EnforceExtendedAnalyzerRules>true</EnforceExtendedAnalyzerRules>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.CSharp" Version="$(RoslynVersion)" PrivateAssets="all" />
    <PackageReference Include="Microsoft.CodeAnalysis.Analyzers" Version="$(RoslynVersion)" PrivateAssets="all" />
    <Compile Remove="Banned.cs" Condition="'$(WithBanned)' != 'true'" />
  </ItemGroup>
</Project>
```

`exp/SpecAnalyzer/SpecAnalyzer.cs`:

```csharp
using System.Collections.Immutable;
using System.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Diagnostics;

[DiagnosticAnalyzer(LanguageNames.CSharp)]
public sealed class SpecAnalyzer : DiagnosticAnalyzer
{
    private static readonly DiagnosticDescriptor Seen = new DiagnosticDescriptor(
        "SPEC001", "Spec seen", "{0}", "Spec", DiagnosticSeverity.Warning, true,
        customTags: new[] { WellKnownDiagnosticTags.CompilationEnd });

    public override ImmutableArray<DiagnosticDescriptor> SupportedDiagnostics => ImmutableArray.Create(Seen);

    public override void Initialize(AnalysisContext context)
    {
        context.EnableConcurrentExecution();
        context.ConfigureGeneratedCodeAnalysis(GeneratedCodeAnalysisFlags.None);
        context.RegisterCompilationStartAction(start =>
        {
            var spec = start.Options.AdditionalFiles.FirstOrDefault(f => f.Path.EndsWith("Decision.spec.json"));
            var text = spec?.GetText(start.CancellationToken)?.ToString() ?? "<no spec>";
            start.RegisterCompilationEndAction(end =>
            {
                var parse = (CSharpParseOptions)end.Compilation.SyntaxTrees.First().Options;
                var nullable = ((CSharpCompilationOptions)end.Compilation.Options).NullableContextOptions;
                var type = end.Compilation.GetTypeByMetadataName("Target.Decision");
                var methods = type == null
                    ? "<no type>"
                    : string.Join(",", type.GetMembers().OfType<IMethodSymbol>().Where(m => m.MethodKind == MethodKind.Ordinary).Select(m => m.Name));
                var message = $"lang={parse.LanguageVersion} symbols={string.Join("+", parse.PreprocessorSymbolNames)} nullable={nullable} methods={methods} specLength={text.Length}";
                end.ReportDiagnostic(Diagnostic.Create(Seen, Location.None, message));
            });
        });
    }
}
```

`exp/SpecAnalyzer/Banned.cs`:

```csharp
internal static class Banned
{
    internal static string Read(string path) => System.IO.File.ReadAllText(path);
}
```

Replace `<version>` with a compiler package version that is not newer than the product version recorded in E1.

```powershell
dotnet build SpecAnalyzer/SpecAnalyzer.csproj -c Release -p:RoslynVersion=<version>
dotnet build Target/Target.csproj --no-incremental -p:WithSpecAnalyzer=true -p:TreatWarningsAsErrors=false
dotnet build Target/Target.csproj --no-incremental -p:WithSpecAnalyzer=true
dotnet build SpecAnalyzer/SpecAnalyzer.csproj -c Release -p:RoslynVersion=<version> -p:WithBanned=true
```

Record the text of `SPEC001` in the second command: it shows whether the analyzer sees language version 13, `FEATURE_X`, the nullable setting, the generated `Pattern` method and the spec file.
Record whether the third command fails because the warning is promoted to an error.
Record whether the fourth command reports `RS1035` for `System.IO.File`.

### E6. Computed checks as MSTest rows on MTP

Confirms or refutes: Q1-13, Q1-18, Q1-20, Q3-7, Q3-10, Q3-13, Q3-14, Q3-24 to Q3-31, Q3-34 to Q3-36, and the open point about row identifiers.

`exp/Checks.Tests/Checks.Tests.csproj`:

```xml
<Project Sdk="MSTest.Sdk/4.5.3">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\Target\Target.csproj" />
  </ItemGroup>
</Project>
```

`exp/Checks.Tests/Checks.cs`:

```csharp
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Target;

namespace Checks.Tests;

[TestClass]
public sealed class ComputedChecks
{
    public static IEnumerable<TestDataRow<(bool Member, bool Banned, bool Expected)>> Rows()
    {
        var rows = new[] { (false, false, false), (false, true, false), (true, false, true), (true, true, false) };
        foreach (var (member, banned, expected) in rows)
            yield return new TestDataRow<(bool Member, bool Banned, bool Expected)>((member, banned, expected))
            {
                DisplayName = $"Target.Decision.Allowed({member},{banned})"
            };
    }

    [TestMethod]
    [DynamicData(nameof(Rows))]
    public void Check(bool member, bool banned, bool expected) =>
        Assert.AreEqual(expected, Decision.Allowed(member, banned));
}

[TestClass]
public sealed class HandWritten
{
    [TestMethod]
    public void MemberIsAllowed() => Assert.IsTrue(Decision.Allowed(true, false));

    [TestMethod]
    public void AlwaysPasses() => Assert.IsTrue(true);
}
```

Replace `<uid>` with one `uid` value of a `Check` row from `tests.json`.

```powershell
dotnet build Checks.Tests/Checks.Tests.csproj -c Release
dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --list-tests json --no-banner > tests.json; "exit $LASTEXITCODE"
dotnet build Checks.Tests/Checks.Tests.csproj -c Release --no-incremental
dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --list-tests json --no-banner > tests2.json; "exit $LASTEXITCODE"
dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --no-banner --filter-uid "<uid>" --report-trx --results-directory out/one; "exit $LASTEXITCODE"
dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --no-banner --filter "FullyQualifiedName~ComputedChecks" --report-trx --results-directory out/computed; "exit $LASTEXITCODE"
dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --no-banner --filter "Name=DoesNotExist"; "exit $LASTEXITCODE"
dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --no-banner --option-that-does-not-exist; "exit $LASTEXITCODE"
dotnet test --project Checks.Tests/Checks.Tests.csproj -c Release --no-build; "exit $LASTEXITCODE"
dotnet build Checks.Tests/Checks.Tests.csproj -c Release --no-incremental -p:NoFeatureX=true
dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --no-banner --report-trx --results-directory out/failing; "exit $LASTEXITCODE"
```

Record whether the four rows appear as four tests with their display names, whether `tests.json` and `tests2.json` hold the same identifiers, the number of results in each TRX file, and the exit codes (expected from the documentation: 0, 0, 0, 0, 8, 5, 0 and 2).

### E7. The same checks on VSTest

Confirms or refutes: Q1-12, Q1-21, Q3-19 to Q3-23, Q3-32, Q3-33, Q3-37.

```powershell
Copy-Item global.json global.mtp.json
Copy-Item global.vstest.json global.json -Force
dotnet test Checks.Tests/Checks.Tests.csproj -c Release -p:UseVSTest=true --list-tests
dotnet test Checks.Tests/Checks.Tests.csproj -c Release -p:UseVSTest=true --filter "FullyQualifiedName~ComputedChecks" --logger "trx;logfilename=vstest.trx"; "exit $LASTEXITCODE"
dotnet test Checks.Tests/Checks.Tests.csproj -c Release -p:UseVSTest=true --filter "Name=DoesNotExist"; "exit $LASTEXITCODE"
dotnet test Checks.Tests/Checks.Tests.csproj -c Release -p:UseVSTest=true -p:NoFeatureX=true --filter "FullyQualifiedName~ComputedChecks"; "exit $LASTEXITCODE"
Copy-Item global.mtp.json global.json -Force
```

Record whether each row is listed, whether one row can be selected with a `Name` or `Id` filter, and the exit codes (expected from the documentation: 0, 0 and 1).

### E8. Loading the built assembly and its dependency

Confirms or refutes: Q3-1 to Q3-6.

`exp/HostLoad/HostLoad.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
```

`exp/HostLoad/Program.cs`:

```csharp
using System.Reflection;
using System.Runtime.Loader;

var path = Path.GetFullPath(args[0]);
var context = new ResolvingContext(path);
var assembly = context.LoadFromAssemblyPath(path);
var decision = assembly.GetType("Target.Decision", throwOnError: true)!;
Console.WriteLine($"ALLOWED {decision.GetMethod("Allowed")!.Invoke(null, [true, false])}");
var uses = assembly.GetType("Target.Uses", throwOnError: true)!;
Console.WriteLine($"HASTEXT {uses.GetMethod("HasText")!.Invoke(null, ["x"])}");
context.Unload();

internal sealed class ResolvingContext(string path) : AssemblyLoadContext("target", isCollectible: true)
{
    private readonly AssemblyDependencyResolver _resolver = new(path);

    protected override Assembly? Load(AssemblyName name)
    {
        var resolved = _resolver.ResolveAssemblyToPath(name);
        return resolved == null ? null : LoadFromAssemblyPath(resolved);
    }
}
```

```powershell
dotnet build HostLoad/HostLoad.csproj -c Release
dotnet build Target/Target.csproj -c Release --no-incremental
dotnet HostLoad/bin/Release/net10.0/HostLoad.dll Target/bin/Release/net10.0/Target.dll
dotnet build Target/Target.csproj -c Release --no-incremental -p:EnableDynamicLoading=true
dotnet HostLoad/bin/Release/net10.0/HostLoad.dll Target/bin/Release/net10.0/Target.dll
```

Record whether `HASTEXT` prints or a file-not-found exception is thrown in each of the two runs, and whether the package assembly is present in `Target/bin/Release/net10.0` each time.

### E9. The Stryker.NET JSON report

Confirms or refutes: Q4-1, Q4-3, Q4-12, Q4-18 to Q4-21, Q4-34 to Q4-41, Q4-50, and the open points about file keys and the default output folder.

`exp/inspect-report.mjs`:

```js
import { readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'))
console.log('schemaVersion', report.schemaVersion, 'topLevel', Object.keys(report).join(','))
const statuses = {}
for (const [name, file] of Object.entries(report.files)) {
  console.log('file', name, 'absolute', isAbsolute(name), 'language', file.language, 'mutants', file.mutants.length)
  for (const m of file.mutants) {
    statuses[m.status] = (statuses[m.status] ?? 0) + 1
    console.log(' ', m.id, m.status, m.mutatorName, JSON.stringify(m.location), JSON.stringify(m.replacement), 'coveredBy', m.coveredBy?.length, 'killedBy', m.killedBy?.length)
  }
}
console.log('statuses', JSON.stringify(statuses))
console.log('testFiles', report.testFiles ? Object.keys(report.testFiles).length : 'absent')
for (const [name, file] of Object.entries(report.testFiles ?? {}))
  for (const t of file.tests) console.log(' test', name, t.id, t.name)
```

```powershell
dotnet new tool-manifest
dotnet tool install dotnet-stryker --version 5.1.0
New-Item -ItemType Directory -Force out/stryker-mtp, out/stryker-vstest | Out-Null
Push-Location Checks.Tests
dotnet stryker --reporter json --reporter cleartext; "exit $LASTEXITCODE"
dotnet stryker --reporter json --reporter cleartext --test-runner mtp --output ../out/stryker-mtp; "exit $LASTEXITCODE"
dotnet stryker --reporter json --reporter cleartext --test-runner vstest --output ../out/stryker-vstest; "exit $LASTEXITCODE"
Pop-Location
Get-ChildItem -Recurse -Filter mutation-report.json | ForEach-Object FullName
node inspect-report.mjs out/stryker-mtp/reports/mutation-report.json
node inspect-report.mjs out/stryker-vstest/reports/mutation-report.json
```

Record where the first run wrote its report, whether file keys are absolute, the status names, whether `location` is one-based and matches the text in `source`, whether `coveredBy` and `killedBy` are filled and name the dynamic-data rows one by one, whether `testFiles` is present for each runner, and whether the inactive `#else` branch and the generated regular-expression code received mutants.
Record whether the default runner works on a project built with the MSTest SDK while `global.json` selects MTP.

### E10. Cost and coverage of one test per process

Confirms or refutes: Q5-1, Q5-11, and the open points about cost and about the coverage extension being registered.

```powershell
$dll = "Checks.Tests/bin/Release/net10.0/Checks.Tests.dll"
dotnet build Checks.Tests/Checks.Tests.csproj -c Release --no-incremental
dotnet $dll --list-tests json --no-banner > tests.json
$uids = (Get-Content tests.json -Raw | ConvertFrom-Json).tests.uid
(Measure-Command { dotnet $dll --no-banner | Out-Null }).TotalMilliseconds
foreach ($uid in $uids) { $t = Measure-Command { dotnet $dll --no-banner --filter-uid $uid | Out-Null }; "$uid $([int]$t.TotalMilliseconds) ms exit $LASTEXITCODE" }
$i = 0; foreach ($uid in $uids) { $i++; dotnet $dll --no-banner --filter-uid $uid --coverage --coverage-output-format cobertura --coverage-output "cov-$i.xml" --results-directory out/cov | Out-Null; "$i $uid exit $LASTEXITCODE" }
Select-String -Path out/cov/cov-*.xml -Pattern 'Decision.cs' -Context 0,12
```

Record the time of the whole suite, the time of each single-test run, whether `--coverage` is accepted (exit code 5 means the extension is not registered), and whether the line hits for `Decision.cs` differ between the per-test files.

### E11. One coverage session with a snapshot after each test

Confirms or refutes: Q5-3, Q5-4, Q5-5.

Replace `<uid1>` and `<uid2>` with two identifiers from `tests.json`.

```powershell
dotnet tool install dotnet-coverage --version 18.12.0
dotnet tool run dotnet-coverage collect --server-mode --background --session-id exp1
dotnet tool run dotnet-coverage connect exp1 dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --no-banner --filter-uid "<uid1>"
dotnet tool run dotnet-coverage snapshot exp1 --reset --output out/snap-1.coverage
dotnet tool run dotnet-coverage connect exp1 dotnet Checks.Tests/bin/Release/net10.0/Checks.Tests.dll --no-banner --filter-uid "<uid2>"
dotnet tool run dotnet-coverage snapshot exp1 --reset --output out/snap-2.coverage
dotnet tool run dotnet-coverage shutdown exp1
dotnet tool run dotnet-coverage merge out/snap-1.coverage --output out/snap-1.xml --output-format cobertura
dotnet tool run dotnet-coverage merge out/snap-2.coverage --output out/snap-2.xml --output-format cobertura
```

The `merge` command and its `--output` and `--output-format` options are documented on the page cited in Q5-3.
Record whether each snapshot holds only the lines of its own test, and the added time against E10.

## (e) Options for the checker

This whole section is inference from the claims above.
It is not a finding, and it does not rank the options.
Each option names the claims it rests on and what it would leave unchecked.

### Project loading

* **Option P1: keep one file, and read the project's settings by evaluation.**
  The tool would call `dotnet msbuild -getProperty` for the language version, nullable setting, defined constants and warnings-as-errors setting, and apply them to its own parse and compilation options.
  Rests on: Q2-30 to Q2-35, L1, L2.
  Leaves unchecked: the project's references, analyzers and generated code; any property that depends on items or targets (Q2-35); whether the applied options equal what the compiler receives.
* **Option P2: take the compiler's own command line from a compile target that does not compile.**
  The tool would run the compile target with the two properties the workspace uses, read `CscCommandLineArgs`, and parse them.
  Rests on: Q2-7 to Q2-12, Q2-32.
  Leaves unchecked: generated code, unless the tool runs the generators itself; stability of property names that were found only in source; behaviour without restore.
* **Option P3: load the project with the MSBuild workspace.**
  The tool would get the project's compilation with its options, references and generator output.
  Rests on: Q2-1 to Q2-24.
  Leaves unchecked: the difference between a design-time build and a real build (Q2-8, Q2-14, Q2-16); version alignment between the workspace package and the project's SDK; load failures that arrive as diagnostics and not as exceptions (Q2-17, Q2-18); the end of the present rule that the tool has no package dependency (L6).
* **Option P4: read a binary log of a real build.**
  The tool would take compiler inputs from the log of the build the project already runs.
  Rests on: Q2-36 to Q2-38.
  Leaves unchecked: how to read the log from code, for which no first-party reader was found; source files, which the log does not hold (Q2-36); staleness between the log and the working tree.
* **Option P5: run the admission check inside the project's compilation as an analyzer.**
  The analyzer would see exactly the compilation the build uses and would read the spec as an additional file.
  Rests on: Q2-40 to Q2-52.
  Leaves unchecked: execution of the methods, which the published rules exclude (Q2-43 to Q2-45); writing an obligations file, which is file access; hosts that never run end actions (Q2-50); the change this makes to the application's own build.
* **Option P6: generate the driver from the compilation with an incremental generator.**
  The generator would turn the spec, given as an additional file, into test source.
  Rests on: Q2-39, Q2-53 to Q2-55.
  Leaves unchecked: review of output that exists only in memory by default (Q2-39); diagnostics, which generators are advised not to issue (Q2-54); the same build change as P5.

### Running under MSTest

* **Option R1: one generic driver test fed by a data source that reads the obligations.**
  Each computed check would be one unfolded row, listed as JSON and selected by identifier.
  Rests on: Q3-7 to Q3-18, Q3-24 to Q3-31, Q3-34 to Q3-36.
  Leaves unchecked: how row identifiers are formed and whether they are stable; that the number of rows equals the number of obligations; rows hidden by folding when the data source throws (Q3-16); the path of the obligations file at discovery time (Q3-13).
* **Option R2: generated test source with one test or one data row per check.**
  The tool, or the generator of P6, would write the tests.
  Rests on: Q3-14, Q3-18, Q2-39.
  Leaves unchecked: stale generated files; who regenerates them and when.
* **Option R3: keep execution in the tool, against the built assembly.**
  The tool would load the application's built assembly with a load context and a dependency resolver, as it now loads its own in-memory output.
  Rests on: Q3-1 to Q3-6, L4.
  Leaves unchecked: any claim that the checks run under the test framework; dependency folders that are incomplete for a plain library (Q3-5); type identity across contexts (Q3-3).
* **Option R4: the VSTest path.**
  The checks would run through `dotnet test --filter` with the TRX logger.
  Rests on: Q3-19 to Q3-23, Q3-32, Q3-33, Q3-37.
  Leaves unchecked: a filter that selects nothing, which returns exit code 0 by default (Q3-33); the cause of a failure, since the exit code is only 0 or 1 (Q3-32).
* **Option R5: the MTP server mode for many single-test runs.**
  A client would discover and run tests by identifier over JSON-RPC.
  Rests on: Q3-41 to Q3-43.
  Leaves unchecked: process reuse, which depends on a capability (Q3-43); report extensions that open extra connections, as the same page warns.

### Mutation sorting

* **Option M1: read the Stryker.NET JSON report with the same sorting rules as the TypeScript helper.**
  The report fields the helper reads have the same names in the Stryker.NET source, and only the step that finds the enclosing unit would need a C# parser.
  Rests on: L7 to L10, Q4-18 to Q4-41.
  Leaves unchecked: the form of file keys (Q4-38); files that appear with placeholder source (Q4-40); the statuses the helper counts as neither killed nor alive (L8, Q4-36); stability of mutator names and replacement text; the absence of a conformance statement in the Stryker.NET documentation.
* **Option M2: use `coveredBy`, `killedBy` and `testFiles` to relate existing tests to mutants.**
  This would give a per-test signal without a separate reconciliation run.
  Rests on: Q4-28 to Q4-30, Q4-41, Q4-50 to Q4-53.
  Leaves unchecked: the mapping from mutants to computed cells, which are different things; mutants in static initialisers (Q4-53); `killedBy` that names only the first failing test (Q4-29); the preview status of the MTP runner (Q4-12).
* **Option M3: derive the `mutate` patterns from the list of admitted files.**
  Rests on: Q4-8 to Q4-10.
  Leaves unchecked: methods outside the admitted set in the same file, unless character spans are maintained (Q4-10).

### Per-test reconciliation

* **Option C1: one process per test with the coverage option.**
  Rests on: Q3-27, Q5-1, Q5-11.
  Leaves unchecked: the cost; whether line coverage is fine enough to tell which computed cell a test notices, since executing a line is not noticing an outcome.
* **Option C2: one coverage session with a snapshot and reset after each test.**
  Rests on: Q5-3 to Q5-5.
  Leaves unchecked: the same question about line coverage; whether a snapshot can be taken between tests without a process per test.
* **Option C3: change one outcome at a time and run each test alone, as the TypeScript side does.**
  A run-time switch of the kind Stryker.NET injects shows that a compiled-in switch read from an environment variable or a file is workable.
  Rests on: Q4-44 to Q4-47, Q3-27.
  Leaves unchecked: everything about the TypeScript reconciliation design, of which only 140 lines were read; the cost; how the switch reaches code in the application's own assembly.

## (f) Verification pass (2026-11-11)

This pass started from the position that every claim in section (b) is false, and read only section (b), the list "Claims with no source" in section (c), and section (d).
All eleven experiments were run on Windows 11 with .NET SDK 10.0.400, and none was left out.
100 distinct claims were checked by a run, by a source opened in this pass, or by both: 95 held, 4 hold only in a narrower form, 1 is refuted, and none was unreachable.
What held: the version numbers and release dates in Q1, Q2, Q4 and Q5, the analyzer rule RS1035 and its opt-in property, the `global.json` runner selection, the MTP exit codes, `--list-tests json` and `--filter-uid`, the compiler command line from a design-time build, loading through the MSBuild workspace with no locator call, and the shape of the Stryker.NET JSON report.
What did not hold: a file excluded by `mutate` is not reported with placeholder source and no mutants (Q4-40), and four claims need narrower wording (Q1-26, Q2-18, Q3-30, Q4-35).
What the runs added: the Stryker.NET default runner fails on an MSTest SDK project, an unrestored project loads with no exception and no workspace diagnostic, an analyzer can read files and inspect processes at run time, and the existing mutation helper cannot name a C# unit and exits with failure on any `Ignored` mutant.
What was not checked: 102 of the 202 claims in section (b) were neither re-opened nor exercised, and they are listed at the end.

`<S>` below stands for `%LOCALAPPDATA%\Temp\claude\9afdadc431132e53\4bb6a23e-9b6e-4243-ba14-e6ab616d6281\scratchpad\verify-projects`.
Every command ran with `NUGET_PACKAGES=<S>\nuget`, so packages were restored into the scratch folder.
Tools were installed with `dotnet tool install <id> --version <v> --tool-path <S>\tools` and not with a tool manifest, which is a change from section (d).
`stryker` below stands for `<S>\tools\dotnet-stryker.exe`, and `coverage` for `<S>\tools\dotnet-coverage.exe`.
`<dll>` stands for `Checks.Tests/bin/Release/net10.0/Checks.Tests.dll`.
"Confirmed by run" means the command was run in this pass and printed the output shown.
It says nothing about other SDKs, other operating systems or other project shapes.

### Table 1. Experiments

The rows are in the order the experiments were run.

| ID | Claims tested | SDK | Commands | Observed output (trimmed) | Verdict |
| --- | --- | --- | --- | --- | --- |
| E9 | Q4-1, Q4-3, Q4-12, Q4-18 to Q4-20, Q4-34 to Q4-41, Q4-50 | 10.0.400 | `dotnet tool install dotnet-stryker --version 5.1.0 --tool-path <S>\tools`; in `Checks.Tests`: `stryker --reporter json --reporter cleartext`; `stryker --reporter json --reporter cleartext --test-runner mtp --output ../out/stryker-mtp`; `stryker --reporter json --reporter cleartext --test-runner vstest --output ../out/stryker-vstest`; `node inspect-report.mjs out/stryker-mtp/reports/mutation-report.json` | Install: `Tool 'dotnet-stryker' (version '5.1.0') was successfully installed`, tool files under `tools/net10.0`. Default runner: exit 1, `Could not find testhost for test source ... Checks.Tests.dll`, no report written. MTP runner: exit 0 in 12 s, `The Microsoft Test Platform testrunner is currently in preview`, `Number of tests found: 6`, `2 mutants created`, `Capture mutant coverage using 'CoverageBasedTest' mode`, report at `out/stryker-mtp/reports/mutation-report.json`. VSTest runner: exit 1, same testhost error. Report: `schemaVersion 2 topLevel files,projectRoot,schemaVersion,testFiles,thresholds`; one file key, an absolute path with backslashes; `language cs`; mutant 0 `Killed`, `Logical mutation`, line 9 columns 61 to 78, replacement `member \|\| !banned`, `coveredBy` 5, `killedBy` 2; mutant 1 `Killed`, `LogicalNotExpression to un-LogicalNotExpression mutation`, line 9 columns 71 to 78, replacement `banned`, `coveredBy` 3, `killedBy` 3; `testFiles 1` with six tests. | Confirmed by run: Q4-1, Q4-3 (tool-path form only), Q4-12, Q4-18, Q4-19, Q4-20, Q4-34, Q4-36, Q4-37, Q4-38, Q4-39, Q4-41, Q4-50. Narrower: Q4-35. Refuted by run: Q4-40 (see the supplement). |
| E9 supplement | Q4-36, Q4-37, Q4-40, the open points on file keys, default output folder and conditional code | 10.0.400 | Added by this pass, because neither VSTest attempt produced a report and no run produced a survivor. In `Checks.VSTest` (same tests, `<UseVSTest>true</UseVSTest>`): `stryker --reporter json --reporter cleartext --output ../out/stryker-vstest`. In `e9s/Weak.Tests` (the two hand-written tests only, sources with CRLF line ends, extra files `Other.cs` and `Skipped.cs`): `stryker --reporter json --reporter cleartext --test-runner mtp --mutate "!**/Skipped.cs" --output ../../out/stryker-mtp-weak`; `stryker --reporter json --test-runner mtp`; `node slice-check.mjs` over the three reports | VSTest variant: exit 0 in 26 s, the same two mutants, `coveredBy` and `killedBy` filled, `testFiles` present, test ids different from the MTP ids. Weak suite: `statuses {"Survived":1,"Killed":1,"NoCoverage":1,"Ignored":1}`; `Skipped.cs` appears with `language cs`, its real source and one mutant `Ignored` with `statusReason` `Removed by mutate filter`; the `NoCoverage` mutant has `statusReason` `Not covered by any test.`. Run without `--output`: report at `e9s\Weak.Tests\StrykerOutput\2026-11-11.22-21-56\reports\mutation-report.json`, beside a generated `StrykerOutput\.gitignore`. Slice check: for all 8 mutants the text between `location.start` and `location.end` equals the original expression, with LF and with CRLF sources; `source` is identical to the file on disk; no byte-order mark. No mutant on line 11, the inactive `#else` branch, and no entry in `files` for generated regular-expression code. | Refuted by run: Q4-40. Confirmed by run: file keys are absolute, and the default output folder is `StrykerOutput\<date.time>\reports` under the directory the tool ran in. |
| E1 | open point on workspace assemblies in the SDK | 10.0.400 | `Get-ChildItem "$env:ProgramFiles\dotnet\sdk\10.0.400\Roslyn\bincore" -Filter "Microsoft.CodeAnalysis*.dll"` with product versions; the same with `-Recurse` and `*Workspaces*` over the SDK folder | `Roslyn\bincore` holds `Microsoft.CodeAnalysis.dll`, `Microsoft.CodeAnalysis.CSharp.dll` and `Microsoft.CodeAnalysis.VisualBasic.dll`, all `5.9.0-1.26379.115`. Workspace assemblies exist only under `DotnetTools\dotnet-format` and `DotnetTools\dotnet-watch`. SDK 11.0.100-rc.3 ships compiler `5.12.0-1.26522.148`. | Confirmed by run: the folder the tool references does not contain the workspace assemblies. |
| E2 | Q2-30, Q2-33, Q2-34, Q2-35 | 10.0.400 | After deleting `Target/obj` and `Target/bin`: `dotnet msbuild Target/Target.csproj -getProperty:LangVersion`; `dotnet msbuild Target/Target.csproj -getProperty:TargetFramework,LangVersion,Nullable,DefineConstants,TreatWarningsAsErrors,TargetPath`; `dotnet msbuild Target/Target.csproj -getProperty:DefineConstants -p:NoFeatureX=true`; `dotnet msbuild Target/Target.csproj -getItem:Compile,Analyzer,AdditionalFiles` | `13` as plain text; JSON with `"DefineConstants": "TRACE;FEATURE_X;DEBUG"`; `TRACE;DEBUG`; JSON with one `Compile` item `Decision.cs`, 2 `Analyzer` items and 0 `AdditionalFiles`. All exit 0 with no restore, and `obj` was not created. | Confirmed by run: Q2-30, Q2-33, Q2-34. Q2-35 was not tested as written. Caveat: the evaluated `DefineConstants` has 3 symbols where the compiler receives 19 (E3), and evaluation lists 2 analyzers where the compiler receives 8. |
| E3 | Q2-7, Q2-10, Q2-11, Q2-12, Q2-32 | 10.0.400 | `dotnet restore Target/Target.csproj`; `dotnet msbuild Target/Target.csproj -t:Compile -p:ProvideCommandLineArgs=true -p:SkipCompilerExecution=true -p:DesignTimeBuild=true -getItem:CscCommandLineArgs`; the same command on an unrestored copy in `e3u` | Restored: exit 0, 205 arguments, among them `/nullable:enable`, `/langversion:13`, `/warnaserror+`, `/define:TRACE;FEATURE_X;DEBUG;NET;NET10_0;...` (19 symbols), 168 `/reference:` entries including `Microsoft.Extensions.Primitives.dll` from the package folder, 8 `/analyzer:` entries including `System.Text.RegularExpressions.Generator.dll`, and three source files. No `.dll` in `obj`; `bin` is created and stays empty; four generated files are written to `obj`. Unrestored copy: exit 0, no message, 204 arguments, 167 references. | Confirmed by run: Q2-7, Q2-10, Q2-11 (nullable, language version, constants, warnings-as-errors and analyzers), Q2-12, Q2-32. Added: without a restore the command succeeds silently with the package reference missing. |
| E6 | Q1-13, Q1-18, Q1-20, Q3-7, Q3-10, Q3-14, Q3-24 to Q3-27, Q3-29, Q3-30, Q3-34 to Q3-36, open point on row identifiers | 10.0.400 | `dotnet build Checks.Tests/Checks.Tests.csproj -c Release`; `dotnet <dll> --list-tests json --no-banner > tests.json`; rebuild with `--no-incremental`; the same into `tests2.json`; `dotnet <dll> --no-banner --filter-uid "1dee9851-d249-8b6d-9f78-ee88c28f82b4" --report-trx --results-directory out/one`; `dotnet <dll> --no-banner --filter "FullyQualifiedName~ComputedChecks" --report-trx --results-directory out/computed`; `dotnet <dll> --no-banner --filter "Name=DoesNotExist"`; `dotnet <dll> --no-banner --option-that-does-not-exist`; `dotnet test --project Checks.Tests/Checks.Tests.csproj -c Release --no-build`; rebuild with `-p:NoFeatureX=true`; `dotnet <dll> --no-banner --report-trx --results-directory out/failing` | Exit codes in order: 0, 0, 0, 0, 8, 5, 0, 2. `tests.json` has `"schemaVersion": 1` and 6 tests, each with `uid`, `displayName`, `type` and `location`; the four rows show `Target.Decision.Allowed(False,False)` and so on. `tests.json` and `tests2.json` are byte-identical. The six `uid` values equal the six test ids in the Stryker.NET MTP report, which was built in Debug. TRX files: 1 result, 4 results, and 6 results with `Target.Decision.Allowed(True,True):Failed`; the file name is `Checks.Tests_net10.0_x64.trx` each time. Extra filters run by this pass: `Id=<uid>` selects 1 row, `Name~True,False` selects 1 row, `DisplayName~Allowed` selects 0, `Name=Check` selects 0, `FullyQualifiedName=Checks.Tests.ComputedChecks.Check` selects 4. | Confirmed by run: Q1-13, Q1-18, Q1-20, Q3-7, Q3-10, Q3-14, Q3-24, Q3-25, Q3-26, Q3-27, Q3-29, Q3-34, Q3-35, Q3-36. Narrower: Q3-30. Not tested: Q3-13, Q3-28, and Q3-31 (an unknown option was run, not an option of an unregistered extension). |
| E7 | Q1-12, Q1-21, Q3-19 to Q3-23, Q3-32, Q3-33, Q3-37 | 10.0.400 | With `global.vstest.json` copied over `global.json`: `dotnet test Checks.Tests/Checks.Tests.csproj -c Release -p:UseVSTest=true --list-tests`; the same with `--filter "FullyQualifiedName~ComputedChecks" --logger "trx;logfilename=vstest.trx"`; with `--filter "Name=DoesNotExist"`; with `-p:NoFeatureX=true --filter "FullyQualifiedName~ComputedChecks"`; added by this pass: with `--filter "Id=1dee9851-d249-8b6d-9f78-ee88c28f82b4"` and with `--filter "Name~True,False"`; then `global.json` restored | The list shows the four row display names and the two hand-written tests. Exit codes: 0 (`Passed: 4`, `Results File: ...\TestResults\vstest.trx`, 4 results), 0 (`No test matches the given testcase filter`), 1 (`Failed: 1, Passed: 3`). `Id=` and `Name~True,False` each ran 1 test. | Confirmed by run: Q1-12, Q1-21 (property passed on the command line), Q3-22, Q3-32, Q3-33, Q3-37. Partly exercised and not counted: Q3-19 to Q3-21 (only `=` and `~`). Not tested: Q3-23. |
| E6 and E7 supplement | Q1-12, Q1-13, Q1-15, Q1-26 | 10.0.400 and 11.0.100-rc.3.26522.148 | Added by this pass. With the VSTest `global.json`: `dotnet test Checks.Tests/Checks.Tests.csproj -c Release --no-build` and `dotnet test --project Checks.Tests/Checks.Tests.csproj -c Release --no-build`. In `e11sdk`, with a `global.json` that pins the 11 release candidate and has no `test` entry: `dotnet test --project ..\Checks.Tests\Checks.Tests.csproj -c Release --no-build`, without and with `DOTNET_TEST_RUNNER=Microsoft.Testing.Platform` | SDK 10, VSTest mode, MTP project: exit 1, `error : Testing with VSTest target is no longer supported by Microsoft.Testing.Platform on .NET 10 SDK and later`. SDK 10, VSTest mode, `--project`: exit 1, MSBuild rejects the switch. SDK 11 rc.3 without the variable: exit 1, the same rejection. SDK 11 rc.3 with the variable: `succeeded: 6`, exit 0. | Confirmed by run: Q1-12, Q1-13, and Q1-15 for selection on the release candidate (the override of `global.json` was not tested). Narrower: Q1-26. |
| E8 | Q3-1, Q3-2, Q3-5 | 10.0.400 | `dotnet build HostLoad/HostLoad.csproj -c Release`; `dotnet build Target/Target.csproj -c Release --no-incremental`; `dotnet HostLoad/bin/Release/net10.0/HostLoad.dll Target/bin/Release/net10.0/Target.dll`; rebuild with `-p:EnableDynamicLoading=true`; the same run | Plain build: the output holds `Target.deps.json`, `Target.dll` and `Target.pdb`; the run prints `ALLOWED True`, then `System.IO.FileNotFoundException: Could not load file or assembly 'Microsoft.Extensions.Primitives, Version=10.0.0.0'`, exit -532462766. With the property: the output also holds `Microsoft.Extensions.Primitives.dll` and `Target.runtimeconfig.json`; `ALLOWED True`, `HASTEXT True`, exit 0. Loading `Target.dll` from the test project's output folder, where the dependency is copied, also printed `HASTEXT True`. | Confirmed by run: Q3-2, Q3-5. Q3-1 was seen only as far as loading into a collectible context, and is not counted. Not tested: Q3-3, Q3-4, Q3-6. |
| E10 | Q5-1, Q5-11, open points on cost and on the coverage extension | 10.0.400 | The commands of section (d), with the whole-suite timing repeated three times | Whole suite: 478, 516 and 454 ms. One test per process: 474, 454, 459, 650, 451 and 447 ms, each exit 0. `--coverage --coverage-output-format cobertura` was accepted, exit 0 six times. The five files of tests that call `Allowed` are 14461 bytes each and all show `<line number="9" hits="1" branch="True" condition-coverage="50% (1/2)">`; the file of `AlwaysPasses` is 181 bytes with `<packages />`. The coverage files include `RegexGenerator.g.cs`. | Confirmed by run: Q5-1, Q5-11, and the MSTest SDK registers the coverage extension. Added: one test alone costs about as much as the whole suite here, and line hits do not tell the four rows apart, because the decision is one line. |
| E11 | Q5-3, Q5-4, Q5-5 | 10.0.400 | `dotnet tool install dotnet-coverage --version 18.12.0 --tool-path <S>\tools`; `coverage collect --server-mode --background --session-id exp1`; `coverage connect exp1 dotnet <dll> --no-banner --filter-uid "1cd8ac51-55a8-849c-8b39-a79b6c163005"`; `coverage snapshot exp1 --reset --output out/snap-1.coverage`; the same pair for uid `13a587f4-d2f5-811e-b1d5-a177733b541c` into `snap-2`; `coverage shutdown exp1`; `coverage merge out/snap-1.coverage --output out/snap-1.xml --output-format cobertura` and the same for `snap-2` | All exit 0. `connect` took 1581 and 1382 ms, `snapshot` 521 and 525 ms. `snap-1.xml`: `Target` package, line 9 `hits="1"`. `snap-2.xml`: `Target` package line rate 0, line 9 `hits="0"`. The first attempt captured the output of `collect --background` through a pipe, did not return for 180 s and was stopped; the server it had started was then used, with output sent to files. | Confirmed by run: Q5-3, Q5-4, Q5-5. Added: the session costs about 2 s per test here, against about 0.45 s for a plain single-test process. |
| E4 | Q2-1 to Q2-5, Q2-13, Q2-15, Q2-17, Q2-18, Q2-20 to Q2-22, open points on restore and version alignment | 10.0.400 | `dotnet build Loader/Loader.csproj -c Release`; `dotnet restore Target/Target.csproj`; `dotnet Loader/bin/Release/net10.0/Loader.dll Target/Target.csproj`; delete `Target/obj` and `Target/bin`; the same run; `dotnet Loader/bin/Release/net10.0/Loader.dll Target/Missing.csproj`; a poll of `Win32_Process` command lines during one more run | Build: 0 errors with packages 5.9.0; the output has `BuildHost-netcore` and `BuildHost-net472` folders and no `Microsoft.Build.dll` or `Microsoft.Build.Locator.dll`. Restored: `LANGVERSION CSharp13`, `SYMBOLS TRACE,FEATURE_X,DEBUG,NET,NET10_0,...`, `NULLABLE Enable`, `GENERALDIAGNOSTIC Error`, `METADATAREFERENCES 168`, 8 `AnalyzerFileReference` lines, `GENERATEDDOCUMENTS 1`, `SYNTAXTREES 4`, `METHOD Allowed member && !banned`, `EMIT True`, no `WORKSPACE` line. Unrestored: no exception, no `WORKSPACE` line, `METADATAREFERENCES 167`, `ERROR ... CS0234` and `ERROR ... CS0246`, `EMIT False`, exit 0, and four files written to `Target/obj`. Missing file: `THROWN System.IO.FileNotFoundException: Project file not found`. Child process seen: `"dotnet.exe" --roll-forward LatestMajor <S>\Loader\bin\Release\net10.0\BuildHost-netcore\Microsoft.CodeAnalysis.Workspaces.MSBuild.BuildHost.dll <guid> en-US`. | Confirmed by run: Q2-1, Q2-2, Q2-3, Q2-4 (for package 5.9.0), Q2-13, Q2-15 (references and analyzers), Q2-20, Q2-21, Q2-22; no locator call was needed; the 5.9.0 package loaded the generators of an SDK whose compiler is 5.9.0-1. Narrower: Q2-18. Not tested or not counted: Q2-5, Q2-6, Q2-14, Q2-16, Q2-17, Q2-19. |
| E5 | Q2-40 to Q2-43, Q2-47, Q2-49 | 10.0.400 | `dotnet build SpecAnalyzer/SpecAnalyzer.csproj -c Release -p:RoslynVersion=5.6.0`; `dotnet build Target/Target.csproj --no-incremental -p:WithSpecAnalyzer=true -p:TreatWarningsAsErrors=false`; `dotnet build Target/Target.csproj --no-incremental -p:WithSpecAnalyzer=true`; `dotnet build SpecAnalyzer/SpecAnalyzer.csproj -c Release -p:RoslynVersion=5.6.0 -p:WithBanned=true`. Version 5.6.0 was chosen because both packages publish it and it is older than the SDK compiler. | Second command: `CSC : warning SPEC001: lang=CSharp13 symbols=TRACE+FEATURE_X+DEBUG+NET+NET10_0+... nullable=Enable methods=Allowed,Pattern specLength=16`, exit 0. Third: `CSC : error SPEC001: ...`, `1 Error(s)`, exit 1. Fourth: `Banned.cs(3,49): error RS1035: The symbol 'File' is banned for use by analyzers: Do not do file IO in analyzers`, exit 1. | Confirmed by run: Q2-40, Q2-41, Q2-42, Q2-43. One `SPEC001` per compilation is consistent with Q2-49, which is not counted. |
| E5 supplement | Q2-47, open point on run-time enforcement | 10.0.400 | Added by this pass. In `e5io`: an analyzer with `<EnforceExtendedAnalyzerRules>false</EnforceExtendedAnalyzerRules>` whose start action calls `System.IO.File.ReadAllText(spec.Path)` and `System.Diagnostics.Process.GetCurrentProcess().ProcessName`; `dotnet build IoAnalyzer/IoAnalyzer.csproj -c Release -p:RoslynVersion=5.6.0`; `dotnet build Target/Target.csproj --no-incremental -p:WithSpecAnalyzer=true -p:TreatWarningsAsErrors=false` | Analyzer build: `0 Error(s)`, no RS1035. Target build: `warning SPEC001: ... specLength=28`, which is the 16 characters of the file plus the 12 characters of `VBCSCompiler`. | Confirmed by run: Q2-47. Added: the compiler did not block file or process access when the analyzer ran. |

### E9 against `scripts/mutation.ts`

The kept report is `<S>\out\stryker-mtp\reports\mutation-report.json` (4268 bytes, Stryker.NET 5.1.0, MTP runner).
Two more reports are kept: `<S>\out\stryker-vstest\reports\mutation-report.json` and `<S>\out\stryker-mtp-weak\reports\mutation-report.json`, the second with `Survived`, `NoCoverage` and `Ignored` mutants.
`mutation.ts` was read as executable statements and was not run.
The slice check in Table 1 used a copy of the arithmetic of lines 40 to 45 in a separate script, so it tests that arithmetic and not the helper.

| Field or step | Where `mutation.ts` reads it | In the Stryker.NET report | Same name, type and meaning |
| --- | --- | --- | --- |
| `files` | lines 106 to 108, `Object.entries(report.files)` | present, an object | yes |
| file key | line 110, `isAbsolute(name) ? name : join(project.root, name)`, then `project.path`, which is `relative(root, ...)` with separators replaced by `/` (`scripts/project.ts` lines 139 to 142 and 189) | an absolute Windows path with a drive letter and backslashes, for example `<S>\Target\Decision.cs`; the shared schema describes the key as a relative path | Accepted by line 110. The result is a root-relative path with forward slashes only when the mutated file lies under the checker's root. |
| `source` | lines 106, 119 to 123 and 139 | present, identical to the file on disk, line ends kept as they are (LF or CRLF), no byte-order mark | yes |
| `mutants` | lines 106 and 112 | present, an array | yes |
| `status` | lines 114 to 116, compared with `Killed` and `Timeout`, and with `Survived` and `NoCoverage` (line 38) | strings; observed `Killed`, `Survived`, `NoCoverage`, `Ignored`; `Timeout`, `CompileError`, `RuntimeError` and `Pending` were not produced | Same names for the three tested values that appeared. `Ignored` falls into `other` (line 116), and `other > 0` makes the exit code 1 (line 210). |
| `location.start` and `location.end`, each with `line` and `column` | lines 119 to 123 and 135, through `offsetOf` (lines 40 to 45) | integers, one-based, end exclusive; the slice equals the original expression for all 8 mutants | yes |
| `replacement` | line 124, optional | present on all 8 mutants, the full replacement text of the located span, for example `member \|\| !banned` | yes |
| `mutatorName` | lines 128 and 136, compared with an explanation's `mutator` | present; values such as `Logical mutation`, `Arithmetic mutation`, `LogicalNotExpression to un-LogicalNotExpression mutation` | Same name and type. The values are Stryker.NET's own wording, so an explanation written for one tool does not match the other. |
| not read | no line | `schemaVersion`, `thresholds`, `projectRoot`, `testFiles`; per file `language`; per mutant `id`, `static`, `coveredBy`, `killedBy`, `statusReason` | not applicable |

How a mutant is mapped to a unit, as read:

`unitAt` (lines 47 to 67) parses the report's `source` with the TypeScript parser (line 53).
It takes the top-level statement that contains the mutant's start offset (lines 54 to 56).
It takes a name only when that statement is a function declaration or a variable statement (lines 57 to 62).
It then looks for an obligation with `o.file === file && o.name === name` (line 63).
A C# method is a member of a type and is never a top-level function declaration, so for a C# source no name can come from lines 57 to 62.
That last sentence is an inference from the code, because the helper was not run on C# text.
Every C# survivor would then be printed as `in code that has no computed check` (line 188).

What would have to change for the helper to sort this report:

1. The unit lookup must be done by a C# parser, which maps file, line and column to the enclosing method and matches it to a unit of the C# backend.
   The C# backend writes units with `name` and `cases` (`scripts/dotnet/Program.cs` line 100), and a search of that file for a `file` property found none, so line 63 has nothing to match on; only that line and the search were read.
2. The claim test on lines 97 to 100 uses `settings.include`, whose default is `src/**/*.ts` (`scripts/project.ts` line 46), so every C# file is `outside` until the settings name C# files.
3. `Ignored` must be handled.
   Excluding a file with `mutate` still produced a mutant with status `Ignored`, and the helper turns any such mutant into exit code 1.
4. The report path must be passed with `--report=`.
   The default on line 171 is `reports/mutation.json`, and Stryker.NET writes `StrykerOutput\<date.time>\reports\mutation-report.json`, or `<output>\reports\mutation-report.json` with `--output`.
5. The mutated project must lie under the checker's root, or line 110 yields a path that starts with `..` or stays absolute.

One further candidate was seen and not resolved.
`scripts/inventory.ts` line 323 sets an obligation's file to `relative(root, file)`, which uses backslashes on Windows, while `mutation.ts` line 109 produces forward slashes for the comparison on line 63.
Whether the two ever differ in a written `obligations.json` was not established, because neither script was run and `inventory.ts` was read only at lines 258 to 264 and 318 to 340.

### Table 2. Citations re-opened

Each source was downloaded in this pass and searched for the quoted text.
Package versions, dates and dependencies were read from the NuGet registration index, not from the gallery pages.

| Claim | Verdict | Accurate statement, where it differs |
| --- | --- | --- |
| Q1-1 | confirmed | |
| Q1-2 | confirmed | |
| Q1-3 | confirmed | |
| Q1-4 | confirmed | |
| Q1-5 | confirmed | |
| Q1-6 | confirmed | |
| Q1-7 | confirmed | |
| Q1-8 | confirmed | |
| Q1-9 | confirmed | |
| Q1-10 | confirmed | |
| Q1-11 | confirmed | |
| Q1-12 | confirmed | |
| Q1-13 | confirmed | |
| Q1-14 | confirmed | |
| Q1-15 | confirmed | |
| Q1-16 | confirmed | |
| Q1-17 | confirmed | |
| Q1-26 | narrower | The page still says the support "will be removed", and the quote is accurate. With MTP 2.5.3 on SDK 10.0.400 the removal has happened: `dotnet test` in VSTest mode on an MTP project fails with "Testing with VSTest target is no longer supported by Microsoft.Testing.Platform on .NET 10 SDK and later". https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/unit-testing-with-dotnet-test.md |
| Q2-1 | confirmed | |
| Q2-2 | confirmed | |
| Q2-3 | confirmed | |
| Q2-25 | confirmed | |
| Q2-42 | confirmed | |
| Q2-43 | confirmed | |
| Q2-44 | confirmed | |
| Q2-45 | confirmed | |
| Q2-46 | confirmed | |
| Q2-47 | confirmed | |
| Q2-48 | confirmed | |
| Q3-25 | confirmed | |
| Q3-26 | confirmed | |
| Q3-27 | confirmed | |
| Q3-29 | confirmed | |
| Q3-30 | narrower | Exit code 5 is as stated. Exit code 8 is documented as "the test session discovered no tests, or that every selected test was skipped under the strict `--zero-tests-policy`", and it was also returned when a filter matched no test. Exit code 9 covers a run below `--minimum-expected-tests`. https://raw.githubusercontent.com/dotnet/docs/main/docs/core/testing/microsoft-testing-platform-troubleshooting.md |
| Q3-31 | confirmed | |
| Q4-1 | confirmed | |
| Q4-2 | confirmed | |
| Q4-4 | confirmed | |
| Q4-12 | confirmed | |
| Q4-13 | confirmed | |
| Q4-14 | confirmed | |
| Q4-22 | confirmed | |
| Q4-23 | confirmed | |
| Q4-24 | confirmed | |
| Q4-26 | confirmed | |
| Q4-27 | confirmed | |
| Q4-32 | confirmed | |
| Q4-36 | confirmed | |
| Q4-40 | refuted | The cited file does define a placeholder (`SourceFile.Ignored`, source "File ignored by mutate filter", language "none", no mutants), and the file does not show where it is used. In a run of 5.1.0 with `--mutate "!**/Skipped.cs"` the excluded file was reported with its real source, language `cs` and one mutant with status `Ignored`. https://raw.githubusercontent.com/stryker-mutator/stryker-net/master/src/Stryker.Core/Stryker.Core/Reporters/Json/SourceFiles/SourceFile.cs |
| Q5-2 | confirmed | |
| Q5-9 | confirmed | |

Two half-claims were also checked and are not counted.
The registry half of Q3-38 holds: the package has only pre-release versions, the latest being `1.0.0-alpha.26561.10`.
The change-log half of Q4-16 holds: the entry is listed under "Features" of 5.1.0.
`Microsoft.Extensions.Primitives` 10.0.1, which section (d) used without checking, exists and restored.

### Error rate

Citations re-opened: 51 claims; 48 confirmed, 2 narrower, 1 refuted, 0 unreachable.
Claims exercised by a run: 68; 63 confirmed, 4 narrower, 1 refuted.
19 claims are in both sets.
Distinct claims checked: 100 of 202; 95 confirmed, 4 narrower (Q1-26, Q2-18, Q3-30, Q4-35), 1 refuted (Q4-40), 0 unreachable.
Several "confirmed by run" verdicts cover part of a claim only, and Table 1 says which part.
Section (d) predicted the exit codes of E6 and E7 correctly.
Section (d) did not predict three results: the default Stryker.NET runner failing on the test project, the silent result for an unrestored project, and identical test names for the data rows.

### Claims that must not be relied on as written

* Q4-40: refuted.
  Use: a file excluded by `mutate` is reported with its real source, and its mutants carry status `Ignored` and the reason "Removed by mutate filter" (5.1.0, MTP runner).
* Q4-35: narrower.
  Use: the mutants in the three reports carried `id`, `mutatorName`, `replacement`, `location`, `status`, `static`, `coveredBy` and `killedBy`, and `statusReason` only for `NoCoverage` and `Ignored`; `description`, `testsCompleted` and `duration` never appeared.
* Q2-18: narrower.
  Use: a missing project file throws `FileNotFoundException`; a project that was never restored does not throw and leaves `Diagnostics` empty, and the only signals are one fewer metadata reference and compilation errors.
* Q1-26: narrower.
  Use: with MTP 2.5.3 on SDK 10.0.400, running an MTP project through VSTest mode fails; the support is removed, not scheduled for removal.
* Q3-30: narrower.
  Use: exit code 8 means no test was discovered or selected, or every selected test was skipped under the strict zero-tests policy.
* Q4-3: confirmed only for a tool-path installation; the global and manifest forms were not run.
* Q4-12, when used to pick the default: the default runner is VSTest, and it fails with "Could not find testhost" on a project built with the MSTest SDK in its default MTP mode, so `--test-runner mtp` is required there.
* Q4-41, and the question in section (d) about naming rows: `coveredBy` and `killedBy` identify each data row by id, and the ids equal the MTP `uid` values, but `testFiles` gives all four rows the same `name` (`Checks.Tests.ComputedChecks.Check`) and no display name.
* Q2-30 to Q2-35, when used as a source of compiler settings: evaluation without a build gave `DefineConstants` with 3 symbols and 2 analyzers, where the compiler command line has 19 symbols and 8 analyzers.
* Q2-7 and Q2-10, when used as a path that writes nothing and needs no restore: the design-time build writes four files to `obj`, creates `bin`, and succeeds silently on an unrestored project with the package reference missing.
* Q2-42 to Q2-48, when used as a run-time guarantee: the ban is a build-time rule for the analyzer's own project, and an analyzer built without the property read a file and inspected a process inside the compiler server.

### Worklist for a person

Table A has one row per finding, ordered by effort.

| ID | Question to decide | Where to look | Command | Minutes |
| --- | --- | --- | --- | --- |
| A1 | Is a mutant with status `Ignored` a failure of the mutation step or a neutral exclusion? | `scripts/mutation.ts` lines 114 to 117 and 210; the weak-suite report | `node <S>\inspect-report.mjs <S>\out\stryker-mtp-weak\reports\mutation-report.json` | 5 |
| A2 | Is about 0.45 s per single-test process, or about 2 s per test in a coverage session, an acceptable cost for per-test reconciliation? | rows E10 and E11 | `dotnet <dll> --no-banner --filter-uid <uid>` | 5 |
| A3 | Must the tool refuse a project that was not restored, given that loading it reports nothing? | rows E3 and E4 | `dotnet <S>\Loader\bin\Release\net10.0\Loader.dll <S>\e3u\Target\Target.csproj` | 10 |
| A4 | Is it acceptable that Stryker.NET names all rows of one data-driven test alike, when the ids match the MTP identifiers? | `testFiles` in the kept report; `<S>\tests.json` | `node <S>\inspect-report.mjs <S>\out\stryker-mtp\reports\mutation-report.json` | 10 |
| A5 | May a check that runs as an analyzer read files, given that nothing stops it at run time and the published rule forbids it at build time? | `<S>\e5io` | `dotnet build <S>\e5io\Target\Target.csproj --no-incremental -p:WithSpecAnalyzer=true -p:TreatWarningsAsErrors=false` | 15 |
| A6 | Do the file names in `obligations.json` and the helper's file names use the same separators on Windows? | `scripts/inventory.ts` line 323; `scripts/mutation.ts` lines 63 and 109 | `git grep -n "file: rel" -- skills/development/verifiable/scripts/inventory.ts` | 20 |
| A7 | Where does the C# unit lookup belong: in the C# backend, or in the helper? | `scripts/mutation.ts` lines 47 to 67; `scripts/dotnet/Program.cs` line 100 | `git grep -n "unitAt" -- skills/development/verifiable/scripts` | 30 |

Table B lists what this pass did not reach, ordered by effort.

| Item | How it was looked at | What could not be ruled out | Minutes |
| --- | --- | --- | --- |
| Q1-15, override of `global.json` by the environment variable | run on SDK 11.0.100-rc.3 only, with no `test` entry | behaviour on the released 11.0.100, and the override case | 10 |
| Q3-31 | an unknown option was run, not an option of an unregistered extension | the exit code for a real extension option | 10 |
| `scripts/mutation.ts` on a Stryker.NET report | read, not run | the actual output and exit code | 15 |
| Q2-5 (working directory), Q2-14, Q2-17, Q2-19 | not exercised by E4 as written | where the build host starts, documentation mode, when `Diagnostics` is filled, referenced projects | 20 |
| Whether `Project.GetCompilationAsync` runs analyzers | not tested | the open point of section (c) stays open | 20 |
| Q3-1 (unloading), Q3-3, Q3-4, Q3-6 | not exercised by E8 as written | real unload, type identity across contexts, .NET Standard libraries | 30 |
| Statuses `Timeout`, `CompileError`, `RuntimeError`, `Pending` | never produced | spelling and meaning in a real report | 30 |
| Stryker.NET `perTestInIsolation`, `--since`, solution mode, projects with several target frameworks | never run | report shape and file keys in those modes | 45 |
| `scripts/inventory.ts`, `scripts/reconcile.ts`, `scripts/dotnet/Program.cs` | 30 lines, 0 lines, and one line plus a search | the obligation format of both backends | 60 |
| Linux and macOS | never run | the form of file keys, separators, the build-host start | 60 |
| 102 claims of section (b): L1 to L10, Q1-19, Q1-22 to Q1-25, Q1-27, Q2-5, Q2-6, Q2-8, Q2-9, Q2-14, Q2-16, Q2-17, Q2-19, Q2-23, Q2-24, Q2-26 to Q2-29, Q2-31, Q2-35 to Q2-39, Q2-49 to Q2-55, Q3-1, Q3-3, Q3-4, Q3-6, Q3-8, Q3-9, Q3-11 to Q3-13, Q3-15 to Q3-21, Q3-23, Q3-28, Q3-38 to Q3-43, Q4-5 to Q4-11, Q4-15 to Q4-17, Q4-21, Q4-25, Q4-28 to Q4-31, Q4-33, Q4-42 to Q4-49, Q4-51 to Q4-55, Q5-6 to Q5-8, Q5-10, Q5-12 | not re-opened and not exercised, or exercised in part only | each remains a claim of the first pass | 240 |

### Note on the versions of the local files read

`scripts/mutation.ts`, `scripts/project.ts` and `scripts/inventory.ts` were read in the working tree, where they are unmodified against commit `dbefbe5`.
`scripts/dotnet/Program.cs` changed in the working tree while this pass ran.
The reference to its line 100 above is to the file at commit `dbefbe5`, where the units are written with `name` and `cases`.
In the working tree at the end of this pass the units are written on line 96 with `name`, `cases`, `claim` and `domains`, and that line still has no `file` property.
The new file `scripts/dotnet/Admission.cs` was not read.
