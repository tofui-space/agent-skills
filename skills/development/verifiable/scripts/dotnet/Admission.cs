using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

/// <summary>An admitted enum: its named values and one value that stands for every unnamed one.</summary>
internal sealed record EnumDomain(INamedTypeSymbol Type, (string Name, decimal Value)[] Members, decimal Unnamed);

/// <summary>The cells of one parameter or of the result: false and true, or the named enum values plus the unnamed cell.</summary>
internal sealed record Dimension(string Name, EnumDomain? Enum)
{
    public const string UnnamedToken = "#unnamed";

    public object[] Tokens => Enum == null
        ? [false, true]
        : [.. Enum.Members.Select(m => (object)m.Name), UnnamedToken];
}

internal sealed record Admitted(IMethodSymbol Symbol, string Name, Dimension[] Inputs, Dimension Result, int Cases);

/// <summary>Decides which source is admitted and which cells its methods have.</summary>
internal static class Admission
{
    public const int MaxCases = 4096;

    public static void CheckDeclarations(CompilationUnitSyntax root)
    {
        Tool.Require(!root.DescendantTrivia().Any(t => t.IsDirective), "preprocessor directives are unsupported");
        Tool.Require(root.Usings.Count == 0 && root.Externs.Count == 0 && root.AttributeLists.Count == 0,
            "using directives, extern aliases and assembly attributes are unsupported");
        Tool.Require(!root.DescendantNodes().Any(n => n is CheckedExpressionSyntax or CheckedStatementSyntax),
            "checked and unchecked are unsupported");
        CheckMembers(root.Members);
    }

    public static Admitted[] Methods(CompilationUnitSyntax root, SemanticModel model)
    {
        var enums = new Dictionary<INamedTypeSymbol, EnumDomain>(SymbolEqualityComparer.Default);
        foreach (var declaration in root.DescendantNodes().OfType<EnumDeclarationSyntax>())
        {
            var type = model.GetDeclaredSymbol(declaration) ?? throw new InvalidOperationException("enum has no symbol");
            enums.Add(type, ReadEnum(type));
        }
        var methods = root.DescendantNodes().OfType<MethodDeclarationSyntax>().ToArray();
        Tool.Require(methods.Length > 0, "no decision methods found");
        var admitted = methods.Select(m => Method(m, model, enums)).ToArray();
        Tool.Require(admitted.Select(a => a.Name).Distinct().Count() == admitted.Length,
            "overloads are unsupported; unit names must be unique");
        return admitted;
    }

    private static void CheckMembers(SyntaxList<MemberDeclarationSyntax> members)
    {
        foreach (var member in members)
        {
            if (member is BaseNamespaceDeclarationSyntax ns)
            {
                Tool.Require(ns.Usings.Count == 0 && ns.Externs.Count == 0, "namespace imports are unsupported");
                CheckMembers(ns.Members);
            }
            else if (member is ClassDeclarationSyntax type)
            {
                Tool.Require(type.Modifiers.Count == 2 && type.Modifiers.Any(SyntaxKind.PublicKeyword)
                    && type.Modifiers.Any(SyntaxKind.StaticKeyword) && type.TypeParameterList == null
                    && type.BaseList == null && type.AttributeLists.Count == 0 && type.ParameterList == null
                    && type.Members.Count > 0 && type.Members.All(m => m is MethodDeclarationSyntax),
                    "only public static, non-generic classes containing methods are admitted; no fields, constructors or nested types");
            }
            else if (member is EnumDeclarationSyntax enumeration)
            {
                Tool.Require(enumeration.Modifiers.Count == 1 && enumeration.Modifiers.Any(SyntaxKind.PublicKeyword)
                    && enumeration.AttributeLists.Count == 0
                    && enumeration.Members.All(m => m.AttributeLists.Count == 0),
                    $"{enumeration.Identifier.Text}: only public enums without attributes are admitted");
            }
            else throw new InvalidOperationException($"unsupported declaration: {member.Kind()}");
        }
    }

    private static EnumDomain ReadEnum(INamedTypeSymbol type)
    {
        var members = type.GetMembers().OfType<IFieldSymbol>().Where(f => f.HasConstantValue)
            .Select(f => (f.Name, Value: Convert.ToDecimal(f.ConstantValue))).ToArray();
        Tool.Require(members.Select(m => m.Value).Distinct().Count() == members.Length,
            $"{type.Name}: enum members must have distinct values");
        var unnamed = Enumerable.Range(0, members.Length + 1).Select(k => (decimal)k)
            .First(k => members.All(m => m.Value != k));
        decimal largest = type.EnumUnderlyingType!.SpecialType switch
        {
            SpecialType.System_SByte => sbyte.MaxValue,
            SpecialType.System_Byte => byte.MaxValue,
            _ => decimal.MaxValue
        };
        Tool.Require(unnamed <= largest, $"{type.Name}: every value from zero up is named, so no unnamed cell can be formed");
        return new EnumDomain(type, members, unnamed);
    }

    private static Admitted Method(MethodDeclarationSyntax method, SemanticModel model,
        Dictionary<INamedTypeSymbol, EnumDomain> enums)
    {
        var symbol = model.GetDeclaredSymbol(method) ?? throw new InvalidOperationException("method has no symbol");
        bool IsBool(ITypeSymbol? type) => type?.SpecialType == SpecialType.System_Boolean;
        EnumDomain? EnumOf(ITypeSymbol? type) => type is INamedTypeSymbol named && enums.TryGetValue(named, out var found) ? found : null;
        bool HasCells(ITypeSymbol? type) => IsBool(type) || EnumOf(type) != null;

        Tool.Require(method.Modifiers.Count == 2 && method.Modifiers.Any(SyntaxKind.PublicKeyword)
            && method.Modifiers.Any(SyntaxKind.StaticKeyword) && method.AttributeLists.Count == 0
            && !symbol.IsGenericMethod && !symbol.IsVararg && !symbol.ReturnsByRef && !symbol.ReturnsByRefReadonly
            && HasCells(symbol.ReturnType) && symbol.Parameters.All(p => HasCells(p.Type))
            && method.ParameterList.Parameters.All(p => p.Modifiers.Count == 0 && p.Default == null && p.AttributeLists.Count == 0),
            $"{symbol.Name}: only public static methods over bool and enums declared in the file, with ordinary parameters, are admitted");

        var inputs = symbol.Parameters.Select(p => new Dimension(p.Name, EnumOf(p.Type))).ToArray();
        var cases = inputs.Aggregate(1L, (product, d) => Math.Min(product * d.Tokens.Length, int.MaxValue));
        Tool.Require(cases <= MaxCases, $"{symbol.Name}: domain of {cases} cells exceeds {MaxCases}");

        InvalidOperationException Unsupported(string what, IOperation operation) =>
            new($"{symbol.Name}: unsupported {what} {operation.Syntax.Kind()}");
        bool IsParameter(IOperation operation) => operation is IParameterReferenceOperation;
        bool IsConstant(IOperation operation) => operation is IFieldReferenceOperation { Field.IsConst: true };
        bool IsBoolLiteral(IOperation operation) => operation is ILiteralOperation { ConstantValue: { HasValue: true, Value: bool } };

        void Pattern(IPatternOperation pattern)
        {
            switch (pattern)
            {
                case IConstantPatternOperation constant when IsBoolLiteral(constant.Value) || IsConstant(constant.Value): return;
                case IBinaryPatternOperation both: Pattern(both.LeftPattern); Pattern(both.RightPattern); return;
                case INegatedPatternOperation negated: Pattern(negated.Pattern); return;
                case IDiscardPatternOperation: return;
                default: throw Unsupported("pattern", pattern);
            }
        }
        ITypeSymbol Value(IOperation operation)
        {
            switch (operation)
            {
                case ILiteralOperation when IsBoolLiteral(operation):
                case IParameterReferenceOperation:
                case IFieldReferenceOperation when IsConstant(operation):
                    break;
                case IUnaryOperation negation when IsBool(Value(negation.Operand)):
                    break;
                case IBinaryOperation binary:
                    var bools = IsBool(Value(binary.LeftOperand)) & IsBool(Value(binary.RightOperand));
                    var enumTest = (IsParameter(binary.LeftOperand) && IsConstant(binary.RightOperand))
                        || (IsConstant(binary.LeftOperand) && IsParameter(binary.RightOperand));
                    var admitted = binary.OperatorKind switch
                    {
                        BinaryOperatorKind.ConditionalAnd or BinaryOperatorKind.ConditionalOr or BinaryOperatorKind.And
                            or BinaryOperatorKind.Or or BinaryOperatorKind.ExclusiveOr => bools,
                        BinaryOperatorKind.Equals or BinaryOperatorKind.NotEquals => bools || enumTest,
                        _ => false
                    };
                    if (!admitted) throw Unsupported("expression", operation);
                    break;
                case IConditionalOperation { WhenFalse: not null, IsRef: false } choice when IsBool(Value(choice.Condition)):
                    Value(choice.WhenTrue); Value(choice.WhenFalse);
                    break;
                case IIsPatternOperation test when IsParameter(test.Value):
                    Pattern(test.Pattern);
                    break;
                case ISwitchExpressionOperation table when IsParameter(table.Value):
                    foreach (var arm in table.Arms)
                    {
                        if (arm.Guard != null) throw Unsupported("switch guard", arm.Guard);
                        Pattern(arm.Pattern);
                        Value(arm.Value);
                    }
                    Tool.Require(table.IsExhaustive,
                        $"{symbol.Name}: a switch expression must return a value for every input, unnamed enum values included; add a discard arm");
                    break;
                default: throw Unsupported("expression", operation);
            }
            return operation.Type!;
        }
        void Statement(IOperation statement)
        {
            switch (statement)
            {
                case IBlockOperation block: foreach (var child in block.Operations) Statement(child); return;
                case IReturnOperation { ReturnedValue: { } returned }: Value(returned); return;
                case IConditionalOperation branch when IsBool(Value(branch.Condition)):
                    Statement(branch.WhenTrue);
                    if (branch.WhenFalse != null) Statement(branch.WhenFalse);
                    return;
                default: throw Unsupported("statement", statement);
            }
        }

        var body = model.GetOperation(method) as IMethodBodyOperation;
        Statement(body?.BlockBody ?? body?.ExpressionBody ?? throw new InvalidOperationException($"{symbol.Name}: missing method body"));
        return new Admitted(symbol, $"{symbol.ContainingType.ToDisplayString()}.{symbol.Name}", inputs,
            new Dimension("result", EnumOf(symbol.ReturnType)), (int)cases);
    }
}
