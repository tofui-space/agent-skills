using System.Reflection;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

return Tool.MainCommand(args);

internal sealed record SpecRow(JsonElement[] Input, JsonElement Outcome);
internal sealed record Spec(string Requirement, string[] Parameters, SpecRow[] Rows, string[] Unsettled);
internal sealed record Specs(Dictionary<string, Spec> Units);
internal sealed record Case(object[] Input, object Expected);
internal sealed record Domain(string Parameter, string Type, object[] Values, string? Unnamed);
internal sealed record Unit(string Name, string[] Parameters, string Claim, Domain[] Domains, int Cases, Case[] Checks);
internal sealed record Report(string Schema, string Backend, string SourceHash, string SpecHash,
    string Compiler, string Runtime, Unit[] Units, string[] Unsettled);

internal static class Tool
{
    private const string Version = "csharp-decision-v2";
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        RespectRequiredConstructorParameters = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };
    private static readonly SymbolDisplayFormat RuntimeName = new(
        typeQualificationStyle: SymbolDisplayTypeQualificationStyle.NameAndContainingTypesAndNamespaces);

    public static int MainCommand(string[] args)
    {
        try { return Execute(args); }
        catch (Exception e)
        {
            Console.Error.WriteLine($"REJECTED: {e.Message}");
            return 1;
        }
    }

    private static int Execute(string[] args)
    {
        if (args.Length == 1 && args[0] == "capabilities")
        {
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                backend = Version,
                commands = new[] { "paths", "inventory", "check", "run" },
                shapes = new[] { "decision:boolean", "decision:enum" },
                scope = "one standalone C# source file; all declared methods",
                unsupported = new[] { "project-loading", "classifiers", "adapters", "wiring",
                    "conversions", "contracts", "reconcile", "mutation", "prune", "test-runner-integration" }
            }, Json));
            return 0;
        }
        Require(args.Length > 0 && new[] { "paths", "inventory", "check", "run" }.Contains(args[0]),
            "unsupported command; use capabilities, paths, inventory, check or run");
        var options = new Dictionary<string, string>();
        foreach (var arg in args.Skip(1))
        {
            var parts = arg.Split('=', 2);
            Require(parts.Length == 2 && new[] { "--source", "--spec", "--out" }.Contains(parts[0])
                && parts[1].Length > 0 && options.TryAdd(parts[0], parts[1]), "unknown or repeated option");
        }
        string Option(string name) => options.TryGetValue(name, out var value)
            ? Path.GetFullPath(value) : throw new InvalidOperationException($"missing {name}");
        var sourcePath = Option("--source");
        Require(Path.GetExtension(sourcePath) == ".cs", "--source must name a .cs file");
        var source = File.ReadAllText(sourcePath);
        var tree = CSharpSyntaxTree.ParseText(source, new CSharpParseOptions(LanguageVersion.CSharp14));
        var root = tree.GetCompilationUnitRoot();
        Admission.CheckDeclarations(root);

        var referencePaths = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES"))?.Split(Path.PathSeparator)
            ?? throw new InvalidOperationException("runtime reference assemblies unavailable");
        var compilation = CSharpCompilation.Create("VerifiableDecision", [tree],
            referencePaths.Select(p => MetadataReference.CreateFromFile(p)),
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, optimizationLevel: OptimizationLevel.Release));
        var diagnostics = compilation.GetDiagnostics().Where(d => d.Severity == DiagnosticSeverity.Error).ToArray();
        Require(diagnostics.Length == 0, string.Join(Environment.NewLine, diagnostics.Select(d => d.ToString())));
        var admitted = Admission.Methods(root, compilation.GetSemanticModel(tree));
        var domains = admitted.Select(a => a.Inputs.Select(d => new Domain(d.Name,
            d.Enum == null ? "bool" : d.Enum.Type.ToDisplayString(RuntimeName), d.Tokens,
            d.Enum?.Unnamed.ToString(System.Globalization.CultureInfo.InvariantCulture))).ToArray()).ToArray();
        string Claim(Admitted unit) => unit.Inputs.Any(d => d.Enum != null) ? "cells" : "every input";
        if (args[0] == "paths")
        {
            Require(options.Count == 1, "paths accepts only --source");
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                backend = Version, scope = "selected file only; no specs or checks executed",
                units = admitted.Select((a, i) => new { name = a.Name, cases = a.Cases, claim = Claim(a), domains = domains[i] })
            }, Json));
            return 0;
        }

        var specPath = Option("--spec");
        var outPath = Option("--out");
        Require(!new[] { sourcePath, specPath }.Contains(outPath, StringComparer.OrdinalIgnoreCase),
            "--out must not overwrite the source or spec");
        var specText = File.ReadAllText(specPath);
        RejectDuplicateKeys(specText);
        var specs = JsonSerializer.Deserialize<Specs>(specText, Json);
        Require(specs?.Units != null, "spec needs a units object");
        var specUnits = specs!.Units;
        Require(specUnits.Keys.Order().SequenceEqual(admitted.Select(a => a.Name).Order()),
            "spec must name exactly every admitted method");
        var units = new List<Unit>();
        var unsettled = new List<string>();
        for (var index = 0; index < admitted.Length; index++)
        {
            var unit = admitted[index];
            var name = unit.Name;
            var spec = specUnits[name];
            Require(spec != null && !string.IsNullOrWhiteSpace(spec.Requirement) && spec.Parameters != null
                && spec.Rows != null && spec.Unsettled != null, $"{name}: requirement, parameters, rows and unsettled are required");
            var parameters = unit.Inputs.Select(d => d.Name).ToArray();
            Require(spec!.Parameters.SequenceEqual(parameters), $"{name}: parameter names/order changed");
            var tokens = unit.Inputs.Select(d => d.Tokens).ToArray();
            var expected = new Dictionary<int, object>();
            foreach (var row in spec.Rows)
            {
                Require(row != null && row.Input != null && row.Input.Length == parameters.Length,
                    $"{name}: row input must match parameters");
                var key = 0;
                var stride = 1;
                for (var i = 0; i < parameters.Length; i++)
                {
                    var position = Array.IndexOf(tokens[i], Token(row!.Input[i]));
                    Require(position >= 0, $"{name}: row input must match parameters; {parameters[i]} accepts {string.Join(", ", tokens[i])}");
                    key += position * stride;
                    stride *= tokens[i].Length;
                }
                var outcome = Token(row!.Outcome);
                Require(Array.IndexOf(unit.Result.Tokens, outcome) >= 0,
                    $"{name}: row outcome must be one of {string.Join(", ", unit.Result.Tokens)}");
                Require(expected.TryAdd(key, outcome!), $"{name}: duplicate input row");
            }
            Require(expected.Count == unit.Cases, $"{name}: spec must describe all {unit.Cases} inputs");
            var checks = Enumerable.Range(0, unit.Cases).Select(key => new Case(Decode(key, tokens), expected[key])).ToArray();
            Require(spec.Unsettled.All(p => !string.IsNullOrWhiteSpace(p)), $"{name}: unsettled entries must contain text");
            unsettled.AddRange(spec.Unsettled.Select(p => $"{name}: {p}"));
            units.Add(new Unit(name, parameters, Claim(unit), domains[index], unit.Cases, checks));
        }
        var compiler = typeof(CSharpCompilation).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? throw new InvalidOperationException("compiler informational version unavailable");
        var report = new Report("verifiable.csharp/3", Version, Hash(source), Hash(specText), compiler,
            System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription, units.ToArray(), unsettled.ToArray());
        var json = JsonSerializer.Serialize(report, Json);
        if (args[0] == "inventory")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(outPath)!);
            File.WriteAllText(outPath, json + "\n");
            Console.WriteLine(json);
            return 0;
        }
        Require(File.Exists(outPath) && File.ReadAllText(outPath).Trim() == json,
            "STALE obligations: recompute inventory for this source, spec and compiler");
        if (args[0] == "check")
        {
            Console.WriteLine("CURRENT obligations; no checks executed");
            return 0;
        }
        using var emitted = new MemoryStream();
        var emit = compilation.Emit(emitted);
        Require(emit.Success, string.Join(Environment.NewLine, emit.Diagnostics));
        emitted.Position = 0;
        var context = new AssemblyLoadContext("verifiable", isCollectible: true);
        try
        {
            var assembly = context.LoadFromStream(emitted);
            for (var index = 0; index < admitted.Length; index++)
            {
                var unit = admitted[index];
                var method = assembly.GetType(unit.Symbol.ContainingType.ToDisplayString(RuntimeName), throwOnError: true)!
                    .GetMethod(unit.Symbol.Name, BindingFlags.Public | BindingFlags.Static)!;
                foreach (var check in units[index].Checks)
                {
                    var call = $"{unit.Name}({string.Join(",", check.Input)})";
                    var result = method.Invoke(null, check.Input.Select((token, i) => RuntimeValue(assembly, unit.Inputs[i], token)).ToArray());
                    var actual = ResultToken(unit.Result, result!);
                    Require(Equals(actual, check.Expected), $"FAIL {call}: expected {check.Expected}, got {actual}");
                }
                Console.WriteLine($"PASS {unit.Name} {unit.Cases} checks ({Claim(unit)})");
            }
            foreach (var point in unsettled) Console.WriteLine($"UNSETTLED {point}");
            Console.WriteLine("Selected standalone methods agree with the supplied spec; human review is separate.");
            return 0;
        }
        finally { context.Unload(); }
    }

    private static object? Token(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.String => element.GetString(),
        _ => null
    };

    private static object[] Decode(int key, object[][] tokens)
    {
        var input = new object[tokens.Length];
        for (var i = 0; i < tokens.Length; i++)
        {
            input[i] = tokens[i][key % tokens[i].Length];
            key /= tokens[i].Length;
        }
        return input;
    }

    private static object RuntimeValue(Assembly assembly, Dimension dimension, object token)
    {
        if (dimension.Enum == null) return token;
        var type = assembly.GetType(dimension.Enum.Type.ToDisplayString(RuntimeName), throwOnError: true)!;
        var value = Equals(token, Dimension.UnnamedToken)
            ? dimension.Enum.Unnamed
            : dimension.Enum.Members.Single(m => m.Name.Equals(token)).Value;
        return Enum.ToObject(type, Convert.ChangeType(value, Enum.GetUnderlyingType(type)));
    }

    private static object ResultToken(Dimension result, object value)
    {
        if (result.Enum == null) return (bool)value;
        var number = Convert.ToDecimal(value);
        var named = result.Enum.Members.Where(m => m.Value == number).Select(m => m.Name).ToArray();
        return named.Length == 1 ? named[0] : Dimension.UnnamedToken;
    }

    private static void RejectDuplicateKeys(string text)
    {
        using var document = JsonDocument.Parse(text);
        void Visit(JsonElement element)
        {
            if (element.ValueKind == JsonValueKind.Object)
            {
                var keys = new HashSet<string>();
                foreach (var property in element.EnumerateObject())
                {
                    Require(keys.Add(property.Name), $"duplicate spec key: {property.Name}");
                    Visit(property.Value);
                }
            }
            else if (element.ValueKind == JsonValueKind.Array)
                foreach (var child in element.EnumerateArray()) Visit(child);
        }
        Visit(document.RootElement);
    }

    private static string Hash(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));

    internal static void Require([DoesNotReturnIf(false)] bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
