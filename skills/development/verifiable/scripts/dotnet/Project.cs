using System.Collections.Immutable;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Loader;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Diagnostics;
using Microsoft.CodeAnalysis.Emit;
using Microsoft.CodeAnalysis.Text;

/// <summary>What a project was built as: the compilation the tool made of it, the assembly of that compilation, and the configuration and framework the build used.</summary>
internal sealed record Built(CSharpCompilation Compilation, byte[] Assembly, string Configuration, string Framework);

/// <summary>
/// Builds a project, compiles it again from what its build gives the compiler, and accepts the result only when the program the build wrote is that same code.
/// The project is built with the command a person runs, and nothing is added to that build.
/// The compiler's command line comes from a second run of the build that compiles nothing; from it come the source files, the references, the code generators, the language version, the defined symbols and the other options.
/// The tool runs the code generators itself, as the compiler does, and compares its result with the built program instruction for instruction.
/// For the tool's compilation a warning is never an error, because its compiler need not warn where the project's compiler does.
/// </summary>
internal static class Project
{
    // The compiler reads a file without a byte order mark as UTF-8 and, where that fails, in a code page of the machine; the tool refuses such a file.
    private static readonly Encoding Strict = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    public static Built Load(string path, string? configuration, string? framework)
    {
        Tool.Require(Path.GetExtension(path) == ".csproj" && File.Exists(path), "--project must name an existing .csproj file");
        var directory = Path.GetDirectoryName(path)!;
        var build = Build(path, directory, configuration, framework);
        var parsed = CSharpCommandLineParser.Default.Parse(build.Arguments, directory, sdkDirectory: null);
        var errors = parsed.Errors.Where(error => error.Severity == DiagnosticSeverity.Error).ToArray();
        Tool.Require(errors.Length == 0, $"the tool's compiler does not accept the project's compiler options:{Lines(errors)}");
        Tool.Require(!parsed.EmitOptions.EmitMetadataOnly, "the build of this project writes only a reference assembly, which has no code to run");
        // Instrumented code calls methods of the project at the start of every method, so a check would run code that was never admitted.
        Tool.Require(parsed.EmitOptions.InstrumentationKinds.IsEmpty,
            $"the build of this project instruments its code ({string.Join(", ", parsed.EmitOptions.InstrumentationKinds)}), so every method calls code that was never admitted; a project built that way is not admitted");
        // The compiler takes a file once, however often and in whatever spelling the project names it.
        var files = parsed.SourceFiles.Select(file => file.Path).Distinct(OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal);
        var trees = files.Select(file =>
        {
            using var stream = File.OpenRead(file);
            try { return CSharpSyntaxTree.ParseText(SourceText.From(stream, parsed.Encoding ?? Strict, parsed.ChecksumAlgorithm), parsed.ParseOptions, file); }
            catch (DecoderFallbackException)
            {
                throw new InvalidOperationException($"{file} is not valid UTF-8 and the project names no code page, so the tool does not know how the compiler reads it");
            }
        });
        // The resolver carries the path mapping of the build, which decides the file names that code can ask for and the names of types a file keeps to itself.
        var options = parsed.CompilationOptions.WithGeneralDiagnosticOption(ReportDiagnostic.Default)
            .WithStrongNameProvider(new DesktopStrongNameProvider([directory]))
            .WithSourceReferenceResolver(new SourceFileResolver(parsed.SourcePaths, directory, parsed.PathMap));
        var written = CSharpCompilation.Create(parsed.CompilationName, trees,
            parsed.MetadataReferences.Select(reference => MetadataReference.CreateFromFile(Path.GetFullPath(reference.Reference, directory), reference.Properties)), options);
        var (compilation, failed) = Generated(written, parsed, directory);
        var broken = compilation.GetDiagnostics().Where(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error).ToArray();
        Tool.Require(broken.Length == 0,
            $"the project builds, and the tool's compiler finds errors in the same files; {broken.Length} errors, the first of them:{Lines(broken.Take(5))}{failed}");
        // A module initializer runs before the first method of the assembly, so calling a checked method would run code that was never admitted.
        var initializer = Methods(compilation.Assembly.GlobalNamespace).FirstOrDefault(method => method.GetAttributes().Any(attribute =>
            attribute.AttributeClass?.ToDisplayString() == "System.Runtime.CompilerServices.ModuleInitializerAttribute"));
        Tool.Require(initializer == null,
            $"the project has a module initializer, {initializer?.ToDisplayString()}, which would run before a checked method; a project with one is not admitted");

        // The build can differ from this compilation in ways no option shows: a step that changes a file around the compiler, code a tool puts into the assembly afterwards, a compiler of another version.
        // So the program the build wrote is read back and must be, instruction for instruction, what this compilation gives.
        using var compiled = new MemoryStream();
        // The compiler writes other instructions when it also writes debug information, so this compilation writes it where the build did.
        using var symbols = parsed.EmitPdb && parsed.EmitOptions.DebugInformationFormat != DebugInformationFormat.Embedded ? new MemoryStream() : null;
        var emit = compilation.Emit(compiled, symbols, options: parsed.EmitOptions);
        Tool.Require(emit.Success, $"the tool cannot write the assembly of the project:{Lines(emit.Diagnostics.Where(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error).Take(5))}");
        compiled.Position = 0;
        Tool.Require(File.Exists(build.Target), $"the build wrote no program at {build.Target}, so there is nothing to compare the tool's compilation with");
        using var shipped = File.OpenRead(build.Target);
        var difference = Listing.Difference(Listing.Of(shipped), Listing.Of(compiled));
        Tool.Require(difference == null,
            $"the program the build wrote is not what the tool compiles from the files and options of that build; the first difference is in {difference}. "
            + "Causes seen so far: a build step that changes a file, an option or the assembly around the compiler; a code generator that writes something else on each run; "
            + $"a project built with another compiler version than the tool's.{failed}");
        return new(compilation, compiled.ToArray(), build.Configuration, build.Framework);
    }

    private sealed record Reported(string[] Arguments, string Target, string Configuration, string Framework);

    /// <summary>
    /// Builds the project with <c>dotnet build</c>, exactly as a person does, and then asks its build for what it gives the C# compiler, where it writes the program, and which configuration and framework it uses.
    /// The first run is the project's own build: it restores, runs every step and writes every file.
    /// The second run compiles nothing and builds no other project.
    /// </summary>
    private static Reported Build(string path, string directory, string? configuration, string? framework)
    {
        foreach (var (option, value) in new[] { ("--configuration", configuration), ("--framework", framework) })
            // The value goes to the build as it is, so it must be a name and nothing the build could read as more options.
            Tool.Require(value == null || Regex.IsMatch(value, "^[A-Za-z0-9._-]+$"), $"{option} takes one name of letters, digits, dots, hyphens and underscores");
        var (built, _, said) = Dotnet(directory, ["build", path, "--nologo", .. Named("--configuration", configuration), .. Named("--framework", framework)]);
        // A failed build reports each error once in the form "error CODE: text"; where it reports none in that form, its last lines say what happened.
        var failures = said.Where(line => line.Contains("error ")).Distinct().Take(10).ToArray();
        Tool.Require(built, $"the project does not build:{Lines(failures.Length > 0 ? failures : said.TakeLast(10))}");
        // The compile step is skipped when its outputs are up to date, and then it reports no command line; an output that never exists keeps it from being skipped.
        // BeforeBuild is named because steps that change compiler options commonly attach to it, and the compile step alone would not run them.
        var (reported, output, _) = Dotnet(directory, ["msbuild", path, "-nologo", "-t:BeforeBuild;Compile", "-p:ProvideCommandLineArgs=true", "-p:SkipCompilerExecution=true",
            "-p:NonExistentFile=__NonExistentSubDir__/__NonExistentFile__", "-p:BuildProjectReferences=false",
            .. Named("-p:Configuration=", configuration), .. Named("-p:TargetFramework=", framework),
            "-getItem:CscCommandLineArgs", "-getProperty:TargetPath", "-getProperty:Configuration", "-getProperty:TargetFramework"]);
        const string none = "the build of this project file runs no C# compiler; for a project with several target frameworks, name one with --framework";
        Tool.Require(reported, none);
        using var document = JsonDocument.Parse(output);
        var items = document.RootElement.GetProperty("Items").GetProperty("CscCommandLineArgs").EnumerateArray()
            .Select(item => item.GetProperty("Identity").GetString()!).ToArray();
        Tool.Require(items.Length > 0, none);
        string Property(string name) => document.RootElement.GetProperty("Properties").GetProperty(name).GetString()!;
        return new(items, Property("TargetPath"), Property("Configuration"), Property("TargetFramework"));
    }

    /// <summary>An option with its value: two arguments, or one when the option ends in an equals sign, and none when there is no value.</summary>
    private static string[] Named(string option, string? value) => value == null ? [] : option.EndsWith('=') ? [option + value] : [option, value];

    /// <summary>The window of this process's console on Windows, or zero when the process has no console.</summary>
    [DllImport("kernel32.dll")]
    private static extern nint GetConsoleWindow();

    /// <summary>Runs the dotnet command of the search path in the project's folder, as the project's own build is run.</summary>
    private static (bool Succeeded, string Output, string[] Said) Dotnet(string directory, string[] arguments)
    {
        // On Windows a console program started by a process that has no console opens a window of its own, so it is started without one.
        // A process that has a console passes it on, and the output is read in that console's code page, so the build is then started as before.
        var start = new ProcessStartInfo("dotnet")
        {
            RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = directory,
            CreateNoWindow = OperatingSystem.IsWindows() && GetConsoleWindow() == 0,
        };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        using var process = Process.Start(start)!;
        var errors = process.StandardError.ReadToEndAsync();
        var output = process.StandardOutput.ReadToEnd();
        process.WaitForExit();
        return (process.ExitCode == 0, output, [.. (errors.Result + Environment.NewLine + output).Split('\n').Select(line => line.Trim()).Where(line => line.Length > 0)]);
    }

    /// <summary>
    /// The compilation with the code its generators add, run as the compiler runs them: with the project's additional files and its configuration files.
    /// The second value says which generators failed inside the tool, for the message of a refusal that follows from it.
    /// </summary>
    private static (CSharpCompilation Compilation, string Failed) Generated(CSharpCompilation written, CSharpCommandLineArguments parsed, string directory)
    {
        var places = parsed.AnalyzerReferences.Select(reference => Path.GetFullPath(reference.FilePath, directory)).ToArray();
        var loader = new FromPath(places);
        var generators = places.SelectMany(place => new AnalyzerFileReference(place, loader).GetGenerators(LanguageNames.CSharp)).ToArray();
        var configured = AnalyzerConfigSet.Create(parsed.AnalyzerConfigPaths.Select(file => AnalyzerConfig.Parse(File.ReadAllText(file), file)).ToList());
        var additional = parsed.AdditionalFiles.Select(file => (AdditionalText)new Extra(file.Path, parsed.Encoding, parsed.ChecksumAlgorithm));
        // The compiler names a generated file under the folder it would write it to, and that name goes into the names of the types the file keeps to itself.
        var driver = CSharpGeneratorDriver.Create(generators, additional, parsed.ParseOptions, new Configured(configured),
            new GeneratorDriverOptions(IncrementalGeneratorOutputKind.None, trackIncrementalGeneratorSteps: false, baseDirectory: parsed.GeneratedFilesOutputDirectory ?? parsed.OutputDirectory));
        driver.RunGeneratorsAndUpdateCompilation(written, out var compilation, out var messages);
        // CS8784 and CS8785 say that a generator could not start or stopped with an exception.
        var failed = messages.Where(message => message.Id is "CS8784" or "CS8785").ToArray();
        return ((CSharpCompilation)compilation, failed.Length == 0 ? "" : $"{Environment.NewLine}A code generator of the project failed inside the tool:{Lines(failed)}");
    }

    /// <summary>Loads the assemblies of code generators, and finds what they depend on among the other analyzer files the build names.</summary>
    private sealed class FromPath : IAnalyzerAssemblyLoader
    {
        public FromPath(string[] places)
        {
            var byName = places.ToLookup(place => Path.GetFileNameWithoutExtension(place), StringComparer.OrdinalIgnoreCase);
            AssemblyLoadContext.Default.Resolving += (context, name) => byName[name.Name ?? ""].Select(context.LoadFromAssemblyPath).FirstOrDefault();
        }

        public void AddDependencyLocation(string fullPath) { }
        public Assembly LoadFromPath(string fullPath) => Assembly.LoadFrom(fullPath);
    }

    private sealed class Extra(string path, Encoding? encoding, SourceHashAlgorithm checksum) : AdditionalText
    {
        public override string Path => path;

        public override SourceText GetText(CancellationToken cancellationToken = default)
        {
            using var stream = File.OpenRead(path);
            return SourceText.From(stream, encoding, checksum);
        }
    }

    private sealed class Configured(AnalyzerConfigSet set) : AnalyzerConfigOptionsProvider
    {
        public override AnalyzerConfigOptions GlobalOptions => new Options(set.GlobalConfigOptions.AnalyzerOptions);
        public override AnalyzerConfigOptions GetOptions(SyntaxTree tree) => new Options(set.GetOptionsForSourcePath(tree.FilePath).AnalyzerOptions);
        public override AnalyzerConfigOptions GetOptions(AdditionalText textFile) => new Options(set.GetOptionsForSourcePath(textFile.Path).AnalyzerOptions);

        private sealed class Options(ImmutableDictionary<string, string> values) : AnalyzerConfigOptions
        {
            public override bool TryGetValue(string key, out string value) => values.TryGetValue(key, out value!);
        }
    }

    private static IEnumerable<IMethodSymbol> Methods(INamespaceOrTypeSymbol container) => container.GetMembers().SelectMany(member => member switch
    {
        INamespaceOrTypeSymbol inner => Methods(inner),
        IMethodSymbol method => [method],
        _ => []
    });

    private static string Lines<T>(IEnumerable<T> lines) => string.Concat(lines.Select(line => Environment.NewLine + line));
}
