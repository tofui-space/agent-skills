using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

/// <summary>Decides which source is admitted, and reads from each method what its code can tell apart and what it computes.</summary>
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
                $"{type.Name}: record fields must be bool, integers, double, strings or enums declared in the file");
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
        : IntegerRange(type) is { } range ? new(name, Number: new(type, range.Min, range.Max, []))
        : type.SpecialType == SpecialType.System_Double ? new(name, Number: new(type, -NumberDomain.Infinity, NumberDomain.Infinity, []))
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
            else if (member is ClassDeclarationSyntax or StructDeclarationSyntax)
            {
                var type = (TypeDeclarationSyntax)member;
                Tool.Require(type.Modifiers.Count == 2 && type.Modifiers.Any(SyntaxKind.PublicKeyword)
                    && type.Modifiers.Any(type is ClassDeclarationSyntax ? SyntaxKind.StaticKeyword : SyntaxKind.ReadOnlyKeyword)
                    && type.TypeParameterList == null && type.BaseList == null && type.AttributeLists.Count == 0 && type.ParameterList == null
                    && type.Members.Count > 0 && type.Members.All(m => m is MethodDeclarationSyntax),
                    "only public static classes and public readonly structs, non-generic and containing methods, are admitted; no fields, constructors, interfaces or nested types");
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
        // Each parameter gets dimensions of its own, because the cuts and constants of a number or a string are collected per input.
        Parameter? Read(IParameterSymbol parameter) =>
            Cell(parameter.Name, parameter.Type, enums) is { } cell ? new(parameter.Name, null, [cell])
            : records.TryGetValue(parameter.Type, out var fields)
                ? new(parameter.Name, (INamedTypeSymbol)parameter.Type, [.. fields.Select(f => Cell(f.Name, f.Type, enums)!)])
            : null;

        var parameters = symbol.Parameters.Select(Read).ToArray();
        var inStruct = method.Parent is StructDeclarationSyntax;
        Tool.Require(method.Modifiers.Count == (inStruct ? 1 : 2) && method.Modifiers.Any(SyntaxKind.PublicKeyword)
            && method.AttributeLists.Count == 0
            && !symbol.IsGenericMethod && !symbol.IsVararg && !symbol.ReturnsByRef && !symbol.ReturnsByRefReadonly,
            $"{symbol.Name}: only public static methods of a class and public methods of a readonly struct, without attributes or type parameters, are admitted");
        Tool.Require(parameters.All(p => p != null) && method.ParameterList.Parameters.Select((p, i) => p.Default == null && p.AttributeLists.Count == 0
                && (p.Modifiers.Count == 0 || (p.Modifiers.Count == 1 && p.Modifiers[0].IsKind(SyntaxKind.InKeyword) && parameters[i]!.Record != null))).All(ordinary => ordinary),
            $"{symbol.Name}: parameters are bool, integers, double, strings, and enums and records declared in the file, without default values or attributes, and without modifiers other than in on a record");
        var inputs = parameters.SelectMany(p => p!.Cells).ToArray();
        var entities = parameters.Where(p => SymbolEqualityComparer.Default.Equals(p!.Record, symbol.ReturnType)).ToArray();
        var decision = IsBool(symbol.ReturnType) || enums.ContainsKey(symbol.ReturnType);
        Tool.Require(decision || Term.KindOf(symbol.ReturnType) != Kind.Other || entities.Length == 1,
            $"{symbol.Name}: the result is bool, an enum declared in the file, int, long, double, or the record type of exactly one parameter");
        // A computed result holds one number, or the fields of the record parameter it is made from.
        Output[] outputs = decision ? []
            : entities.Length == 1 ? [.. entities[0]!.Cells.Select(field => new Output(field.Name, field, field.Kind, Array.FindIndex(inputs, input => ReferenceEquals(input, field))))]
            : [new("", null, Term.KindOf(symbol.ReturnType), -1)];
        var read = new Dictionary<IParameterSymbol, Parameter>(SymbolEqualityComparer.Default);
        for (var i = 0; i < parameters.Length; i++) read.Add(symbol.Parameters[i], parameters[i]!);
        // Two fields with the same name and type are equal as records, so the inputs are told apart by reference.
        var tested = new HashSet<Dimension>(ReferenceEqualityComparer.Instance);
        var sites = new List<Site>();

        InvalidOperationException Unsupported(string what, IOperation operation) =>
            new($"{symbol.Name}: unsupported {what} {operation.Syntax.Kind()}");
        string Misuse(Dimension? cell) => symbol.Name + (cell?.Number is { Real: true }
            ? ": a double input can only be compared with a constant or matched by a pattern"
            : cell?.Number != null
                ? ": an integer input can only be compared with a constant of an integer type or matched by a pattern"
            : cell?.Text != null
                ? ": a string input can only be compared with a string constant or null, or matched by a pattern"
                : ": an enum input can only be compared with a named member or matched by a pattern; return named members");
        // What an expression names: one cell, a whole record parameter, or neither.
        (Dimension? Cell, Parameter? Record) Named(IOperation operation) => operation switch
        {
            IParameterReferenceOperation reference when read.TryGetValue(reference.Parameter, out var parameter)
                => parameter.Record == null ? (parameter.Cells[0], null) : (null, parameter),
            IPropertyReferenceOperation { Instance: IParameterReferenceOperation reference } field
                when read.TryGetValue(reference.Parameter, out var parameter) && parameter.Record != null
                => (parameter.Cells.FirstOrDefault(cell => cell.Name == field.Property.Name), null),
            _ => default
        };
        // What a condition reads. Every cell that passes through here counts as tested; a cell that is missed would be tried in too few combinations.
        (Dimension? Cell, Parameter? Record) Subject(IOperation operation)
        {
            var named = Named(operation);
            if (named.Cell != null) tested.Add(named.Cell);
            return named;
        }
        bool IsInput(IOperation operation) => Subject(operation) != default;
        bool IsConstant(IOperation operation) => operation is IFieldReferenceOperation { Field.IsConst: true };
        bool IsBoolLiteral(IOperation operation) => operation is ILiteralOperation { ConstantValue: { HasValue: true, Value: bool } };

        // Admits a test of one cell against a constant, written as `cell <kind> constant`, and records what the test lets the code tell apart.
        bool Test(Dimension cell, BinaryOperatorKind kind, IOperation constant)
        {
            tested.Add(cell);
            var equality = kind is BinaryOperatorKind.Equals or BinaryOperatorKind.NotEquals;
            var value = constant.ConstantValue;
            if (cell.Enum != null) return equality && IsConstant(constant);
            if (cell.Number is { } number)
            {
                if (!value.HasValue || (number.Real ? value.Value is not double : Whole(value.Value) == null)) return false;
                // A comparison with NaN answers the same for every input, and a NaN pattern matches NaN alone, which is a cell of every double.
                var unordered = value.Value is double.NaN;
                var at = value.Value is double real ? unordered ? 0 : NumberDomain.Ordinal(real) : Whole(value.Value)!.Value;
                Int128[] cuts = kind switch
                {
                    BinaryOperatorKind.LessThan or BinaryOperatorKind.GreaterThanOrEqual => [at],
                    BinaryOperatorKind.LessThanOrEqual or BinaryOperatorKind.GreaterThan => [at + 1],
                    BinaryOperatorKind.Equals or BinaryOperatorKind.NotEquals => [at, at + 1],
                    _ => []
                };
                // A cut at the lowest value of the type, or above its highest, separates nothing the input can hold.
                if (!unordered) number.Cuts.UnionWith(cuts.Where(cut => cut > number.Min && cut <= number.Max));
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
            && IntegerRange(widened.Type) != null && Subject(widened.Operand).Cell?.Number is { Real: false } ? widened.Operand : operand;
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
                    when subject.Cell?.Number != null && Test(subject.Cell, relational.OperatorKind, relational.Value): return;
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
        // The arms of a switch expression over an input; each arm's value goes to the caller, which knows whether it is a condition or a result.
        void Table(ISwitchExpressionOperation table, Action<IOperation> value)
        {
            foreach (var arm in table.Arms)
            {
                if (arm.Guard != null) throw Unsupported("switch guard", arm.Guard);
                Pattern(arm.Pattern, Subject(table.Value));
                value(arm.Value);
            }
            Tool.Require(table.IsExhaustive,
                $"{symbol.Name}: a switch expression must return a value for every input, unnamed enum values, null and NaN included; add a discard arm");
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
                    // A cell is checked through a few representatives, so a decision must not carry the value of an enum, a number or a string input.
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
                    Table(table, arm => Value(arm));
                    break;
                default: throw Unsupported("expression", operation);
            }
            return operation.Type!;
        }

        char? Arithmetic(BinaryOperatorKind kind) => kind switch
        {
            BinaryOperatorKind.Add => '+',
            BinaryOperatorKind.Subtract => '-',
            BinaryOperatorKind.Multiply => '*',
            BinaryOperatorKind.Divide => '/',
            _ => null
        };
        // The arithmetic of a result. It names its inputs without testing them, because a result does not choose the branch.
        Term Number(IOperation operation)
        {
            var kind = Term.KindOf(operation.Type);
            if (operation.ConstantValue is { HasValue: true, Value: int or long or double } constant && Term.KindOf(operation.Type) != Kind.Other)
                return Term.Constant(constant.Value, kind);
            var term = operation switch
            {
                IParameterReferenceOperation or IPropertyReferenceOperation when Named(operation).Cell is { } cell
                    => Term.Input(Array.FindIndex(inputs, input => ReferenceEquals(input, cell)), cell.Kind),
                IConversionOperation { IsImplicit: true, OperatorMethod: null, Conversion.IsNumeric: true } widened
                    => Term.Widen(Number(widened.Operand), kind, symbol.Name),
                IUnaryOperation { OperatorKind: UnaryOperatorKind.Minus, OperatorMethod: null } negation => Term.Negate(Number(negation.Operand), symbol.Name),
                IBinaryOperation { OperatorMethod: null } binary when Arithmetic(binary.OperatorKind) is { } op
                    => Term.Binary(op, Number(binary.LeftOperand), Number(binary.RightOperand), symbol.Name),
                _ => throw Unsupported("expression", operation)
            };
            Tool.Require(term.Kind == kind && kind != Kind.Other, $"{symbol.Name}: {Term.Rule}");
            return term;
        }
        // A field that is not a number of the three kinds can only be kept from an input of its type or set to a bool literal or a named enum member.
        Term Kept(IOperation operation) => operation switch
        {
            IParameterReferenceOperation or IPropertyReferenceOperation when Named(operation).Cell is { } cell
                => Term.Input(Array.FindIndex(inputs, input => ReferenceEquals(input, cell)), Kind.Other),
            ILiteralOperation when IsBoolLiteral(operation) => Term.Constant(operation.ConstantValue.Value, Kind.Other),
            IFieldReferenceOperation { Field: { IsConst: true } member } when enums.ContainsKey(member.ContainingType) => Term.Constant(member.Name, Kind.Other),
            _ => throw Unsupported("expression", operation)
        };
        // One result expression: a number, the record parameter itself, or a copy of it with some fields set.
        void Leaf(IOperation operation)
        {
            if (entities.Length != 1)
            {
                sites.Add(new(operation.Syntax, [Term.Widen(Number(operation), outputs[0].Kind, symbol.Name)], [operation.Syntax.ToString()]));
                return;
            }
            var labels = entities[0]!.Cells.Select(entities[0]!.Label).ToArray();
            var terms = outputs.Select(output => Term.Input(output.Kept, output.Kind)).ToArray();
            var changes = operation switch
            {
                // Exactly one parameter has the type of the result, so a parameter in this place is that one.
                IParameterReferenceOperation => [],
                IWithOperation { Operand: IParameterReferenceOperation } copy => copy.Initializer.Initializers,
                _ => throw Unsupported("result", operation)
            };
            foreach (var change in changes)
            {
                if (change is not ISimpleAssignmentOperation { Target: IPropertyReferenceOperation { Instance: IInstanceReferenceOperation } target } set)
                    throw Unsupported("result", change);
                var field = Array.FindIndex(outputs, output => output.Name == target.Property.Name);
                terms[field] = outputs[field].Kind == Kind.Other ? Kept(set.Value) : Term.Widen(Number(set.Value), outputs[field].Kind, symbol.Name);
                labels[field] = set.Value.Syntax.ToString();
            }
            sites.Add(new(operation.Syntax, terms, labels));
        }
        // A computed result is chosen by conditions and switch expressions; what they choose between are the result expressions.
        void Result(IOperation operation)
        {
            switch (operation)
            {
                case IConversionOperation { IsImplicit: true, OperatorMethod: null, Conversion.IsNumeric: true, Operand: IConditionalOperation or ISwitchExpressionOperation } widened:
                    Result(widened.Operand);
                    break;
                case IConditionalOperation { WhenFalse: not null, IsRef: false } choice when IsBool(Value(choice.Condition)):
                    Result(choice.WhenTrue); Result(choice.WhenFalse);
                    break;
                case ISwitchExpressionOperation table when IsInput(table.Value):
                    Table(table, Result);
                    break;
                default: Leaf(operation); break;
            }
        }
        void Statement(IOperation statement)
        {
            switch (statement)
            {
                case IBlockOperation block: foreach (var child in block.Operations) Statement(child); return;
                case IReturnOperation { ReturnedValue: { } returned }:
                    if (decision) Value(returned); else Result(returned);
                    return;
                case IConditionalOperation branch when IsBool(Value(branch.Condition)):
                    Statement(branch.WhenTrue);
                    if (branch.WhenFalse != null) Statement(branch.WhenFalse);
                    return;
                default: throw Unsupported("statement", statement);
            }
        }

        var body = model.GetOperation(method) as IMethodBodyOperation;
        Statement(body?.BlockBody ?? body?.ExpressionBody ?? throw new InvalidOperationException($"{symbol.Name}: missing method body"));
        return new Admitted(symbol, $"{symbol.ContainingType.ToDisplayString()}.{symbol.Name}", parameters!, inputs,
            [.. inputs.Select(tested.Contains)], decision ? new Dimension("result", enums.GetValueOrDefault(symbol.ReturnType)) : null, outputs, [.. sites]);
    }
}
