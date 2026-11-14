using System.Globalization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

/// <summary>The number types arithmetic is admitted on. A value of any other type can only be kept or set to a constant.</summary>
internal enum Kind { Other, Int, Long, Double }

/// <summary>
/// A computed value as a tree of inputs, constants, negation, widening and + - * /.
/// The result expressions of the code and the formulas of a spec both become terms, so one evaluator serves both, and the two can be compared operation by operation.
/// A term over constants only is folded when it is built, so a tree of constants is one constant.
/// </summary>
internal sealed class Term
{
    public const string Rule = "arithmetic is admitted on int, long and double values with + - * / and negation, and an integer is divided only by a constant other than 0 and -1";

    // 'i' is an input, 'c' a constant, 'n' a negation, 'w' a widening; any other character is the operator of a binary term.
    private readonly char op;
    private readonly int input;
    private readonly Term[] operands;

    private Term(char op, Kind kind, Term[] operands, int input = -1, object? value = null)
    {
        (this.op, Kind, this.operands, this.input, Value) = (op, kind, operands, input, value);
        var keys = operands.Select(operand => operand.Key).ToArray();
        // Both + and * give the same result with their operands exchanged, for integers and for doubles, so the two operands are put in one order.
        if (op is '+' or '*' && string.CompareOrdinal(keys[0], keys[1]) > 0) Array.Reverse(keys);
        Key = op switch
        {
            'i' => $"in{input}",
            'c' => $"{value?.GetType().Name}:{Literal(value)}",
            _ => $"({op}{kind} {string.Join(" ", keys)})"
        };
    }

    public Kind Kind { get; }

    /// <summary>The value of a constant term: an int, a long, a double, or the token of a value that is not a number.</summary>
    public object? Value { get; }

    /// <summary>Two terms with the same key do the same operations on the same operands.</summary>
    public string Key { get; }

    public bool IsConstant => op == 'c';

    public bool IsInput => op == 'i';

    public static Kind KindOf(ITypeSymbol? type) => type?.SpecialType switch
    {
        SpecialType.System_Int32 => Kind.Int,
        SpecialType.System_Int64 => Kind.Long,
        SpecialType.System_Double => Kind.Double,
        _ => Kind.Other
    };

    public static Term Input(int index, Kind kind) => new('i', kind, [], index);

    public static Term Constant(object? value, Kind kind) => new('c', kind, [], value: value);

    /// <summary><paramref name="where"/> starts the rejection of a term the rule does not admit.</summary>
    public static Term Negate(Term operand, string where)
    {
        Tool.Require(operand.Kind != Kind.Other, $"{where}: {Rule}");
        return Folded(new('n', operand.Kind, [operand]), where);
    }

    /// <summary>Converts to a wider number type the way an implicit conversion does: int to long, int to double, long to double.</summary>
    public static Term Widen(Term operand, Kind to, string where)
    {
        if (operand.Kind == to) return operand;
        Tool.Require(operand.Kind != Kind.Other && to != Kind.Other, $"{where}: {Rule}");
        Tool.Require(operand.Kind < to, $"{where}: a {Name(operand.Kind)} value does not fit a result of type {Name(to)}");
        // An int keeps its value on the way through long, so a widening of a widening is the widening of what is inside.
        return Folded(new('w', to, [operand.op == 'w' ? operand.operands[0] : operand]), where);
    }

    public static Term Binary(char op, Term left, Term right, string where)
    {
        Tool.Require(left.Kind == right.Kind && left.Kind != Kind.Other
            && (op != '/' || left.Kind == Kind.Double || right is { IsConstant: true, Value: not (0 or -1 or 0L or -1L) }), $"{where}: {Rule}");
        return Folded(new(op, left.Kind, [left, right]), where);
    }

    /// <summary>
    /// Reads a formula of a spec: inputs by their labels, numbers, + - * /, negation and parentheses, with the precedence and the number literals of C#.
    /// <paramref name="named"/> resolves a name that stands alone; it returns null for a name it does not know.
    /// An int operand next to a long or a double one is widened, and a long next to a double, as the compiler does.
    /// </summary>
    public static Term Parse(string text, Func<string, Term?> named, string where)
    {
        var parsed = SyntaxFactory.ParseExpression(text, options: new CSharpParseOptions(LanguageVersion.CSharp14));
        InvalidOperationException Unreadable(string part) => new(
            $"{where}: a formula is made of input labels, numbers of type int, long or double, + - * /, negation and parentheses; found: {part}");
        var plain = parsed.DescendantTrivia(descendIntoTrivia: true).All(trivia => trivia.IsKind(SyntaxKind.WhitespaceTrivia) || trivia.IsKind(SyntaxKind.EndOfLineTrivia));
        // What the parser hangs on the end of the text, such as a directive on a line of its own, is not part of the expression it returns.
        if (parsed.ContainsDiagnostics || !plain || !string.IsNullOrWhiteSpace(text[parsed.FullSpan.End..])) throw Unreadable(text);
        Term Read(ExpressionSyntax part)
        {
            switch (part)
            {
                case ParenthesizedExpressionSyntax inner: return Read(inner.Expression);
                case LiteralExpressionSyntax { Token.Value: int or long or double } number:
                    return Constant(number.Token.Value, number.Token.Value is int ? Kind.Int : number.Token.Value is long ? Kind.Long : Kind.Double);
                case LiteralExpressionSyntax { Token.Value: bool truth }: return Constant(truth, Kind.Other);
                // The lowest int and the lowest long are written as a minus sign before a number that is one too large for the type, as in C#.
                case PrefixUnaryExpressionSyntax { Operand: LiteralExpressionSyntax { Token.Value: 2147483648u } } lowest when lowest.IsKind(SyntaxKind.UnaryMinusExpression):
                    return Constant(int.MinValue, Kind.Int);
                case PrefixUnaryExpressionSyntax { Operand: LiteralExpressionSyntax { Token.Value: 9223372036854775808ul } } lowest when lowest.IsKind(SyntaxKind.UnaryMinusExpression):
                    return Constant(long.MinValue, Kind.Long);
                case PrefixUnaryExpressionSyntax negation when negation.IsKind(SyntaxKind.UnaryMinusExpression):
                    return Negate(Read(negation.Operand), where);
                case BinaryExpressionSyntax binary when Operator(binary.Kind()) is { } op:
                    var (left, right) = (Read(binary.Left), Read(binary.Right));
                    var wider = left.Kind > right.Kind ? left.Kind : right.Kind;
                    Tool.Require(left.Kind != Kind.Other && right.Kind != Kind.Other, $"{where}: {Rule}");
                    return Binary(op, Widen(left, wider, where), Widen(right, wider, where), where);
                case IdentifierNameSyntax or MemberAccessExpressionSyntax
                    when named(string.Concat(part.DescendantTokens().Select(token => token.ValueText))) is { } term: return term;
                default: throw Unreadable(part.ToString().Trim());
            }
        }
        return Read(parsed);
    }

    private static char? Operator(SyntaxKind kind) => kind switch
    {
        SyntaxKind.AddExpression => '+',
        SyntaxKind.SubtractExpression => '-',
        SyntaxKind.MultiplyExpression => '*',
        SyntaxKind.DivideExpression => '/',
        _ => null
    };

    /// <summary>
    /// Puts the value tried in place of each input for which <paramref name="known"/> answers true, and folds what becomes constant.
    /// With every input known the result is a constant, which is how a term is evaluated.
    /// </summary>
    public Term At(IReadOnlyList<Probe> probes, Func<int, bool> known) => op switch
    {
        'i' => known(input) ? Constant(Typed(probes[input].Value, Kind), Kind) : this,
        'c' => this,
        _ => Folded(new(op, Kind, [.. operands.Select(operand => operand.At(probes, known))]), null)
    };

    /// <summary>The value of a number of a spec, read as the C# literal with the same digits; null when the text is not such a number.</summary>
    public static double? Number(string text)
    {
        var parsed = SyntaxFactory.ParseExpression(text);
        var literal = parsed is PrefixUnaryExpressionSyntax negative && negative.IsKind(SyntaxKind.UnaryMinusExpression) ? negative.Operand : parsed;
        if (parsed.ContainsDiagnostics || literal is not LiteralExpressionSyntax { Token.Value: int or uint or long or ulong or double } number) return null;
        var value = Convert.ToDouble(number.Token.Value, CultureInfo.InvariantCulture);
        return ReferenceEquals(literal, parsed) ? value : -value;
    }

    private static string Name(Kind kind) => kind.ToString().ToLowerInvariant();

    // A probe holds an integer as a long, whatever the type of its input.
    private static object? Typed(object? value, Kind kind) => kind switch
    {
        Kind.Int => (int)Convert.ToInt64(value, CultureInfo.InvariantCulture),
        Kind.Long => Convert.ToInt64(value, CultureInfo.InvariantCulture),
        _ => value
    };

    private static string Literal(object? value) => value switch
    {
        // Every NaN is one value here; the two zeros are two.
        double real => double.IsNaN(real) ? "NaN" : BitConverter.DoubleToInt64Bits(real).ToString("X16", CultureInfo.InvariantCulture),
        IFormattable number => number.ToString(null, CultureInfo.InvariantCulture),
        _ => value?.ToString() ?? "null"
    };

    // Integer arithmetic wraps and double arithmetic rounds each operation on its own, as the compiled code does without checked and without fused instructions.
    // When where is given, the constants are written ones, in a formula or in the code, and an integer result that leaves its type is rejected as the compiler rejects it.
    private static Term Folded(Term term, string? where)
    {
        if (!term.operands.All(operand => operand.IsConstant)) return term;
        var first = term.operands[0].Value;
        var second = term.operands.Length > 1 ? term.operands[1].Value : null;
        static Int128 Whole(char op, Int128 a, Int128 b) => op switch { '+' => a + b, '-' => a - b, '*' => a * b, _ => a / b };
        Int128? exact = (term.op, first, second) switch
        {
            ('w', _, _) => null,
            ('n', int a, _) => -(Int128)a,
            ('n', long a, _) => -(Int128)a,
            (_, int a, int b) => Whole(term.op, a, b),
            (_, long a, long b) => Whole(term.op, a, b),
            _ => null
        };
        if (exact is { } whole)
        {
            var fits = term.Kind == Kind.Int ? whole >= int.MinValue && whole <= int.MaxValue : whole >= long.MinValue && whole <= long.MaxValue;
            Tool.Require(where == null || fits, $"{where}: a constant part of the formula overflows its type");
            // The cast keeps an int an int; without it both branches would have the type long.
            return Constant(term.Kind == Kind.Int ? (object)unchecked((int)whole) : unchecked((long)whole), term.Kind);
        }
        object value = (term.op, first, second) switch
        {
            // The cast keeps each result in its own type; without it the arms would share the type double.
            ('w', int a, _) when term.Kind == Kind.Long => (object)(long)a,
            ('w', int a, _) => (double)a,
            ('w', long a, _) => (double)a,
            ('n', double a, _) => -a,
            ('+', double a, double b) => a + b,
            ('-', double a, double b) => a - b,
            ('*', double a, double b) => a * b,
            ('/', double a, double b) => a / b,
            _ => throw new InvalidOperationException($"a term of kind {term.Kind} holds a value of another kind")
        };
        return Constant(value, term.Kind);
    }
}
