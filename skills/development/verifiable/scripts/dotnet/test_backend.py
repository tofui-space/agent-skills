"""Behavioral regressions for the standalone Boolean-decision backend. No test packages."""
import copy
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
        self.assertFalse(self.out.exists())
        report = json.loads(self.run_tool("inventory"))
        self.assertEqual(len(report["units"][0]["checks"]), 4)
        self.assertEqual(report["schema"], "verifiable.csharp/2")
        self.assertRegex(report["compiler"], r"^\d+\.\d+\.\d+")
        self.assertNotRegex(report["compiler"], r"^\d+\.\d+\.\d+\.\d+$")
        self.assertTrue(report["runtime"].startswith(".NET "), report["runtime"])
        self.assertIn("CURRENT", self.run_tool("check"))
        self.assertIn("PASS Example.Decision.CanBorrow 4 checks", self.run_tool("run"))

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
                    target.write_text(old.replace("csharp-boolean-v1", "other") if kind == "artifact" else old + "\n")
                    self.assertIn("STALE", self.run_tool(command, ok=False))
                    target.write_text(old)

    def test_bad_specs_fail_without_writing_inventory(self):
        for kind in ("missing_row", "duplicate_row", "parameter_order", "missing_outcome", "extra_property", "extra_unit",
                     "null_row", "blank_requirement", "blank_unsettled"):
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
                self.write_spec(spec)
                self.run_tool("inventory", ok=False)
                self.assertFalse(self.out.exists())

    def test_duplicate_json_keys_fail(self):
        self.spec.write_text('{"units":{},"units":{}}')
        self.assertIn("duplicate spec key", self.run_tool("inventory", ok=False))

    def test_unsupported_code_rejects_whole_file(self):
        method_rule = "only public static bool methods"
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
        self.assertIn("up to 12", self.run_tool("paths", ok=False))
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

    def test_unsupported_command_and_output_collision(self):
        self.assertIn("unsupported command", self.run_tool("prune", ok=False))
        self.assertIn("paths accepts only --source", self.run_tool("paths", ok=False, extra=[f"--spec={self.spec}"]))
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
