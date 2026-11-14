using System.Globalization;
using System.Reflection;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

return Tool.MainCommand(args);

internal sealed record SpecRow(JsonElement[] Input, JsonElement Outcome);
internal sealed record Spec(string Requirement, string[] Parameters, SpecRow[] Rows, string[] Unsettled,
    Dictionary<string, string[]>? Domains = null);
internal sealed record Specs(Dictionary<string, Spec> Units);
internal sealed record Case(object?[] Input, object? Expected);
internal sealed record Domain(string Parameter, string Type, object[] Values, string? Unnamed);
internal sealed record Unit(string Name, string[] Parameters, string Claim, Domain[] Domains, int Cases, Case[] Checks);
internal sealed record Report(string Schema, string Backend, string SourceHash, string SpecHash,
    string Compiler, string Runtime, Unit[] Units, string[] Unsettled);

/// <summary>What a spec row states for one output of a computed result: the formula as a term and as written.</summary>
internal sealed record Stated(Term Term, string Text);

/// <summary>
/// One check as the run needs it: the values tried and the expected value of each output.
/// A decision has one output and no formulas.
/// </summary>
internal sealed record Check(Probe[] Probes, object?[] Expected, Stated[]? Formulas);

internal static class Tool
{
    private const string Version = "csharp-decision-v5";
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        RespectRequiredConstructorParameters = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        // JSON has no number for NaN or an infinity, so these three are written as the strings "NaN", "Infinity" and "-Infinity".
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
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
                shapes = new[] { "decision:boolean", "decision:enum", "decision:record", "decision:integer", "decision:string", "decision:double", "rule:number", "rule:record" },
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
        Domain[] Domains(Admitted unit, Plan plan) => [.. unit.Inputs.Select((input, i) => new Domain(unit.Labels[i],
            input.Enum?.Type.ToDisplayString(RuntimeName) ?? input.Number?.Type.ToDisplayString() ?? (input.Text == null ? "bool" : "string"),
            plan.Partitions[i].Tokens, input.Enum?.Unnamed.ToString(CultureInfo.InvariantCulture)))];
        // Every input is tried when all inputs are bool and at most one of them is tried side by side with nothing.
        string Claim(Admitted unit, Plan plan) => unit.Inputs.All(d => d.IsBool) && plan.Plain.Count(plain => plain) <= 1 ? "every input" : "cells";
        if (args[0] == "paths")
        {
            Require(options.Count == 1, "paths accepts only --source");
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                backend = Version,
                scope = "selected file only; no specs or checks executed; number and string cells are the ones the code tells apart, and a spec's domains can add more",
                units = admitted.Select(a => (Unit: a, Plan: Plan.Of(a, Plan.Split(a, null), new bool[a.Inputs.Length])))
                    .Select(a => new { name = a.Unit.Name, cases = a.Plan.Cases, claim = Claim(a.Unit, a.Plan), domains = Domains(a.Unit, a.Plan) })
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
        var checks = new List<Check[]>();
        var plans = new List<Plan>();
        var unsettled = new List<string>();
        foreach (var unit in admitted)
        {
            var name = unit.Name;
            var spec = specUnits[name];
            Require(spec != null && !string.IsNullOrWhiteSpace(spec.Requirement) && spec.Parameters != null
                && spec.Rows != null && spec.Unsettled != null, $"{name}: requirement, parameters, rows and unsettled are required");
            var parameters = unit.Parameters.Select(p => p.Name).ToArray();
            Require(spec!.Parameters.SequenceEqual(parameters), $"{name}: parameter names/order changed");
            var partitions = Plan.Split(unit, spec.Domains ?? []);
            var covered = spec.Rows.Select(row => Covered(unit, partitions, row)).ToArray();
            var plan = Plan.Of(unit, partitions,
                [.. unit.Inputs.Select((_, i) => covered.Any(cells => cells[i].Length < partitions[i].Tokens.Length))]);
            plans.Add(plan);
            var rows = new object?[plan.Rows];
            for (var r = 0; r < spec.Rows.Length; r++)
            {
                var outcome = Outcome(unit, spec.Rows[r].Outcome);
                foreach (var key in Combinations([.. covered[r].Select((cells, i) => plan.Named[i] ? cells : [0])]).Select(plan.Row))
                {
                    Require(rows[key] == null, $"{name}: two rows cover the same combination of cells");
                    rows[key] = outcome;
                }
            }
            var missing = rows.Count(row => row == null);
            Require(missing == 0, $"{name}: the rows must cover each of the {plan.Rows} combinations of cells; {missing} of them have no row");
            var planned = Enumerable.Range(0, plan.Cases).Select(plan.Probes).Select(probes =>
            {
                var row = rows[plan.Row(probes.Select(p => p.Cell))]!;
                return row is Stated[] formulas
                    ? new Check(probes, [.. formulas.Select(formula => Stored(formula.Term.At(probes, _ => true).Value))], formulas)
                    : new Check(probes, [row], null);
            }).ToArray();
            checks.Add(planned);
            Require(spec.Unsettled.All(p => !string.IsNullOrWhiteSpace(p)), $"{name}: unsettled entries must contain text");
            unsettled.AddRange(spec.Unsettled.Select(p => $"{name}: {p}"));
            units.Add(new Unit(name, parameters, Claim(unit, plan), Domains(unit, plan), plan.Cases, [.. planned.Select(check => new Case(
                PerParameter(unit, [.. check.Probes.Select(p => p.Value)], (parameter, own) => new JsonObject(
                    parameter.Cells.Select((d, i) => KeyValuePair.Create(d.Name, JsonSerializer.SerializeToNode(own[i], Json))))),
                unit.Outputs.Length <= 1 && unit.Outputs.All(output => output.Type == null) ? check.Expected[0]
                    : new JsonObject(unit.Outputs.Select((output, i) => KeyValuePair.Create(output.Name, JsonSerializer.SerializeToNode(check.Expected[i], Json))))))]));
        }
        var compiler = typeof(CSharpCompilation).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? throw new InvalidOperationException("compiler informational version unavailable");
        var report = new Report("verifiable.csharp/6", Version, Hash(source), Hash(specText), compiler,
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
        var context = new AssemblyLoadContext("verifiable", isCollectible: true);
        Assembly Load(CSharpCompilation built)
        {
            using var emitted = new MemoryStream();
            var emit = built.Emit(emitted);
            Require(emit.Success, string.Join(Environment.NewLine, emit.Diagnostics));
            emitted.Position = 0;
            return context.LoadFromStream(emitted);
        }
        try
        {
            var assembly = Load(compilation);
            // A second build of the same source answers, for the same input, which result expression the code reaches.
            var numbered = admitted.Any(unit => unit.Sites.Length > 0) ? Load(compilation.ReplaceSyntaxTree(tree, tree.WithRootAndOptions(Numbered(root, admitted), tree.Options)).WithAssemblyName("VerifiableSites")) : null;
            for (var index = 0; index < admitted.Length; index++)
            {
                var unit = admitted[index];
                foreach (var check in checks[index])
                {
                    var values = check.Probes.Select(p => p.Value).ToArray();
                    var shown = string.Join(",", PerParameter(unit, [.. values.Select((value, i) => Shown(unit.Inputs[i], value))], (parameter, own) =>
                        $"{{{string.Join(",", parameter.Cells.Select((d, i) => $"{d.Name}={own[i]}"))}}}"));
                    var actual = Call(assembly, unit, values)!;
                    if (check.Formulas == null)
                    {
                        var decided = ResultToken(unit.Result!, actual);
                        Require(Equals(decided, check.Expected[0]), $"FAIL {unit.Name}({shown}): expected {check.Expected[0]}, got {decided}");
                        continue;
                    }
                    var site = unit.Sites[(int)Call(numbered!, unit, values)!];
                    // An input that a row leaves open is never fixed to the value tried, because its values are not tried in every combination.
                    bool Fixed(int input) => check.Probes[input].Sole && !plans[index].Plain[input];
                    for (var i = 0; i < unit.Outputs.Length; i++)
                    {
                        var output = unit.Outputs[i];
                        var label = output.Type == null ? "" : $"{output.Name}: ";
                        Require(site.Terms[i].At(check.Probes, Fixed).Key == check.Formulas[i].Term.At(check.Probes, Fixed).Key,
                            $"FAIL {unit.Name}({shown}): {label}the code computes {site.Texts[i]}, and the spec states {check.Formulas[i].Text}");
                        var observed = Observed(output, output.Type == null ? actual : actual.GetType().GetProperty(output.Name)!.GetValue(actual));
                        Require(Same(observed, check.Expected[i]),
                            $"FAIL {unit.Name}({shown}): {label}expected {Shown(output.Type, check.Expected[i])}, got {Shown(output.Type, observed)}");
                    }
                }
                Console.WriteLine($"PASS {unit.Name} {checks[index].Length} checks ({Claim(unit, plans[index])})");
            }
            foreach (var point in unsettled) Console.WriteLine($"UNSETTLED {point}");
            Console.WriteLine("Selected standalone methods agree with the supplied spec; human review is separate.");
            return 0;
        }
        finally { context.Unload(); }
    }

    /// <summary>The cells a spec row covers: for each input the positions of its cells, all of them where the row says so or leaves a record field out.</summary>
    private static int[][] Covered(Admitted unit, Partition[] partitions, SpecRow? row)
    {
        var name = unit.Name;
        Require(row != null && row.Input != null && row.Input.Length == unit.Parameters.Length, $"{name}: row input must match parameters");
        var covered = new List<int[]>();
        for (var i = 0; i < unit.Parameters.Length; i++)
        {
            var parameter = unit.Parameters[i];
            var written = row!.Input[i];
            var fields = parameter.Cells.Select(d => d.Name).ToArray();
            Require(parameter.Record == null || (written.ValueKind == JsonValueKind.Object && written.EnumerateObject().All(f => fields.Contains(f.Name))),
                $"{name}: row input must match parameters; {parameter.Name} takes an object with fields among {string.Join(", ", fields)}");
            foreach (var dimension in parameter.Cells)
            {
                var tokens = partitions[covered.Count].Tokens;
                var token = parameter.Record == null ? Token(written)
                    : written.TryGetProperty(dimension.Name, out var own) ? Token(own) : Dimension.AnyToken;
                var position = Array.IndexOf(tokens, token);
                Require(position >= 0 || Equals(token, Dimension.AnyToken),
                    $"{name}: row input must match parameters; {parameter.Label(dimension)} accepts {string.Join(", ", tokens)}, or {Dimension.AnyToken} for all of them");
                covered.Add(position >= 0 ? [position] : [.. Enumerable.Range(0, tokens.Length)]);
            }
        }
        return [.. covered];
    }

    private static IEnumerable<int[]> Combinations(int[][] choices) => choices.Aggregate(
        (IEnumerable<int[]>)[[]], (combined, choice) => combined.SelectMany(prefix => choice.Select(position => (int[])[.. prefix, position])));

    /// <summary>What a spec row states as its outcome: the token of a decision, or one formula per output of a computed result.</summary>
    private static object Outcome(Admitted unit, JsonElement written)
    {
        var name = unit.Name;
        if (unit.Result != null)
        {
            var outcome = Token(written);
            Require(Array.IndexOf(unit.Result.Results, outcome) >= 0, $"{name}: row outcome must be one of {string.Join(", ", unit.Result.Results)}");
            return outcome!;
        }
        var labels = unit.Labels;
        Stated Formula(Output output, JsonElement? stated)
        {
            if (stated == null) return new(Term.Input(output.Kept, output.Kind), labels[output.Kept]);
            var where = output.Type == null ? name : $"{name}: {output.Name}";
            Require(stated.Value.ValueKind is JsonValueKind.String or JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False,
                $"{where}: an outcome is a formula, written as a string or as a number");
            var text = stated.Value.ValueKind == JsonValueKind.String ? stated.Value.GetString()! : stated.Value.GetRawText();
            var term = Term.Parse(text, word =>
            {
                var input = Array.IndexOf(labels, word);
                var fits = input >= 0 && (output.Kind != Kind.Other || output.Type!.SameType(unit.Inputs[input]));
                var member = output.Type?.Enum is { } named && named.Members.Any(member => member.Name == word);
                Require(!fits || !member, $"{where}: {word} is the name of an input and of an enum member, so the outcome does not say which is meant");
                return fits ? Term.Input(input, output.Kind == Kind.Other ? Kind.Other : unit.Inputs[input].Kind) : member ? Term.Constant(word, Kind.Other) : null;
            }, where);
            if (output.Kind != Kind.Other) return new(Term.Widen(term, output.Kind, where), text);
            Require(term.IsInput || (term.IsConstant && term.Kind == Kind.Other && (term.Value is bool) == output.Type!.IsBool),
                $"{where}: a value that is not an int, a long or a double is kept from an input of its type, or set to true, false or a named member");
            return new(term, text);
        }
        if (unit.Outputs[0].Type == null) return new[] { Formula(unit.Outputs[0], written) };
        var names = unit.Outputs.Select(output => output.Name).ToArray();
        Require(written.ValueKind == JsonValueKind.Object && written.EnumerateObject().All(field => names.Contains(field.Name)),
            $"{name}: row outcome must be an object with fields among {string.Join(", ", names)}; a field that is left out is kept");
        return unit.Outputs.Select(output => Formula(output, written.TryGetProperty(output.Name, out var stated) ? stated : null)).ToArray();
    }

    /// <summary>The source with every result expression of a computed result replaced by its number, and the result type of those methods by int.</summary>
    private static CompilationUnitSyntax Numbered(CompilationUnitSyntax root, Admitted[] admitted)
    {
        var numbers = admitted.SelectMany(unit => unit.Sites.Select((site, number) => (site.Syntax, number))).ToDictionary(site => site.Syntax, site => site.number);
        var types = admitted.Where(unit => unit.Sites.Length > 0)
            .Select(unit => (SyntaxNode)((MethodDeclarationSyntax)unit.Symbol.DeclaringSyntaxReferences[0].GetSyntax()).ReturnType);
        return root.ReplaceNodes(numbers.Keys.Concat(types), (original, _) => numbers.TryGetValue(original, out var number)
            ? SyntaxFactory.LiteralExpression(SyntaxKind.NumericLiteralExpression, SyntaxFactory.Literal(number)).WithTriviaFrom(original)
            : SyntaxFactory.PredefinedType(SyntaxFactory.Token(SyntaxKind.IntKeyword)).WithTriviaFrom(original));
    }

    private static object? Call(Assembly assembly, Admitted unit, object?[] values)
    {
        var type = assembly.GetType(unit.Symbol.ContainingType.ToDisplayString(RuntimeName), throwOnError: true)!;
        var method = type.GetMethod(unit.Symbol.Name, BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)!;
        var arguments = PerParameter(unit, [.. values.Select((value, i) => RuntimeValue(assembly, unit.Inputs[i], value))],
            (parameter, own) => assembly.GetType(parameter.Record!.ToDisplayString(RuntimeName), throwOnError: true)!
                .GetConstructors().Single().Invoke(own));
        return method.Invoke(method.IsStatic ? null : Activator.CreateInstance(type), arguments);
    }

    private static object? Token(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.String => element.GetString(),
        _ => null
    };

    /// <summary>
    /// A value as a failure line prints it.
    /// A string is quoted so that it cannot be taken for an enum member or for null, and a number is printed the same way under every culture.
    /// </summary>
    private static object Shown(Dimension? dimension, object? value) =>
        dimension?.Text != null ? value == null ? "null" : JsonSerializer.Serialize(value)
        : value is double real ? real.ToString("R", CultureInfo.InvariantCulture) : Convert.ToString(value, CultureInfo.InvariantCulture)!;

    /// <summary>Regroups one value per cell into one value per parameter; <paramref name="record"/> builds the value of a record parameter from the values of its fields.</summary>
    private static object?[] PerParameter(Admitted unit, object?[] cells, Func<Parameter, object?[], object> record)
    {
        var grouped = new object?[unit.Parameters.Length];
        var next = 0;
        for (var i = 0; i < grouped.Length; i++)
        {
            var parameter = unit.Parameters[i];
            var own = cells[next..(next + parameter.Cells.Length)];
            next += own.Length;
            grouped[i] = parameter.Record == null ? own[0] : record(parameter, own);
        }
        return grouped;
    }

    private static object? RuntimeValue(Assembly assembly, Dimension dimension, object? token)
    {
        if (dimension.Number is { Real: false } integer)
            return Convert.ChangeType(token, Type.GetType($"System.{integer.Type.MetadataName}", throwOnError: true)!, CultureInfo.InvariantCulture);
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
        return result.Enum.Members.Single(m => m.Value == number).Name;
    }

    /// <summary>An expected value as a check holds it: an integer as a long, as a probe does.</summary>
    private static object? Stored(object? value) => value is int number ? (long)number : value;

    /// <summary>What the code returned for one output, in the form a check holds its expected value.</summary>
    private static object? Observed(Output output, object? value)
    {
        if (output.Type?.Enum is not { } named)
            return value is double or bool or string or null or ulong and > long.MaxValue ? value : Convert.ToInt64(value, CultureInfo.InvariantCulture);
        var number = Convert.ToDecimal(value, CultureInfo.InvariantCulture);
        return named.Members.Where(member => member.Value == number).Select(member => member.Name).FirstOrDefault()
            ?? (number == named.Unnamed ? Dimension.UnnamedToken : $"#{number.ToString(CultureInfo.InvariantCulture)}");
    }

    /// <summary>Two results are the same when they are equal bit for bit; every NaN counts as the same NaN.</summary>
    private static bool Same(object? left, object? right) => left is double a && right is double b
        ? BitConverter.DoubleToInt64Bits(a) == BitConverter.DoubleToInt64Bits(b) || (double.IsNaN(a) && double.IsNaN(b))
        : Equals(left, right);

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
