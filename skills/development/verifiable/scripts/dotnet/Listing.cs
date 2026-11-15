using System.Collections.Immutable;
using System.Reflection.Emit;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;
using System.Text;

/// <summary>
/// The code of an assembly, written so that two compilations of the same source give the same text: every type with its fields and methods, and every instruction with what it refers to written out by name.
/// Row numbers of the assembly's own tables do not appear in it, because they depend on the order in which the compiler met the files.
/// Properties and events are listed with the methods that stand for them, because code that finds a property by its name runs the method the property names.
/// Attributes, resources and debug information are left out; they do not change what a method computes.
/// </summary>
internal static class Listing
{
    /// <summary>Per type, its members as lines in a fixed order.</summary>
    public static SortedDictionary<string, string[]> Of(Stream assembly)
    {
        using var file = new PEReader(assembly, PEStreamOptions.LeaveOpen);
        var reader = file.GetMetadataReader();
        var names = new Names(reader);
        var types = new SortedDictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var handle in reader.TypeDefinitions)
        {
            var type = reader.GetTypeDefinition(handle);
            var lines = new List<string>
            {
                $"type {type.Attributes} : {(type.BaseType.IsNil ? "" : names.Type(type.BaseType))} : {string.Join(", ", type.GetInterfaceImplementations().Select(i => names.Type(reader.GetInterfaceImplementation(i).Interface)).Order(StringComparer.Ordinal))}"
            };
            foreach (var field in type.GetFields().Select(reader.GetFieldDefinition))
            {
                var constant = field.GetDefaultValue().IsNil ? "" : Convert.ToHexString(reader.GetBlobBytes(reader.GetConstant(field.GetDefaultValue()).Value));
                lines.Add($"field {reader.GetString(field.Name)} {field.DecodeSignature(names, null)} {field.Attributes} {constant}");
            }
            foreach (var property in type.GetProperties().Select(reader.GetPropertyDefinition))
            {
                var accessors = property.GetAccessors();
                lines.Add($"property {reader.GetString(property.Name)} {names.Signature(property.DecodeSignature(names, null))} {property.Attributes} "
                    + $"get ({names.Method(accessors.Getter)}) set ({names.Method(accessors.Setter)}) other ({string.Join(", ", accessors.Others.Select(names.Method).Order(StringComparer.Ordinal))})");
            }
            foreach (var @event in type.GetEvents().Select(reader.GetEventDefinition))
            {
                var accessors = @event.GetAccessors();
                lines.Add($"event {reader.GetString(@event.Name)} {names.Type(@event.Type)} {@event.Attributes} add ({names.Method(accessors.Adder)}) remove ({names.Method(accessors.Remover)}) "
                    + $"raise ({names.Method(accessors.Raiser)}) other ({string.Join(", ", accessors.Others.Select(names.Method).Order(StringComparer.Ordinal))})");
            }
            foreach (var method in type.GetMethods().Select(reader.GetMethodDefinition))
            {
                var head = $"method {reader.GetString(method.Name)} {names.Signature(method.DecodeSignature(names, null))} {method.Attributes} {method.ImplAttributes}";
                if (method.RelativeVirtualAddress == 0) { lines.Add(head); continue; }
                var body = file.GetMethodBody(method.RelativeVirtualAddress);
                var locals = body.LocalSignature.IsNil ? [] : reader.GetStandaloneSignature(body.LocalSignature).DecodeLocalSignature(names, null);
                var regions = body.ExceptionRegions.Select(region =>
                    $"{region.Kind} {region.TryOffset} {region.TryLength} {region.HandlerOffset} {region.HandlerLength} {region.FilterOffset} {(region.CatchType.IsNil ? "" : names.Type(region.CatchType))}");
                // The stack size and the flag for cleared locals stand in the header of the method, and a method with a wrong header does not run as its instructions say.
                lines.Add($"{head} stack {body.MaxStack} cleared {body.LocalVariablesInitialized} locals ({string.Join(", ", locals)}) regions ({string.Join("; ", regions)}) {names.Instructions(body.GetILBytes()!)}");
            }
            // Members are compared as a set per type: two builds of the same source can number them differently only through file order.
            types.Add(names.Type(handle), [lines[0], .. lines.Skip(1).Order(StringComparer.Ordinal)]);
        }
        return types;
    }

    /// <summary>The first place where two listings differ, as a type and what is different there, or null when they are the same.</summary>
    public static string? Difference(SortedDictionary<string, string[]> built, SortedDictionary<string, string[]> compiled)
    {
        foreach (var type in built.Keys.Union(compiled.Keys).Order(StringComparer.Ordinal))
        {
            if (!built.TryGetValue(type, out var left)) return $"{type}, which the built program does not have";
            if (!compiled.TryGetValue(type, out var right)) return $"{type}, which only the built program has";
            if (left.SequenceEqual(right)) continue;
            var member = left.Except(right).Concat(right.Except(left)).First().Split(' ').Take(2);
            return $"{type}, in its {string.Join(" ", member)}";
        }
        return null;
    }

    /// <summary>Writes the rows of one assembly's tables as names.</summary>
    private sealed class Names(MetadataReader reader) : ISignatureTypeProvider<string, object?>
    {
        private static readonly Dictionary<ushort, OpCode> Codes = typeof(OpCodes).GetFields()
            .Select(field => (OpCode)field.GetValue(null)!).ToDictionary(code => (ushort)code.Value);

        public string Type(EntityHandle handle) => handle.Kind switch
        {
            HandleKind.TypeDefinition => GetTypeFromDefinition(reader, (TypeDefinitionHandle)handle, 0),
            HandleKind.TypeReference => GetTypeFromReference(reader, (TypeReferenceHandle)handle, 0),
            _ => reader.GetTypeSpecification((TypeSpecificationHandle)handle).DecodeSignature(this, null)
        };

        public string Signature(MethodSignature<string> signature) =>
            $"{signature.Header.CallingConvention} {signature.GenericParameterCount} {signature.ReturnType}({string.Join(", ", signature.ParameterTypes)})";

        public string Method(MethodDefinitionHandle handle) => handle.IsNil ? "" : Member(handle);

        private string Member(EntityHandle handle)
        {
            switch (handle.Kind)
            {
                case HandleKind.MethodDefinition:
                    var method = reader.GetMethodDefinition((MethodDefinitionHandle)handle);
                    return $"{Type(method.GetDeclaringType())}::{reader.GetString(method.Name)} {Signature(method.DecodeSignature(this, null))}";
                case HandleKind.FieldDefinition:
                    var field = reader.GetFieldDefinition((FieldDefinitionHandle)handle);
                    return $"{Type(field.GetDeclaringType())}::{reader.GetString(field.Name)} {field.DecodeSignature(this, null)}";
                case HandleKind.MemberReference:
                    var member = reader.GetMemberReference((MemberReferenceHandle)handle);
                    var parent = member.Parent.Kind == HandleKind.MethodDefinition ? Member(member.Parent) : Type(member.Parent);
                    return $"{parent}::{reader.GetString(member.Name)} "
                        + (member.GetKind() == MemberReferenceKind.Field ? member.DecodeFieldSignature(this, null) : Signature(member.DecodeMethodSignature(this, null)));
                case HandleKind.MethodSpecification:
                    var instance = reader.GetMethodSpecification((MethodSpecificationHandle)handle);
                    return $"{Member(instance.Method)}<{string.Join(", ", instance.DecodeSignature(this, null))}>";
                case HandleKind.StandaloneSignature:
                    return Signature(reader.GetStandaloneSignature((StandaloneSignatureHandle)handle).DecodeMethodSignature(this, null));
                default: return Type(handle);
            }
        }

        public string Instructions(byte[] code)
        {
            var text = new StringBuilder();
            for (var at = 0; at < code.Length;)
            {
                var operation = code[at] == 0xFE ? Codes[(ushort)(0xFE00 | code[at + 1])] : Codes[code[at]];
                at += operation.Size;
                var size = operation.OperandType switch
                {
                    OperandType.InlineNone => 0,
                    OperandType.ShortInlineBrTarget or OperandType.ShortInlineI or OperandType.ShortInlineVar => 1,
                    OperandType.InlineVar => 2,
                    OperandType.InlineI8 or OperandType.InlineR => 8,
                    OperandType.InlineSwitch => 4 + 4 * BitConverter.ToInt32(code, at),
                    _ => 4
                };
                var operand = operation.OperandType switch
                {
                    OperandType.InlineString => "\"" + reader.GetUserString(MetadataTokens.UserStringHandle(BitConverter.ToInt32(code, at) & 0xFFFFFF)) + "\"",
                    OperandType.InlineMethod or OperandType.InlineField or OperandType.InlineType or OperandType.InlineTok or OperandType.InlineSig
                        => Member(MetadataTokens.EntityHandle(BitConverter.ToInt32(code, at))),
                    _ => Convert.ToHexString(code, at, size)
                };
                text.Append(operation.Name).Append(' ').Append(operand).Append("; ");
                at += size;
            }
            return text.ToString();
        }

        public string GetPrimitiveType(PrimitiveTypeCode typeCode) => typeCode.ToString();

        public string GetTypeFromDefinition(MetadataReader from, TypeDefinitionHandle handle, byte rawTypeKind)
        {
            var type = from.GetTypeDefinition(handle);
            var name = from.GetString(type.Name);
            if (!type.GetDeclaringType().IsNil) return GetTypeFromDefinition(from, type.GetDeclaringType(), 0) + "+" + name;
            return type.Namespace.IsNil ? name : from.GetString(type.Namespace) + "." + name;
        }

        public string GetTypeFromReference(MetadataReader from, TypeReferenceHandle handle, byte rawTypeKind)
        {
            var type = from.GetTypeReference(handle);
            var name = from.GetString(type.Name);
            if (type.ResolutionScope.Kind == HandleKind.TypeReference) return GetTypeFromReference(from, (TypeReferenceHandle)type.ResolutionScope, 0) + "+" + name;
            var scope = type.ResolutionScope.Kind == HandleKind.AssemblyReference ? from.GetString(from.GetAssemblyReference((AssemblyReferenceHandle)type.ResolutionScope).Name) : "";
            return $"[{scope}]{(type.Namespace.IsNil ? name : from.GetString(type.Namespace) + "." + name)}";
        }

        public string GetTypeFromSpecification(MetadataReader from, object? context, TypeSpecificationHandle handle, byte rawTypeKind) =>
            from.GetTypeSpecification(handle).DecodeSignature(this, context);

        public string GetSZArrayType(string elementType) => elementType + "[]";
        public string GetArrayType(string elementType, ArrayShape shape) => $"{elementType}[{shape.Rank}]";
        public string GetByReferenceType(string elementType) => elementType + "&";
        public string GetPointerType(string elementType) => elementType + "*";
        public string GetPinnedType(string elementType) => elementType + " pinned";
        public string GetGenericInstantiation(string genericType, ImmutableArray<string> typeArguments) => $"{genericType}<{string.Join(", ", typeArguments)}>";
        public string GetGenericTypeParameter(object? context, int index) => "!" + index;
        public string GetGenericMethodParameter(object? context, int index) => "!!" + index;
        public string GetFunctionPointerType(MethodSignature<string> signature) => "fn " + Signature(signature);
        public string GetModifiedType(string modifier, string unmodifiedType, bool isRequired) => $"{unmodifiedType} {(isRequired ? "modreq" : "modopt")}({modifier})";
    }
}
