using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

/// <summary>Decides which source is admitted, and reads from each method what its code can tell apart.</summary>
internal static class Admission
{
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
        var enums = new Dictionary<ITypeSymbol, EnumDomain>(SymbolEqualityComparer.Default);
        foreach (var declaration in root.DescendantNodes().OfType<EnumDeclarationSyntax>())
        {
            var type = model.GetDeclaredSymbol(declaration) ?? throw new InvalidOperationException("enum has no symbol");
            enums.Add(type, ReadEnum(type));
        }
        var records = new Dictionary<ITypeSymbol, IParameterSymbol[]>(SymbolEqualityComparer.Default);
        foreach (var declaration in root.DescendantNodes().OfType<RecordDeclarationSyntax>())
        {
            var type = model.GetDeclaredSymbol(declaration) ?? throw new InvalidOperationException("record has no symbol");
            var fields = declaration.ParameterList!.Parameters
                .Select(p => model.GetDeclaredSymbol(p) ?? throw new InvalidOperationException("record field has no symbol")).ToArray();
            Tool.Require(fields.All(f => Cell(f.Name, f.Type, enums) != null),
                $"{type.Name}: record fields must be bool, integers, strings or enums declared in the file");
            records.Add(type, fields);
        }
        var methods = root.DescendantNodes().OfType<MethodDeclarationSyntax>().ToArray();
        Tool.Require(methods.Length > 0, "no decision methods found");
        var admitted = methods.Select(m => Method(m, model, enums, records)).ToArray();
        Tool.Require(admitted.Select(a => a.Name).Distinct().Count() == admitted.Length,
            "overloads are unsupported; unit names must be unique");
        return admitted;
    }

    private static bool IsBool(ITypeSymbol? type) => type?.SpecialType == SpecialType.System_Boolean;

    private static (Int128 Min, Int128 Max)? IntegerRange(ITypeSymbol? type) => type?.SpecialType switch
    {
        SpecialType.System_SByte => (sbyte.MinValue, sbyte.MaxValue),
        SpecialType.System_Byte => (byte.MinValue, byte.MaxValue),
        SpecialType.System_Int16 => (short.MinValue, short.MaxValue),
        SpecialType.System_UInt16 => (ushort.MinValue, ushort.MaxValue),
        SpecialType.System_Int32 => (int.MinValue, int.MaxValue),
        SpecialType.System_UInt32 => (uint.MinValue, uint.MaxValue),
        SpecialType.System_Int64 => (long.MinValue, long.MaxValue),
        SpecialType.System_UInt64 => (ulong.MinValue, ulong.MaxValue),
        _ => null
    };

    private static Int128? Whole(object? constant) => constant switch
    {
        sbyte value => value, byte value => value, short value => value, ushort value => value,
        int value => value, uint value => value, long value => value, ulong value => value,
        _ => null
    };

    private static bool PairsSurrogates(string text)
    {
        for (var i = 0; i < text.Length; i++)
            if (char.IsSurrogate(text[i]) && !(char.IsHighSurrogate(text[i]) && i + 1 < text.Length && char.IsLowSurrogate(text[++i])))
                return false;
        return true;
    }

    /// <summary>The dimension of one parameter or record field, or null when its type has no cells.</summary>
    private static Dimension? Cell(string name, ITypeSymbol type, Dictionary<ITypeSymbol, EnumDomain> enums) =>
        IsBool(type) ? new(name)
        : enums.TryGetValue(type, out var named) ? new(name, Enum: named)
        : IntegerRange(type) is { } range ? new(name, Integer: new(type, range.Min, range.Max, []))
        : type.SpecialType == SpecialType.System_String ? new(name, Text: new(StringComparer.Ordinal))
        : null;

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
            else if (member is RecordDeclarationSyntax record)
            {
                Tool.Require(record.Modifiers.Count == 2
                    && record.Modifiers.Any(SyntaxKind.PublicKeyword) && record.Modifiers.Any(SyntaxKind.ReadOnlyKeyword)
                    && record.TypeParameterList == null && record.BaseList == null && record.AttributeLists.Count == 0
                    && record.Members.Count == 0 && record.ParameterList is { Parameters.Count: > 0 } fields
                    && fields.Parameters.All(p => p.Modifiers.Count == 0 && p.Default == null && p.AttributeLists.Count == 0),
                    $"{record.Identifier.Text}: only public readonly record structs with ordinary positional fields and no other members are admitted");
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
        Dictionary<ITypeSymbol, EnumDomain> enums, Dictionary<ITypeSymbol, IParameterSymbol[]> records)
    {
        var symbol = model.GetDeclaredSymbol(method) ?? throw new InvalidOperationException("method has no symbol");
        // Each parameter gets dimensions of its own, because the cuts and constants of an integer or a string are collected per input.
        Parameter? Read(IParameterSymbol parameter) =>
            Cell(parameter.Name, parameter.Type, enums) is { } cell ? new(parameter.Name, null, [cell])
            : records.TryGetValue(parameter.Type, out var fields)
                ? new(parameter.Name, (INamedTypeSymbol)parameter.Type, [.. fields.Select(f => Cell(f.Name, f.Type, enums)!)])
            : null;

        var parameters = symbol.Parameters.Select(Read).ToArray();
        Tool.Require(method.Modifiers.Count == 2 && method.Modifiers.Any(SyntaxKind.PublicKeyword)
            && method.Modifiers.Any(SyntaxKind.StaticKeyword) && method.AttributeLists.Count == 0
            && !symbol.IsGenericMethod && !symbol.IsVararg && !symbol.ReturnsByRef && !symbol.ReturnsByRefReadonly
            && (IsBool(symbol.ReturnType) || enums.ContainsKey(symbol.ReturnType)) && parameters.All(p => p != null)
            && method.ParameterList.Parameters.All(p => p.Modifiers.Count == 0 && p.Default == null && p.AttributeLists.Count == 0),
            $"{symbol.Name}: only public static methods over bool, integers, strings, and enums and records declared in the file, with ordinary parameters and a bool or enum result, are admitted");
        var read = new Dictionary<IParameterSymbol, Parameter>(SymbolEqualityComparer.Default);
        for (var i = 0; i < parameters.Length; i++) read.Add(symbol.Parameters[i], parameters[i]!);

        InvalidOperationException Unsupported(string what, IOperation operation) =>
            new($"{symbol.Name}: unsupported {what} {operation.Syntax.Kind()}");
        string Misuse(Dimension? cell) => symbol.Name + (cell?.Integer != null
            ? ": an integer input can only be compared with a constant of an integer type or matched by a pattern"
            : cell?.Text != null
                ? ": a string input can only be compared with a string constant or null, or matched by a pattern"
                : ": an enum input can only be compared with a named member or matched by a pattern; return named members");
        // What an expression reads: one cell, a whole record parameter, or neither.
        (Dimension? Cell, Parameter? Record) Subject(IOperation operation) => operation switch
        {
            IParameterReferenceOperation reference when read.TryGetValue(reference.Parameter, out var parameter)
                => parameter.Record == null ? (parameter.Cells[0], null) : (null, parameter),
            IPropertyReferenceOperation { Instance: IParameterReferenceOperation reference } field
                when read.TryGetValue(reference.Parameter, out var parameter) && parameter.Record != null
                => (parameter.Cells.FirstOrDefault(cell => cell.Name == field.Property.Name), null),
            _ => default
        };
        bool IsInput(IOperation operation) => Subject(operation) != default;
        bool IsConstant(IOperation operation) => operation is IFieldReferenceOperation { Field.IsConst: true };
        bool IsBoolLiteral(IOperation operation) => operation is ILiteralOperation { ConstantValue: { HasValue: true, Value: bool } };

        // Admits a test of one cell against a constant, written as `cell <kind> constant`, and records what the test lets the code tell apart.
        bool Test(Dimension cell, BinaryOperatorKind kind, IOperation constant)
        {
            var equality = kind is BinaryOperatorKind.Equals or BinaryOperatorKind.NotEquals;
            var value = constant.ConstantValue;
            if (cell.Enum != null) return equality && IsConstant(constant);
            if (cell.Integer is { } integer)
            {
                if (!value.HasValue || Whole(value.Value) is not { } number) return false;
                Int128[] cuts = kind switch
                {
                    BinaryOperatorKind.LessThan or BinaryOperatorKind.GreaterThanOrEqual => [number],
                    BinaryOperatorKind.LessThanOrEqual or BinaryOperatorKind.GreaterThan => [number + 1],
                    BinaryOperatorKind.Equals or BinaryOperatorKind.NotEquals => [number, number + 1],
                    _ => []
                };
                // A cut at the lowest value of the type, or above its highest, separates nothing the input can hold.
                integer.Cuts.UnionWith(cuts.Where(cut => cut > integer.Min && cut <= integer.Max));
                return cuts.Length > 0;
            }
            if (cell.Text is { } text)
            {
                if (!equality || !value.HasValue || value.Value is not (string or null)
                    || constant.Type?.SpecialType != SpecialType.System_String) return false;
                // JSON has no spelling for half of a surrogate pair, so the obligations file could not say which string was tried.
                Tool.Require(value.Value is not string paired || PairsSurrogates(paired),
                    $"{symbol.Name}: a string constant with an unpaired surrogate is not admitted");
                if (value.Value is string known) text.Add(known);
                return true;
            }
            return kind == BinaryOperatorKind.Equals && IsBoolLiteral(constant);
        }
        // The compiler widens an integer operand that is narrower than the other side; the widening keeps the value, so the comparison is still one of the input.
        IOperation Narrow(IOperation operand) => operand is IConversionOperation { IsImplicit: true, Conversion.IsNumeric: true } widened
            && IntegerRange(widened.Type) != null && Subject(widened.Operand).Cell?.Integer != null ? widened.Operand : operand;
        bool Comparison(IBinaryOperation binary)
        {
            var (left, right) = (Narrow(binary.LeftOperand), Narrow(binary.RightOperand));
            var mirrored = Subject(left).Cell == null;
            var cell = Subject(mirrored ? right : left).Cell;
            if (cell == null || cell.IsBool || binary.OperatorMethod != null) return false;
            var kind = !mirrored ? binary.OperatorKind : binary.OperatorKind switch
            {
                BinaryOperatorKind.LessThan => BinaryOperatorKind.GreaterThan,
                BinaryOperatorKind.LessThanOrEqual => BinaryOperatorKind.GreaterThanOrEqual,
                BinaryOperatorKind.GreaterThan => BinaryOperatorKind.LessThan,
                BinaryOperatorKind.GreaterThanOrEqual => BinaryOperatorKind.LessThanOrEqual,
                var same => same
            };
            if (Test(cell, kind, mirrored ? binary.LeftOperand : binary.RightOperand)) return true;
            Tool.Require(!cell.Declared, Misuse(cell));
            return false;
        }

        void Pattern(IPatternOperation pattern, (Dimension? Cell, Parameter? Record) subject)
        {
            switch (pattern)
            {
                case IConstantPatternOperation constant
                    when subject.Cell != null && Test(subject.Cell, BinaryOperatorKind.Equals, constant.Value): return;
                case IRelationalPatternOperation relational
                    when subject.Cell?.Integer != null && Test(subject.Cell, relational.OperatorKind, relational.Value): return;
                case IBinaryPatternOperation both: Pattern(both.LeftPattern, subject); Pattern(both.RightPattern, subject); return;
                case INegatedPatternOperation negated: Pattern(negated.Pattern, subject); return;
                case IDiscardPatternOperation: return;
                case IRecursivePatternOperation { DeclaredSymbol: null, DeconstructionSubpatterns.Length: 0 } fields
                    when subject.Record != null && SymbolEqualityComparer.Default.Equals(fields.MatchedType, subject.Record.Record):
                    foreach (var field in fields.PropertySubpatterns)
                    {
                        var cell = field.Member is IMemberReferenceOperation member
                            ? subject.Record.Cells.FirstOrDefault(c => c.Name == member.Member.Name) : null;
                        if (cell == null) throw Unsupported("pattern", field);
                        Pattern(field.Pattern, (cell, null));
                    }
                    return;
                default: throw Unsupported("pattern", pattern);
            }
        }
        ITypeSymbol Operand(IOperation operand) => IsInput(operand) ? operand.Type! : Value(operand);
        ITypeSymbol Value(IOperation operation)
        {
            switch (operation)
            {
                case ILiteralOperation when IsBoolLiteral(operation):
                case IFieldReferenceOperation when IsConstant(operation):
                    break;
                case IParameterReferenceOperation or IPropertyReferenceOperation when IsInput(operation):
                    // A cell is checked through a few representatives, so a result must not carry the value of an enum, an integer or a string input.
                    Tool.Require(IsBool(operation.Type), Misuse(Subject(operation).Cell));
                    break;
                case IConversionOperation { IsImplicit: true } converted when Subject(converted.Operand).Cell is { Declared: true } cell:
                    throw new InvalidOperationException(Misuse(cell));
                case IUnaryOperation negation when IsBool(Operand(negation.Operand)):
                    break;
                case IBinaryOperation binary:
                    if (Comparison(binary)) break;
                    var bools = IsBool(Operand(binary.LeftOperand)) & IsBool(Operand(binary.RightOperand));
                    var logical = binary.OperatorKind is BinaryOperatorKind.ConditionalAnd or BinaryOperatorKind.ConditionalOr
                        or BinaryOperatorKind.And or BinaryOperatorKind.Or or BinaryOperatorKind.ExclusiveOr
                        or BinaryOperatorKind.Equals or BinaryOperatorKind.NotEquals;
                    if (!bools || !logical) throw Unsupported("expression", operation);
                    break;
                case IConditionalOperation { WhenFalse: not null, IsRef: false } choice when IsBool(Value(choice.Condition)):
                    Value(choice.WhenTrue); Value(choice.WhenFalse);
                    break;
                case IIsPatternOperation test when IsInput(test.Value):
                    Pattern(test.Pattern, Subject(test.Value));
                    break;
                case ISwitchExpressionOperation table when IsInput(table.Value):
                    foreach (var arm in table.Arms)
                    {
                        if (arm.Guard != null) throw Unsupported("switch guard", arm.Guard);
                        Pattern(arm.Pattern, Subject(table.Value));
                        Value(arm.Value);
                    }
                    Tool.Require(table.IsExhaustive,
                        $"{symbol.Name}: a switch expression must return a value for every input, unnamed enum values and null included; add a discard arm");
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
        return new Admitted(symbol, $"{symbol.ContainingType.ToDisplayString()}.{symbol.Name}", parameters!,
            [.. parameters.SelectMany(p => p!.Cells)], new Dimension("result", enums.GetValueOrDefault(symbol.ReturnType)));
    }
}
