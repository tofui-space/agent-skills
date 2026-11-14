using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;

/// <summary>An admitted enum: its named values and one value that stands for every unnamed one.</summary>
internal sealed record EnumDomain(INamedTypeSymbol Type, (string Name, decimal Value)[] Members, decimal Unnamed);

/// <summary>
/// A number input: the range of its type and the cuts the code makes in it.
/// A cut <c>k</c> says that some comparison in the code answers differently for <c>k - 1</c> and for <c>k</c>.
/// The values of a double are numbered in their order, with both zeros under the number 0, so a double is cut the way an integer is.
/// NaN has no number and is a cell of its own.
/// </summary>
internal sealed record NumberDomain(ITypeSymbol Type, Int128 Min, Int128 Max, SortedSet<Int128> Cuts)
{
    /// <summary>The number of positive infinity; negative infinity has the same number with a minus sign.</summary>
    public static readonly Int128 Infinity = BitConverter.DoubleToInt64Bits(double.PositiveInfinity);

    public bool Real => Type.SpecialType == SpecialType.System_Double;

    /// <summary>The number of a double that is not NaN.</summary>
    public static Int128 Ordinal(double value)
    {
        var bits = BitConverter.DoubleToInt64Bits(value);
        return bits >= 0 ? bits : -(Int128)(bits & long.MaxValue);
    }

    /// <summary>The double with the number <paramref name="ordinal"/>; for 0 the positive zero.</summary>
    public static double Value(Int128 ordinal) =>
        ordinal >= 0 ? BitConverter.Int64BitsToDouble((long)ordinal) : -BitConverter.Int64BitsToDouble((long)-ordinal);
}

/// <summary>
/// One value to try, and the index of the spec cell it lies in.
/// <c>Sole</c> says that every value that shares its branches and its spec row is tried as well, so a check of this value stands for no other.
/// </summary>
internal sealed record Probe(object? Value, int Cell, bool Sole);

/// <summary>The cells of one input as a spec row names them, and the values tried in them.</summary>
internal sealed record Partition(object[] Tokens, Probe[] Probes);

/// <summary>
/// One input or the result of a decision: a bool, an enum, a number or a string.
/// <c>Text</c> is set for a string input and holds the constants the code compares it with.
/// </summary>
internal sealed record Dimension(string Name, EnumDomain? Enum = null, NumberDomain? Number = null, SortedSet<string>? Text = null)
{
    public const string UnnamedToken = "#unnamed";
    public const string NullToken = "#null";
    public const string OtherToken = "#other";
    public const string NanToken = "#nan";
    /// <summary>In a spec row, stands for every cell of an input.</summary>
    public const string AnyToken = "#any";

    private const string Decimal = @"-?[0-9]+(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?";
    // The two empty groups give the ends of a whole range the group numbers they have in a double range.
    private static readonly Regex WholeRange = new(@"^()(-?[0-9]+)?\.\.()(-?[0-9]+)?\z");
    private static readonly Regex RealRange = new($@"^(?:(>)?({Decimal}))?\.\.(?:(<)?({Decimal}))?\z");

    public bool IsBool => Enum == null && Number == null && Text == null;

    /// <summary>True for a number or a string, whose cells the type does not name, so the spec states them.</summary>
    public bool Declared => Number != null || Text != null;

    public Kind Kind => Term.KindOf(Number?.Type);

    /// <summary>The values the result of a decision can take. A decision returns constants only, so its result is never unnamed.</summary>
    public object[] Results => Enum == null ? [false, true] : [.. Enum.Members.Select(m => (object)m.Name)];

    /// <summary>True when a value of <paramref name="other"/> is a value of this dimension's type.</summary>
    public bool SameType(Dimension other) => IsBool == other.IsBool && (Text == null) == (other.Text == null)
        && SymbolEqualityComparer.Default.Equals(Enum?.Type, other.Enum?.Type) && SymbolEqualityComparer.Default.Equals(Number?.Type, other.Number?.Type);

    /// <summary>
    /// Splits the input into cells and picks the values to try in each.
    /// <paramref name="declared"/> holds the cells a spec states for a number or a string; without it they are the ones the code tells apart.
    /// <paramref name="where"/> starts every rejection.
    /// <paramref name="position"/> is the place of the input among the inputs of its method; a double takes its value from the inside of a piece by it, so that two inputs of one method are not tried at the same value.
    /// </summary>
    public Partition Split(string[]? declared, string where, int position)
    {
        if (Number != null) return SplitNumber(Number, declared, where, position);
        if (Text != null) return SplitText(Text, declared, where);
        object[] tokens = Enum == null ? [false, true] : [.. Enum.Members.Select(m => (object)m.Name), UnnamedToken];
        return new(tokens, [.. tokens.Select((token, cell) => new Probe(token, cell, !Equals(token, UnnamedToken)))]);
    }

    private static Partition SplitNumber(NumberDomain domain, string[]? declared, string where, int position)
    {
        var type = domain.Type.ToDisplayString();
        var cuts = new SortedSet<Int128>(domain.Cuts);
        var ranges = Array.Empty<(Int128 From, Int128 To, string Token)>();
        if (declared != null)
        {
            ranges = [.. declared.Select(token =>
            {
                var match = (domain.Real ? RealRange : WholeRange).Match(token ?? "");
                Int128 from = domain.Min, to = domain.Max;
                Tool.Require(match.Success && End(domain.Real, match.Groups[2], match.Groups[1], 1, ref from) && End(domain.Real, match.Groups[4], match.Groups[3], -1, ref to),
                    domain.Real
                        ? $"{where}: a range of a double is written <first>..<last> in decimal numbers, either end may be left out, and > before the first or < before the last leaves that number out; found: {token}"
                        : $"{where}: a range is written <first>..<last> in whole numbers, and either end may be left out; found: {token}");
                Tool.Require(from >= domain.Min && to <= domain.Max && from <= to, $"{where}: {token} is not a range of {type}");
                return (From: from, To: to, Token: token!);
            }).OrderBy(range => range.From)];
            Tool.Require(ranges.Length > 0 && ranges[0].From == domain.Min && ranges[^1].To == domain.Max
                && ranges.Zip(ranges.Skip(1)).All(pair => pair.Second.From == pair.First.To + 1),
                $"{where}: the ranges must cover every {type} value exactly once, such as {(domain.Real ? "\"..<0\", \"0..<0.5\", \"0.5..\"" : "\"..0\", \"1..14\", \"15..\"")}; found: {string.Join(", ", declared)}");
            cuts.UnionWith(ranges.Skip(1).Select(range => range.From));
        }
        Int128[] starts = [domain.Min, .. cuts];
        var ends = starts.Skip(1).Select(next => next - 1).Append(domain.Max).ToArray();
        if (declared == null) ranges = [.. starts.Zip(ends, (from, to) => (From: from, To: to, Token: Shown(domain, from, to)))];
        var probes = new List<Probe>();
        for (var i = 0; i < starts.Length; i++)
        {
            // Every value between two neighbouring cuts takes the same branches and has the same spec row, so the two ends stand for all of them.
            var cell = Array.FindIndex(ranges, range => range.From <= starts[i] && ends[i] <= range.To);
            object[] values = domain.Real ? Reals(starts[i], ends[i], position % 5)
                : starts[i] == ends[i] ? [Boxed(starts[i])] : [Boxed(starts[i]), Boxed(ends[i])];
            probes.AddRange(values.Select(value => new Probe(value, cell, starts[i] == ends[i])));
        }
        if (!domain.Real) return new([.. ranges.Select(range => (object)range.Token)], [.. probes]);
        probes.Add(new(double.NaN, ranges.Length, false));
        return new([.. ranges.Select(range => (object)range.Token), NanToken], [.. probes]);
    }

    // Reads one end of a range; an end that is left out keeps the limit of the type.
    private static bool End(bool real, Group number, Group open, int inward, ref Int128 end)
    {
        if (!number.Success) return true;
        if (!real) return Int128.TryParse(number.Value, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out end);
        if (Term.Number(number.Value) is not { } value) return false;
        // A number other than zero that is too small for a double would be read as zero, which is not what is written.
        if (value == 0 && number.Value.Split('e', 'E')[0].Any(digit => digit is >= '1' and <= '9')) return false;
        end = NumberDomain.Ordinal(value) + (open.Success ? inward : 0);
        return true;
    }

    private static object[] Reals(Int128 start, Int128 end, int shift)
    {
        var (low, high) = (NumberDomain.Value(start), NumberDomain.Value(end));
        // The ends of a wide piece are often infinite or extreme, where most formulas give an infinity or NaN, so one ordinary value from the inside is tried as well.
        var far = 1.5 + 1.25 * shift;
        var inside = double.IsNegativeInfinity(low) && double.IsPositiveInfinity(high) ? far
            : double.IsNegativeInfinity(low) ? high - far * Math.Max(1, Math.Abs(high))
            : double.IsPositiveInfinity(high) ? low + far * Math.Max(1, Math.Abs(low))
            : low + (high - low) * (0.1875 + 0.125 * shift);
        double[] values = start == end ? [low] : low < inside && inside < high ? [low, inside, high] : [low, high];
        // The number 0 holds two values, which arithmetic tells apart, so both are tried.
        return [.. values.SelectMany(value => value == 0 ? new object[] { -0.0, 0.0 } : [value])];
    }

    // The name of a piece that the code cuts out, in the notation a spec uses for its ranges.
    private static string Shown(NumberDomain domain, Int128 from, Int128 to)
    {
        string Whole(Int128 value) => value.ToString(CultureInfo.InvariantCulture);
        string Real(Int128 inside, int outward, string open)
        {
            var (included, excluded) = (NumberDomain.Value(inside), NumberDomain.Value(inside + outward));
            var texts = new[] { (Value: included, Text: ""), (Value: excluded, Text: open) }.Where(end => double.IsFinite(end.Value))
                .Select(end => end.Text + end.Value.ToString("R", CultureInfo.InvariantCulture)).ToArray();
            // A cut next to a constant is named by the constant, which is the shorter number.
            return texts.OrderBy(text => text.Length).First();
        }
        var first = from == domain.Min ? "" : domain.Real ? Real(from, -1, ">") : Whole(from);
        var last = to == domain.Max ? "" : domain.Real ? Real(to, 1, "<") : Whole(to);
        return $"{first}..{last}";
    }

    private static Partition SplitText(SortedSet<string> constants, string[]? declared, string where)
    {
        bool IsToken(string? value) => value is NullToken or OtherToken or AnyToken;
        // Without a spec the code's constants stand for the listed strings; one that is spelled like a token is shown under #other, where a spec has to leave it too.
        var listed = declared ?? [.. constants.Where(constant => !IsToken(constant))];
        Tool.Require(listed.All(value => value != null && !IsToken(value))
            && listed.Distinct(StringComparer.Ordinal).Count() == listed.Length,
            $"{where}: list each string once; {NullToken} and {OtherToken} are cells of every string input, {AnyToken} stands for all cells, and none of them is listed");
        var known = new SortedSet<string>(constants.Concat(listed), StringComparer.Ordinal);
        var other = listed.Length + 1;
        var probes = listed.Select((value, cell) => new Probe(value, cell, true)).ToList();
        probes.Add(new(null, listed.Length, true));
        // The code tells a constant it compares with from every other string, so such a constant is tried even when the spec does not list it.
        probes.AddRange(constants.Except(listed, StringComparer.Ordinal).Select(constant => new Probe(constant, other, false)));
        var unknown = new List<string>();
        foreach (var candidate in known.Select(SwapAsciiCase).Prepend(""))
            if (!known.Contains(candidate) && !unknown.Contains(candidate)) unknown.Add(candidate);
        for (var filler = "x"; unknown.Count == 0; filler += "x")
            if (!known.Contains(filler)) unknown.Add(filler);
        probes.AddRange(unknown.Select(value => new Probe(value, other, false)));
        return new([.. listed, NullToken, OtherToken], [.. probes]);
    }

    /// <summary>Every admitted integer type fits in <see cref="long"/> or <see cref="ulong"/>, which the JSON writer and the type converter both take.</summary>
    private static object Boxed(Int128 value) => value > long.MaxValue ? (ulong)value : (long)value;

    // Only the letters a to z are swapped, so the probe does not depend on the Unicode tables of the runtime.
    private static string SwapAsciiCase(string text) => string.Concat(text.Select(letter =>
        letter is >= 'a' and <= 'z' ? (char)(letter - 32) : letter is >= 'A' and <= 'Z' ? (char)(letter + 32) : letter));
}

/// <summary>One method parameter: a single dimension, or an admitted record whose positional fields are the dimensions.</summary>
internal sealed record Parameter(string Name, INamedTypeSymbol? Record, Dimension[] Cells)
{
    public string Label(Dimension cell) => Record == null ? Name : $"{Name}.{cell.Name}";
}

/// <summary>
/// One value a computed result holds: the whole result when it is a number, or one field when it is a record.
/// <c>Type</c> is the field's dimension and null for a number result; <c>Kept</c> is the index of the input that an untouched field keeps, or -1.
/// </summary>
internal sealed record Output(string Name, Dimension? Type, Kind Kind, int Kept);

/// <summary>One result expression of the code: where it stands, and per output the term it computes and the text that computes it.</summary>
internal sealed record Site(SyntaxNode Syntax, Term[] Terms, string[] Texts);

/// <summary>
/// An admitted method.
/// <c>Inputs</c> holds the dimensions of all parameters in declaration order, and <c>Tested</c> says for each whether a condition of the code reads it.
/// A decision has a <c>Result</c>; a method that computes its result has <c>Outputs</c> and <c>Sites</c> instead.
/// </summary>
internal sealed record Admitted(IMethodSymbol Symbol, string Name, Parameter[] Parameters, Dimension[] Inputs, bool[] Tested,
    Dimension? Result, Output[] Outputs, Site[] Sites)
{
    public string[] Labels => [.. Parameters.SelectMany(p => p.Cells.Select(p.Label))];
}

/// <summary>
/// The cells and the checks of one admitted method: one partition per input, in the order of <see cref="Admitted.Inputs"/>.
/// <c>Named</c> marks the inputs of which some spec row names a cell; the rows are numbered over these inputs only.
/// <c>Plain</c> marks the inputs that no spec row names and no condition of the code reads.
/// Neither the branch taken nor the row depends on a plain input, so its values are tried side by side with those of the other plain inputs instead of in every combination.
/// </summary>
internal sealed record Plan(Partition[] Partitions, bool[] Named, bool[] Plain, int Rows, int Cases)
{
    public const int MaxCases = 4096;

    /// <summary>
    /// Splits every input of <paramref name="unit"/> into cells.
    /// <paramref name="declared"/> is the <c>domains</c> object of the unit's spec, keyed by input label; without a spec it is null.
    /// </summary>
    public static Partition[] Split(Admitted unit, IReadOnlyDictionary<string, string[]>? declared)
    {
        var labels = unit.Labels;
        if (declared != null)
        {
            var stated = labels.Where((_, i) => unit.Inputs[i].Declared).ToArray();
            Tool.Require(declared.Keys.ToHashSet().SetEquals(stated) && declared.Values.All(list => list != null),
                stated.Length == 0
                    ? $"{unit.Name}: domains is for number and string inputs, and this method has none"
                    : $"{unit.Name}: domains must list the cells of exactly {string.Join(", ", stated)}");
        }
        return [.. unit.Inputs.Select((input, i) => input.Split(declared?.GetValueOrDefault(labels[i]), $"{unit.Name}: domains.{labels[i]}", i))];
    }

    /// <summary>Builds the plan from the partitions and from <paramref name="named"/>, which says for each input whether some spec row names one of its cells.</summary>
    public static Plan Of(Admitted unit, Partition[] partitions, bool[] named)
    {
        var plain = named.Select((byRow, i) => !byRow && !unit.Tested[i]).ToArray();
        long Product(Func<int, bool> counted, Func<Partition, int> size) => partitions.Select((partition, i) => counted(i) ? size(partition) : 1)
            .Aggregate(1L, (product, factor) => Math.Min(product * factor, int.MaxValue));
        var cases = Math.Min(Product(i => !plain[i], partition => partition.Probes.Length) * Side(partitions, plain), int.MaxValue);
        Tool.Require(cases <= MaxCases, $"{unit.Name}: {cases} checks exceed the limit of {MaxCases}");
        return new(partitions, named, plain, (int)Product(i => named[i], partition => partition.Tokens.Length), (int)cases);
    }

    /// <summary>The probes of check number <paramref name="key"/>, one per input.</summary>
    public Probe[] Probes(int key)
    {
        var side = Side(Partitions, Plain);
        (var step, key) = (key % side, key / side);
        var probes = new Probe[Partitions.Length];
        for (var i = 0; i < probes.Length; i++)
        {
            var axis = Partitions[i].Probes;
            if (Plain[i]) probes[i] = axis[step % axis.Length];
            else (probes[i], key) = (axis[key % axis.Length], key / axis.Length);
        }
        return probes;
    }

    // The plain inputs step through their values together, so the longest list of values sets the number of steps.
    private static int Side(Partition[] partitions, bool[] plain) =>
        partitions.Where((_, i) => plain[i]).Select(partition => partition.Probes.Length).DefaultIfEmpty(1).Max();

    /// <summary>The number of the spec row that holds <paramref name="cells"/>, one cell index per input.</summary>
    public int Row(IEnumerable<int> cells)
    {
        var (row, stride, i) = (0, 1, 0);
        foreach (var cell in cells)
        {
            if (Named[i])
            {
                row += cell * stride;
                stride *= Partitions[i].Tokens.Length;
            }
            i++;
        }
        return row;
    }
}
