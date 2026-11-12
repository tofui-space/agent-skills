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
        self.assertEqual(report["schema"], "verifiable.csharp/3")
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
                    target.write_text(old.replace("csharp-decision-v2", "other") if kind == "artifact" else old + "\n")
                    self.assertIn("STALE", self.run_tool(command, ok=False))
                    target.write_text(old)

    def test_bad_specs_fail_without_writing_inventory(self):
        reasons = {"duplicate_row": "duplicate input row", "long_row": "row input must match parameters",
                   "short_row": "row input must match parameters", "missing_row": "spec must describe all 4 inputs",
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
        method_rule = "only public static methods over bool and enums declared in the file"
        class_rule = "only public static, non-generic classes"
        cases = [
            ("public static bool Decide(int x) => x > 0;", method_rule),
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
        self.assertIn("domain of 8192 cells exceeds 4096", self.run_tool("paths", ok=False))
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
            ("missing_unnamed", "spec must describe all 6 inputs"),
            ("unknown_member", "row input must match parameters; membership accepts Standard, Staff, #unnamed"),
            ("bool_for_enum", "row input must match parameters"),
            ("text_for_bool", "row input must match parameters; reference accepts False, True"),
            ("number_for_bool", "row input must match parameters"),
            ("unknown_outcome", "row outcome must be one of Refused, TwoWeeks, FourWeeks, #unnamed"),
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
    public static Tier Promote(Tier t, bool paid) => paid ? Tier.Gold : t;
    public static Level Flip(Level l) => l switch { Level.Low => Level.High, Level.High => Level.Low, _ => l };
    public static bool Both(Tier t, Level l) { if (t == Tier.Gold) { return l == Level.High; } return false; }
    public static bool Negate(bool b) => b switch { true => false, false => true };
    public static bool IsOff(Mode m) => m == Mode.Off;
    public static bool OnlyBasic(Tier t) => t is Tier.Basic and not Tier.Gold;
    public static bool Rest(Tier t) => t switch { Tier.Basic => false, not Tier.Basic => true };
}
""")
        tier, level, flag = ["Basic", "Gold", "#unnamed"], ["Low", "High", "#unnamed"], [False, True]
        reference = {
            "IsNamed": (["t"], [tier], lambda t: t != "#unnamed"),
            "IsOther": (["t"], [tier], lambda t: t == "#unnamed"),
            "NotGold": (["t"], [tier], lambda t: t != "Gold"),
            "Promote": (["t", "paid"], [tier, flag], lambda t, paid: "Gold" if paid else t),
            "Flip": (["l"], [level], lambda l: {"Low": "High", "High": "Low"}.get(l, l)),
            "Both": (["t", "l"], [tier, level], lambda t, l: t == "Gold" and l == "High"),
            "Negate": (["b"], [flag], lambda b: not b),
            "IsOff": (["m"], [["Off", "On", "#unnamed"]], lambda m: m == "Off"),
            "OnlyBasic": (["t"], [tier], lambda t: t == "Basic"),
            "Rest": (["t"], [tier], lambda t: t != "Basic"),
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
        method_rule = "only public static methods over bool and enums declared in the file"
        enum_rule = "only public enums without attributes"
        cases = [
            (tier, "public static bool Decide(Tier t) => t switch { Tier.Basic => true, Tier.Gold => false };", "add a discard arm"),
            (tier, "public static bool Decide(Tier t, Tier u) => t == u;", "unsupported expression EqualsExpression"),
            (tier, "public static bool Decide(bool b) => Tier.Basic == Tier.Gold;", "unsupported expression EqualsExpression"),
            (tier, "public static bool Decide(Tier t, bool b) => (b ? t : Tier.Gold) != Tier.Basic;", "unsupported expression NotEqualsExpression"),
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
        self.assertIn("domain of 4225 cells exceeds 4096", self.run_tool("paths", ok=False))

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
