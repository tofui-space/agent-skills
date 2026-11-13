using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;

/// <summary>An admitted enum: its named values and one value that stands for every unnamed one.</summary>
internal sealed record EnumDomain(INamedTypeSymbol Type, (string Name, decimal Value)[] Members, decimal Unnamed);

/// <summary>
/// An integer input: the range of its type and the cuts the code makes in it.
/// A cut <c>k</c> says that some comparison in the code answers differently for <c>k - 1</c> and for <c>k</c>.
/// </summary>
internal sealed record IntegerDomain(ITypeSymbol Type, Int128 Min, Int128 Max, SortedSet<Int128> Cuts);

/// <summary>One value to try, and the index of the spec cell it lies in.</summary>
internal sealed record Probe(object? Value, int Cell);

/// <summary>The cells of one input as a spec row names them, and the values tried in them.</summary>
internal sealed record Partition(object[] Tokens, Probe[] Probes);

/// <summary>
/// One input or the result: a bool, an enum, an integer or a string.
/// <c>Text</c> is set for a string input and holds the constants the code compares it with.
/// </summary>
internal sealed record Dimension(string Name, EnumDomain? Enum = null, IntegerDomain? Integer = null, SortedSet<string>? Text = null)
{
    public const string UnnamedToken = "#unnamed";
    public const string NullToken = "#null";
    public const string OtherToken = "#other";

    private static readonly Regex Range = new(@"^(-?[0-9]+)?\.\.(-?[0-9]+)?\z");

    public bool IsBool => Enum == null && Integer == null && Text == null;

    /// <summary>True for an integer or a string, whose cells the type does not name, so the spec states them.</summary>
    public bool Declared => Integer != null || Text != null;

    /// <summary>The values a result can take. An admitted method returns constants only, so a result is never unnamed.</summary>
    public object[] Results => Enum == null ? [false, true] : [.. Enum.Members.Select(m => (object)m.Name)];

    /// <summary>
    /// Splits the input into cells and picks the values to try in each.
    /// <paramref name="declared"/> holds the cells a spec states for an integer or a string; without it they are the ones the code tells apart.
    /// <paramref name="where"/> starts every rejection.
    /// </summary>
    public Partition Split(string[]? declared, string where)
    {
        if (Integer != null) return SplitInteger(Integer, declared, where);
        if (Text != null) return SplitText(Text, declared, where);
        object[] tokens = Enum == null ? [false, true] : [.. Enum.Members.Select(m => (object)m.Name), UnnamedToken];
        return new(tokens, [.. tokens.Select((token, cell) => new Probe(token, cell))]);
    }

    private static Partition SplitInteger(IntegerDomain domain, string[]? declared, string where)
    {
        var type = domain.Type.ToDisplayString();
        var cuts = new SortedSet<Int128>(domain.Cuts);
        var ranges = Array.Empty<(Int128 From, Int128 To, string Token)>();
        if (declared != null)
        {
            ranges = [.. declared.Select(token =>
            {
                var match = Range.Match(token ?? "");
                Int128 from = domain.Min, to = domain.Max;
                Tool.Require(match.Success && (!match.Groups[1].Success || Whole(match.Groups[1].Value, out from))
                    && (!match.Groups[2].Success || Whole(match.Groups[2].Value, out to)),
                    $"{where}: a range is written <first>..<last> in whole numbers, and either end may be left out; found: {token}");
                Tool.Require(from >= domain.Min && to <= domain.Max && from <= to, $"{where}: {token} is not a range of {type}");
                return (From: from, To: to, Token: token!);
            }).OrderBy(range => range.From)];
            Tool.Require(ranges.Length > 0 && ranges[0].From == domain.Min && ranges[^1].To == domain.Max
                && ranges.Zip(ranges.Skip(1)).All(pair => pair.Second.From == pair.First.To + 1),
                $"{where}: the ranges must cover every {type} value exactly once, such as \"..0\", \"1..14\", \"15..\"; found: {string.Join(", ", declared)}");
            cuts.UnionWith(ranges.Skip(1).Select(range => range.From));
        }
        Int128[] starts = [domain.Min, .. cuts];
        var ends = starts.Skip(1).Select(next => next - 1).Append(domain.Max).ToArray();
        if (declared == null)
            ranges = [.. starts.Zip(ends, (from, to) => (From: from, To: to,
                Token: $"{(from == domain.Min ? "" : from.ToString(CultureInfo.InvariantCulture))}..{(to == domain.Max ? "" : to.ToString(CultureInfo.InvariantCulture))}"))];
        var probes = new List<Probe>();
        for (var i = 0; i < starts.Length; i++)
        {
            // Every value between two neighbouring cuts takes the same branches and has the same spec row, so the two ends stand for all of them.
            var cell = Array.FindIndex(ranges, range => range.From <= starts[i] && ends[i] <= range.To);
            probes.Add(new(Boxed(starts[i]), cell));
            if (ends[i] != starts[i]) probes.Add(new(Boxed(ends[i]), cell));
        }
        return new([.. ranges.Select(range => (object)range.Token)], [.. probes]);
    }

    private static Partition SplitText(SortedSet<string> constants, string[]? declared, string where)
    {
        // Without a spec the code's constants stand for the listed strings; one that is spelled like a cell token is shown under #other, where a spec has to leave it too.
        var listed = declared ?? [.. constants.Where(constant => constant != NullToken && constant != OtherToken)];
        Tool.Require(listed.All(value => value != null && value != NullToken && value != OtherToken)
            && listed.Distinct(StringComparer.Ordinal).Count() == listed.Length,
            $"{where}: list each string once; {NullToken} and {OtherToken} are cells of every string input and are not listed");
        var known = new SortedSet<string>(constants.Concat(listed), StringComparer.Ordinal);
        var other = listed.Length + 1;
        var probes = listed.Select((value, cell) => new Probe(value, cell)).ToList();
        probes.Add(new(null, listed.Length));
        // The code tells a constant it compares with from every other string, so such a constant is tried even when the spec does not list it.
        probes.AddRange(constants.Except(listed, StringComparer.Ordinal).Select(constant => new Probe(constant, other)));
        var unknown = new List<string>();
        foreach (var candidate in known.Select(SwapAsciiCase).Prepend(""))
            if (!known.Contains(candidate) && !unknown.Contains(candidate)) unknown.Add(candidate);
        for (var filler = "x"; unknown.Count == 0; filler += "x")
            if (!known.Contains(filler)) unknown.Add(filler);
        probes.AddRange(unknown.Select(value => new Probe(value, other)));
        return new([.. listed, NullToken, OtherToken], [.. probes]);
    }

    private static bool Whole(string text, out Int128 value) =>
        Int128.TryParse(text, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out value);

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

/// <summary>An admitted method. <c>Inputs</c> holds the dimensions of all parameters in declaration order.</summary>
internal sealed record Admitted(IMethodSymbol Symbol, string Name, Parameter[] Parameters, Dimension[] Inputs, Dimension Result);

/// <summary>The cells and the checks of one admitted method: one partition per input, in the order of <see cref="Admitted.Inputs"/>.</summary>
internal sealed record Plan(Partition[] Partitions, int Rows, int Cases)
{
    public const int MaxCases = 4096;

    /// <summary>
    /// Builds the plan of <paramref name="unit"/>.
    /// <paramref name="declared"/> is the <c>domains</c> object of the unit's spec, keyed by input label; without a spec it is null.
    /// </summary>
    public static Plan For(Admitted unit, IReadOnlyDictionary<string, string[]>? declared)
    {
        var cells = unit.Parameters.SelectMany(p => p.Cells.Select(cell => (Label: p.Label(cell), Cell: cell))).ToArray();
        if (declared != null)
        {
            var stated = cells.Where(c => c.Cell.Declared).Select(c => c.Label).ToArray();
            Tool.Require(declared.Keys.ToHashSet().SetEquals(stated) && declared.Values.All(list => list != null),
                stated.Length == 0
                    ? $"{unit.Name}: domains is for integer and string inputs, and this method has none"
                    : $"{unit.Name}: domains must list the cells of exactly {string.Join(", ", stated)}");
        }
        var partitions = cells.Select(c => c.Cell.Split(declared?.GetValueOrDefault(c.Label), $"{unit.Name}: domains.{c.Label}")).ToArray();
        long Product(Func<Partition, int> size) => partitions.Aggregate(1L, (product, p) => Math.Min(product * size(p), int.MaxValue));
        var cases = Product(p => p.Probes.Length);
        Tool.Require(cases <= MaxCases, $"{unit.Name}: {cases} checks exceed the limit of {MaxCases}");
        return new(partitions, (int)Product(p => p.Tokens.Length), (int)cases);
    }

    /// <summary>The probes of check number <paramref name="key"/>, one per input.</summary>
    public Probe[] Probes(int key)
    {
        var probes = new Probe[Partitions.Length];
        for (var i = 0; i < probes.Length; i++)
        {
            var axis = Partitions[i].Probes;
            probes[i] = axis[key % axis.Length];
            key /= axis.Length;
        }
        return probes;
    }

    /// <summary>The number of the spec row that holds <paramref name="cells"/>, one cell index per input.</summary>
    public int Row(IEnumerable<int> cells)
    {
        var (row, stride, i) = (0, 1, 0);
        foreach (var cell in cells)
        {
            row += cell * stride;
            stride *= Partitions[i++].Tokens.Length;
        }
        return row;
    }
}
