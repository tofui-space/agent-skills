"""Behavioral regressions for the standalone decision backend. No test packages."""
import copy
import itertools
import json
from pathlib import Path
import subprocess
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
        self.assertEqual(report["schema"], "verifiable.csharp/5")
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
                    target.write_text(old.replace("csharp-decision-v4", "other") if kind == "artifact" else old + "\n")
                    self.assertIn("STALE", self.run_tool(command, ok=False))
                    target.write_text(old)

    def test_bad_specs_fail_without_writing_inventory(self):
        reasons = {"duplicate_row": "duplicate input row", "long_row": "row input must match parameters",
                   "short_row": "row input must match parameters", "missing_row": "spec needs one row for each of the 4 combinations of cells",
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
        method_rule = "only public static methods over bool, integers, strings, and enums and records declared in the file"
        class_rule = "only public static, non-generic classes"
        cases = [
            ("public static bool Decide(double x) => x > 0;", method_rule),
            ("public static bool Decide(bool x) => System.Boolean.Parse(\"true\");", "unsupported expression InvocationExpression"),
            ("public static bool Decide(bool x) { while (x) {} return x; }", "unsupported statement WhileStatement"),
            ("public static bool Decide(bool x) { x = !x; return x; }", "unsupported statement ExpressionStatement"),
            ("public static bool Decide(bool x) => throw new System.Exception();", "unsupported expression ThrowExpression"),
            ("public static bool Decide(bool? x) => x == true;", method_rule),
            ("public static bool Decide(bool x) { bool y = x; return y; }", "unsupported statement LocalDeclarationStatement"),
            ("public static bool field = true; public static bool Decide(bool x) => field;", class_rule),
            ("static Decision() {} public static bool Decide(bool x) => x;", class_rule),
            ("public static bool Decide(bool x) => missing;", "CS0103"),
            ("public static bool Decide(bool x = true) => x;", method_rule),
            ("public static object Decide(bool x) => x;", method_rule),
            ("internal static bool Decide(bool x) => x;", method_rule),
            ("public static bool Decide(this bool x) => x;", method_rule),
            ("public static bool Decide(ref bool x) => x;", method_rule),
            ("public static bool Decide(in bool x) => x;", method_rule),
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
                       "public static class Decision<T> { public static bool Decide(bool x) => x; }"):
            with self.subTest(source=source):
                self.source.write_text(source)
                self.assertIn(class_rule, self.run_tool("paths", ok=False))
        self.source.write_text("using System; public static class Decision { public static bool Decide(bool x) => x; }")
        self.assertIn("using directives", self.run_tool("paths", ok=False))
        self.source.write_text("namespace Outer { using System; public static class Decision { public static bool Decide(bool x) => x; } }")
        self.assertIn("namespace imports are unsupported", self.run_tool("paths", ok=False))
        self.source.write_text("public struct Decision { }")
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
        twelve = ", ".join(f"bool p{i}" for i in range(12))
        self.source.write_text(f"public static class Decision {{ public static bool Decide({twelve}) => true; }}")
        self.assertEqual(json.loads(self.run_tool("paths"))["units"][0]["cases"], 4096)
        parameters = ", ".join(f"bool p{i}" for i in range(13))
        self.source.write_text(f"public static class Decision {{ public static bool Decide({parameters}) => true; }}")
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
            ("missing_unnamed", "spec needs one row for each of the 6 combinations of cells"),
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
        method_rule = "only public static methods over bool, integers, strings, and enums and records declared in the file"
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
            (tier, "public static bool Decide(Tier? t) => t == Tier.Gold;", method_rule),
            ("", "public static bool Decide(System.DayOfWeek d) => d == System.DayOfWeek.Monday;", method_rule),
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
        self.assertIn("only public static, non-generic classes", self.run_tool("paths", ok=False))

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
        self.assertEqual(report["schema"], "verifiable.csharp/5")
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
        fields = "request takes an object with Membership, Overdue, Reserved"
        cases = [
            ("array_for_record", fields),
            ("scalar_for_record", fields),
            ("missing_field", fields),
            ("extra_field", fields),
            ("misspelled_field", fields),
            ("unknown_member", "row input must match parameters; request.Membership accepts Standard, Staff, #unnamed"),
            ("text_for_bool", "row input must match parameters; request.Overdue accepts False, True"),
            ("object_for_field", "row input must match parameters; request.Reserved accepts False, True"),
            ("missing_row", "spec needs one row for each of the 12 combinations of cells"),
            ("duplicate_row", "duplicate input row"),
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
        method_rule = "only public static methods over bool, integers, strings, and enums and records declared in the file"
        record_rule = "Ticket: only public readonly record structs with ordinary positional fields and no other members"
        field_rule = "Ticket: record fields must be bool, integers, strings or enums declared in the file"
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
            ("public readonly record struct Ticket(double Count); ", plain, field_rule),
            ("public readonly record struct Ticket(System.DayOfWeek Day); ", plain, field_rule),
            ("public readonly record struct Ticket(bool? Paid); ", plain, field_rule),
            ("public readonly record struct Inner(bool Paid); public readonly record struct Ticket(Inner Inner); ", plain, field_rule),
            (ticket, "public static Ticket Decide(Ticket t) => t;", method_rule),
            (ticket, "public static bool Decide(Ticket? t) => true;", method_rule),
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
        self.assertIn("only public static, non-generic classes", self.run_tool("paths", ok=False))

    def test_record_cell_limit(self):
        def source(fields, extra):
            names = ", ".join(f"bool P{i}" for i in range(fields))
            return (f"public readonly record struct Wide({names}); "
                    f"public static class Decision {{ public static bool Decide(Wide w{extra}) => w.P0; }}")
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
        listed = "domains.membership: list each string once; #null and #other are cells of every string input and are not listed"
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
            ("missing_row", "spec needs one row for each of the 9 combinations of cells"),
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
        self.assertIn("domains is for integer and string inputs, and this method has none", self.run_tool("inventory", ok=False))

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
        return [(value, value) for value in listed]

    def write_ranged_spec(self):
        self.source.write_text(self.RANGED_SOURCE)
        reference = self.ranged_reference()
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
                    if kind == "string" or kind in self.INTEGER_RANGES:
                        domains[label] = listed
            units[f"Desk.Rules.{name}"] = {"requirement": name, "parameters": list(parameters), "domains": domains,
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
        method_rule = "only public static methods over bool, integers, strings, and enums and records declared in the file"
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
            ("", "public static bool Decide(int? x) => x > 0;", method_rule),
            ("", "public static bool Decide(char c) => c == 'a';", method_rule),
            ("", "public static bool Decide(decimal d) => d > 0;", method_rule),
            ("", "public static bool Decide(float f) => f > 0;", method_rule),
            ("", "public static bool Decide(nint n) => n > 0;", method_rule),
            ("", "public static bool Decide(object o) => o == null;", method_rule),
            ("", "public static int Decide(int x) => 3;", method_rule),
            ("", "public static string Decide(string s) => \"a\";", method_rule),
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
