using System.Reflection;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

return Tool.MainCommand(args);

internal sealed record SpecRow(bool[] Input, bool Outcome);
internal sealed record Spec(string Requirement, string[] Parameters, SpecRow[] Rows, string[] Unsettled);
internal sealed record Specs(Dictionary<string, Spec> Units);
internal sealed record Case(bool[] Input, bool Expected);
internal sealed record Unit(string Name, string[] Parameters, int Cases, Case[] Checks);
internal sealed record Report(string Schema, string Backend, string SourceHash, string SpecHash,
    string Compiler, string Runtime, Unit[] Units, string[] Unsettled);

internal static class Tool
{
    private const string Version = "csharp-boolean-v1";
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        RespectRequiredConstructorParameters = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

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
                shapes = new[] { "decision:boolean" },
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
        Require(!root.DescendantTrivia().Any(t => t.IsDirective), "preprocessor directives are unsupported");
        Require(root.Usings.Count == 0 && root.Externs.Count == 0 && root.AttributeLists.Count == 0,
            "using directives, extern aliases and assembly attributes are unsupported");
        ValidateMembers(root.Members);

        var referencePaths = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES"))?.Split(Path.PathSeparator)
            ?? throw new InvalidOperationException("runtime reference assemblies unavailable");
        var compilation = CSharpCompilation.Create("VerifiableDecision", [tree],
            referencePaths.Select(p => MetadataReference.CreateFromFile(p)),
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, optimizationLevel: OptimizationLevel.Release));
        var diagnostics = compilation.GetDiagnostics().Where(d => d.Severity == DiagnosticSeverity.Error).ToArray();
        Require(diagnostics.Length == 0, string.Join(Environment.NewLine, diagnostics.Select(d => d.ToString())));
        var model = compilation.GetSemanticModel(tree);
        var methods = root.DescendantNodes().OfType<MethodDeclarationSyntax>().ToArray();
        Require(methods.Length > 0, "no decision methods found");
        var symbols = methods.Select(m => model.GetDeclaredSymbol(m)
            ?? throw new InvalidOperationException("method has no symbol")).ToArray();
        foreach (var (method, symbol) in methods.Zip(symbols)) ValidateMethod(method, symbol, model);
        var names = symbols.Select(s => $"{s.ContainingType.ToDisplayString()}.{s.Name}").ToArray();
        Require(names.Distinct().Count() == names.Length, "overloads are unsupported; unit names must be unique");
        if (args[0] == "paths")
        {
            Require(options.Count == 1, "paths accepts only --source");
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                backend = Version, scope = "selected file only; no specs or checks executed",
                units = symbols.Select((s, i) => new { name = names[i], cases = 1 << s.Parameters.Length })
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
        Require(specUnits.Keys.Order().SequenceEqual(names.Order()), "spec must name exactly every admitted method");
        var units = new List<Unit>();
        var unsettled = new List<string>();
        for (var index = 0; index < symbols.Length; index++)
        {
            var symbol = symbols[index];
            var name = names[index];
            var spec = specUnits[name];
            Require(spec != null && !string.IsNullOrWhiteSpace(spec.Requirement) && spec.Parameters != null
                && spec.Rows != null && spec.Unsettled != null, $"{name}: requirement, parameters, rows and unsettled are required");
            var parameters = symbol.Parameters.Select(p => p.Name).ToArray();
            Require(spec!.Parameters.SequenceEqual(parameters), $"{name}: parameter names/order changed");
            var count = 1 << parameters.Length;
            var expected = new Dictionary<int, bool>();
            foreach (var row in spec.Rows)
            {
                Require(row != null && row.Input != null && row.Input.Length == parameters.Length,
                    $"{name}: row input must match parameters");
                var key = row!.Input.Select((v, i) => v ? 1 << i : 0).Sum();
                Require(expected.TryAdd(key, row.Outcome), $"{name}: duplicate input row");
            }
            Require(expected.Count == count, $"{name}: spec must describe all {count} inputs");
            var checks = Enumerable.Range(0, count).Select(key => new Case(
                Enumerable.Range(0, parameters.Length).Select(i => (key & (1 << i)) != 0).ToArray(), expected[key])).ToArray();
            Require(spec.Unsettled.All(p => !string.IsNullOrWhiteSpace(p)), $"{name}: unsettled entries must contain text");
            unsettled.AddRange(spec.Unsettled.Select(p => $"{name}: {p}"));
            units.Add(new Unit(name, parameters, count, checks));
        }
        var compiler = typeof(CSharpCompilation).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? throw new InvalidOperationException("compiler informational version unavailable");
        var report = new Report("verifiable.csharp/2", Version, Hash(source), Hash(specText), compiler,
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
            for (var index = 0; index < symbols.Length; index++)
            {
                var symbol = symbols[index];
                var runtimeName = symbol.ContainingType.ToDisplayString(new SymbolDisplayFormat(
                    typeQualificationStyle: SymbolDisplayTypeQualificationStyle.NameAndContainingTypesAndNamespaces));
                var method = assembly.GetType(runtimeName, throwOnError: true)!
                    .GetMethod(symbol.Name, BindingFlags.Public | BindingFlags.Static)!;
                foreach (var check in units[index].Checks)
                {
                    var actual = (bool)method.Invoke(null, check.Input.Cast<object>().ToArray())!;
                    Require(actual == check.Expected,
                        $"FAIL {names[index]}({string.Join(",", check.Input)}): expected {check.Expected}, got {actual}");
                }
                Console.WriteLine($"PASS {names[index]} {units[index].Cases} checks");
            }
            foreach (var point in unsettled) Console.WriteLine($"UNSETTLED {point}");
            Console.WriteLine("Selected standalone methods agree with the supplied spec; human review is separate.");
            return 0;
        }
        finally { context.Unload(); }
    }

    private static void ValidateMembers(SyntaxList<MemberDeclarationSyntax> members)
    {
        foreach (var member in members)
        {
            if (member is BaseNamespaceDeclarationSyntax ns)
            {
                Require(ns.Usings.Count == 0 && ns.Externs.Count == 0, "namespace imports are unsupported");
                ValidateMembers(ns.Members);
            }
            else if (member is ClassDeclarationSyntax type)
            {
                Require(type.Modifiers.Count == 2 && type.Modifiers.Any(SyntaxKind.PublicKeyword)
                    && type.Modifiers.Any(SyntaxKind.StaticKeyword) && type.TypeParameterList == null
                    && type.BaseList == null && type.AttributeLists.Count == 0 && type.ParameterList == null
                    && type.Members.Count > 0 && type.Members.All(m => m is MethodDeclarationSyntax),
                    "only public static, non-generic classes containing methods are admitted; no fields, constructors or nested types");
            }
            else throw new InvalidOperationException($"unsupported declaration: {member.Kind()}");
        }
    }

    private static void ValidateMethod(MethodDeclarationSyntax method, IMethodSymbol symbol, SemanticModel model)
    {
        Require(method.Modifiers.Count == 2 && method.Modifiers.Any(SyntaxKind.PublicKeyword)
            && method.Modifiers.Any(SyntaxKind.StaticKeyword) && method.AttributeLists.Count == 0
            && !symbol.IsGenericMethod && !symbol.ReturnsByRef && !symbol.ReturnsByRefReadonly
            && symbol.ReturnType.SpecialType == SpecialType.System_Boolean
            && symbol.Parameters.Length <= 12 && symbol.Parameters.All(p => p.Type.SpecialType == SpecialType.System_Boolean)
            && method.ParameterList.Parameters.All(p => p.Modifiers.Count == 0 && p.Default == null && p.AttributeLists.Count == 0),
            $"{symbol.Name}: only public static bool methods with up to 12 ordinary bool parameters are admitted");
        void Expression(ExpressionSyntax expression)
        {
            switch (expression)
            {
                case LiteralExpressionSyntax literal when literal.IsKind(SyntaxKind.TrueLiteralExpression)
                    || literal.IsKind(SyntaxKind.FalseLiteralExpression): return;
                case IdentifierNameSyntax identifier when model.GetSymbolInfo(identifier).Symbol is IParameterSymbol p
                    && SymbolEqualityComparer.Default.Equals(p.ContainingSymbol, symbol): return;
                case ParenthesizedExpressionSyntax parentheses: Expression(parentheses.Expression); return;
                case PrefixUnaryExpressionSyntax unary when unary.IsKind(SyntaxKind.LogicalNotExpression):
                    Expression(unary.Operand); return;
                case BinaryExpressionSyntax binary when new[] { SyntaxKind.LogicalAndExpression,
                    SyntaxKind.LogicalOrExpression, SyntaxKind.BitwiseAndExpression, SyntaxKind.BitwiseOrExpression,
                    SyntaxKind.ExclusiveOrExpression, SyntaxKind.EqualsExpression, SyntaxKind.NotEqualsExpression }.Contains(binary.Kind()):
                    Expression(binary.Left); Expression(binary.Right); return;
                case ConditionalExpressionSyntax conditional:
                    Expression(conditional.Condition); Expression(conditional.WhenTrue); Expression(conditional.WhenFalse); return;
                default: throw new InvalidOperationException($"{symbol.Name}: unsupported expression {expression.Kind()}");
            }
        }
        void Statement(StatementSyntax statement)
        {
            switch (statement)
            {
                case BlockSyntax block: foreach (var child in block.Statements) Statement(child); return;
                case ReturnStatementSyntax { Expression: not null } ret: Expression(ret.Expression); return;
                case IfStatementSyntax conditional:
                    Expression(conditional.Condition); Statement(conditional.Statement);
                    if (conditional.Else != null) Statement(conditional.Else.Statement);
                    return;
                default: throw new InvalidOperationException($"{symbol.Name}: unsupported statement {statement.Kind()}");
            }
        }
        if (method.ExpressionBody != null) Expression(method.ExpressionBody.Expression);
        else if (method.Body != null) Statement(method.Body);
        else throw new InvalidOperationException($"{symbol.Name}: missing method body");
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
    private static void Require([DoesNotReturnIf(false)] bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
