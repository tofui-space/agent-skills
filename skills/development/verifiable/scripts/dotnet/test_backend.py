"""Behavioral regressions for the standalone decision backend. No test packages."""
import copy
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent.parent


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        workspace = Path(tempfile.gettempdir()) / "verifiable-workspace"
        workspace.mkdir(exist_ok=True)
        cls.build = tempfile.TemporaryDirectory(dir=workspace)
        cls.addClassCleanup(cls.build.cleanup)
        subprocess.run(["dotnet", "build", "--nologo", "--artifacts-path", cls.build.name], cwd=HERE, check=True)
        cls.dll = Path(cls.build.name) / "bin/Verifiable/debug/Verifiable.dll"

    def setUp(self):
        workspace = Path(tempfile.gettempdir()) / "verifiable-workspace"
        workspace.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=workspace)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "Decision.cs"
        self.spec = self.root / "Decision.spec.json"
        self.out = self.root / "obligations.json"
        self.source.write_text((SKILL / "assets/csharp/Decision.cs").read_text(), encoding="utf-8")
        self.original = json.loads((SKILL / "assets/csharp/Decision.spec.json").read_text())
        self.write_spec(self.original)

    def write_spec(self, spec):
        self.spec.write_text(json.dumps(spec), encoding="utf-8")

    def run_tool(self, command, ok=True, extra=None):
        args = ["dotnet", str(self.dll), command]
        if command != "capabilities":
            args += [f"--source={self.source}"]
        if command in ("inventory", "check", "run"):
            args += [f"--spec={self.spec}", f"--out={self.out}"]
        result = subprocess.run(args + (extra or []), capture_output=True, text=True)
        self.assertEqual(result.returncode, 0 if ok else 1, result.stdout + result.stderr)
        return result.stdout + result.stderr

    def test_complete_domain_executes_and_paths_does_not_write(self):
        paths = json.loads(self.run_tool("paths"))
        self.assertEqual(paths["units"][0]["cases"], 4)
        self.assertEqual(paths["units"][0]["claim"], "every input")
        self.assertFalse(self.out.exists())
        report = json.loads(self.run_tool("inventory"))
        self.assertEqual(len(report["units"][0]["checks"]), 4)
        self.assertEqual(report["schema"], "verifiable.csharp/6")
        self.assertRegex(report["compiler"], r"^\d+\.\d+\.\d+")
        self.assertNotRegex(report["compiler"], r"^\d+\.\d+\.\d+\.\d+$")
        self.assertTrue(report["runtime"].startswith(".NET "), report["runtime"])
        self.assertIn("CURRENT", self.run_tool("check"))
        self.assertIn("PASS Example.Decision.CanBorrow 4 checks (every input)", self.run_tool("run"))

    def test_seeded_wrong_behavior_fails_after_fresh_inventory(self):
        self.source.write_text(self.source.read_text().replace("!suspended", "suspended"))
        self.run_tool("inventory")
        self.assertIn("FAIL", self.run_tool("run", ok=False))

    def test_stale_source_spec_and_tampered_obligations_fail(self):
        for command in ("check", "run"):
            for kind in ("source", "spec", "artifact"):
                with self.subTest(command=command, kind=kind):
                    self.run_tool("inventory")
                    target = {"source": self.source, "spec": self.spec, "artifact": self.out}[kind]
                    old = target.read_text()
                    target.write_text(old.replace("csharp-decision-v5", "other") if kind == "artifact" else old + "\n")
                    self.assertIn("STALE", self.run_tool(command, ok=False))
                    target.write_text(old)

    def test_bad_specs_fail_without_writing_inventory(self):
        reasons = {"duplicate_row": "two rows cover the same combination of cells", "long_row": "row input must match parameters",
                   "short_row": "row input must match parameters", "missing_row": "the rows must cover each of the 4 combinations of cells; 1 of them have no row",
                   "parameter_order": "parameter names/order changed", "extra_unit": "spec must name exactly every admitted method",
                   "blank_requirement": "requirement, parameters, rows and unsettled are required",
                   "blank_unsettled": "unsettled entries must contain text"}
        for kind in ("missing_row", "duplicate_row", "parameter_order", "missing_outcome", "extra_property", "extra_unit",
                     "null_row", "blank_requirement", "blank_unsettled", "long_row", "short_row"):
            with self.subTest(kind=kind):
                spec = copy.deepcopy(self.original)
                unit = spec["units"]["Example.Decision.CanBorrow"]
                if kind == "missing_row": unit["rows"].pop()
                if kind == "duplicate_row": unit["rows"][1] = unit["rows"][0]
                if kind == "parameter_order": unit["parameters"].reverse()
                if kind == "missing_outcome": del unit["rows"][0]["outcome"]
                if kind == "extra_property": unit["ignore"] = True
                if kind == "extra_unit": spec["units"]["Other"] = unit
                if kind == "null_row": unit["rows"][0] = None
                if kind == "blank_requirement": unit["requirement"] = "  "
                if kind == "blank_unsettled": unit["unsettled"] = [" "]
                if kind == "long_row": unit["rows"][0]["input"].append(False)
                if kind == "short_row": unit["rows"][0]["input"].pop()
                self.write_spec(spec)
                self.assertIn(reasons.get(kind, "REJECTED"), self.run_tool("inventory", ok=False))
                self.assertFalse(self.out.exists())

    def test_duplicate_json_keys_fail(self):
        self.spec.write_text('{"units":{},"units":{}}')
        self.assertIn("duplicate spec key", self.run_tool("inventory", ok=False))

    def test_unsupported_code_rejects_whole_file(self):
        method_rule = "only public static methods of a class and public methods of a readonly struct"
        parameter_rule = "parameters are bool, integers, double, strings, and enums and records declared in the file"
        result_rule = "the result is bool, an enum declared in the file, int, long, double, or the record type of exactly one parameter"
        class_rule = "only public static classes and public readonly structs"
        cases = [
            ("public static bool Decide(bool x) => System.Boolean.Parse(\"true\");", "unsupported expression InvocationExpression"),
            ("public static bool Decide(bool x) { while (x) {} return x; }", "unsupported statement WhileStatement"),
            ("public static bool Decide(bool x) { x = !x; return x; }", "unsupported statement ExpressionStatement"),
            ("public static bool Decide(bool x) => throw new System.Exception();", "unsupported expression ThrowExpression"),
            ("public static bool Decide(bool? x) => x == true;", parameter_rule),
            ("public static bool Decide(bool x) { bool y = x; return y; }", "unsupported statement LocalDeclarationStatement"),
            ("public static bool field = true; public static bool Decide(bool x) => field;", class_rule),
            ("static Decision() {} public static bool Decide(bool x) => x;", class_rule),
            ("public static bool Decide(bool x) => missing;", "CS0103"),
            ("public static bool Decide(bool x = true) => x;", parameter_rule),
            ("public static object Decide(bool x) => x;", result_rule),
            ("internal static bool Decide(bool x) => x;", method_rule),
            ("public static bool Decide(this bool x) => x;", parameter_rule),
            ("public static bool Decide(ref bool x) => x;", parameter_rule),
            ("public static bool Decide(in bool x) => x;", parameter_rule),
            ("public static bool Decide(bool x) => (bool)x;", "unsupported expression CastExpression"),
            ("public static bool Decide(bool x, __arglist) => x;", method_rule),
            ("public static bool Decide(bool x) => checked(x);", "checked and unchecked are unsupported"),
            ("public static bool Decide(bool x) { unchecked { return x; } }", "checked and unchecked are unsupported"),
            ("public static bool Decide(bool c, bool x, bool y) => c ? ref x : ref y;", "unsupported expression ConditionalExpression"),
            ("public static bool Decide(bool x) => 1 == 1;", "unsupported expression NumericLiteralExpression"),
            ("public static bool Decide(bool x) => System.BitConverter.IsLittleEndian;", "unsupported expression SimpleMemberAccessExpression"),
        ]
        for method, reason in cases:
            with self.subTest(method=method):
                self.source.write_text("public static class Decision { " + method + " }")
                output = self.run_tool("paths", ok=False)
                self.assertIn("REJECTED", output)
                self.assertIn(reason, output)
        for source in ("public class Decision { public static bool Decide(bool x) => x; }",
                       "public sealed class Decision { public static bool Decide(bool x) => x; }",
                       "public partial class Decision { public static bool Decide(bool x) => x; }",
                       "static partial class Decision { public static bool Decide(bool x) => x; }",
                       "public static class Decision<T> { public static bool Decide(bool x) => x; }"):
            with self.subTest(source=source):
                self.source.write_text(source)
                self.assertIn(class_rule, self.run_tool("paths", ok=False))
        self.source.write_text("using System; public static class Decision { public static bool Decide(bool x) => x; }")
        self.assertIn("using directives", self.run_tool("paths", ok=False))
        self.source.write_text("namespace Outer { using System; public static class Decision { public static bool Decide(bool x) => x; } }")
        self.assertIn("namespace imports are unsupported", self.run_tool("paths", ok=False))
        self.source.write_text("public struct Decision { }")
        self.assertIn(class_rule, self.run_tool("paths", ok=False))
        self.source.write_text("public interface IDecision { }")
        self.assertIn("unsupported declaration", self.run_tool("paths", ok=False))
        self.source.write_text("namespace Empty;")
        self.assertIn("no decision methods", self.run_tool("paths", ok=False))
        self.source.write_text("#if false\nclass Hidden {}\n#endif\npublic static class Decision { public static bool Decide() => true; }")
        self.assertIn("directives", self.run_tool("paths", ok=False))

    def test_blocks_boolean_operators_and_zero_parameters(self):
        self.source.write_text("public static class Decision { public static bool Decide() { if (true == !false && (false != true || false)) { return (true & false) | (true ^ false); } else return false ? true : false; } }")
        self.write_spec({"units": {"Decision.Decide": {"requirement": "Always true", "parameters": [], "rows": [{"input": [], "outcome": True}], "unsettled": ["Requirement awaits review"]}}})
        self.run_tool("inventory")
        result = self.run_tool("run")
        self.assertIn("1 checks", result)
        self.assertIn("UNSETTLED", result)

    def test_domain_limit_and_overloads(self):
        def source(count):
            parameters = ", ".join(f"bool p{i}" for i in range(count))
            return f"public static class Decision {{ public static bool Decide({parameters}) => {" ^ ".join(f"p{i}" for i in range(count))}; }}"
        self.source.write_text(source(12))
        self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["cases"], 4096)
        self.source.write_text(source(13))
        self.assertIn("8192 checks exceed the limit of 4096", self.run_tool("paths", ok=False))
        self.source.write_text("public static class Decision { public static bool Decide() => true; public static bool Decide(bool x) => x; }")
        self.assertIn("overloads", self.run_tool("paths", ok=False))

    def test_multiple_methods_and_escaped_identifiers(self):
        self.source.write_text("namespace @event; public static class @class { public static bool @return(bool x) => x; public static bool Other(bool x) => !x; }")
        names = [u["name"] for u in json.loads(self.run_tool("paths"))["units"]]
        units = {}
        for name in names:
            identity = name.endswith(".return")
            units[name] = {"requirement": "Identity" if identity else "Negation", "parameters": ["x"],
                           "rows": [{"input": [False], "outcome": not identity}, {"input": [True], "outcome": identity}], "unsettled": []}
        self.write_spec({"units": units})
        self.run_tool("inventory")
        self.assertEqual(self.run_tool("run").count("PASS "), 2)

    def use_example(self, name):
        self.source.write_text((SKILL / f"assets/csharp/{name}.cs").read_text(), encoding="utf-8")
        spec = json.loads((SKILL / f"assets/csharp/{name}.spec.json").read_text())
        self.write_spec(spec)
        return spec

    def test_enum_cells_include_the_unnamed_value_and_execute(self):
        self.use_example("LoanPeriod")
        unit = json.loads(self.run_tool("paths"))["units"][0]
        self.assertEqual(unit["cases"], 6)
        self.assertEqual(unit["claim"], "cells")
        self.assertEqual(unit["domains"][0], {"parameter": "membership", "type": "Example.Membership",
                                              "values": ["Standard", "Staff", "#unnamed"], "unnamed": "0"})
        self.assertEqual(unit["domains"][1]["values"], [False, True])
        report = json.loads(self.run_tool("inventory"))
        self.assertEqual(report["units"][0]["claim"], "cells")
        self.assertEqual(report["units"][0]["checks"][2], {"input": ["#unnamed", False], "expected": "Refused"})
        self.assertIn("PASS Example.Lending.LoanPeriod 6 checks (cells)", self.run_tool("run"))

    def test_enum_seeded_faults_fail_on_named_and_unnamed_cells(self):
        faults = [
            ("Membership.Staff => Period.FourWeeks", "Membership.Staff => Period.TwoWeeks",
             "FAIL Example.Lending.LoanPeriod(Staff,False): expected FourWeeks, got TwoWeeks"),
            ("_ => Period.Refused", "_ => Period.TwoWeeks",
             "FAIL Example.Lending.LoanPeriod(#unnamed,False): expected Refused, got TwoWeeks"),
        ]
        for old, new, message in faults:
            with self.subTest(fault=new):
                self.use_example("LoanPeriod")
                text = self.source.read_text()
                self.assertIn(old, text)
                self.source.write_text(text.replace(old, new))
                self.run_tool("inventory")
                self.assertIn(message, self.run_tool("run", ok=False))

    def test_enum_specs_must_cover_and_name_every_cell(self):
        cases = [
            ("missing_unnamed", "the rows must cover each of the 6 combinations of cells; 2 of them have no row"),
            ("unknown_member", "row input must match parameters; membership accepts Standard, Staff, #unnamed"),
            ("bool_for_enum", "row input must match parameters"),
            ("text_for_bool", "row input must match parameters; reference accepts False, True"),
            ("number_for_bool", "row input must match parameters"),
            ("unknown_outcome", "row outcome must be one of Refused, TwoWeeks, FourWeeks\n"),
            ("unnamed_outcome", "row outcome must be one of Refused, TwoWeeks, FourWeeks\n"),
            ("bool_outcome", "row outcome must be one of"),
        ]
        for kind, message in cases:
            with self.subTest(kind=kind):
                spec = self.use_example("LoanPeriod")
                rows = spec["units"]["Example.Lending.LoanPeriod"]["rows"]
                if kind == "missing_unnamed": rows[:] = [r for r in rows if r["input"][0] != "#unnamed"]
                if kind == "unknown_member": rows[0]["input"][0] = "Gold"
                if kind == "bool_for_enum": rows[0]["input"][0] = True
                if kind == "text_for_bool": rows[0]["input"][1] = "false"
                if kind == "number_for_bool": rows[0]["input"][1] = 0
                if kind == "unknown_outcome": rows[0]["outcome"] = "Forever"
                if kind == "unnamed_outcome": rows[2]["outcome"] = "#unnamed"
                if kind == "bool_outcome": rows[0]["outcome"] = True
                self.write_spec(spec)
                self.assertIn(message, self.run_tool("inventory", ok=False))
                self.assertFalse(self.out.exists())

    def test_admitted_enum_forms_agree_with_a_reference(self):
        self.source.write_text("""namespace Shop;
public enum Tier : byte { Basic = 1, Gold = 2 }
public enum Level : long { Low = -1, High = 5000000000 }
public enum Mode { Off, On }
public static class Rules
{
    public static bool IsNamed(Tier t) => t is Tier.Basic or Tier.Gold;
    public static bool IsOther(Tier t) => t is not (Tier.Basic or Tier.Gold);
    public static bool NotGold(Tier t) => Tier.Gold != t;
    public static Tier Promote(Tier t, bool paid) => t switch { Tier.Gold => Tier.Gold, _ => paid ? Tier.Gold : Tier.Basic };
    public static Level Flip(Level l) => l switch { Level.Low => Level.High, _ => Level.Low };
    public static bool Both(Tier t, Level l) { if (t == Tier.Gold) { return l == Level.High; } return false; }
    public static bool Negate(bool b) => b switch { true => false, false => true };
    public static bool IsOff(Mode m) => m == Mode.Off;
    public static bool OnlyBasic(Tier t) => t is Tier.Basic and not Tier.Gold;
    public static bool Rest(Tier t) => t switch { Tier.Basic => false, not Tier.Basic => true };
    public static bool Last(Tier t) => t switch { Tier.Basic => true, var _ => false };
}
""")
        tier, level, flag = ["Basic", "Gold", "#unnamed"], ["Low", "High", "#unnamed"], [False, True]
        reference = {
            "IsNamed": (["t"], [tier], lambda t: t != "#unnamed"),
            "IsOther": (["t"], [tier], lambda t: t == "#unnamed"),
            "NotGold": (["t"], [tier], lambda t: t != "Gold"),
            "Promote": (["t", "paid"], [tier, flag], lambda t, paid: "Gold" if paid or t == "Gold" else "Basic"),
            "Flip": (["l"], [level], lambda l: "High" if l == "Low" else "Low"),
            "Both": (["t", "l"], [tier, level], lambda t, l: t == "Gold" and l == "High"),
            "Negate": (["b"], [flag], lambda b: not b),
            "IsOff": (["m"], [["Off", "On", "#unnamed"]], lambda m: m == "Off"),
            "OnlyBasic": (["t"], [tier], lambda t: t == "Basic"),
            "Rest": (["t"], [tier], lambda t: t != "Basic"),
            "Last": (["t"], [tier], lambda t: t == "Basic"),
        }
        units = {}
        for name, (parameters, values, outcome) in reference.items():
            rows = [{"input": list(row), "outcome": outcome(*row)} for row in itertools.product(*values)]
            units[f"Shop.Rules.{name}"] = {"requirement": name, "parameters": parameters, "rows": rows, "unsettled": []}
        self.write_spec({"units": units})
        paths = {u["name"]: u for u in json.loads(self.run_tool("paths"))["units"]}
        self.assertEqual(paths["Shop.Rules.Both"]["cases"], 9)
        self.assertEqual(paths["Shop.Rules.Flip"]["domains"][0]["unnamed"], "0")
        self.assertEqual(paths["Shop.Rules.IsOff"]["domains"][0]["unnamed"], "2")
        self.assertEqual(paths["Shop.Rules.Negate"]["claim"], "every input")
        self.run_tool("inventory")
        self.assertEqual(self.run_tool("run").count("PASS "), len(reference))

    def test_unsupported_enum_code_rejects_with_its_reason(self):
        tier = "public enum Tier { Basic = 1, Gold = 2 } "
        parameter_rule = "parameters are bool, integers, double, strings, and enums and records declared in the file"
        result_rule = "the result is bool, an enum declared in the file, int, long, double, or the record type of exactly one parameter"
        enum_rule = "only public enums without attributes"
        input_rule = "an enum input can only be compared with a named member or matched by a pattern"
        cases = [
            (tier, "public static bool Decide(Tier t) => t switch { Tier.Basic => true, Tier.Gold => false };", "add a discard arm"),
            (tier, "public static bool Decide(Tier t, Tier u) => t == u;", "unsupported expression EqualsExpression"),
            (tier, "public static bool Decide(bool b) => Tier.Basic == Tier.Gold;", "unsupported expression EqualsExpression"),
            (tier, "public static bool Decide(Tier t, bool b) => (b ? t : Tier.Gold) != Tier.Basic;", input_rule),
            (tier, "public static Tier Decide(Tier t) => t;", input_rule),
            (tier, "public static Tier Decide(Tier t, bool b) => b ? Tier.Gold : t;", input_rule),
            (tier, "public static Tier Decide(Tier t) => t switch { Tier.Basic => Tier.Gold, _ => t };", input_rule),
            (tier, "public static Tier Decide(Tier t) { if (t == Tier.Gold) return Tier.Basic; return t; }", input_rule),
            (tier, "public static bool Decide(Tier t) => t > Tier.Basic;", "unsupported expression GreaterThanExpression"),
            (tier, "public static bool Decide(Tier t) => t == 0;", "unsupported expression NumericLiteralExpression"),
            (tier, "public static bool Decide(Tier t) => t is 0;", "unsupported pattern ConstantPattern"),
            (tier, "public static bool Decide(Tier t) => t switch { 0 => true, _ => false };", "unsupported pattern ConstantPattern"),
            (tier, "public static bool Decide(Tier t) => t is > Tier.Basic;", "unsupported pattern RelationalPattern"),
            (tier, "public static Tier Decide(Tier t) => ~t;", "unsupported expression BitwiseNotExpression"),
            (tier, "public static bool Decide(Tier t) => t is Tier;", "unsupported expression IsExpression"),
            (tier, "public static bool Decide(Tier t) => (int)t == 1;", "unsupported expression CastExpression"),
            (tier, "public static Tier Decide(Tier t) => t | Tier.Gold;", "unsupported expression BitwiseOrExpression"),
            (tier, "public static Tier Decide(bool b) => default;", "unsupported expression DefaultLiteralExpression"),
            (tier, "public static bool Decide(Tier t) => t switch { Tier.Basic when true => true, _ => false };", "unsupported switch guard"),
            (tier, "public static bool Decide(Tier t, bool b) => (t == Tier.Gold) switch { true => b, false => !b };", "unsupported expression SwitchExpression"),
            (tier, "public static bool Decide(bool a, bool b) => (a && b) is true;", "unsupported expression IsPatternExpression"),
            (tier, "public static bool Decide(Tier? t) => t == Tier.Gold;", parameter_rule),
            ("", "public static bool Decide(System.DayOfWeek d) => d == System.DayOfWeek.Monday;", parameter_rule),
            ("public enum Twice { A = 1, B = 1 } ", "public static bool Decide(bool b) => b;", "enum members must have distinct values"),
            ("[System.Flags] public enum Marked { A = 1 } ", "public static bool Decide(bool b) => b;", enum_rule),
            ("public enum Marked { [System.Obsolete] A = 1 } ", "public static bool Decide(bool b) => b;", enum_rule),
            ("enum Hidden { A } ", "public static bool Decide(bool b) => b;", enum_rule),
            ("public enum Full : byte { " + ", ".join(f"M{i}" for i in range(256)) + " } ", "public static bool Decide(bool b) => b;", "no unnamed cell can be formed"),
            ("public enum Half : sbyte { " + ", ".join(f"M{i}" for i in range(128)) + " } ", "public static bool Decide(bool b) => b;", "no unnamed cell can be formed"),
        ]
        for declarations, method, reason in cases:
            with self.subTest(method=method, declarations=declarations[:40]):
                self.source.write_text(declarations + "public static class Decision { " + method + " }")
                output = self.run_tool("paths", ok=False)
                self.assertIn("REJECTED", output)
                self.assertIn(reason, output)
        self.source.write_text("public static class Decision { public enum Inner { A } public static bool Decide(bool b) => b; }")
        self.assertIn("only public static classes and public readonly structs", self.run_tool("paths", ok=False))

    def test_enum_cell_limit(self):
        def source(members):
            names = ", ".join(f"M{i}" for i in range(members))
            return f"public enum Wide {{ {names} }} public static class Decision {{ public static bool Decide(Wide a, Wide b) => a == Wide.M0; }}"
        self.source.write_text(source(63))
        self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["cases"], 4096)
        self.source.write_text(source(64))
        self.assertIn("4225 checks exceed the limit of 4096", self.run_tool("paths", ok=False))

    def test_record_cells_are_the_product_of_the_fields_and_execute(self):
        spec = self.use_example("Renewal")
        unit = json.loads(self.run_tool("paths"))["units"][0]
        self.assertEqual(unit["cases"], 12)
        self.assertEqual(unit["claim"], "cells")
        self.assertEqual([d["parameter"] for d in unit["domains"]], ["request.Membership", "request.Overdue", "request.Reserved"])
        self.assertEqual(unit["domains"][0]["values"], ["Standard", "Staff", "#unnamed"])
        for row in spec["units"]["Example.Renewals.CanRenew"]["rows"]:
            row["input"][0] = dict(reversed(row["input"][0].items()))
        self.write_spec(spec)
        text = self.run_tool("inventory")
        report = json.loads(text)
        self.assertEqual(report["schema"], "verifiable.csharp/6")
        self.assertEqual(report["units"][0]["parameters"], ["request"])
        self.assertEqual(report["units"][0]["checks"][5],
                         {"input": [{"Membership": "#unnamed", "Overdue": True, "Reserved": False}], "expected": False})
        self.assertRegex(text, r'"Membership": "#unnamed",\s+"Overdue": true,\s+"Reserved": false')
        self.assertIn("PASS Example.Renewals.CanRenew 12 checks (cells)", self.run_tool("run"))

    def test_record_seeded_faults_fail_on_named_and_unnamed_field_cells(self):
        faults = [
            ("{ Membership: Membership.Staff } => true", "{ Membership: Membership.Staff } => false",
             "FAIL Example.Renewals.CanRenew({Membership=Staff,Overdue=False,Reserved=False}): expected True, got False"),
            ("_ => false", "_ => true",
             "FAIL Example.Renewals.CanRenew({Membership=#unnamed,Overdue=False,Reserved=False}): expected False, got True"),
        ]
        for old, new, message in faults:
            with self.subTest(fault=new):
                self.use_example("Renewal")
                text = self.source.read_text()
                self.assertIn(old, text)
                self.source.write_text(text.replace(old, new))
                self.run_tool("inventory")
                self.assertIn(message, self.run_tool("run", ok=False))

    def test_record_specs_must_name_every_field(self):
        fields = "request takes an object with fields among Membership, Overdue, Reserved"
        cases = [
            ("array_for_record", fields),
            ("scalar_for_record", fields),
            ("missing_field", "two rows cover the same combination of cells"),
            ("extra_field", fields),
            ("misspelled_field", fields),
            ("unknown_member", "row input must match parameters; request.Membership accepts Standard, Staff, #unnamed"),
            ("text_for_bool", "row input must match parameters; request.Overdue accepts False, True"),
            ("object_for_field", "row input must match parameters; request.Reserved accepts False, True"),
            ("missing_row", "the rows must cover each of the 12 combinations of cells; 1 of them have no row"),
            ("duplicate_row", "two rows cover the same combination of cells"),
        ]
        for kind, message in cases:
            with self.subTest(kind=kind):
                spec = self.use_example("Renewal")
                rows = spec["units"]["Example.Renewals.CanRenew"]["rows"]
                first = rows[0]["input"][0]
                if kind == "array_for_record": rows[0]["input"][0] = ["Standard", False, False]
                if kind == "scalar_for_record": rows[0]["input"][0] = "Standard"
                if kind == "missing_field": del first["Reserved"]
                if kind == "extra_field": first["Late"] = False
                if kind == "misspelled_field": first["reserved"] = first.pop("Reserved")
                if kind == "unknown_member": first["Membership"] = "Gold"
                if kind == "text_for_bool": first["Overdue"] = "false"
                if kind == "object_for_field": first["Reserved"] = {"Reserved": False}
                if kind == "missing_row": rows.pop()
                if kind == "duplicate_row": rows[1] = rows[0]
                self.write_spec(spec)
                self.assertIn(message, self.run_tool("inventory", ok=False))
                self.assertFalse(self.out.exists())
        spec = copy.deepcopy(self.original)
        self.source.write_text((SKILL / "assets/csharp/Decision.cs").read_text(), encoding="utf-8")
        unit = spec["units"]["Example.Decision.CanBorrow"]
        unit["rows"][0]["input"][0] = {unit["parameters"][0]: unit["rows"][0]["input"][0]}
        self.write_spec(spec)
        self.assertIn(f"row input must match parameters; {unit['parameters'][0]} accepts False, True", self.run_tool("inventory", ok=False))

    def test_admitted_record_forms_agree_with_a_reference(self):
        self.source.write_text("""namespace Desk;
public enum Tier : byte { Basic = 1, Gold = 2 }
public enum Mode { Off, On }
public readonly record struct Ticket(Tier Tier, bool Paid);
public readonly record struct Switches(bool Left, bool Right);
public readonly record struct Plan(Mode Mode, Tier Tier);
public static class Rules
{
    public static bool Access(Ticket ticket) => ticket.Paid && ticket.Tier == Tier.Gold;
    public static bool Flipped(Ticket ticket) => Tier.Basic != ticket.Tier || !ticket.Paid;
    public static bool Match(Ticket ticket) => ticket is { Tier: Tier.Gold or Tier.Basic, Paid: true };
    public static bool Typed(Ticket ticket) => ticket is Ticket { Paid: false };
    public static bool Negated(Ticket ticket) => ticket is not { Tier: Tier.Gold };
    public static Tier Table(Ticket ticket) => ticket switch
    {
        { Paid: true, Tier: not Tier.Basic } => Tier.Gold,
        { Paid: true } => Tier.Basic,
        _ => Tier.Basic
    };
    public static bool Both(Switches s) => s switch { { Left: true, Right: true } => true, { Left: false } => false, { Right: false } => false };
    public static bool Mixed(Ticket ticket, bool open, Plan plan) { if (open) { return plan.Mode == Mode.On && ticket.Paid; } return plan is { Tier: Tier.Gold }; }
    public static bool Field(Ticket ticket) => ticket.Tier is Tier.Gold;
    public static Mode FieldTable(Plan plan) => plan.Mode switch { Mode.Off => Mode.On, _ => Mode.Off };
    public static bool Twice(Ticket a, Ticket b) => a.Paid == b.Paid;
    public static bool Any(Ticket ticket) => ticket is { };
}
""")
        tier, mode, flag = ["Basic", "Gold", "#unnamed"], ["Off", "On", "#unnamed"], [False, True]
        ticket, switches, plan = {"Tier": tier, "Paid": flag}, {"Left": flag, "Right": flag}, {"Mode": mode, "Tier": tier}
        reference = {
            "Access": ({"ticket": ticket}, lambda ticket: ticket["Paid"] and ticket["Tier"] == "Gold"),
            "Flipped": ({"ticket": ticket}, lambda ticket: ticket["Tier"] != "Basic" or not ticket["Paid"]),
            "Match": ({"ticket": ticket}, lambda ticket: ticket["Tier"] in ("Gold", "Basic") and ticket["Paid"]),
            "Typed": ({"ticket": ticket}, lambda ticket: not ticket["Paid"]),
            "Negated": ({"ticket": ticket}, lambda ticket: ticket["Tier"] != "Gold"),
            "Table": ({"ticket": ticket}, lambda ticket: "Gold" if ticket["Paid"] and ticket["Tier"] != "Basic" else "Basic"),
            "Both": ({"s": switches}, lambda s: s["Left"] and s["Right"]),
            "Mixed": ({"ticket": ticket, "open": flag, "plan": plan},
                      lambda ticket, open, plan: (plan["Mode"] == "On" and ticket["Paid"]) if open else plan["Tier"] == "Gold"),
            "Field": ({"ticket": ticket}, lambda ticket: ticket["Tier"] == "Gold"),
            "FieldTable": ({"plan": plan}, lambda plan: "On" if plan["Mode"] == "Off" else "Off"),
            "Twice": ({"a": ticket, "b": ticket}, lambda a, b: a["Paid"] == b["Paid"]),
            "Any": ({"ticket": ticket}, lambda ticket: True),
        }
        units = {}
        for name, (parameters, outcome) in reference.items():
            shapes = list(parameters.values())
            axes = [axis for shape in shapes for axis in (shape.values() if isinstance(shape, dict) else [shape])]
            rows = []
            for cells in itertools.product(*axes):
                remaining = list(cells)
                values = [{field: remaining.pop(0) for field in shape} if isinstance(shape, dict) else remaining.pop(0)
                          for shape in shapes]
                rows.append({"input": values, "outcome": outcome(*values)})
            units[f"Desk.Rules.{name}"] = {"requirement": name, "parameters": list(parameters), "rows": rows, "unsettled": []}
        self.write_spec({"units": units})
        paths = {u["name"]: u for u in json.loads(self.run_tool("paths"))["units"]}
        self.assertEqual(paths["Desk.Rules.Mixed"]["cases"], 108)
        self.assertEqual([d["parameter"] for d in paths["Desk.Rules.Mixed"]["domains"]],
                         ["ticket.Tier", "ticket.Paid", "open", "plan.Mode", "plan.Tier"])
        self.assertEqual(paths["Desk.Rules.Both"]["claim"], "every input")
        self.assertEqual(paths["Desk.Rules.Table"]["claim"], "cells")
        self.run_tool("inventory")
        self.assertEqual(self.run_tool("run").count("PASS "), len(reference))

    def test_unsupported_record_code_rejects_with_its_reason(self):
        ticket = "public enum Tier { Basic = 1, Gold = 2 } public readonly record struct Ticket(Tier Tier, bool Paid); "
        plain = "public static bool Decide(bool b) => b;"
        parameter_rule = "parameters are bool, integers, double, strings, and enums and records declared in the file"
        result_rule = "the result is bool, an enum declared in the file, int, long, double, or the record type of exactly one parameter"
        record_rule = "Ticket: only public readonly record structs with ordinary positional fields and no other members"
        field_rule = "Ticket: record fields must be bool, integers, double, strings or enums declared in the file"
        cases = [
            ("public record Ticket(bool Paid); ", plain, record_rule),
            ("public record struct Ticket(bool Paid); ", plain, record_rule),
            ("public partial record struct Ticket(bool Paid); ", plain, record_rule),
            ("readonly partial record struct Ticket(bool Paid); ", plain, record_rule),
            ("public readonly partial record struct Ticket(bool Paid); ", plain, record_rule),
            ("public readonly record Ticket(bool Paid); ", plain, "CS0106"),
            ("public readonly record struct Ticket<T>(bool Paid); ", plain, record_rule),
            ("public readonly record struct Ticket(bool Paid) : System.IEquatable<Ticket>; ", plain, record_rule),
            ("[System.Serializable] public readonly record struct Ticket(bool Paid); ", plain, record_rule),
            ("public readonly record struct Ticket(bool Paid) { public bool Free => !Paid; } ", plain, record_rule),
            ("public readonly record struct Ticket(bool Paid = true); ", plain, record_rule),
            ("public readonly record struct Ticket([property: System.Obsolete] bool Paid); ", plain, record_rule),
            ("public readonly record struct Ticket(in bool Paid); ", plain, record_rule),
            ("public readonly record struct Ticket(); ", plain, record_rule),
            ("public readonly record struct Ticket; ", plain, record_rule),
            ("public readonly record struct Ticket(float Count); ", plain, field_rule),
            ("public readonly record struct Ticket(System.DayOfWeek Day); ", plain, field_rule),
            ("public readonly record struct Ticket(bool? Paid); ", plain, field_rule),
            ("public readonly record struct Inner(bool Paid); public readonly record struct Ticket(Inner Inner); ", plain, field_rule),
            (ticket, "public static Ticket Decide(Ticket a, Ticket b) => a;", result_rule),
            (ticket, "public static Ticket Decide(bool b) => default;", result_rule),
            (ticket, "public static bool Decide(Ticket? t) => true;", parameter_rule),
            (ticket, "public static bool Decide(Ticket a, Ticket b) => a == b;", "unsupported expression EqualsExpression"),
            (ticket, "public static bool Decide(Ticket a, Ticket b) => a.Tier == b.Tier;", "unsupported expression EqualsExpression"),
            (ticket, "public static bool Decide(Ticket t) => t.Tier > Tier.Basic;", "unsupported expression GreaterThanExpression"),
            (ticket, "public static bool Decide(Ticket t) => t.Equals(t);", "unsupported expression InvocationExpression"),
            (ticket, "public static bool Decide(Ticket t) => (t with { Paid = true }).Paid;", "unsupported expression SimpleMemberAccessExpression"),
            (ticket, "public static bool Decide(Ticket t) => new Ticket(Tier.Gold, true).Paid;", "unsupported expression SimpleMemberAccessExpression"),
            (ticket, "public static bool Decide(Ticket t) => default(Ticket).Paid;", "unsupported expression SimpleMemberAccessExpression"),
            (ticket, "public static bool Decide(Ticket t, bool b) => (b ? t : t).Paid;", "unsupported expression SimpleMemberAccessExpression"),
            (ticket, "public static bool Decide(Ticket t) => t is (Tier.Gold, true);", "unsupported pattern RecursivePattern"),
            (ticket, "public static bool Decide(Ticket t) => t is { Paid: true } other;", "unsupported pattern RecursivePattern"),
            (ticket, "public static bool Decide(Ticket t) => t is { Paid: var paid };", "unsupported pattern VarPattern"),
            (ticket, "public static bool Decide(Ticket t) => t is { Tier: > Tier.Basic };", "unsupported pattern RelationalPattern"),
            (ticket, "public static bool Decide(Ticket t) => t is { Tier: 0 };", "unsupported pattern ConstantPattern"),
            (ticket, "public static bool Decide(Ticket t) => t is { Tier: { } };", "unsupported pattern RecursivePattern"),
            (ticket, "public static bool Decide(Ticket t) => t.Tier is { };", "unsupported pattern RecursivePattern"),
            (ticket, "public static bool Decide(bool b) => b is { };", "unsupported pattern RecursivePattern"),
            (ticket, "public static bool Decide(Ticket t) => t is System.ValueType { };", "unsupported pattern RecursivePattern"),
            (ticket, "public static bool Decide(Ticket t) => t is Ticket;", "unsupported expression IsExpression"),
            (ticket, "public static Tier Decide(Ticket t) => t.Tier;", "an enum input can only be compared with a named member or matched by a pattern"),
            (ticket, "public static bool Decide(Ticket t) => t switch { { Tier: Tier.Basic } => true, { Tier: Tier.Gold } => false };", "add a discard arm"),
            (ticket, "public static bool Decide(Ticket t) => t switch { { Paid: true } when t.Paid => true, _ => false };", "unsupported switch guard"),
            (ticket, "public static bool Decide(Ticket t) => t switch { var other => true };", "unsupported pattern VarPattern"),
            (ticket, "public static bool Decide(Ticket t) => (t.Paid && t.Paid) switch { true => true, false => false };", "unsupported expression SwitchExpression"),
        ]
        for declarations, method, reason in cases:
            with self.subTest(method=method, declarations=declarations[-70:]):
                self.source.write_text(declarations + "public static class Decision { " + method + " }")
                output = self.run_tool("paths", ok=False)
                self.assertIn("REJECTED", output)
                self.assertIn(reason, output)
        self.source.write_text("public static class Decision { public readonly record struct Inner(bool A); public static bool Decide(bool b) => b; }")
        self.assertIn("only public static classes and public readonly structs", self.run_tool("paths", ok=False))

    def test_record_cell_limit(self):
        def source(fields, extra):
            names = ", ".join(f"bool P{i}" for i in range(fields))
            return (f"public readonly record struct Wide({names}); "
                    f"public static class Decision {{ public static bool Decide(Wide w{extra}) => "
                    f"{" ^ ".join([f"w.P{i}" for i in range(fields)] + (["more"] if extra else []))}; }}")
        self.source.write_text(source(12, ""))
        self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["cases"], 4096)
        self.source.write_text(source(12, ", bool more"))
        self.assertIn("8192 checks exceed the limit of 4096", self.run_tool("paths", ok=False))

    def test_integer_and_string_cells_are_tried_at_both_ends_and_execute(self):
        self.use_example("LateFee")
        unit = json.loads(self.run_tool("paths"))["units"][0]
        self.assertEqual(unit["claim"], "cells")
        self.assertEqual(unit["cases"], 24)
        self.assertEqual(unit["domains"], [
            {"parameter": "daysLate", "type": "int", "values": ["..0", "1..14", "15.."], "unnamed": None},
            {"parameter": "membership", "type": "string", "values": ["staff", "#null", "#other"], "unnamed": None}])
        report = json.loads(self.run_tool("inventory"))
        checks = report["units"][0]["checks"]
        self.assertEqual(report["units"][0]["cases"], 24)
        self.assertEqual([c["input"][0] for c in checks[:6]], [-2147483648, 0, 1, 14, 15, 2147483647])
        self.assertEqual([c["input"][1] for c in checks[::6]], ["staff", None, "", "STAFF"])
        self.assertIn({"input": [15, None], "expected": "Charge"}, checks)
        self.assertIn({"input": [14, "STAFF"], "expected": "Reminder"}, checks)
        self.assertIn("CURRENT", self.run_tool("check"))
        self.assertIn("PASS Example.Fees.LateFee 24 checks (cells)", self.run_tool("run"))

    def test_integer_and_string_seeded_faults_fail_at_the_boundary(self):
        fee = "FAIL Example.Fees.LateFee"
        faults = [
            ("<= 14 =>", "< 14 =>", f"{fee}(14,null): expected Reminder, got Charge"),
            ("<= 14 =>", "<= 13 =>", f"{fee}(14,null): expected Reminder, got Charge"),
            ("<= 14 =>", "<= 15 =>", f"{fee}(15,null): expected Charge, got Reminder"),
            ("<= 0 =>", "< 0 =>", f'{fee}(0,"staff"): expected None, got Reminder'),
            ("<= 0 =>", "<= 1 =>", f'{fee}(1,"staff"): expected Reminder, got None'),
            ("<= 0 => Fee.None,", "<= 0 => Fee.None, 7 => Fee.Charge,", f'{fee}(7,"staff"): expected Reminder, got Charge'),
            ('== "staff"', '== "Staff"', f'{fee}(15,"staff"): expected Reminder, got Charge'),
            ('== "staff"', '!= "staff"', f'{fee}(15,"staff"): expected Reminder, got Charge'),
            ('== "staff"', "== null", f'{fee}(15,"staff"): expected Reminder, got Charge'),
            ('membership == "staff"', 'membership is "staff" or "volunteer"', f'{fee}(15,"volunteer"): expected Charge, got Reminder'),
            ('membership == "staff"', 'membership is "staff" or null', f"{fee}(15,null): expected Charge, got Reminder"),
        ]
        for old, new, message in faults:
            with self.subTest(fault=new):
                self.use_example("LateFee")
                text = self.source.read_text()
                self.assertEqual(text.count(old), 1)
                self.source.write_text(text.replace(old, new))
                self.run_tool("inventory")
                self.assertIn(message, self.run_tool("run", ok=False))
        spec_faults = [
            (["..0", "1..13", "14.."], f"{fee}(14,null): expected Charge, got Reminder"),
            (["..0", "1..15", "16.."], f"{fee}(15,null): expected Reminder, got Charge"),
            (["..-1", "0..14", "15.."], f'{fee}(0,"staff"): expected Reminder, got None'),
        ]
        for ranges, message in spec_faults:
            with self.subTest(ranges=ranges):
                spec = self.use_example("LateFee")
                unit = spec["units"]["Example.Fees.LateFee"]
                renamed = dict(zip(unit["domains"]["daysLate"], ranges))
                unit["domains"]["daysLate"] = ranges
                for row in unit["rows"]:
                    row["input"][0] = renamed[row["input"][0]]
                self.write_spec(spec)
                self.run_tool("inventory")
                self.assertIn(message, self.run_tool("run", ok=False))

    def test_domains_must_split_every_integer_and_list_every_string(self):
        cover = "domains.daysLate: the ranges must cover every int value exactly once"
        named = "Example.Fees.LateFee: domains must list the cells of exactly daysLate, membership"
        listed = "domains.membership: list each string once; #null and #other are cells of every string input, #any stands for all cells, and none of them is listed"
        cases = [
            ("gap", cover), ("overlap", cover), ("open_end_missing", cover), ("low_end_missing", cover), ("no_ranges", cover),
            ("same_range_twice", cover),
            ("below_type", "domains.daysLate: -3000000000..0 is not a range of int"),
            ("reversed", "domains.daysLate: 14..1 is not a range of int"),
            ("outside_type", "domains.daysLate: 15..3000000000 is not a range of int"),
            ("malformed", "domains.daysLate: a range is written <first>..<last> in whole numbers, and either end may be left out; found: 1-14"),
            ("fraction", "domains.daysLate: a range is written <first>..<last>"),
            ("too_long", "domains.daysLate: a range is written <first>..<last>"),
            ("null_range", "domains.daysLate: a range is written <first>..<last>"),
            ("line_feed", "domains.daysLate: a range is written <first>..<last>"),
            ("no_domains", named), ("missing_input", named), ("extra_input", named), ("null_list", named),
            ("null_listed", listed), ("other_listed", listed), ("string_twice", listed), ("null_string", listed),
            ("unknown_range", "row input must match parameters; daysLate accepts ..0, 1..14, 15.."),
            ("number_for_range", "row input must match parameters; daysLate accepts ..0, 1..14, 15.."),
            ("unlisted_string", "row input must match parameters; membership accepts staff, #null, #other"),
            ("null_for_string", "row input must match parameters; membership accepts staff, #null, #other"),
            ("missing_row", "the rows must cover each of the 9 combinations of cells; 1 of them have no row"),
        ]
        for kind, message in cases:
            with self.subTest(kind=kind):
                spec = self.use_example("LateFee")
                unit = spec["units"]["Example.Fees.LateFee"]
                domains, rows = unit["domains"], unit["rows"]
                if kind == "gap": domains["daysLate"] = ["..0", "2..14", "15.."]
                if kind == "overlap": domains["daysLate"] = ["..0", "0..14", "15.."]
                if kind == "open_end_missing": domains["daysLate"] = ["..0", "1..14"]
                if kind == "low_end_missing": domains["daysLate"] = ["0..0", "1..14", "15.."]
                if kind == "below_type": domains["daysLate"] = ["-3000000000..0", "1..14", "15.."]
                if kind == "no_ranges": domains["daysLate"] = []
                if kind == "same_range_twice": domains["daysLate"] = ["..0", "1..14", "1..14", "15.."]
                if kind == "reversed": domains["daysLate"] = ["..0", "14..1", "15.."]
                if kind == "outside_type": domains["daysLate"] = ["..0", "1..14", "15..3000000000"]
                if kind == "malformed": domains["daysLate"] = ["..0", "1-14", "15.."]
                if kind == "fraction": domains["daysLate"] = ["..0", "1..14.5", "15.."]
                if kind == "too_long": domains["daysLate"] = ["..0", "1..14", "15.." + "9" * 60]
                if kind == "null_range": domains["daysLate"] = ["..0", None, "15.."]
                if kind == "line_feed":
                    domains["daysLate"] = ["..0", "1..14\n", "15.."]
                    for row in rows:
                        row["input"][0] = {"1..14": "1..14\n"}.get(row["input"][0], row["input"][0])
                if kind == "no_domains": del unit["domains"]
                if kind == "missing_input": del domains["membership"]
                if kind == "extra_input": domains["staff"] = []
                if kind == "null_list": domains["membership"] = None
                if kind == "null_listed": domains["membership"] = ["staff", "#null"]
                if kind == "other_listed": domains["membership"] = ["#other"]
                if kind == "string_twice": domains["membership"] = ["staff", "staff"]
                if kind == "null_string": domains["membership"] = ["staff", None]
                if kind == "unknown_range": rows[0]["input"][0] = "..1"
                if kind == "number_for_range": rows[0]["input"][0] = 0
                if kind == "unlisted_string": rows[0]["input"][1] = "guest"
                if kind == "null_for_string": rows[0]["input"][1] = None
                if kind == "missing_row": rows.pop()
                self.write_spec(spec)
                self.assertIn(message, self.run_tool("inventory", ok=False))
                self.assertFalse(self.out.exists())
        spec = copy.deepcopy(self.original)
        self.source.write_text((SKILL / "assets/csharp/Decision.cs").read_text(), encoding="utf-8")
        spec["units"]["Example.Decision.CanBorrow"]["domains"] = {}
        self.write_spec(spec)
        self.run_tool("inventory")
        spec["units"]["Example.Decision.CanBorrow"]["domains"] = {"suspended": [".."]}
        self.write_spec(spec)
        self.assertIn("domains is for number and string inputs, and this method has none", self.run_tool("inventory", ok=False))

    INTEGER_RANGES = {"sbyte": (-128, 127), "byte": (0, 255), "short": (-32768, 32767), "ushort": (0, 65535),
                      "int": (-2**31, 2**31 - 1), "uint": (0, 2**32 - 1), "long": (-2**63, 2**63 - 1), "ulong": (0, 2**64 - 1)}
    OTHER_STRING = "␀ no constant"
    RANGED_SOURCE = """namespace Desk;
public enum Band { Low, Mid, High }
public readonly record struct Loan(int DaysLate, string Code, byte Copies, bool Reserved);
public static class Rules
{
    public static bool Less(int x) => x < 14;
    public static bool Mirrored(byte x) => 200 <= x;
    public static bool After(int x) => 5 < x;
    public static bool Before(long x) => 5 > x;
    public static bool AtMost(ushort x) => 5 >= x;
    public static bool Exact(long x) => x == -5;
    public static bool NotExact(short x) => x != 3;
    public static bool Folded(int x) => x < 7 * 24;
    public static bool Between(int x) => x is > 0 and <= 14 or 99;
    public static Band Table(sbyte x) => x switch { <= 0 => Band.Low, <= 14 => Band.Mid, _ => Band.High };
    public static Band Closed(short x) => x switch { <= 0 => Band.Low, > 0 => Band.High };
    public static bool Top(ulong x) => x >= 18446744073709551615;
    public static bool Unsigned(uint x) => x > 3000000000;
    public static bool Wide(ushort x) => x >= 65535 || x == 0;
    public static bool Ends(int x) => x <= int.MinValue || x >= int.MaxValue;
    public static bool Outside(uint x) => x > -1;
    public static bool Unused(int x, bool b) => b;
    public static bool Word(string s) => s == "RENEW";
    public static bool Missing(string s) => s == null || "A" == s;
    public static bool Either(string s) => s is "RENEW" or null;
    public static Band Words(string s) => s switch { "low" => Band.Low, null => Band.High, "" => Band.High, _ => Band.Mid };
    public static bool Match(Loan loan) => loan is { DaysLate: > 14, Code: "X", Copies: < 3 };
    public static bool Fields(Loan loan) => loan.DaysLate >= 30 || loan.Code == "Y" || loan.Copies == 2 || loan.Reserved;
    public static bool Two(int a, int b) => a < 0 && b < 0;
}
"""

    def ranged_reference(self):
        flag = ("bool", [False, True])
        loan = {"DaysLate": ("int", ["..14", "15..29", "30.."]), "Code": ("string", ["X", "Y"]),
                "Copies": ("byte", ["..1", "2..2", "3.."]), "Reserved": flag}
        return {
            "Less": ({"x": ("int", ["..13", "14.."])}, lambda x: x < 14),
            "Mirrored": ({"x": ("byte", ["..199", "200.."])}, lambda x: x >= 200),
            "After": ({"x": ("int", ["..5", "6.."])}, lambda x: x > 5),
            "Before": ({"x": ("long", ["..4", "5.."])}, lambda x: x < 5),
            "AtMost": ({"x": ("ushort", ["..5", "6.."])}, lambda x: x <= 5),
            "Exact": ({"x": ("long", ["..-6", "-5..-5", "-4.."])}, lambda x: x == -5),
            "NotExact": ({"x": ("short", ["..2", "3..3", "4.."])}, lambda x: x != 3),
            "Folded": ({"x": ("int", ["..167", "168.."])}, lambda x: x < 168),
            "Between": ({"x": ("int", ["..0", "1..14", "15..98", "99..99", "100.."])}, lambda x: 0 < x <= 14 or x == 99),
            "Table": ({"x": ("sbyte", ["..0", "1..14", "15.."])}, lambda x: "Low" if x <= 0 else "Mid" if x <= 14 else "High"),
            "Closed": ({"x": ("short", ["..0", "1.."])}, lambda x: "Low" if x <= 0 else "High"),
            "Top": ({"x": ("ulong", ["..18446744073709551614", "18446744073709551615.."])}, lambda x: x == 2**64 - 1),
            "Unsigned": ({"x": ("uint", ["..3000000000", "3000000001.."])}, lambda x: x > 3000000000),
            "Wide": ({"x": ("ushort", ["..0", "1..65534", "65535.."])}, lambda x: x in (0, 65535)),
            "Ends": ({"x": ("int", ["..-2147483648", "-2147483647..2147483646", "2147483647.."])},
                     lambda x: x in (-2**31, 2**31 - 1)),
            "Outside": ({"x": ("uint", [".."])}, lambda x: True),
            "Unused": ({"x": ("int", [".."]), "b": flag}, lambda x, b: b),
            "Word": ({"s": ("string", ["RENEW"])}, lambda s: s == "RENEW"),
            "Missing": ({"s": ("string", ["A"])}, lambda s: s is None or s == "A"),
            "Either": ({"s": ("string", ["RENEW"])}, lambda s: s is None or s == "RENEW"),
            "Words": ({"s": ("string", ["low", ""])}, lambda s: "Low" if s == "low" else "High" if s in (None, "") else "Mid"),
            "Match": ({"loan": loan}, lambda loan: loan["DaysLate"] > 14 and loan["Code"] == "X" and loan["Copies"] < 3),
            "Fields": ({"loan": loan},
                       lambda loan: loan["DaysLate"] >= 30 or loan["Code"] == "Y" or loan["Copies"] == 2 or loan["Reserved"]),
            "Two": ({"a": ("int", ["..-1", "0.."]), "b": ("int", ["..-1", "0.."])}, lambda a, b: a < 0 and b < 0),
        }

    def ranged_cells(self, kind, listed):
        """Each cell of one input as (the token a row names it by, one value that lies in it)."""
        if kind in self.INTEGER_RANGES:
            return [(token, int(token.split("..")[0] or self.INTEGER_RANGES[kind][0])) for token in listed]
        if kind == "string":
            return [(value, value) for value in listed] + [("#null", None), ("#other", self.OTHER_STRING)]
        if kind == "double":
            def lowest(token):
                first = token.split("..")[0]
                return math.nextafter(float(first[1:]), math.inf) if first.startswith(">") else float(first or "-inf")
            return [(token, lowest(token)) for token in listed] + [("#nan", math.nan)]
        return [(value, value) for value in listed]

    def write_ranged_spec(self, source=None, reference=None, prefix="Desk.Rules."):
        self.source.write_text(source or self.RANGED_SOURCE)
        reference = reference or self.ranged_reference()
        units = {}
        for name, (parameters, outcome) in reference.items():
            shapes = list(parameters.values())
            axes = [self.ranged_cells(*axis) for shape in shapes for axis in (shape.values() if isinstance(shape, dict) else [shape])]
            rows = []
            for cells in itertools.product(*axes):
                remaining = list(cells)
                tokens, values = [], []
                for shape in shapes:
                    taken = [remaining.pop(0) for _ in (shape if isinstance(shape, dict) else [0])]
                    tokens.append({f: t for f, (t, _) in zip(shape, taken)} if isinstance(shape, dict) else taken[0][0])
                    values.append({f: v for f, (_, v) in zip(shape, taken)} if isinstance(shape, dict) else taken[0][1])
                rows.append({"input": tokens, "outcome": outcome(*values)})
            domains = {}
            for parameter, shape in parameters.items():
                for label, (kind, listed) in ({f"{parameter}.{f}": axis for f, axis in shape.items()} if isinstance(shape, dict)
                                              else {parameter: shape}).items():
                    if kind in ("string", "double") or kind in self.INTEGER_RANGES:
                        domains[label] = listed
            units[f"{prefix}{name}"] = {"requirement": name, "parameters": list(parameters), "domains": domains,
                                           "rows": rows, "unsettled": []}
        self.write_spec({"units": units})
        return reference

    def test_admitted_integer_and_string_forms_agree_with_a_reference(self):
        reference = self.write_ranged_spec()
        paths = {u["name"]: u for u in json.loads(self.run_tool("paths"))["units"]}
        own_cells = {
            "Less": ["..13", "14.."], "Mirrored": ["..199", "200.."], "After": ["..5", "6.."], "Before": ["..4", "5.."],
            "AtMost": ["..5", "6.."], "Exact": ["..-6", "-5..-5", "-4.."], "NotExact": ["..2", "3..3", "4.."],
            "Folded": ["..167", "168.."], "Between": ["..0", "1..14", "15..98", "99..99", "100.."],
            "Table": ["..0", "1..14", "15.."], "Closed": ["..0", "1.."],
            "Top": ["..18446744073709551614", "18446744073709551615.."], "Unsigned": ["..3000000000", "3000000001.."],
            "Wide": ["..0", "1..65534", "65535.."], "Ends": ["..-2147483648", "-2147483647..2147483646", "2147483647.."],
            "Outside": [".."], "Unused": [".."],
        }
        for name, tokens in own_cells.items():
            self.assertEqual(paths[f"Desk.Rules.{name}"]["domains"][0]["values"], tokens, name)
        self.assertEqual([d["values"] for d in paths["Desk.Rules.Match"]["domains"]],
                         [["..14", "15.."], ["X", "#null", "#other"], ["..2", "3.."], [False, True]])
        self.assertEqual([d["values"] for d in paths["Desk.Rules.Fields"]["domains"]],
                         [["..29", "30.."], ["Y", "#null", "#other"], ["..1", "2..2", "3.."], [False, True]])
        self.assertEqual(paths["Desk.Rules.Mirrored"]["domains"][0], {"parameter": "x", "type": "byte", "values": ["..199", "200.."], "unnamed": None})
        self.assertEqual(paths["Desk.Rules.Outside"]["domains"][0]["values"], [".."])
        self.assertEqual(paths["Desk.Rules.Outside"]["cases"], 2)
        self.assertEqual(paths["Desk.Rules.Ends"]["cases"], 4)
        self.assertEqual(paths["Desk.Rules.Missing"]["domains"][0]["values"], ["A", "#null", "#other"])
        self.assertEqual([d["parameter"] for d in paths["Desk.Rules.Match"]["domains"]],
                         ["loan.DaysLate", "loan.Code", "loan.Copies", "loan.Reserved"])
        # The code's own cells of an 8-bit input are checked value by value: the reference never changes inside one.
        for name in ("Table", "Mirrored"):
            kind, outcome = paths[f"Desk.Rules.{name}"]["domains"][0]["type"], reference[name][1]
            low, high = self.INTEGER_RANGES[kind]
            for token in paths[f"Desk.Rules.{name}"]["domains"][0]["values"]:
                first, last = token.split("..")
                results = {outcome(value) for value in range(int(first or low), int(last or high) + 1)}
                self.assertEqual(len(results), 1, f"{name} {token}")
        report = json.loads(self.run_tool("inventory"))
        executed = 0
        for unit in report["units"]:
            outcome = reference[unit["name"].rsplit(".", 1)[1]][1]
            for check in unit["checks"]:
                self.assertEqual(outcome(*check["input"]), check["expected"], f'{unit["name"]} {check["input"]}')
            executed += unit["cases"]
            self.assertEqual(unit["claim"], "cells")
        checks = {u["name"].rsplit(".", 1)[1]: [c["input"] for c in u["checks"]] for u in report["units"]}
        tried = set()
        for unit in report["units"]:
            kind = unit["domains"][0]["type"]
            if len(unit["domains"]) == 1 and kind in self.INTEGER_RANGES:
                inputs = checks[unit["name"].rsplit(".", 1)[1]]
                self.assertEqual((inputs[0][0], inputs[-1][0]), self.INTEGER_RANGES[kind], unit["name"])
                tried.add(kind)
        self.assertEqual(tried, set(self.INTEGER_RANGES))
        self.assertEqual(checks["Less"], [[-2**31], [13], [14], [2**31 - 1]])
        self.assertEqual(checks["Exact"], [[-2**63], [-6], [-5], [-4], [2**63 - 1]])
        self.assertEqual(checks["Top"], [[0], [2**64 - 2], [2**64 - 1]])
        self.assertEqual(checks["Ends"], [[-2**31], [-2**31 + 1], [2**31 - 2], [2**31 - 1]])
        self.assertEqual(checks["Word"], [["RENEW"], [None], [""], ["renew"]])
        self.assertEqual(checks["Words"], [["low"], [""], [None], ["LOW"]])
        self.assertEqual(len(checks["Match"]), 6 * 6 * 5 * 2)
        result = self.run_tool("run")
        self.assertEqual(result.count("PASS "), len(reference))
        self.assertEqual(sum(int(line.split()[2]) for line in result.splitlines() if line.startswith("PASS ")), executed)

    def test_every_planted_integer_and_string_fault_fails_a_check(self):
        faults = {
            "Less": [("x < 14", "x <= 14"), ("x < 14", "x < 15"), ("x < 14", "x < 13"), ("x < 14", "x > 14"), ("x < 14", "14 < x")],
            "Mirrored": [("200 <= x", "200 < x"), ("200 <= x", "199 <= x"), ("200 <= x", "x <= 200")],
            "After": [("5 < x", "5 <= x"), ("5 < x", "x < 5")],
            "Before": [("5 > x", "5 >= x"), ("5 > x", "x > 5")],
            "AtMost": [("5 >= x", "5 > x"), ("5 >= x", "x >= 5")],
            "Exact": [("x == -5", "x == -4"), ("x == -5", "x != -5"), ("x == -5", "x <= -5")],
            "NotExact": [("x != 3", "x != 4"), ("x != 3", "x > 3")],
            "Folded": [("7 * 24", "7 * 24 + 1"), ("7 * 24", "167")],
            "Between": [("> 0 and <= 14 or 99", ">= 0 and <= 14 or 99"), ("> 0 and <= 14 or 99", "> 0 and < 14 or 99"),
                        ("> 0 and <= 14 or 99", "> 0 and <= 14 or 98"), ("> 0 and <= 14 or 99", "> 0 and <= 14")],
            "Table": [("<= 0 => Band.Low, <= 14", "< 0 => Band.Low, <= 14"), ("<= 14 => Band.Mid", "<= 13 => Band.Mid"),
                      ("<= 14 => Band.Mid", "< 16 => Band.Mid")],
            "Closed": [("<= 0 => Band.Low, > 0", "<= 1 => Band.Low, > 0"), ("<= 0 => Band.Low, > 0", "< 0 => Band.Low, >= 0")],
            "Top": [(">= 18446744073709551615", ">= 18446744073709551614"), (">= 18446744073709551615", "> 18446744073709551615")],
            "Unsigned": [("x > 3000000000", "x >= 3000000000"), ("x > 3000000000", "x > 3000000001")],
            "Wide": [("x >= 65535", "x > 65535"), ("x >= 65535", "x >= 65534"), ("|| x == 0", "|| x == 1")],
            "Ends": [("x <= int.MinValue", "x < int.MinValue"), ("x >= int.MaxValue", "x > int.MaxValue"),
                     ("x <= int.MinValue", "x <= int.MinValue + 1")],
            "Outside": [("x > -1", "x > 0")],
            "Unused": [("Unused(int x, bool b) => b", "Unused(int x, bool b) => b && x != int.MaxValue")],
            "Word": [('s == "RENEW"', 's == "RENEWAL"'), ('s == "RENEW"', 's != "RENEW"'), ('s == "RENEW"', 's == "renew"'),
                     ('s == "RENEW"', 's == "RENEW" || s == ""'), ('s == "RENEW"', 's == "RENEW" || s == null')],
            "Missing": [('s == null ||', 's != null &&'), ('"A" == s', '"a" == s'), ('s == null || "A" == s', '"A" == s')],
            "Either": [('is "RENEW" or null', 'is "RENEW"'), ('is "RENEW" or null', "is null")],
            "Words": [('"low" => Band.Low', '"Low" => Band.Low'), ("null => Band.High", "null => Band.Mid"),
                      ('"" => Band.High', '"" => Band.Mid'), ("_ => Band.Mid", "_ => Band.High")],
            "Match": [("DaysLate: > 14", "DaysLate: >= 14"), ('Code: "X"', 'Code: "x"'), ("Copies: < 3", "Copies: <= 3"),
                      ("Copies: < 3", "Copies: < 2")],
            "Fields": [("loan.DaysLate >= 30", "loan.DaysLate > 30"), ('loan.Code == "Y"', 'loan.Code == "X"'),
                       ("loan.Copies == 2", "loan.Copies == 3"), ("loan.Copies == 2", "loan.Copies >= 2")],
            "Two": [("a < 0 && b < 0", "a < 0 && b <= 0"), ("a < 0 && b < 0", "a <= 0 && b < 0"), ("a < 0 && b < 0", "a < 0 || b < 0")],
        }
        self.assertEqual(set(faults), set(self.ranged_reference()))
        for name, edits in faults.items():
            for old, new in edits:
                with self.subTest(unit=name, fault=new):
                    self.write_ranged_spec()
                    self.assertEqual(self.RANGED_SOURCE.count(old), 1, old)
                    self.source.write_text(self.RANGED_SOURCE.replace(old, new))
                    self.run_tool("inventory")
                    self.assertIn(f"FAIL Desk.Rules.{name}(", self.run_tool("run", ok=False))

    def test_string_probes_cover_the_constants_of_code_and_spec(self):
        def probes(body, listed):
            self.source.write_text("public static class Decision { public static bool Decide(string s) => " + body + "; }")
            tokens = listed + ["#null", "#other"]
            self.write_spec({"units": {"Decision.Decide": {
                "requirement": "Probe list", "parameters": ["s"], "domains": {"s": listed},
                "rows": [{"input": [token], "outcome": token == "#other"} for token in tokens], "unsettled": []}}})
            return [(c["input"][0], c["expected"]) for c in json.loads(self.run_tool("inventory"))["units"][0]["checks"]]
        self.assertEqual(probes('s == "A"', ["B"]),
                         [("B", False), (None, False), ("A", True), ("", True), ("a", True), ("b", True)])
        self.assertEqual(probes('s == ""', [""]), [("", False), (None, False), ("x", True)])
        self.assertEqual(probes('s == "x" || s == ""', ["7"]), [("7", False), (None, False), ("", True), ("x", True), ("X", True)])
        self.assertEqual(probes("s is not null", []), [(None, False), ("", True)])
        self.assertEqual(probes('s is "" or "x" or "X"', []), [(None, False), ("", True), ("X", True), ("x", True), ("xx", True)])
        # The letter is written as an escape in the C# source, so the fixture does not depend on the encoding it is saved in.
        self.assertEqual(probes('s == "\\u00e9" || s == "Ab"', ["\u00e9", "Ab"]),
                         [("\u00e9", False), ("Ab", False), (None, False), ("", True), ("aB", True)])
        self.assertIn('FAIL Decision.Decide("\\u00E9")', self.run_tool("run", ok=False))

    def test_a_constant_is_the_value_the_compiler_folds(self):
        def cells(parameter, body):
            self.source.write_text("public static class Decision { public static bool Decide(" + parameter + ") => " + body + "; }")
            return json.loads(self.run_tool("paths"))["units"][0]["domains"][0]["values"]
        self.assertEqual(cells("string s", 's == "a" + "b" || s == $"c" || s == nameof(s)'), ["ab", "c", "s", "#null", "#other"])
        self.assertEqual(cells("string s", 's == "#null" || s == "#other" || s == "a"'), ["a", "#null", "#other"])
        self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["cases"], 8)
        self.assertEqual(cells("string s", 's == "\\ud83d\\ude00"'), ["\U0001F600", "#null", "#other"])
        self.assertEqual(cells("int x", "x == (int)System.DayOfWeek.Friday || x < sizeof(int) || x > short.MaxValue || x == 'a'"),
                         ["..3", "4..4", "5..5", "6..96", "97..97", "98..32767", "32768.."])

    def test_unsupported_integer_and_string_code_rejects_with_its_reason(self):
        parameter_rule = "parameters are bool, integers, double, strings, and enums and records declared in the file"
        result_rule = "the result is bool, an enum declared in the file, int, long, double, or the record type of exactly one parameter"
        integer_rule = "Decide: an integer input can only be compared with a constant of an integer type or matched by a pattern"
        string_rule = "Decide: a string input can only be compared with a string constant or null, or matched by a pattern"
        loan = "public readonly record struct Loan(int Days, string Code); "
        cases = [
            ("", "public static bool Decide(int x, int y) => x < y;", integer_rule),
            ("", "public static bool Decide(int x) => x + 1 > 3;", integer_rule),
            ("", "public static bool Decide(int x) => x % 2 == 0;", integer_rule),
            ("", "public static bool Decide(int x) => (x & 1) == 1;", integer_rule),
            ("", "public static bool Decide(int x) => x < 2.5;", integer_rule),
            ("", "public static bool Decide(int x) => x == 1m;", integer_rule),
            ("", "public static bool Decide(int x, long y) => x == y;", integer_rule),
            ("", "public static bool Decide(int x, bool b) => (b ? x : 3) > 2;", integer_rule),
            ("", "public static bool Decide(int x) => -x > 3;", "unsupported expression UnaryMinusExpression"),
            ("", "public static bool Decide(int x) => (long)x < 5;", "unsupported expression CastExpression"),
            ("", "public static bool Decide(int x) => x is int;", "unsupported expression IsExpression"),
            ("", "public static bool Decide(int x) => x.Equals(3);", "unsupported expression InvocationExpression"),
            ("", "public static bool Decide(int x) => x is var y;", "unsupported pattern VarPattern"),
            ("", "public static bool Decide(int x) => x switch { > 0 => true, < 0 => false };", "add a discard arm"),
            ("", "public static bool Decide(int x) => x switch { > 0 when true => true, _ => false };", "unsupported switch guard"),
            ("", "public static bool Decide(int? x) => x > 0;", parameter_rule),
            ("", "public static bool Decide(char c) => c == 'a';", parameter_rule),
            ("", "public static bool Decide(decimal d) => d > 0;", parameter_rule),
            ("", "public static bool Decide(float f) => f > 0;", parameter_rule),
            ("", "public static bool Decide(nint n) => n > 0;", parameter_rule),
            ("", "public static bool Decide(object o) => o == null;", parameter_rule),
            ("", "public static string Decide(string s) => \"a\";", result_rule),
            ("", "public static bool Decide(string s, string t) => s == t;", string_rule),
            ("", "public static bool Decide(string s) => s == string.Empty;", string_rule),
            ("", "public static bool Decide(string s) => s == \"\\ud83d\";", "a string constant with an unpaired surrogate is not admitted"),
            ("", "public static bool Decide(string s) => s is \"a\\udc00\" or null;", "a string constant with an unpaired surrogate is not admitted"),
            ("", "public static bool Decide(string s) => s + \"a\" == \"ba\";", string_rule),
            ("", "public static bool Decide(string s, bool b) => (b ? s : \"a\") == \"a\";", string_rule),
            ("", "public static bool Decide(string s) => s.Length == 3;", "unsupported expression SimpleMemberAccessExpression"),
            ("", "public static bool Decide(string s) => s.Equals(\"a\");", "unsupported expression InvocationExpression"),
            ("", "public static bool Decide(string s) => (object)s == null;", "unsupported expression CastExpression"),
            ("", "public static bool Decide(string s) => s is string;", "unsupported expression IsExpression"),
            ("", "public static bool Decide(string s) => s is { Length: 3 };", "unsupported pattern RecursivePattern"),
            ("", "public static bool Decide(string s) => s switch { \"a\" => true };", "add a discard arm"),
            (loan, "public static bool Decide(Loan a, Loan b) => a.Days < b.Days;", integer_rule),
            (loan, "public static bool Decide(Loan a) => a.Days * 2 > 30;", integer_rule),
            (loan, "public static bool Decide(Loan a, Loan b) => a.Code == b.Code;", string_rule),
            (loan, "public static bool Decide(Loan a) => a is { Days: var days };", "unsupported pattern VarPattern"),
            (loan, "public static bool Decide(Loan a) => a is { Code: { } };", "unsupported pattern RecursivePattern"),
        ]
        for declarations, method, reason in cases:
            with self.subTest(method=method):
                self.source.write_text(declarations + "public static class Decision { " + method + " }")
                output = self.run_tool("paths", ok=False)
                self.assertIn("REJECTED", output)
                self.assertIn(reason, output)

    def test_range_check_limit(self):
        def source(count):
            parameters = ", ".join(f"int p{i}" for i in range(count))
            return ("public static class Decision { public static bool Decide(" + parameters + ") => "
                    + " && ".join(f"p{i} > 0" for i in range(count)) + "; }")
        self.source.write_text(source(6))
        self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["cases"], 4096)
        self.source.write_text(source(7))
        self.assertIn("Decision.Decide: 16384 checks exceed the limit of 4096", self.run_tool("paths", ok=False))

    ARITHMETIC = "arithmetic is admitted on int, long and double values with + - * / and negation, and an integer is divided only by a constant other than 0 and -1"
    NAMED_DOUBLES = {"NaN": math.nan, "Infinity": math.inf, "-Infinity": -math.inf}

    @staticmethod
    def report(text):
        """Reads an obligations file; the negative zero of a double is written -0, which the plain reader would turn into the integer 0."""
        return json.loads(text, parse_int=lambda digits: -0.0 if digits == "-0" else int(digits))

    def real(self, value):
        return self.NAMED_DOUBLES[value] if isinstance(value, str) else float(value)

    @staticmethod
    def same(left, right):
        """Equal bit for bit, with every NaN equal to every NaN; an int and a double are never the same."""
        if isinstance(left, float) and isinstance(right, float):
            return math.isnan(left) and math.isnan(right) or (left == right and math.copysign(1, left) == math.copysign(1, right))
        return type(left) is type(right) and left == right

    def decoded(self, unit, check):
        """The inputs of a check, with every double turned into a float."""
        kinds = iter(domain["type"] for domain in unit["domains"])
        def one(value): return self.real(value) if next(kinds) == "double" else value
        return [{field: one(value) for field, value in given.items()} if isinstance(given, dict) else one(given) for given in check["input"]]

    DOUBLE_SOURCE = """namespace Desk;
public enum Band { Low, Mid, High }
public readonly record struct Parcel(double Weight, int Copies, bool Fragile);
public static class Scales
{
    public static bool Less(double x) => x < 0.5;
    public static bool AtMost(double x) => x <= 0.5;
    public static bool Mirrored(double x) => 0.5 <= x;
    public static bool Exact(double x) => x == 0.1;
    public static bool NotExact(double x) => x != 2;
    public static bool Zero(double x) => x == 0.0;
    public static bool NegativeZero(double x) => x is -0.0;
    public static bool Positive(double x) => x > 0;
    public static bool Folded(double x) => x >= 0.1 + 0.2;
    public static bool Between(double x) => x is > 0 and <= 14.5 or 99;
    public static bool Outside(double x) => x is not (>= -1.5 and <= 1.5);
    public static bool Unordered(double x) => x is double.NaN;
    public static bool Never(double x) => x == double.NaN;
    public static bool Always(double x) => x != double.NaN;
    public static bool Endless(double x) => x == double.PositiveInfinity || x <= double.NegativeInfinity;
    public static bool Largest(double x) => x >= double.MaxValue;
    public static bool Smallest(double x) => x is > 0 and < 1e-323;
    public static Band Table(double x) => x switch { < 0 => Band.Low, <= 2.5 => Band.Mid, double.NaN => Band.Low, _ => Band.High };
    public static Band Closed(double x) => x switch { <= 0 => Band.Low, > 0 => Band.High, _ => Band.Mid };
    public static bool Heavy(Parcel p) => p is { Weight: > 2.5, Copies: < 3 } || p.Fragile && p.Weight >= 0.25;
    public static bool Two(double a, double b) => a < 0 && b < 0;
    public static bool Unused(double x, bool b) => b;
}
"""

    def double_reference(self):
        """Per method the cells a spec states, in spellings of its own, and the method again in Python, whose floats compare as C# doubles do."""
        flag = ("bool", [False, True])
        largest = sys.float_info.max
        parcel = {"Weight": ("double", ["..<0.25", "0.25..2.5", ">2.5.."]), "Copies": ("int", ["..2", "3.."]), "Fragile": flag}
        return {
            "Less": ({"x": ("double", ["..<0.5", "0.5.."])}, lambda x: x < 0.5),
            "AtMost": ({"x": ("double", ["..0.5", ">0.5.."])}, lambda x: x <= 0.5),
            "Mirrored": ({"x": ("double", ["..<5e-1", "0.50.."])}, lambda x: 0.5 <= x),
            "Exact": ({"x": ("double", ["..<0.1", "0.1..0.1", ">0.1.."])}, lambda x: x == 0.1),
            "NotExact": ({"x": ("double", ["..<2", "2..2.0", ">2.."])}, lambda x: x != 2),
            "Zero": ({"x": ("double", ["..<0", "0..0", ">0.."])}, lambda x: x == 0),
            "NegativeZero": ({"x": ("double", ["..<-0.0", "-0.0..0", ">0.0.."])}, lambda x: x == 0),
            "Positive": ({"x": ("double", ["..0", ">0.."])}, lambda x: x > 0),
            "Folded": ({"x": ("double", ["..<0.30000000000000004", "0.30000000000000004.."])}, lambda x: x >= 0.1 + 0.2),
            "Between": ({"x": ("double", ["..0", ">0..14.5", ">14.5..<99", "99..99", ">99.."])}, lambda x: 0 < x <= 14.5 or x == 99),
            "Outside": ({"x": ("double", ["..<-1.5", "-1.5..1.5", ">1.5.."])}, lambda x: not -1.5 <= x <= 1.5),
            "Unordered": ({"x": ("double", [".."])}, math.isnan),
            "Never": ({"x": ("double", [".."])}, lambda x: False),
            "Always": ({"x": ("double", [".."])}, lambda x: True),
            "Endless": ({"x": ("double", ["..<-1.7976931348623157e308", "-1.7976931348623157e308..1.7976931348623157e308",
                                          ">1.7976931348623157e308.."])}, math.isinf),
            "Largest": ({"x": ("double", ["..<1.7976931348623157e308", "1.7976931348623157e308.."])}, lambda x: x >= largest),
            "Smallest": ({"x": ("double", ["..0", ">0..<1e-323", "1e-323.."])}, lambda x: 0 < x < 1e-323),
            "Table": ({"x": ("double", ["..<0", "0..2.5", ">2.5.."])},
                      lambda x: "Low" if x < 0 or math.isnan(x) else "Mid" if x <= 2.5 else "High"),
            "Closed": ({"x": ("double", ["..0", ">0.."])}, lambda x: "Low" if x <= 0 else "High" if x > 0 else "Mid"),
            "Heavy": ({"p": parcel}, lambda p: p["Weight"] > 2.5 and p["Copies"] < 3 or p["Fragile"] and p["Weight"] >= 0.25),
            "Two": ({"a": ("double", ["..<0", "0.."]), "b": ("double", ["..<0", "0.."])}, lambda a, b: a < 0 and b < 0),
            "Unused": ({"x": ("double", [".."]), "b": flag}, lambda x, b: b),
        }

    def test_double_cells_are_cut_at_constants_and_tried_at_their_neighbours(self):
        reference = self.write_ranged_spec(self.DOUBLE_SOURCE, self.double_reference(), "Desk.Scales.")
        paths = {u["name"].rsplit(".", 1)[1]: u for u in json.loads(self.run_tool("paths"))["units"]}
        own_cells = {
            "Less": ["..<0.5", "0.5.."], "AtMost": ["..0.5", ">0.5.."], "Mirrored": ["..<0.5", "0.5.."],
            "Exact": ["..<0.1", "0.1..0.1", ">0.1.."], "NotExact": ["..<2", "2..2", ">2.."], "Zero": ["..<0", "0..0", ">0.."],
            "NegativeZero": ["..<0", "0..0", ">0.."], "Positive": ["..0", ">0.."],
            # The double below 0.1 + 0.2 is the double 0.3, so the cut is named by the shorter of the two numbers.
            "Folded": ["..0.3", ">0.3.."],
            "Between": ["..0", ">0..14.5", ">14.5..<99", "99..99", ">99.."], "Outside": ["..<-1.5", "-1.5..1.5", ">1.5.."],
            "Unordered": [".."], "Never": [".."], "Always": [".."],
            "Endless": ["..<-1.7976931348623157E+308", "-1.7976931348623157E+308..1.7976931348623157E+308", ">1.7976931348623157E+308.."],
            "Smallest": ["..0", ">0..5E-324", "1E-323.."], "Table": ["..<0", "0..2.5", ">2.5.."], "Closed": ["..0", ">0.."],
        }
        for name, tokens in own_cells.items():
            self.assertEqual(paths[name]["domains"][0], {"parameter": "x", "type": "double", "values": tokens + ["#nan"], "unnamed": None}, name)
        self.assertEqual([d["values"] for d in paths["Heavy"]["domains"]],
                         [["..<0.25", "0.25..2.5", ">2.5..", "#nan"], ["..2", "3.."], [False, True]])
        text = self.run_tool("inventory")
        report = self.report(text)
        probes, executed = {}, 0
        for unit in report["units"]:
            name = unit["name"].rsplit(".", 1)[1]
            outcome = reference[name][1]
            probes[name] = [self.decoded(unit, check) for check in unit["checks"]]
            for check, inputs in zip(unit["checks"], probes[name]):
                self.assertEqual(outcome(*inputs), check["expected"], f"{name} {inputs}")
            executed += unit["cases"]
            self.assertEqual(unit["claim"], "cells")

        def tried(name):
            return [inputs[0] for inputs in probes[name]]
        below, above = math.nextafter(0.5, -math.inf), math.nextafter(0.5, math.inf)
        less = tried("Less")
        self.assertEqual(len(less), 7)
        self.assertEqual((less[0], less[2], less[3], less[5]), (-math.inf, below, 0.5, math.inf))
        self.assertTrue(-math.inf < less[1] < below and 0.5 < less[4] < math.inf and math.isnan(less[6]), less)
        self.assertTrue(math.isfinite(less[1]) and math.isfinite(less[4]), less)
        most = tried("AtMost")
        self.assertEqual((most[2], most[3]), (0.5, above))
        exact = tried("Exact")
        self.assertEqual(exact[2:5], [math.nextafter(0.1, -math.inf), 0.1, math.nextafter(0.1, math.inf)])
        zero = tried("Zero")
        self.assertEqual(len(zero), 9)
        self.assertEqual(zero[2:6], [-5e-324, 0.0, 0.0, 5e-324])
        self.assertEqual([math.copysign(1, value) for value in zero[3:5]], [-1.0, 1.0])
        self.assertTrue(all(self.same(a, b) for a, b in zip(tried("NegativeZero"), zero)))
        positive = tried("Positive")
        self.assertEqual([math.copysign(1, value) for value in positive if value == 0], [-1.0, 1.0])
        self.assertEqual(positive[positive.index(0.0) + 2], 5e-324)
        self.assertEqual(tried("Folded")[2:4], [0.3, 0.30000000000000004])
        largest = sys.float_info.max
        self.assertTrue(all(self.same(a, b) for a, b in zip(tried("Endless"), [-math.inf, -largest, largest, math.inf, math.nan])))
        self.assertEqual(tried("Largest")[-4:-1], [math.nextafter(largest, 0), largest, math.inf])
        self.assertEqual([value for value in tried("Smallest") if 0 < value < 1], [5e-324, 1e-323])
        self.assertEqual(len(tried("Unordered")), 4)
        self.assertEqual(len(probes["Two"]), 64)
        self.assertEqual(len(probes["Heavy"]), 10 * 4 * 2)
        # Two inputs of one method are tried at different values inside a piece.
        inside = {tuple(inputs) for inputs in probes["Two"] if all(math.isfinite(value) and abs(value) > 1 for value in inputs)}
        self.assertTrue(inside and all(a != b and abs(a) != abs(b) for a, b in inside), inside)
        self.assertIn('"NaN"', text)
        self.assertIn('"-Infinity"', text)
        self.assertRegex(text, r"(?m)^\s+-0,?$")
        result = self.run_tool("run")
        self.assertEqual(result.count("PASS "), len(reference))
        self.assertEqual(sum(int(line.split()[2]) for line in result.splitlines() if line.startswith("PASS ")), executed)
        # The names the tool gives the cells of the code are names a spec can use, and they add no check.
        own = {name: ({parameter: (kind, paths[name]["domains"][0]["values"][:-1]) if kind == "double" and len(parameters) == 1 else (kind, listed)
                       for parameter, (kind, listed) in parameters.items()} if name != "Heavy" else parameters, outcome)
               for name, (parameters, outcome) in reference.items()}
        self.write_ranged_spec(self.DOUBLE_SOURCE, own, "Desk.Scales.")
        for unit in json.loads(self.run_tool("inventory"))["units"]:
            name = unit["name"].rsplit(".", 1)[1]
            self.assertEqual(unit["cases"], paths[name]["cases"], name)
        self.assertEqual(self.run_tool("run").count("PASS "), len(reference))

    def test_every_planted_double_fault_fails_a_check(self):
        faults = {
            "Less": [("x < 0.5", "x <= 0.5"), ("x < 0.5", "x < 0.5000000000000001"), ("x < 0.5", "x < 0.49999999999999994"),
                     ("x < 0.5", "x > 0.5"), ("x < 0.5", "!(x >= 0.5)")],
            "AtMost": [("x <= 0.5", "x < 0.5"), ("x <= 0.5", "!(x > 0.5)")],
            "Mirrored": [("0.5 <= x", "0.5 < x"), ("0.5 <= x", "x <= 0.5")],
            "Exact": [("x == 0.1", "x == 0.1f"), ("x == 0.1", "x != 0.1"), ("x == 0.1", "x >= 0.1"), ("x == 0.1", "x == 0.1 + 0.2 - 0.2")],
            "NotExact": [("x != 2", "x != 2.0000000000000004"), ("x != 2", "x < 2")],
            "Zero": [("x == 0.0", "x >= 0.0"), ("x == 0.0", "x == 5e-324"), ("x == 0.0", "x == 0.0 || x is double.NaN")],
            "NegativeZero": [("x is -0.0", "x is < 0.0"), ("x is -0.0", "x is -5e-324")],
            "Positive": [("x > 0", "x >= 0"), ("x > 0", "x is not <= 0")],
            "Folded": [("0.1 + 0.2", "0.3"), ("x >= 0.1 + 0.2", "x > 0.1 + 0.2")],
            "Between": [("> 0 and <= 14.5 or 99", ">= 0 and <= 14.5 or 99"), ("> 0 and <= 14.5 or 99", "> 0 and < 14.5 or 99"),
                        ("> 0 and <= 14.5 or 99", "> 0 and <= 14.5 or 99.00000000000001"), ("> 0 and <= 14.5 or 99", "> 0 and <= 14.5")],
            "Outside": [("is not (>= -1.5 and <= 1.5)", "is < -1.5 or > 1.5"), ("is not (>= -1.5 and <= 1.5)", "is not (> -1.5 and <= 1.5)")],
            "Unordered": [("x is double.NaN", "x == double.NaN"), ("x is double.NaN", "x is not double.NaN")],
            "Never": [("x == double.NaN", "x is double.NaN")],
            "Always": [("x != double.NaN", "x is not double.NaN")],
            "Endless": [("x == double.PositiveInfinity", "x >= double.MaxValue"), ("x <= double.NegativeInfinity", "x < double.NegativeInfinity"),
                        ("x <= double.NegativeInfinity", "x <= double.MinValue")],
            "Largest": [("x >= double.MaxValue", "x > double.MaxValue"), ("x >= double.MaxValue", "x >= 1.7976931348623155e308")],
            "Smallest": [("< 1e-323", "<= 1e-323"), ("> 0 and < 1e-323", ">= 0 and < 1e-323"), ("< 1e-323", "< 1.5e-323")],
            "Table": [("< 0 => Band.Low", "<= 0 => Band.Low"), ("<= 2.5 => Band.Mid", "< 2.5 => Band.Mid"),
                      ("double.NaN => Band.Low", "double.NaN => Band.High"), ("_ => Band.High", "_ => Band.Mid")],
            "Closed": [("<= 0 => Band.Low, > 0", "< 0 => Band.Low, >= 0"), ("_ => Band.Mid", "_ => Band.Low")],
            "Heavy": [("Weight: > 2.5", "Weight: >= 2.5"), ("p.Weight >= 0.25", "p.Weight > 0.25"), ("Copies: < 3", "Copies: <= 3")],
            "Two": [("a < 0 && b < 0", "a < 0 && b <= 0"), ("a < 0 && b < 0", "a <= 0 && b < 0"), ("a < 0 && b < 0", "a < 0 || b < 0")],
            "Unused": [("Unused(double x, bool b) => b", "Unused(double x, bool b) => b && x is not double.NaN"),
                       ("Unused(double x, bool b) => b", "Unused(double x, bool b) => b && x < double.PositiveInfinity")],
        }
        self.assertEqual(set(faults), set(self.double_reference()))
        for name, edits in faults.items():
            for old, new in edits:
                with self.subTest(unit=name, fault=new):
                    self.write_ranged_spec(self.DOUBLE_SOURCE, self.double_reference(), "Desk.Scales.")
                    self.assertEqual(self.DOUBLE_SOURCE.count(old), 1, old)
                    self.source.write_text(self.DOUBLE_SOURCE.replace(old, new))
                    self.run_tool("inventory")
                    self.assertIn(f"FAIL Desk.Scales.{name}(", self.run_tool("run", ok=False))

    def test_double_domains_must_cover_every_double_once(self):
        written = "domains.x: a range of a double is written <first>..<last> in decimal numbers, either end may be left out, and > before the first or < before the last leaves that number out; found: "
        once = 'domains.x: the ranges must cover every double value exactly once, such as "..<0", "0..<0.5", "0.5.."; found: '
        cases = [
            ("gap_of_one_value", ["..<0.5", ">0.5.."], once + "..<0.5, >0.5.."),
            ("overlap_of_one_value", ["..0.5", "0.5.."], once),
            ("one_step_apart", ["..<0.5", "0.5000000000000001.."], once),
            ("whole_number_style", ["..0", "1.."], once),
            ("no_start", ["0.5.."], once),
            ("empty_list", [], once),
            ("mark_without_number", [">..0.5", ">0.5.."], written + ">..0.5"),
            ("open_end_without_number", ["..<", "0.5.."], written + "..<"),
            ("hexadecimal", ["..<0x1", "0x1.."], written + "..<0x1"),
            ("suffix", ["..<0.5d", "0.5d.."], written + "..<0.5d"),
            ("comma", ["..<0,5", "0,5.."], written + "..<0,5"),
            ("too_large", ["..<1e999", "1e999.."], written + "..<1e999"),
            ("rounds_to_zero", ["..<1e-400", "1e-400.."], written + "..<1e-400"),
            ("negative_rounds_to_zero", ["..-4.9e-325", ">0.."], written + "..-4.9e-325"),
            ("nan_listed", ["..<0.5", "0.5..", "#nan"], written + "#nan"),
            ("any_listed", ["#any"], written + "#any"),
            ("line_feed", ["..<0.5\n", "0.5.."], written + "..<0.5\n"),
            ("wrong_mark_at_start", ["..<0.5", "<0.5.."], written + "<0.5.."),
            ("empty_range", ["..0.5", ">0.5..0.5", ">0.5.."], "domains.x: >0.5..0.5 is not a range of double"),
            ("backwards", ["..<0.25", "0.5..0.25", ">0.5.."], "domains.x: 0.5..0.25 is not a range of double"),
            ("null_entry", [None, "0.5.."], written),
        ]
        self.source.write_text("public static class Decision { public static bool Decide(double x) => x < 0.5; }")

        def spec(ranges, rows=None):
            rows = rows or [{"input": [token], "outcome": token == ranges[0]} for token in ranges + ["#nan"]]
            return {"units": {"Decision.Decide": {"requirement": "Below one half", "parameters": ["x"], "domains": {"x": ranges},
                                                  "rows": rows, "unsettled": []}}}
        for kind, ranges, message in cases:
            with self.subTest(kind=kind):
                self.write_spec(spec(ranges, [{"input": ["#any"], "outcome": True}]))
                self.assertIn("Decision.Decide: " + message, self.run_tool("inventory", ok=False))
                self.assertFalse(self.out.exists())
        accepted = [(["..<0.5", "0.5.."], 1), (["..<5E-1", "0.500.."], 1), (["0.5..", "..<0.5"], 1),
                    (["..<-1e3", "-1000..<0.5", "0.5..<1E+300", "1e300.."], 2), (["..<-0.0", "0..<0.5", "0.5..0.50", ">0.5.."], 2)]
        for ranges, below in accepted:
            with self.subTest(ranges=ranges):
                ordered = sorted(ranges, key=lambda token: -math.inf if token.startswith("..") else float(token.lstrip(">").split("..")[0]))
                self.write_spec(spec(ranges, [{"input": [token], "outcome": ordered.index(token) < below} for token in ranges]
                                     + [{"input": ["#nan"], "outcome": False}]))
                self.run_tool("inventory")
                self.assertIn("PASS Decision.Decide", self.run_tool("run"))
        self.write_spec(spec(["..<0.5", "0.5.."], [{"input": ["..<0.5"], "outcome": True}, {"input": ["0.5.."], "outcome": False}]))
        self.assertIn("the rows must cover each of the 3 combinations of cells; 1 of them have no row", self.run_tool("inventory", ok=False))
        self.write_spec(spec(["..<0.5", "0.5.."], [{"input": ["..<0.50"], "outcome": True}]))
        self.assertIn("row input must match parameters; x accepts ..<0.5, 0.5.., #nan, or #any for all of them", self.run_tool("inventory", ok=False))
        self.write_spec(spec(["..<0.5", "0.5.."], [{"input": ["..<0.5"], "outcome": True}, {"input": ["0.5.."], "outcome": False},
                                                    {"input": ["#nan"], "outcome": True}]))
        self.run_tool("inventory")
        self.assertIn("FAIL Decision.Decide(NaN): expected True, got False", self.run_tool("run", ok=False))

    def test_unsupported_double_code_rejects_with_its_reason(self):
        misuse = "a double input can only be compared with a constant or matched by a pattern"
        cases = [
            ("public static bool Decide(double x) => x + 1 > 2;", misuse),
            ("public static bool Decide(double x) => x * 2 == 1;", misuse),
            ("public static bool Decide(double x, double y) => x > y;", misuse),
            ("public static bool Decide(double x, double y) => x == y;", misuse),
            ("public static bool Decide(double x, int n) => x > n;", misuse),
            ("public static bool Decide(double x) => x > x;", misuse),
            ("public static bool Decide(double x) => -x > 1;", "unsupported expression UnaryMinusExpression"),
            ("public static bool Decide(double x) => System.Math.Abs(x) > 1;", "unsupported expression InvocationExpression"),
            ("public static bool Decide(double x) => double.IsNaN(x);", "unsupported expression InvocationExpression"),
            ("public static bool Decide(double x) => x.Equals(0.5);", "unsupported expression InvocationExpression"),
            ("public static bool Decide(double x) => (int)x > 1;", "unsupported expression CastExpression"),
            ("public static bool Decide(double x) => (float)x > 1;", "unsupported expression CastExpression"),
            ("public static bool Decide(double x) => x is > double.NaN;", "CS8782"),
            ("public static bool Decide(double x) => x is double;", "unsupported expression IsExpression"),
            ("public static bool Decide(double x) => x is var y;", "unsupported pattern VarPattern"),
            ("public static bool Decide(double x) => x switch { < 0 => true, >= 0 => false };", "unnamed enum values, null and NaN included; add a discard arm"),
            ("public static bool Decide(double x) => x switch { < 0.5 => true, > 0.5 => false, double.NaN => true };", "add a discard arm"),
            ("public static bool Decide(int n) => n > 2.5;", "an integer input can only be compared with a constant of an integer type"),
            ("public static bool Decide(float f) => f > 0;", "parameters are bool, integers, double, strings, and enums and records declared in the file"),
            ("public static bool Decide(double? x) => x > 0;", "parameters are bool, integers, double, strings"),
            ("public static bool Decide(in double x) => x > 0;", "without modifiers other than in on a record"),
        ]
        for method, reason in cases:
            with self.subTest(method=method):
                self.source.write_text("public static class Decision { " + method + " }")
                output = self.run_tool("paths", ok=False)
                self.assertIn("REJECTED", output)
                self.assertIn(reason, output)
        for method in ("public static bool Decide(double x) => x is 1;", "public static bool Decide(double x) => 1 > x == true;",
                       "public static bool Decide(double x) => x switch { < 0 => true, >= 0 => false, double.NaN => false };",
                       "public static bool Decide(double x) => x is > 0.5 and < 0.25 or 3;"):
            with self.subTest(method=method):
                self.source.write_text("public static class Decision { " + method + " }")
                self.assertIn('"type": "double"', self.run_tool("paths"))

    def test_a_row_can_stand_for_every_cell_of_an_input(self):
        spec = copy.deepcopy(self.original)
        unit = spec["units"]["Example.Decision.CanBorrow"]
        full = json.loads(self.run_tool("inventory"))
        refused = [row for row in unit["rows"] if row["input"][1] is True]
        self.assertEqual({row["outcome"] for row in refused}, {False})
        unit["rows"] = [row for row in unit["rows"] if row not in refused] + [{"input": ["#any", True], "outcome": False}]
        self.write_spec(spec)
        merged = json.loads(self.run_tool("inventory"))
        self.assertEqual(merged["units"][0]["checks"], full["units"][0]["checks"])
        self.assertIn("PASS Example.Decision.CanBorrow 4 checks (every input)", self.run_tool("run"))
        unit["rows"].append({"input": [True, "#any"], "outcome": False})
        self.write_spec(spec)
        self.assertIn("Example.Decision.CanBorrow: two rows cover the same combination of cells", self.run_tool("inventory", ok=False))
        # The combinations are counted over the inputs of which some row names a cell.
        unit["rows"] = [{"input": ["#any", True], "outcome": False}]
        self.write_spec(spec)
        self.assertIn("the rows must cover each of the 2 combinations of cells; 1 of them have no row", self.run_tool("inventory", ok=False))
        unit["rows"] = [{"input": [False, True], "outcome": False}]
        self.write_spec(spec)
        self.assertIn("the rows must cover each of the 4 combinations of cells; 3 of them have no row", self.run_tool("inventory", ok=False))
        unit["rows"] = [{"input": ["#any", "#any"], "outcome": "#any"}]
        self.write_spec(spec)
        self.assertIn("row outcome must be one of False, True", self.run_tool("inventory", ok=False))
        unit["rows"] = [{"input": ["#any", "#all"], "outcome": False}]
        self.write_spec(spec)
        self.assertIn("suspended accepts False, True, or #any for all of them", self.run_tool("inventory", ok=False))

        # A record field that a row leaves out stands for every cell of the field.
        spec = self.use_example("Renewal")
        rows = spec["units"]["Example.Renewals.CanRenew"]["rows"]
        full = json.loads(self.run_tool("inventory"))
        reserved = [row for row in rows if row["input"][0]["Reserved"] is True]
        self.assertEqual(len(reserved), 6)
        self.assertEqual({row["outcome"] for row in reserved}, {False})
        spec["units"]["Example.Renewals.CanRenew"]["rows"] = [row for row in rows if row not in reserved] + [
            {"input": [{"Reserved": True}], "outcome": False}]
        self.write_spec(spec)
        self.assertEqual(json.loads(self.run_tool("inventory"))["units"][0]["checks"], full["units"][0]["checks"])
        self.assertIn("PASS Example.Renewals.CanRenew 12 checks (cells)", self.run_tool("run"))
        spec["units"]["Example.Renewals.CanRenew"]["rows"].append({"input": [{}], "outcome": False})
        self.write_spec(spec)
        self.assertIn("two rows cover the same combination of cells", self.run_tool("inventory", ok=False))

        # The token is no string of a string input, in a spec or in the code.
        self.use_example("LateFee")
        late = json.loads((SKILL / "assets/csharp/LateFee.spec.json").read_text())
        late["units"]["Example.Fees.LateFee"]["domains"]["membership"] = ["staff", "#any"]
        self.write_spec(late)
        self.assertIn("#any stands for all cells, and none of them is listed", self.run_tool("inventory", ok=False))
        self.source.write_text('public static class Decision { public static bool Decide(string s) => s == "#any" || s == "a"; }')
        self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["domains"][0]["values"], ["a", "#null", "#other"])

    def test_an_input_that_nothing_reads_is_not_tried_in_every_combination(self):
        def checks(body, rows, parameters=4):
            names = [f"p{i}" for i in range(parameters)]
            self.source.write_text("public static class Decision { public static bool Decide(" + ", ".join(f"bool {name}" for name in names)
                                   + ") => " + body + "; }")
            self.write_spec({"units": {"Decision.Decide": {"requirement": "First input", "parameters": names, "rows": rows, "unsettled": []}}})
            return [check["input"] for check in json.loads(self.run_tool("inventory"))["units"][0]["checks"]]
        first = [{"input": [False, "#any", "#any", "#any"], "outcome": False}, {"input": [True, "#any", "#any", "#any"], "outcome": True}]
        tried = checks("p0", first)
        self.assertEqual(tried, [[False, False, False, False], [False, True, True, True], [True, False, False, False], [True, True, True, True]])
        self.assertIn("PASS Decision.Decide 4 checks (cells)", self.run_tool("run"))
        paths = json.loads(self.run_tool("paths"))["units"][0]
        self.assertEqual((paths["cases"], paths["claim"]), (4, "cells"))
        # An input that a condition reads is tried in every combination, whatever the rows say.
        self.assertEqual(len(checks("p0 && !p3", first)), 8)
        self.assertIn("FAIL Decision.Decide(True,False,False,True): expected True, got False", self.run_tool("run", ok=False))
        self.assertEqual(len(checks("p0 || (p1 & p2 & p3)", first)), 16)
        self.assertIn("FAIL Decision.Decide(False,True,True,True): expected False, got True", self.run_tool("run", ok=False))
        self.assertEqual(len(checks("p0 || p1 is true || p2 == true || !p3 == false", first)), 16)
        # An input of which a row names a cell is tried in every combination too.
        named = [{"input": [False, "#any", "#any", "#any"], "outcome": False}, {"input": [True, True, "#any", "#any"], "outcome": True},
                 {"input": [True, False, "#any", "#any"], "outcome": True}]
        self.assertEqual(len(checks("p0", named)), 8)
        full = [{"input": list(cells), "outcome": cells[0]} for cells in itertools.product([False, True], repeat=4)]
        self.assertEqual(len(checks("p0", full)), 16)
        # Number inputs that nothing reads are tried side by side, each at all of its values.
        self.source.write_text("public readonly record struct Wide(" + ", ".join(f"double P{i}" for i in range(12)) + ", int Count, bool Kept); "
                               "public static class Decision { public static bool Decide(Wide w) => w.Kept; }")
        self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["cases"], 8)
        self.write_spec({"units": {"Decision.Decide": {
            "requirement": "Kept", "parameters": ["w"], "domains": {**{f"w.P{i}": [".."] for i in range(12)}, "w.Count": [".."]},
            "rows": [{"input": [{"Kept": False}], "outcome": False}, {"input": [{"Kept": True}], "outcome": True}], "unsettled": []}}})
        unit = self.report(self.run_tool("inventory"))["units"][0]
        self.assertEqual(unit["cases"], 8)
        for field in ("P0", "P11"):
            values = [self.real(check["input"][0][field]) for check in unit["checks"]]
            self.assertEqual({repr(value) for value in values}, {"-inf", "inf", "nan", repr(values[1])})
            self.assertTrue(math.isfinite(values[1]))
        self.assertEqual({check["input"][0]["Count"] for check in unit["checks"]}, {-2**31, 2**31 - 1})
        self.assertIn("PASS Decision.Decide 8 checks (cells)", self.run_tool("run"))
        # A field counts as read whichever way a condition reads it.
        for body in ("w is { Kept: true }", "w switch { { Kept: true } => true, _ => false }", "w.Kept switch { true => true, _ => false }",
                     "w.Kept == true", "!!w.Kept", "w.Kept ? true : false", "w is { Kept: true, Count: > 5 } or { Kept: true, Count: <= 5 }"):
            with self.subTest(body=body):
                self.source.write_text(self.source.read_text().split(" => ")[0] + " => " + body + "; }")
                self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["cases"], 8 if "Count" not in body else 2 * 4 * 4)
                self.run_tool("inventory")
                self.assertIn("PASS Decision.Decide", self.run_tool("run"))

    RULE_SOURCE = """namespace Desk;
public enum Standing { Good, Suspended }
public readonly record struct Loan(int Id, double DailyRate, int DaysLate, double Fee, long Total, Standing Standing, bool Staff, string Note, short Copies);
public readonly record struct Step(double Days, int Tick);
public readonly struct Accounts
{
    public double Fee(in Loan loan, in Step step)
    {
        if (loan.DaysLate <= 0) return 0;
        if (loan.Staff) return loan.Fee / 2;
        return loan.Fee + loan.DailyRate * step.Days;
    }
    public int Next(in Step step) => step.Tick + 1;
    public long Sum(in Loan loan) => loan.Total * 2L - -5 + loan.DaysLate / 3;
    public double Mixed(in Loan loan) => loan.DailyRate > 10 ? (loan.Fee + 1) * (loan.Total + loan.DaysLate) : -loan.Fee - 2 * 3.0;
    public Loan Close(in Loan loan) => loan.Fee is double.NaN
        ? loan with { Fee = 0, Standing = Standing.Suspended, Staff = false }
        : loan.Standing == Standing.Suspended ? loan with { Standing = Standing.Good, Total = loan.Total + loan.DaysLate } : loan;
}
public static class Plain
{
    public static double Clamp(double x) => x < 0 ? 0 : x > 1 ? 1 : x;
    public static int Count(int days) => days <= 0 ? 0 : days;
    public static double Scale(double speed, int ticks) => speed >= 0.25 ? speed * ticks : 0;
    public static long Widened(int a, long b) => a - b;
    public static double Ratio(long a, int b) => a / 4 * 0.5 + b;
    public static int Negated(int a) => -a / -3;
    public static double Flip(double x) => -x;
    public static Loan Keep(Loan loan, bool flip) => flip ? loan with { Staff = loan.Staff, Copies = loan.Copies } : loan;
}
"""

    @staticmethod
    def wrapped(value, bits):
        """An integer result as C# keeps it without checked: the low bits, read as a signed number."""
        half = 1 << (bits - 1)
        return (value + half) % (1 << bits) - half

    @staticmethod
    def quotient(a, b):
        """Integer division as C# does it, towards zero."""
        return abs(a) // abs(b) * (1 if (a < 0) == (b < 0) else -1)

    def rule_reference(self):
        """Per method its spec and the method again in Python, whose floats add and multiply as C# doubles do, one operation at a time."""
        w32, w64, div = (lambda v: self.wrapped(v, 32)), (lambda v: self.wrapped(v, 64)), self.quotient
        loan = {"loan.Id": [".."], "loan.DailyRate": [".."], "loan.DaysLate": [".."], "loan.Fee": [".."], "loan.Total": [".."],
                "loan.Note": [], "loan.Copies": [".."]}
        step = {"step.Days": [".."], "step.Tick": [".."]}

        def close(loan):
            if math.isnan(loan["Fee"]): return {**loan, "Fee": 0.0, "Standing": "Suspended", "Staff": False}
            if loan["Standing"] == "Suspended": return {**loan, "Standing": "Good", "Total": w64(loan["Total"] + loan["DaysLate"])}
            return loan
        return {
            "Desk.Accounts.Fee": (["loan", "step"], {**loan, **step, "loan.DaysLate": ["..0", "1.."]}, [
                ([{"DaysLate": "..0"}, {}], 0),
                ([{"DaysLate": "1..", "Staff": True}, {}], "loan.Fee / 2"),
                ([{"DaysLate": "1..", "Staff": False}, {}], "loan.Fee + loan.DailyRate * step.Days")],
                lambda loan, step: 0.0 if loan["DaysLate"] <= 0 else loan["Fee"] / 2.0 if loan["Staff"] else loan["Fee"] + loan["DailyRate"] * step["Days"]),
            "Desk.Accounts.Next": (["step"], step, [([{}], "step.Tick + 1")], lambda step: w32(step["Tick"] + 1)),
            "Desk.Accounts.Sum": (["loan"], loan, [([{}], "loan.Total * 2L - -5 + loan.DaysLate / 3")],
                                  lambda loan: w64(loan["Total"] * 2 + 5 + div(loan["DaysLate"], 3))),
            "Desk.Accounts.Mixed": (["loan"], {**loan, "loan.DailyRate": ["..10", ">10.."]}, [
                ([{"DailyRate": ">10.."}], "(loan.Fee + 1) * (loan.Total + loan.DaysLate)"),
                ([{"DailyRate": "..10"}], "-loan.Fee - 6.0"), ([{"DailyRate": "#nan"}], "-loan.Fee - 2 * 3.0")],
                lambda loan: (loan["Fee"] + 1.0) * float(w64(loan["Total"] + loan["DaysLate"])) if loan["DailyRate"] > 10 else -loan["Fee"] - 6.0),
            "Desk.Accounts.Close": (["loan"], loan, [
                ([{"Fee": "#nan"}], {"Fee": 0, "Standing": "Suspended", "Staff": False}),
                ([{"Fee": "..", "Standing": "Suspended"}], {"Standing": "Good", "Total": "loan.Total + loan.DaysLate"}),
                ([{"Fee": "..", "Standing": "Good"}], {}), ([{"Fee": "..", "Standing": "#unnamed"}], {})], close),
            "Desk.Plain.Clamp": (["x"], {"x": ["..<0", "0..1", ">1.."]}, [
                (["..<0"], 0), (["0..1"], "x"), ([">1.."], 1), (["#nan"], "x")], lambda x: 0.0 if x < 0 else 1.0 if x > 1 else x),
            "Desk.Plain.Count": (["days"], {"days": ["..-1", "0.."]}, [(["..-1"], 0), (["0.."], "days")], lambda days: 0 if days <= 0 else days),
            "Desk.Plain.Scale": (["speed", "ticks"], {"speed": ["..<0.25", "0.25.."], "ticks": [".."]}, [
                (["0.25..", "#any"], "ticks * speed"), (["..<0.25", "#any"], 0), (["#nan", "#any"], "0.0")],
                lambda speed, ticks: speed * float(ticks) if speed >= 0.25 else 0.0),
            "Desk.Plain.Widened": (["a", "b"], {"a": [".."], "b": [".."]}, [(["#any", "#any"], "a - b")], lambda a, b: w64(a - b)),
            "Desk.Plain.Ratio": (["a", "b"], {"a": [".."], "b": [".."]}, [(["#any", "#any"], "b + 0.5 * (a / 4)")],
                                 lambda a, b: float(div(a, 4)) * 0.5 + float(b)),
            "Desk.Plain.Negated": (["a"], {"a": [".."]}, [(["#any"], "-a / -3")], lambda a: div(w32(-a), -3)),
            "Desk.Plain.Flip": (["x"], {"x": ["..<0", "0..0", ">0.."]}, [(["#any"], "-x")], lambda x: -x),
            "Desk.Plain.Keep": (["loan", "flip"], loan, [([{}, "#any"], {})], lambda loan, flip: loan),
        }

    def write_rule_spec(self, source=None):
        self.source.write_text(source or self.RULE_SOURCE)
        reference = self.rule_reference()
        self.write_spec({"units": {name: {
            "requirement": name, "parameters": parameters, "domains": domains,
            "rows": [{"input": cells, "outcome": outcome} for cells, outcome in rows], "unsettled": []}
            for name, (parameters, domains, rows, _) in reference.items()}})
        return reference

    def assert_same_result(self, expected, computed, context):
        """Compares what the obligations file expects with what the reference computes, a double as a double and bit for bit."""
        if isinstance(computed, dict):
            self.assertEqual(list(expected), list(computed), context)
            for field in computed:
                self.assert_same_result(expected[field], computed[field], f"{context} {field}")
        elif isinstance(computed, float):
            self.assertTrue(self.same(self.real(expected), computed), f"{context}: {expected!r} is not {computed!r}")
        else:
            self.assertTrue(self.same(expected, computed), f"{context}: {expected!r} is not {computed!r}")

    def test_computed_results_agree_with_a_reference_at_every_check(self):
        reference = self.write_rule_spec()
        paths = {u["name"]: u for u in json.loads(self.run_tool("paths"))["units"]}
        self.assertEqual({name: unit["cases"] for name, unit in paths.items()}, {
            "Desk.Accounts.Fee": 4 * 2 * 4, "Desk.Accounts.Next": 4, "Desk.Accounts.Sum": 4, "Desk.Accounts.Mixed": 7 * 4,
            "Desk.Accounts.Close": 4 * 3 * 4, "Desk.Plain.Clamp": 11, "Desk.Plain.Count": 4, "Desk.Plain.Scale": 7 * 2,
            "Desk.Plain.Widened": 2, "Desk.Plain.Ratio": 2, "Desk.Plain.Negated": 2, "Desk.Plain.Flip": 4, "Desk.Plain.Keep": 2 * 4})
        report = self.report(self.run_tool("inventory"))
        executed = 0
        for unit in report["units"]:
            compute = reference[unit["name"]][3]
            # The spec of Count cuts at 0 where the code cuts at 1, which adds the cell of the single value 0; the spec of Flip cuts around zero, and the code nowhere.
            added = {"Desk.Plain.Count": 1, "Desk.Plain.Flip": 5}.get(unit["name"], 0)
            self.assertEqual(unit["cases"], paths[unit["name"]]["cases"] + added, unit["name"])
            self.assertEqual(unit["claim"], "cells")
            for check in unit["checks"]:
                inputs = self.decoded(unit, check)
                self.assert_same_result(check["expected"], compute(*inputs), f'{unit["name"]} {inputs}')
            executed += unit["cases"]
        checks = {unit["name"].rsplit(".", 1)[1]: unit["checks"] for unit in report["units"]}
        self.assertEqual([(c["input"][0]["Tick"], c["expected"]) for c in checks["Next"]], [(-2**31, -2**31 + 1), (2**31 - 1, -2**31)] * 2)
        self.assertEqual([(c["input"][0], c["expected"]) for c in checks["Count"]], [(-2**31, 0), (-1, 0), (0, 0), (1, 1), (2**31 - 1, 2**31 - 1)])
        self.assertEqual([(c["input"][0], c["expected"]) for c in checks["Negated"]], [(-2**31, 715827882), (2**31 - 1, 715827882)])
        self.assertEqual([c["expected"] for c in checks["Widened"]], [2**63 - 2**31, -2**63 + 2**31])
        flipped = [(self.real(c["input"][0]), self.real(c["expected"])) for c in checks["Flip"]]
        self.assertEqual([(math.copysign(1, value), math.copysign(1, expected)) for value, expected in flipped if value == 0], [(-1.0, 1.0), (1.0, -1.0)])
        clamp = [(self.real(c["input"][0]), self.real(c["expected"])) for c in checks["Clamp"]]
        self.assertEqual([math.copysign(1, expected) for value, expected in clamp if value == 0], [-1.0, 1.0])
        self.assertTrue(math.isnan(clamp[-1][1]))
        self.assertTrue(all(isinstance(c["expected"], dict) and list(c["expected"]) == list(c["input"][0]) for c in checks["Close"]))
        self.assertTrue(any(c["expected"]["Standing"] == "#unnamed" for c in checks["Close"]))
        self.assertTrue(any(c["expected"]["Fee"] == 0 and c["input"][0]["Fee"] == "NaN" and c["expected"]["Staff"] is False for c in checks["Close"]))
        result = self.run_tool("run")
        self.assertEqual(result.count("PASS "), len(reference))
        self.assertEqual(sum(int(line.split()[2]) for line in result.splitlines() if line.startswith("PASS ")), executed)
        self.assertIn("CURRENT", self.run_tool("check"))

        spec = self.use_example("AccrueFee")
        unit = self.report(self.run_tool("inventory"))["units"][0]
        self.assertEqual((unit["name"], unit["cases"]), ("Example.AccrueFee.Apply", 24))

        def apply(loan, step):
            if loan["DaysLate"] <= 0: return loan
            if loan["DaysLate"] <= 14: return {**loan, "Fee": loan["Fee"] + loan["DailyRate"] * step["Days"]}
            return {**loan, "Fee": loan["Fee"] + loan["DailyRate"] * step["Days"] * 2.0, "Standing": "Suspended"}
        for check in unit["checks"]:
            inputs = self.decoded(unit, check)
            self.assert_same_result(check["expected"], apply(*inputs), f"{inputs}")
        self.assertEqual(sorted({check["input"][0]["DaysLate"] for check in unit["checks"]}), [-2**31, 0, 1, 14, 15, 2**31 - 1])
        self.assertTrue(any(math.isfinite(self.real(c["expected"]["Fee"])) and c["expected"]["Fee"] != c["input"][0]["Fee"] for c in unit["checks"]))
        self.assertIn("PASS Example.AccrueFee.Apply 24 checks (cells)", self.run_tool("run"))

    def test_every_planted_fault_in_a_computed_result_fails_a_check(self):
        faults = {
            "Desk.Accounts.Fee": [("loan.DaysLate <= 0) return 0", "loan.DaysLate <= 1) return 0"), ("loan.DaysLate <= 0) return 0", "loan.DaysLate < 0) return 0"),
                                  ("return 0;", "return 0 * loan.Fee;"), ("loan.Fee / 2", "loan.Fee * 0.5"), ("loan.Fee / 2", "loan.Fee / 2.0000000000000004"),
                                  ("if (loan.Staff) return", "if (!loan.Staff) return"),
                                  ("loan.Fee + loan.DailyRate * step.Days", "loan.Fee - loan.DailyRate * step.Days"),
                                  ("loan.Fee + loan.DailyRate * step.Days", "loan.Fee + loan.DailyRate / step.Days"),
                                  ("loan.Fee + loan.DailyRate * step.Days", "(loan.Fee + loan.DailyRate) * step.Days"),
                                  ("loan.Fee + loan.DailyRate * step.Days", "loan.DailyRate + loan.Fee * step.Days"),
                                  ("loan.Fee + loan.DailyRate * step.Days", "loan.Fee + loan.DailyRate * step.Tick"),
                                  ("loan.Fee + loan.DailyRate * step.Days", "loan.Fee + loan.DailyRate * step.Days + 0"),
                                  ("loan.Fee + loan.DailyRate * step.Days", "loan.Fee + loan.DailyRate * step.Days * 1")],
            "Desk.Accounts.Next": [("step.Tick + 1", "step.Tick + 2"), ("step.Tick + 1", "step.Tick - 1"), ("step.Tick + 1", "step.Tick")],
            "Desk.Accounts.Sum": [("* 2L - -5", "* 2L - 5"), ("loan.DaysLate / 3", "loan.DaysLate / 4"), ("loan.Total * 2L", "loan.Total * 3L"),
                                  ("loan.Total * 2L - -5 + loan.DaysLate / 3", "loan.Total * 2L - (-5 + loan.DaysLate / 3)")],
            "Desk.Accounts.Mixed": [("loan.DailyRate > 10", "loan.DailyRate >= 10"), ("(loan.Fee + 1) * (loan.Total + loan.DaysLate)", "(loan.Fee + 1) * loan.Total + loan.DaysLate"),
                                    ("-loan.Fee - 2 * 3.0", "loan.Fee - 2 * 3.0"), ("-loan.Fee - 2 * 3.0", "-loan.Fee - 2 * 3.5"),
                                    ("(loan.Total + loan.DaysLate)", "(loan.Total - loan.DaysLate)"), ("-loan.Fee - 2 * 3.0", "-(loan.Fee + 2 * 3.0)")],
            "Desk.Accounts.Close": [("Fee = 0, Standing", "Fee = 0.5, Standing"), ("Fee = 0, Standing = Standing.Suspended", "Fee = 0, Standing = Standing.Good"),
                                    ("Fee = 0, Standing = Standing.Suspended, Staff = false", "Fee = 0, Standing = Standing.Suspended"),
                                    ("Fee = 0, Standing = Standing.Suspended, Staff = false", "Fee = 0, Standing = Standing.Suspended, Staff = true"),
                                    ("Fee = 0, Standing = Standing.Suspended, Staff = false", "Fee = 0, Standing = Standing.Suspended, Staff = false, Id = 0"),
                                    ("Standing = Standing.Good, Total", "Total"), ("Total = loan.Total + loan.DaysLate", "Total = loan.Total + loan.Id"),
                                    ("loan.Standing == Standing.Suspended", "loan.Standing != Standing.Good"),
                                    ("loan.Fee is double.NaN", "loan.Fee is double.NaN or < 0"), ("loan.DaysLate } : loan;", "loan.DaysLate } : loan with { Id = loan.Id + 1 };")],
            "Desk.Plain.Clamp": [("x < 0 ? 0", "x <= 0 ? 0"), ("x > 1 ? 1", "x > 1 ? 2"), ("x > 1 ? 1 : x", "x > 1 ? 1 : x + 0"), ("x < 0 ? 0", "x < 0 ? -0.0"),
                                 ("x > 1 ? 1 : x", "x > 1 ? 1 : x is double.NaN ? 0 : x")],
            "Desk.Plain.Count": [("days <= 0 ? 0 : days", "days <= 0 ? 0 : days + 0"), ("days <= 0 ? 0", "days <= 1 ? 0"), ("days <= 0 ? 0 : days", "days <= 0 ? days : days")],
            "Desk.Plain.Scale": [("speed >= 0.25", "speed > 0.25"), ("speed * ticks", "speed + ticks"), ("speed * ticks : 0", "speed * ticks : -0.0")],
            "Desk.Plain.Widened": [("a - b", "b - a"), ("a - b", "a + b")],
            "Desk.Plain.Ratio": [("a / 4 * 0.5 + b", "a / 4 * (0.5 + b)"), ("a / 4 * 0.5", "a * 0.5 / 4"), ("a / 4", "a / 5")],
            "Desk.Plain.Negated": [("-a / -3", "a / 3"), ("-a / -3", "-a / 3")],
            "Desk.Plain.Flip": [("=> -x;", "=> 0 - x;"), ("=> -x;", "=> x;"), ("=> -x;", "=> -x * 1;")],
            "Desk.Plain.Keep": [("Staff = loan.Staff", "Staff = flip"), ("Copies = loan.Copies", "Fee = loan.DailyRate"), ("Staff = loan.Staff, Copies", "Staff = !!loan.Staff ? loan.Staff : loan.Staff, Copies")],
        }
        rejected = {"Staff = !!loan.Staff ? loan.Staff : loan.Staff, Copies": "unsupported expression ConditionalExpression"}
        self.assertEqual(set(faults), set(self.rule_reference()))
        for name, edits in faults.items():
            for old, new in edits:
                with self.subTest(unit=name, fault=new):
                    self.assertEqual(self.RULE_SOURCE.count(old), 1, old)
                    self.write_rule_spec(self.RULE_SOURCE.replace(old, new))
                    if new in rejected:
                        self.assertIn(rejected[new], self.run_tool("inventory", ok=False))
                        continue
                    self.run_tool("inventory")
                    failure = self.run_tool("run", ok=False)
                    self.assertIn(f"FAIL {name}(", failure)
                    # Every one of these faults is a different computation, which is reported as such and not as a different number.
                    self.assertIn("the code computes ", failure)
        # The same for the spec: a formula that is changed fails against the unchanged code.
        changes = [("Desk.Accounts.Fee", 2, "loan.Fee + loan.DailyRate * step.Tick"), ("Desk.Accounts.Fee", 1, "loan.Fee * 0.5"), ("Desk.Accounts.Fee", 0, "0.0 * loan.Fee"),
                   ("Desk.Accounts.Next", 0, "step.Tick + 2 - 1"), ("Desk.Accounts.Sum", 0, "loan.Total * 2 + 5 + loan.DaysLate / 3"),
                   ("Desk.Accounts.Mixed", 1, "-(loan.Fee + 6.0)"), ("Desk.Accounts.Close", 0, {"Fee": 0, "Standing": "Suspended"}),
                   ("Desk.Accounts.Close", 1, {"Standing": "Good", "Total": "loan.DaysLate + loan.Total", "Staff": "loan.Staff", "Id": "loan.DaysLate"}),
                   ("Desk.Accounts.Close", 2, {"Standing": "loan.Standing", "Staff": True}), ("Desk.Plain.Clamp", 1, 0.5), ("Desk.Plain.Clamp", 3, 0),
                   ("Desk.Plain.Count", 1, "days + 1 - 1"), ("Desk.Plain.Scale", 0, "speed * ticks * 1"), ("Desk.Plain.Widened", 0, "b - a"),
                   ("Desk.Plain.Ratio", 0, "0.5 * a / 4 + b"), ("Desk.Plain.Keep", 0, {"Fee": "loan.DailyRate"}), ("Desk.Plain.Keep", 0, {"Standing": "Good"})]
        for name, row, outcome in changes:
            with self.subTest(unit=name, stated=outcome):
                self.write_rule_spec()
                spec = json.loads(self.spec.read_text())
                spec["units"][name]["rows"][row]["outcome"] = outcome
                self.write_spec(spec)
                self.run_tool("inventory")
                failure = self.run_tool("run", ok=False)
                self.assertIn(f"FAIL {name}(", failure)
                self.assertIn(", and the spec states ", failure)

    def test_a_formula_is_held_to_the_operations_of_the_code(self):
        def run(source, parameters, domains, rows, ok=True):
            self.source.write_text("public readonly record struct Pair(bool A, bool B, bool Out); public static class Decision { " + source + " }")
            self.write_spec({"units": {"Decision.Apply": {"requirement": "Formula", "parameters": parameters, "domains": domains,
                                                          "rows": [{"input": cells, "outcome": outcome} for cells, outcome in rows], "unsettled": []}}})
            self.run_tool("inventory")
            return self.run_tool("run", ok=ok)
        sum_of_three = "public static double Apply(double a, double b, double c) => a + b * c;"
        open_three = {"a": [".."], "b": [".."], "c": [".."]}
        every = ["#any", "#any", "#any"]
        # The operands of + and of * may change places; nothing else may.
        for stated in ("a + b * c", "b * c + a", "c * b + a", "(a + (c * b))"):
            with self.subTest(stated=stated):
                self.assertIn("PASS Decision.Apply 4 checks (cells)", run(sum_of_three, ["a", "b", "c"], open_three, [(every, stated)]))
        for stated in ("(a + b) * c", "a + c * b * 1", "a + b * c + 0", "a - -(b * c)", "a + b * (c * 1.0)", "1.0 * a + b * c", "a + (0.5 * b) * (c * 2)"):
            with self.subTest(stated=stated):
                self.assertIn(f"the code computes a + b * c, and the spec states {stated}",
                              run(sum_of_three, ["a", "b", "c"], open_three, [(every, stated)], ok=False))
        self.assertIn("PASS", run("public static double Apply(double a, double b, double c) => a - b - c;", ["a", "b", "c"], open_three, [(every, "a - b - c")]))
        for stated in ("a - (b - c)", "a - c - b", "a - (b + c)", "c - (a - b)", "-c + (a - b)"):
            with self.subTest(stated=stated):
                self.assertIn(f"the code computes a - b - c, and the spec states {stated}", run("public static double Apply(double a, double b, double c) => a - b - c;",
                                                          ["a", "b", "c"], open_three, [(every, stated)], ok=False))
        # The compiler widens a branch to the type of the conditional before the result is widened again; both together are one widening.
        mixed = "public static double Apply(bool c, int a, long b) => c ? a : b;"
        self.assertIn("PASS Decision.Apply 4 checks (cells)", run(mixed, ["c", "a", "b"], {"a": [".."], "b": [".."]},
                                                                  [([True, "#any", "#any"], "a"), ([False, "#any", "#any"], "b")]))
        self.assertIn("the code computes a, and the spec states b", run(mixed, ["c", "a", "b"], {"a": [".."], "b": [".."]},
                                                                        [([True, "#any", "#any"], "b"), ([False, "#any", "#any"], "b")], ok=False))
        self.assertIn("PASS", run("public static double Apply(bool c, int a, long b) => c switch { true => a + 1, false => b * 2 };", ["c", "a", "b"],
                                  {"a": [".."], "b": [".."]}, [([True, "#any", "#any"], "a + 1"), ([False, "#any", "#any"], "b * 2")]))
        # An input whose name is a C# keyword is written in a formula as in the code.
        self.assertIn("PASS", run("public static int Apply(int @event) => @event + 1;", ["event"], {"event": [".."]}, [(["#any"], "@event + 1")]))
        # A cell with one value: the formula is compared at that value, so two ways to write its result agree.
        count = "public static int Apply(int days) => days <= 0 ? 0 : days;"
        self.assertIn("PASS Decision.Apply 5 checks (cells)", run(count, ["days"], {"days": ["..-1", "0.."]}, [(["..-1"], 0), (["0.."], "days")]))
        self.assertIn("FAIL Decision.Apply(1): the code computes days, and the spec states 0",
                      run(count, ["days"], {"days": ["..1", "2.."]}, [(["..1"], 0), (["2.."], "days")], ok=False))
        self.assertIn("PASS", run("public static int Apply(int days) => days == 7 ? days * 2 : days;", ["days"], {"days": ["..6", "7..7", "8.."]},
                                  [(["..6"], "days"), (["7..7"], 14), (["8.."], "days")]))
        # The number 0 of a double holds two values, so there the formula has to be the code's.
        clamp = "public static double Apply(double x) => x <= 0 ? 0 : x;"
        self.assertIn("PASS", run(clamp, ["x"], {"x": ["..0", ">0.."]}, [(["..0"], 0), ([">0.."], "x"), (["#nan"], "x")]))
        self.assertIn("FAIL Decision.Apply(-0): the code computes 0, and the spec states x",
                      run(clamp, ["x"], {"x": ["..<0", "0.."]}, [(["..<0"], 0), (["0.."], "x"), (["#nan"], "x")], ok=False))
        self.assertIn("PASS", run("public static double Apply(double x) => x == 2.5 ? 5 : x * 2;", ["x"], {"x": [".."]}, [(["#any"], "x * 2")]))
        # Inputs that no row names are tried side by side, so a formula over them is never compared at the values tried.
        swapped = "public static Pair Apply(Pair p) => p with { Out = p.A };"
        self.assertIn("PASS Decision.Apply 2 checks (cells)", run(swapped, ["p"], {}, [([{}], {"Out": "p.A"})]))
        self.assertIn("FAIL Decision.Apply({A=False,B=False,Out=False}): Out: the code computes p.A, and the spec states p.B",
                      run(swapped, ["p"], {}, [([{}], {"Out": "p.B"})], ok=False))
        self.assertIn("Out: the code computes p.A, and the spec states false", run(swapped, ["p"], {}, [([{}], {"Out": False})], ok=False))
        self.assertIn("PASS Decision.Apply 4 checks (cells)",
                      run(swapped, ["p"], {}, [([{"A": True}], {"Out": True}), ([{"A": False}], {"Out": "false"})]))
        self.assertIn("FAIL Decision.Apply({A=True,B=False,Out=False}): Out: the code computes p.A, and the spec states p.B",
                      run(swapped, ["p"], {}, [([{"A": True}], {"Out": "p.B"}), ([{"A": False}], {"Out": False})], ok=False))
        # The unnamed cell of an enum holds many values and is tried at one, so there a formula is never compared at the value tried.
        self.source.write_text("public enum Tier { Basic, Gold } public readonly record struct Card(Tier First, Tier Second); "
                               "public static class Decision { public static Card Apply(Card card) => card with { First = card.Second }; }")
        tiers = ("Basic", "Gold", "#unnamed")

        def cards(unnamed):
            return {"units": {"Decision.Apply": {"requirement": "Formula", "parameters": ["card"], "rows": [
                {"input": [{"First": first, "Second": second}], "outcome": unnamed if first == second == "#unnamed" else {"First": "card.Second"}}
                for first in tiers for second in tiers], "unsettled": []}}}
        self.write_spec(cards({"First": "card.Second"}))
        self.run_tool("inventory")
        self.assertIn("PASS Decision.Apply 9 checks (cells)", self.run_tool("run"))
        self.write_spec(cards({}))
        self.run_tool("inventory")
        self.assertIn("FAIL Decision.Apply({First=#unnamed,Second=#unnamed}): First: the code computes card.Second, and the spec states card.First",
                      self.run_tool("run", ok=False))
        # The code turns the negative zero into the positive one, which the formula x does not.
        self.assertIn("FAIL Decision.Apply(-0): the code computes 0, and the spec states x",
                      run("public static double Apply(double x) => x == 0 ? 0 : x;", ["x"], {"x": [".."]}, [(["#any"], "x")], ok=False))

    def test_malformed_formulas_and_outcomes_reject_with_their_reason(self):
        source = ("public enum Standing { Good, Suspended } "
                  "public readonly record struct Loan(double Fee, int Days, long Total, Standing Standing, bool Staff, string Note, short Copies); "
                  "public static class Decision { public static Loan Apply(Loan loan, double rate, bool flag) => loan; "
                  "public static int Count(int days, double rate) => days; }")
        made = "a formula is made of input labels, numbers of type int, long or double, + - * /, negation and parentheses; found: "
        kept = "a value that is not an int, a long or a double is kept from an input of its type, or set to true, false or a named member"
        loan_cases = [
            ({"Fee": "loan.Fee + rte"}, "Decision.Apply: Fee: " + made + "rte"),
            ({"Fee": "loan.Fee +"}, "Fee: " + made + "loan.Fee +"),
            ({"Fee": ""}, "Fee: " + made),
            ({"Fee": "loan.Fee rate"}, "Fee: " + made + "loan.Fee rate"),
            ({"Fee": "loan.Fee % 2"}, "Fee: " + made + "loan.Fee % 2"),
            ({"Fee": "System.Math.Abs(loan.Fee)"}, "Fee: " + made + "System.Math.Abs(loan.Fee)"),
            ({"Fee": "+loan.Fee"}, "Fee: " + made + "+loan.Fee"),
            ({"Fee": "loan.Fee * 1f"}, "Fee: " + made + "1f"),
            ({"Fee": "loan.Fee * 1m"}, "Fee: " + made + "1m"),
            ({"Fee": "loan.Fee * 3000000000"}, "Fee: " + made + "3000000000"),
            ({"Fee": "(double)loan.Days"}, "Fee: " + made + "(double)loan.Days"),
            ({"Fee": "loan.Days > 0 ? 1 : 2"}, "Fee: " + made + "loan.Days > 0 ? 1 : 2"),
            ({"Fee": "loan.fee"}, "Fee: " + made + "loan.fee"),
            ({"Fee": "Fee"}, "Fee: " + made + "Fee"),
            ({"Fee": "loan.Fee + flag"}, "Fee: " + self.ARITHMETIC),
            ({"Fee": "loan.Fee + loan.Note"}, "Fee: " + self.ARITHMETIC),
            ({"Fee": "loan.Fee + loan.Copies"}, "Fee: " + self.ARITHMETIC),
            ({"Fee": "-flag"}, "Fee: " + self.ARITHMETIC),
            ({"Staff": "-flag"}, "Staff: " + self.ARITHMETIC),
            ({"Fee": "1000000 * 1000000"}, "Fee: a constant part of the formula overflows its type"),
            ({"Days": "2147483647 + 1"}, "Days: a constant part of the formula overflows its type"),
            ({"Days": "-2147483647 - 2"}, "Days: a constant part of the formula overflows its type"),
            ({"Days": "-(-2147483648)"}, "Days: a constant part of the formula overflows its type"),
            ({"Total": "9223372036854775807 + 1"}, "Total: a constant part of the formula overflows its type"),
            ({"Total": "3037000500L * 3037000500L"}, "Total: a constant part of the formula overflows its type"),
            ({"Days": "2147483648"}, "Days: " + made + "2147483648"),
            ({"Days": "-(2147483648)"}, "Days: " + made + "2147483648"),
            ({"Fee": "loan.Fee // twice"}, "Fee: " + made + "loan.Fee // twice"),
            ({"Fee": "loan.Fee /* twice */ * 2"}, "Fee: " + made + "loan.Fee /* twice */ * 2"),
            ({"Fee": "loan.Fee\n#if false\n + 1\n#endif"}, "Fee: " + made + "loan.Fee\n#if false"),
            ({"Fee": "loan.Fee\n#error stop"}, "Fee: " + made + "loan.Fee\n#error stop"),
            ({"Fee": "loan.Fee\n#pragma warning disable"}, "Fee: " + made + "loan.Fee\n#pragma"),
            ({"Fee": "loan.Fee;"}, "Fee: " + made + "loan.Fee;"),
            ({"Days": "loan.Days / loan.Days"}, "Days: " + self.ARITHMETIC),
            ({"Days": "loan.Days / 0"}, "Days: " + self.ARITHMETIC),
            ({"Days": "loan.Days / -1"}, "Days: " + self.ARITHMETIC),
            ({"Days": "loan.Days / (1 - 2)"}, "Days: " + self.ARITHMETIC),
            ({"Total": "loan.Total / (2L - 2)"}, "Total: " + self.ARITHMETIC),
            ({"Days": "loan.Fee"}, "Days: a double value does not fit a result of type int"),
            ({"Days": "loan.Total"}, "Days: a long value does not fit a result of type int"),
            ({"Days": "loan.Days * 1.0"}, "Days: a double value does not fit a result of type int"),
            ({"Total": "rate"}, "Total: a double value does not fit a result of type long"),
            ({"Fee": "flag"}, "Fee: " + self.ARITHMETIC),
            ({"Fee": True}, "Fee: " + self.ARITHMETIC),
            ({"Fee": None}, "Fee: an outcome is a formula, written as a string or as a number"),
            ({"Fee": ["loan.Fee"]}, "Fee: an outcome is a formula, written as a string or as a number"),
            ({"Fee": {"value": 1}}, "Fee: an outcome is a formula, written as a string or as a number"),
            ({"Staff": 1}, "Staff: " + kept),
            ({"Staff": "Good"}, "Staff: " + made + "Good"),
            ({"Staff": "loan.Days"}, "Staff: " + made + "loan.Days"),
            ({"Staff": "flag + flag"}, "Staff: " + self.ARITHMETIC),
            ({"Staff": "-1"}, "Staff: " + kept),
            ({"Standing": True}, "Standing: " + kept),
            ({"Standing": "Closed"}, "Standing: " + made + "Closed"),
            ({"Standing": "#unnamed"}, "Standing: " + made + "#unnamed"),
            ({"Standing": "flag"}, "Standing: " + made + "flag"),
            ({"Standing": 0}, "Standing: " + kept),
            ({"Note": "loan.Staff"}, "Note: " + made + "loan.Staff"),
            ({"Note": True}, "Note: " + kept),
            ({"Copies": 1}, "Copies: " + kept),
            ({"Copies": "loan.Days"}, "Copies: " + made + "loan.Days"),
            ({"fee": "loan.Fee"}, "Decision.Apply: row outcome must be an object with fields among Fee, Days, Total, Standing, Staff, Note, Copies; a field that is left out is kept"),
            ("loan", "row outcome must be an object with fields among"),
            (["loan.Fee"], "row outcome must be an object with fields among"),
        ]
        self.source.write_text(source)

        def spec(apply, count="days"):
            return {"units": {
                "Decision.Apply": {"requirement": "Formula", "parameters": ["loan", "rate", "flag"],
                                   "domains": {"loan.Fee": [".."], "loan.Days": [".."], "loan.Total": [".."], "loan.Note": [], "loan.Copies": [".."], "rate": [".."]},
                                   "rows": [{"input": [{}, "#any", "#any"], "outcome": apply}], "unsettled": []},
                "Decision.Count": {"requirement": "Formula", "parameters": ["days", "rate"], "domains": {"days": [".."], "rate": [".."]},
                                   "rows": [{"input": ["#any", "#any"], "outcome": count}], "unsettled": []}}}
        for outcome, message in loan_cases:
            with self.subTest(outcome=outcome):
                self.write_spec(spec(outcome))
                self.assertIn(message, self.run_tool("inventory", ok=False))
                self.assertFalse(self.out.exists())
        for outcome, message in [("days * rate", "Decision.Count: a double value does not fit a result of type int"), ("day", "Decision.Count: " + made + "day"),
                                 ({"days": "days"}, "Decision.Count: an outcome is a formula, written as a string or as a number"),
                                 (None, "Decision.Count: an outcome is a formula, written as a string or as a number"), (True, "Decision.Count: " + self.ARITHMETIC),
                                 ("days / 0", "Decision.Count: " + self.ARITHMETIC)]:
            with self.subTest(count=outcome):
                self.write_spec(spec({}, outcome))
                self.assertIn(message, self.run_tool("inventory", ok=False))
        # The lowest int and the lowest long are written as in C#, and a formula may end with a line break.
        for outcome in ({"Days": "-2147483648"}, {"Total": "-9223372036854775808"}, {"Days": -2147483648}, {"Fee": "loan.Fee\n"},
                        {"Total": "2147483647 + 1L"}, {"Fee": "1000000 * 1000000.0"}, {"Days": "65536 * 32767"}):
            with self.subTest(accepted=outcome):
                self.write_spec(spec(outcome))
                self.run_tool("inventory")
        # A word that is an input and a member of the enum is not taken for either.
        self.source.write_text(source.replace("double rate, bool flag", "Standing Good, bool flag").replace("int days, double rate", "int days, bool rate"))
        ambiguous = spec({"Standing": "Good"})
        del ambiguous["units"]["Decision.Apply"]["domains"]["rate"], ambiguous["units"]["Decision.Count"]["domains"]["rate"]
        ambiguous["units"]["Decision.Apply"]["parameters"][1] = "Good"
        self.write_spec(ambiguous)
        self.assertIn("Decision.Apply: Standing: Good is the name of an input and of an enum member, so the outcome does not say which is meant",
                      self.run_tool("inventory", ok=False))
        ambiguous["units"]["Decision.Apply"]["rows"][0]["outcome"] = {"Standing": "Suspended", "Staff": "Good"}
        self.write_spec(ambiguous)
        self.assertIn("Staff: " + made + "Good", self.run_tool("inventory", ok=False))
        ambiguous["units"]["Decision.Apply"]["rows"][0]["outcome"] = {"Standing": "Suspended"}
        self.write_spec(ambiguous)
        self.run_tool("inventory")
        self.source.write_text(source)
        accepted = {"Fee": " ( loan . Fee ) ", "Days": "loan.Days", "Total": "loan.Days", "Standing": "loan.Standing", "Staff": "flag", "Note": "loan.Note", "Copies": "loan.Copies"}
        self.write_spec(spec(accepted))
        self.run_tool("inventory")
        self.assertIn("Total: the code computes loan.Total, and the spec states loan.Days", self.run_tool("run", ok=False))

    def test_unsupported_code_of_a_computed_result_rejects_with_its_reason(self):
        loan = ("public enum Standing { Good, Suspended } "
                "public readonly record struct Loan(double Fee, int Days, long Total, Standing Standing, bool Staff, string Note, short Copies, uint Seen); "
                "public readonly record struct Step(double Days); ")
        result_rule = "the result is bool, an enum declared in the file, int, long, double, or the record type of exactly one parameter"
        method_rule = "only public static methods of a class and public methods of a readonly struct, without attributes or type parameters, are admitted"
        cases = [
            ("public static double Apply(Loan loan) => System.Math.Sqrt(loan.Fee);", "unsupported expression InvocationExpression"),
            ("public static double Apply(Loan loan) => loan.Fee % 2;", "unsupported expression ModuloExpression"),
            ("public static double Apply(Loan loan) => (double)loan.Days;", "unsupported expression CastExpression"),
            ("public static int Apply(Loan loan) => (int)loan.Fee;", "unsupported expression CastExpression"),
            ("public static double Apply(Loan loan) => +loan.Fee;", "unsupported expression UnaryPlusExpression"),
            ("public static int Apply(Loan loan) => ~loan.Days;", "unsupported expression BitwiseNotExpression"),
            ("public static int Apply(Loan loan) => loan.Days << 1;", "unsupported expression LeftShiftExpression"),
            ("public static int Apply(Loan loan) => loan.Days / loan.Days;", self.ARITHMETIC),
            ("public static int Apply(Loan loan) => loan.Days / 0;", self.ARITHMETIC),
            ("public static int Apply(Loan loan) => loan.Days / -1;", self.ARITHMETIC),
            ("public static long Apply(Loan loan) => loan.Total / (loan.Days - loan.Days);", self.ARITHMETIC),
            ("public static int Apply(Loan loan) => loan.Copies + 1;", "Apply: " + self.ARITHMETIC),
            ("public static long Apply(Loan loan) => loan.Seen + 1;", "Apply: " + self.ARITHMETIC),
            ("public static double Apply(Loan loan) => loan.Seen;", "Apply: " + self.ARITHMETIC),
            ("public static double Apply(Loan loan) => loan.Staff ? 1 : 2;", None),
            ("public static double Apply(Loan loan) => loan.Fee > loan.Total ? 1 : 2;", "a double input can only be compared with a constant or matched by a pattern"),
            ("public static double Apply(Loan loan) => loan.Fee + 1 > 2 ? 1 : 2;", "a double input can only be compared with a constant or matched by a pattern"),
            ("public static double Apply(Loan loan) { var fee = loan.Fee; return fee; }", "unsupported statement LocalDeclarationStatement"),
            ("public static double Apply(Loan loan) => new Step(loan.Fee).Days;", "unsupported expression SimpleMemberAccessExpression"),
            ("public static double Apply(Loan loan) => (loan with { Fee = 1 }).Fee;", "unsupported expression SimpleMemberAccessExpression"),
            ("public static double Apply(Loan loan) => double.MaxValue * loan.Fee;", None),
            ("public static double Apply(Loan loan) => loan.Fee * double.Epsilon / double.NaN;", None),
            ("public static double Apply(Loan loan) => loan.Staff switch { true => loan.Fee, false => 0 };", None),
            ("public static double Apply(Loan loan) => loan.Staff switch { true => loan.Fee };", "add a discard arm"),
            ("public static double Apply(Loan loan) => loan.Staff switch { true when loan.Staff => 1, _ => 0 };", "unsupported switch guard"),
            ("public static Loan Apply(Loan loan) => loan with { Note = \"late\" };", "unsupported expression StringLiteralExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Note = null };", "unsupported expression NullLiteralExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Copies = 1 };", "unsupported expression NumericLiteralExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Copies = short.MaxValue };", "unsupported expression SimpleMemberAccessExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Staff = bool.Parse(\"true\") };", "unsupported expression InvocationExpression"),
            ("public static double Apply(Loan loan) => loan.Staff ? loan.Days : 1f;", self.ARITHMETIC),
            ("public static double Apply(Loan loan) => loan.Staff ? 1f : loan.Days;", "unsupported expression NumericLiteralExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Seen = loan.Seen + 1 };", "unsupported expression AddExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Staff = !loan.Staff };", "unsupported expression LogicalNotExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Staff = loan.Days > 3 };", "unsupported expression GreaterThanExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Standing = (Standing)1 };", "unsupported expression CastExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Standing = loan.Staff ? Standing.Good : Standing.Suspended };", "unsupported expression ConditionalExpression"),
            ("public static Loan Apply(Loan loan) => loan with { Fee = loan.Days / loan.Days };", self.ARITHMETIC),
            ("public static Loan Apply(Loan loan) => (loan with { Fee = 1 }) with { Days = 2 };", "unsupported result WithExpression"),
            ("public static Loan Apply(Loan loan) => new Loan(1, 2, 3, Standing.Good, true, null, 4, 5);", "unsupported result ObjectCreationExpression"),
            ("public static Loan Apply(Loan loan) => default;", "unsupported result DefaultLiteralExpression"),
            ("public static Loan Apply(Loan loan) => new();", "unsupported result ImplicitObjectCreationExpression"),
            ("public static Loan Apply(Loan loan, Loan other) => loan;", result_rule),
            ("public static Loan Apply(Step step) => default;", result_rule),
            ("public static Step Apply(Loan loan, Step step) => step with { Days = loan.Fee };", None),
            ("public static Step Apply(Loan loan, Step step) => step with { Days = step.Days * loan.Days + loan.Total };", None),
            ("public static float Apply(Loan loan) => 1;", result_rule),
            ("public static decimal Apply(Loan loan) => 1;", result_rule),
            ("public static short Apply(Loan loan) => loan.Copies;", result_rule),
            ("public static string Apply(Loan loan) => loan.Note;", result_rule),
            ("public static double? Apply(Loan loan) => loan.Fee;", result_rule),
            ("public static (double, double) Apply(Loan loan) => (loan.Fee, loan.Fee);", result_rule),
            ("public static ref readonly double Apply(in Loan loan) => ref System.Runtime.CompilerServices.Unsafe.NullRef<double>();", method_rule),
            ("public static double Apply(ref Loan loan) => loan.Fee;", "without modifiers other than in on a record"),
            ("public static double Apply(ref readonly Loan loan) => loan.Fee;", "without modifiers other than in on a record"),
            ("public static double Apply(out Loan loan) { loan = default; return 1; }", "without modifiers other than in on a record"),
            ("public static double Apply(in Loan loan, in double rate) => rate;", "without modifiers other than in on a record"),
        ]
        for method, reason in cases:
            with self.subTest(method=method):
                self.source.write_text(loan + "public static class Decision { " + method + " }")
                if reason is None:
                    self.assertIn('"name": "Decision.Apply"', self.run_tool("paths"))
                    continue
                output = self.run_tool("paths", ok=False)
                self.assertIn("REJECTED", output)
                self.assertIn(reason, output)
        class_rule = "only public static classes and public readonly structs, non-generic and containing methods, are admitted; no fields, constructors, interfaces or nested types"
        structs = [
            ("public readonly struct Rule { public double Apply(in Loan loan) => loan.Fee; }", None),
            ("public readonly struct Rule { public double Apply(in Loan loan) => loan.Fee; public Loan Keep(in Loan loan) => loan; }", None),
            ("public struct Rule { public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("readonly struct Rule { public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public readonly partial struct Rule { public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public partial struct Rule { public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("readonly partial struct Rule { public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public readonly ref struct Rule { public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public readonly struct Rule<T> { public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public interface IRule { double Apply(in Loan loan); } public readonly struct Rule : IRule { public double Apply(in Loan loan) => loan.Fee; }", "unsupported declaration"),
            ("public readonly struct Rule : System.IDisposable { public void Dispose() { } }", class_rule),
            ("public readonly struct Rule { private readonly double rate; public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public readonly struct Rule { public Rule() { } public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public readonly struct Rule { public double Rate => 1; public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public readonly struct Rule(double rate) { public double Apply(in Loan loan) => loan.Fee; }", class_rule),
            ("public readonly struct Rule { }", class_rule),
            ("public readonly struct Rule { public static double Apply(in Loan loan) => loan.Fee; }", method_rule),
            ("public readonly struct Rule { double Apply(in Loan loan) => loan.Fee; }", method_rule),
            ("public readonly struct Rule { internal double Apply(in Loan loan) => loan.Fee; }", method_rule),
            ("public readonly struct Rule { public readonly double Apply(in Loan loan) => loan.Fee; }", method_rule),
            ("public readonly struct Rule { public double Apply<T>(in Loan loan) => loan.Fee; }", method_rule),
            ("public readonly struct Rule { public Rule Apply(in Loan loan) => this; }", result_rule),
            ("public readonly struct Rule { public bool Apply(in Loan loan) => this.Equals(this); }", "unsupported expression InvocationExpression"),
            ("public readonly struct Rule { public double Apply(in Loan loan) => Other(loan); public double Other(in Loan loan) => loan.Fee; }", "unsupported expression InvocationExpression"),
            ("public static class Rule { public double Apply(in Loan loan) => loan.Fee; }", "CS0708"),
        ]
        for declaration, reason in structs:
            with self.subTest(declaration=declaration):
                self.source.write_text(loan + declaration)
                if reason is None:
                    self.assertIn('"name": "Rule.Apply"', self.run_tool("paths"))
                    continue
                self.assertIn(reason, self.run_tool("paths", ok=False))

    def test_a_struct_rule_and_a_static_method_run_the_same_checks(self):
        body = "loan.Days switch { <= 0 => loan, _ => loan with { Fee = loan.Fee * rate.Factor + 1 } }"
        records = "public readonly record struct Loan(double Fee, int Days); public readonly record struct Rate(double Factor); "
        forms = {
            "struct": records + "public readonly struct Rule { public Loan Apply(in Loan loan, in Rate rate) => " + body + "; }",
            "static": records + "public static class Rule { public static Loan Apply(Loan loan, Rate rate) => " + body + "; }",
            "block": records + "public readonly struct Rule { public Loan Apply(in Loan loan, Rate rate) { if (loan.Days <= 0) { return loan; } else return loan with { Fee = 1 + rate.Factor * loan.Fee }; } }",
        }
        self.write_spec({"units": {"Rule.Apply": {
            "requirement": "A late loan is scaled", "parameters": ["loan", "rate"],
            "domains": {"loan.Fee": [".."], "loan.Days": ["..0", "1.."], "rate.Factor": [".."]},
            "rows": [{"input": [{"Days": "..0"}, {}], "outcome": {}}, {"input": [{"Days": "1.."}, {}], "outcome": {"Fee": "loan.Fee * rate.Factor + 1"}}],
            "unsettled": ["The rounding of the fee is not stated"]}}})
        checks = {}
        for form, source in forms.items():
            with self.subTest(form=form):
                self.source.write_text(source)
                checks[form] = json.loads(self.run_tool("inventory"))["units"]
                result = self.run_tool("run")
                self.assertIn("PASS Rule.Apply 16 checks (cells)", result)
                self.assertIn("UNSETTLED Rule.Apply: The rounding of the fee is not stated", result)
                self.source.write_text(source.replace("<= 0", "<= 1"))
                self.run_tool("inventory")
                self.assertIn("FAIL Rule.Apply({Fee=-Infinity,Days=1},{Factor=-Infinity}): Fee: the code computes loan.Fee, and the spec states loan.Fee * rate.Factor + 1",
                              self.run_tool("run", ok=False))
        self.assertEqual(checks["struct"], checks["static"])
        self.assertEqual(checks["struct"], checks["block"])
        for command in ("check", "run"):
            self.source.write_text(forms["struct"])
            self.run_tool("inventory")
            self.spec.write_text(self.spec.read_text().replace("rate.Factor + 1", "rate.Factor + 1 "))
            self.assertIn("STALE", self.run_tool(command, ok=False))

    def test_unsupported_command_and_output_collision(self):
        self.assertIn("unsupported command", self.run_tool("prune", ok=False))
        self.assertIn("paths accepts only --source", self.run_tool("paths", ok=False, extra=[f"--spec={self.spec}"]))
        self.assertIn("unknown or repeated option", self.run_tool("paths", ok=False, extra=["--verbose=1"]))
        self.assertIn("unknown or repeated option", self.run_tool("paths", ok=False, extra=[f"--source={self.source}"]))
        spec_text = self.spec.read_text()
        for target in (self.source, self.spec):
            with self.subTest(out=target.name):
                self.out = target
                self.assertIn("overwrite", self.run_tool("inventory", ok=False))
        self.assertEqual(self.spec.read_text(), spec_text)
        self.source = self.source.with_suffix(".txt")
        self.source.write_text((SKILL / "assets/csharp/Decision.cs").read_text(), encoding="utf-8")
        self.assertIn("must name a .cs file", self.run_tool("paths", ok=False))

    def test_capabilities_agree_with_the_skill_profile(self):
        tool = json.loads(self.run_tool("capabilities"))
        profile = json.loads((SKILL / "scripts/capabilities.json").read_text())["csharp"]
        self.assertEqual(tool["shapes"], profile["shapes"])
        self.assertIn("project-loading", tool["unsupported"])
        for command, status in profile["commands"].items():
            if status == "unsupported":
                self.assertIn(command, tool["unsupported"])


if __name__ == "__main__":
    unittest.main()
