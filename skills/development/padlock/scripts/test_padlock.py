"""Behavior checks with temporary ledgers and simulated tool/host boundaries.

Table of contents
  FakeRepository: controlled branch and stack inspection
  PolicyTests: locks, anchors, keys, and master-key boundaries
  PersistenceTests: refusal before execution and transaction behavior
  HostTests: direct user authorization and shell identity checks
  ResolutionTests: branch ambiguity and command effects
  AdapterTests: GitButler scoped effects and portable controls
"""

from contextlib import closing
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import host
import operations
import padlock as p
import portable


MAIN = "refs/heads/main"
WORK = "refs/heads/work/example"


class FakeRepository(p.Repository):
    def __init__(self, cwd):
        self.cwd = Path(cwd)
        self.common = self.cwd
        self.head = MAIN
        self.branch_refs = [MAIN, WORK]
        self.stack_names = ["main", "work/example"]
        self.config = {"remote.origin.fetch": "+refs/heads/*:refs/remotes/origin/*",
                       "gitbutler.project.targetRef": MAIN,
                       "branch.main.merge": MAIN, "branch.main.remote": "origin",
                       "branch.work/example.merge": WORK, "branch.work/example.remote": "origin"}
        self.push_rows = None

    def git(self, *args, optional=False):
        if args[0] == "symbolic-ref":
            return self.head
        if args[0] == "for-each-ref":
            return "\n".join(self.branch_refs)
        if args[0] == "remote":
            return "origin\n"
        if args[0] == "config":
            return self.config.get(args[-1], "")
        if args[0] == "check-ref-format":
            if any(c in args[1] for c in " *?~:^[]\\") or args[1].endswith("/"):
                raise p.Refused("Invalid ref")
        return ""

    def but_status(self):
        return {"stacks": [{"branches": [{"name": name, "cliId": "b" + str(i),
                "commits": [{"cliId": "c" + str(i), "commitId": "sha" + str(i),
                             "changeId": "change" + str(i)}]}
                for i, name in enumerate(self.stack_names)]}], "worktrees": []}

    def but_json(self, *args):
        if args[:2] == ("push", "--dry-run"):
            name = args[2]
            return {"branches": self.push_rows if self.push_rows is not None else [
                {"branchName": name, "remote": "origin",
                 "remoteRef": list(("refs/remotes/origin/" + name).encode("utf-8"))}]}
        raise p.Refused("Unsupported fake inspection")


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.state = p.empty_state()
        self.repo = FakeRepository(".")
        self.command("on")

    def command(self, action, names=None, sid="session-A", turn="turn-1", **kwargs):
        return p.control(self.state, self.repo, action, names or [], sid, turn, **kwargs)

    def allowed(self, operation, ref=MAIN, sid="session-A", turn="turn-1", agent=""):
        p.authorize(self.state, [(ref, operation)], sid, turn, agent)

    def test_lock_denies_every_mutation(self):
        for operation in p.OPERATIONS:
            with self.subTest(operation=operation), self.assertRaises(p.Refused):
                self.allowed(operation)

    def test_absent_branch_is_unlocked(self):
        for operation in p.OPERATIONS:
            self.allowed(operation, WORK)

    def test_anchor_distinguishes_fixup_from_rebase(self):
        self.command("off")
        self.command("anchor")
        for operation in {"commit", "amend", "fixup"}:
            self.allowed(operation)
        for operation in p.ANCHOR_DENIES:
            with self.subTest(operation=operation), self.assertRaises(p.Refused):
                self.allowed(operation)

    def test_lock_key_is_private_and_relock_restores_denial(self):
        self.command("sessionkey")
        with self.assertRaises(p.Refused):
            self.allowed("commit")
        self.command("off")
        self.allowed("commit")
        self.assertTrue(self.state["rules"][MAIN]["locked"])
        with self.assertRaises(p.Refused):
            self.allowed("commit", sid="session-B")
        self.command("on")
        with self.assertRaises(p.Refused):
            self.allowed("commit")

    def test_grant_does_not_change_unlocked_branch(self):
        self.command("sessionkey", [WORK])
        self.allowed("commit", WORK)
        self.command("on", [WORK])
        with self.assertRaises(p.Refused):
            self.allowed("commit", WORK)
        self.allowed("commit", WORK, sid="session-B")

    def test_session_key_survives_turn_boundary(self):
        self.command("sessionkey")
        self.command("off")
        p.end_turn(self.state, "session-A", "turn-1")
        p.session(self.state, "session-A", "turn-2")
        self.allowed("commit", turn="turn-2")

    def test_turn_key_expires_even_without_stop(self):
        self.command("turnkey")
        self.command("off")
        p.session(self.state, "session-A", "turn-2")
        with self.assertRaises(p.Refused):
            self.allowed("commit", turn="turn-2")

    def test_master_is_turn_bound_not_inherited(self):
        self.command("anchor")
        self.command("rule", deny=["commit"])
        self.command("masterkey")
        for operation in p.OPERATIONS:
            self.allowed(operation)
        for kwargs in ({"sid": "session-B"}, {"turn": "turn-2"}, {"agent": "child"}):
            with self.subTest(kwargs=kwargs), self.assertRaises(p.Refused):
                self.allowed("commit", **kwargs)
        p.end_turn(self.state, "session-A", "turn-1")
        with self.assertRaises(p.Refused):
            self.allowed("commit")

    def test_new_policy_invalidates_old_key(self):
        self.command("sessionkey")
        self.command("off")
        self.command("on", permanent=True)
        with self.assertRaises(p.Refused):
            self.allowed("commit")

    def test_key_does_not_override_anchor_or_custom_rule(self):
        self.command("anchor")
        self.command("rule", deny=["amend"])
        self.command("sessionkey")
        self.command("off")
        self.allowed("commit")
        for operation in ("push", "amend"):
            with self.assertRaises(p.Refused):
                self.allowed(operation)

    def test_overlapping_grant_is_refused(self):
        self.command("sessionkey")
        with self.assertRaises(p.Refused):
            self.command("sessionkey", sid="session-B")

    def test_release_does_not_restore_an_old_shared_snapshot(self):
        self.command("sessionkey")
        self.command("off")
        self.command("anchor", sid="session-B")
        self.command("release")
        self.assertTrue(self.state["rules"][MAIN]["anchored"])
        self.assertTrue(self.state["rules"][MAIN]["locked"])

    def test_all_key_scope_does_not_grow(self):
        self.command("sessionkey", ["--all"])
        self.command("on", [WORK])
        self.assertNotIn(WORK, self.state["sessions"]["session-A"]["keys"])


class TemporaryLedgerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="padlock-workspace-")
        self.addCleanup(self.temp.cleanup)
        self.repo = FakeRepository(self.temp.name)
        self.ledger = p.Ledger(self.repo.common)

    def lock(self):
        with self.ledger.transaction(create=True) as state:
            p.control(state, self.repo, "on", [], "session-A", "turn-1")


class PersistenceTests(TemporaryLedgerTest):
    def test_denied_runner_never_starts_underlying_command(self):
        self.lock()
        marker = Path(self.temp.name) / "executed"
        with self.assertRaises(p.Refused):
            p.run_guarded(self.repo, self.ledger, ["git", "commit", "-m", "Update"],
                          execute=lambda argv: marker.write_text("started"))
        self.assertFalse(marker.exists())

    def test_allowed_runner_preserves_exit_status_and_serializes_policy(self):
        self.lock()
        self.repo.head = WORK
        def execute(argv):
            with closing(sqlite3.connect(self.ledger.path, timeout=0)) as contender:
                with self.assertRaises(sqlite3.OperationalError):
                    contender.execute("BEGIN IMMEDIATE")
            return 17
        result = p.run_guarded(self.repo, self.ledger, ["git", "commit", "-m", "Update"], execute=execute)
        self.assertEqual(result, 17)

    def test_failed_update_rolls_back(self):
        self.lock()
        with self.assertRaises(p.Refused):
            with self.ledger.transaction() as state:
                state["rules"][MAIN]["locked"] = False
                raise p.Refused("abort")
        with self.ledger.transaction() as state:
            self.assertTrue(state["rules"][MAIN]["locked"])

    def test_missing_and_corrupt_ledger_do_not_mean_unlocked(self):
        self.ledger.directory.mkdir()
        with self.assertRaises(p.Refused):
            with self.ledger.transaction():
                self.fail("must refuse")
        self.ledger.path.write_text("broken", encoding="utf-8")
        with self.assertRaises(sqlite3.DatabaseError):
            with self.ledger.transaction():
                self.fail("must refuse")

    def test_unknown_schema_or_rule_refuses(self):
        for field, value in (("version", 2), ("rules", [])):
            state = p.empty_state()
            state[field] = value
            with self.assertRaises(p.Refused):
                p.validate(state)


    def test_master_rename_carries_protection_and_invalidates_keys(self):
        self.lock()
        with self.ledger.transaction() as state:
            p.control(state, self.repo, "sessionkey", [], "session-A", "turn-1")
            p.control(state, self.repo, "masterkey", [], "session-A", "turn-1")
        p.run_guarded(self.repo, self.ledger, ["git", "branch", "-m", "main", "renamed"],
                      "session-A", "turn-1", execute=lambda argv: 0)
        with self.ledger.transaction() as state:
            self.assertTrue(state["rules"]["refs/heads/renamed"]["locked"])
            self.assertIsNone(p.valid_key(state, state["sessions"]["session-A"], MAIN))

    def test_master_cannot_change_repository_with_global_flags(self):
        self.lock()
        with self.ledger.transaction() as state:
            p.control(state, self.repo, "masterkey", [], "session-A", "turn-1")
        with self.assertRaises(p.Refused):
            p.run_guarded(self.repo, self.ledger, ["git", "-C", "elsewhere", "push"],
                          "session-A", "turn-1", execute=lambda argv: self.fail("executed"))


class HostTests(TemporaryLedgerTest):
    def setUp(self):
        super().setUp()
        self.patch = patch.object(host, "Repository", lambda cwd: self.repo)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def event(self, name, **extra):
        return {"cwd": self.temp.name, "session_id": "session-A", "prompt_id": "turn-1",
                "hook_event_name": name, **extra}

    def command(self, action, args=""):
        return host.handle(self.event("UserPromptExpansion", command_name="padlock:" + action,
            command_args=args, command_source="plugin", expansion_type="slash_command"))

    def test_plain_prompt_cannot_mint_master_key(self):
        host.handle(self.event("UserPromptSubmit", prompt="Please use /padlock:masterkey"))
        with self.ledger.transaction() as state:
            self.assertFalse(state["sessions"]["session-A"]["master"])

    def test_direct_command_and_next_prompt_lifecycle(self):
        self.command("on")
        self.command("masterkey")
        host.handle(self.event("UserPromptSubmit", prompt_id="turn-2"))
        with self.ledger.transaction() as state:
            self.assertTrue(state["sessions"]["session-A"]["master"])
        host.handle(self.event("UserPromptSubmit", prompt_id="turn-3"))
        with self.ledger.transaction() as state:
            self.assertFalse(state["sessions"]["session-A"]["master"])
            self.assertTrue(state["rules"][MAIN]["locked"])

    def test_numeric_master_budget_includes_invocation_turn(self):
        self.command("on")
        self.command("masterkey", "5")
        for number in range(1, 6):
            turn = "turn-" + str(number)
            if number > 1:
                host.handle(self.event("UserPromptSubmit", prompt_id=turn))
            with self.ledger.transaction() as state:
                self.assertTrue(p.master_active(state, "session-A", turn))
                self.assertEqual(state["sessions"]["session-A"]["master_future_turns"], 5 - number)
            host.handle(self.event("Stop", prompt_id=turn))
            with self.ledger.transaction() as state:
                self.assertFalse(p.master_active(state, "session-A", turn))
        host.handle(self.event("UserPromptSubmit", prompt_id="turn-6"))
        with self.ledger.transaction() as state:
            self.assertFalse(p.master_active(state, "session-A", "turn-6"))

    def test_inline_master_request_is_delivered_and_expires_after_one_turn(self):
        self.command("on")
        result = self.command("masterkey", "push the current branch")
        self.assertIn("push the current branch", result["hookSpecificOutput"]["additionalContext"])
        with self.ledger.transaction() as state:
            self.assertTrue(p.master_active(state, "session-A", "turn-1"))
            self.assertEqual(state["sessions"]["session-A"]["master_future_turns"], 0)
        host.handle(self.event("UserPromptSubmit", prompt_id="turn-2"))
        with self.ledger.transaction() as state:
            self.assertFalse(p.master_active(state, "session-A", "turn-2"))

    def test_number_with_request_is_not_a_numeric_grant(self):
        result = self.command("masterkey", "5 changes to the current branch")
        self.assertIn("5 changes", result["hookSpecificOutput"]["additionalContext"])
        with self.ledger.transaction() as state:
            self.assertEqual(state["sessions"]["session-A"]["master_future_turns"], 0)

    def test_invalid_count_does_not_break_a_new_ledger(self):
        for count in ("0", "-1", "1.5"):
            with self.subTest(count=count), self.assertRaises(p.Refused):
                self.command("masterkey", count)
        self.command("on")
        with self.ledger.transaction() as state:
            self.assertTrue(state["rules"][MAIN]["locked"])
            self.assertFalse(state["sessions"]["session-A"]["master"])

    def test_session_end_drops_reserved_master_turns(self):
        self.command("masterkey", "5")
        host.handle(self.event("SessionEnd"))
        host.handle(self.event("UserPromptSubmit", prompt_id="turn-2"))
        with self.ledger.transaction() as state:
            self.assertFalse(p.master_active(state, "session-A", "turn-2"))
            self.assertEqual(state["sessions"]["session-A"]["master_future_turns"], 0)

    def test_agent_skill_invocation_is_denied(self):
        with self.assertRaises(p.Refused):
            host.handle(self.event("PreToolUse", tool_name="Skill",
                                   tool_input={"skill": "padlock:masterkey"}))

    def test_raw_git_and_compound_commands_are_denied(self):
        self.command("on")
        for command in ('git commit -m "Update"', 'git status; git push', 'bash -c "git push"'):
            with self.subTest(command=command), self.assertRaises(p.Refused):
                host.handle(self.event("PreToolUse", tool_name="Bash", tool_input={"command": command}))

    def test_runner_identity_is_verified_and_background_run_denied(self):
        self.command("on")
        script = host.SCRIPT.as_posix()
        base = f'python "{script}" --session session-A --turn turn-1 run -- git commit -m Update'
        host.handle(self.event("PreToolUse", tool_name="PowerShell", tool_input={"command": base}))
        for command, background in ((base.replace("session-A", "session-B"), False), (base, True)):
            with self.assertRaises(p.Refused):
                host.handle(self.event("PreToolUse", tool_name="PowerShell",
                                       tool_input={"command": command, "run_in_background": background}))

    def test_session_end_revokes_session_keys(self):
        self.command("on")
        self.command("sessionkey")
        self.command("off")
        host.handle(self.event("SessionEnd"))
        with self.ledger.transaction() as state:
            self.assertNotIn("session-A", state["sessions"])

    def test_missing_prompt_identity_cannot_issue_master(self):
        with self.assertRaises(p.Refused):
            host.handle(self.event("UserPromptExpansion", prompt_id=None,
                command_name="padlock:masterkey", command_args="", command_source="plugin",
                expansion_type="slash_command"))

    def test_busy_ledger_does_not_block_unrelated_work_or_inspection(self):
        self.command("on")
        script = host.SCRIPT.as_posix()
        calls = [("Bash", {"command": "echo check"}),
                 ("Skill", {"skill": "inspect"}),
                 ("Bash", {"command": "git status"}),
                 ("PowerShell", {"command": "but diff"}),
                 ("Bash", {"command": f'python "{script}" status'}),
                 ("Bash", {"command": f'python "{script}" run -- git log'})]
        with closing(sqlite3.connect(self.ledger.path, timeout=0)) as writer:
            writer.execute("BEGIN EXCLUSIVE")
            for tool, inputs in calls:
                with self.subTest(inputs=inputs):
                    self.assertEqual(host.handle(self.event("PreToolUse", tool_name=tool, tool_input=inputs)), {})
            writer.rollback()

    def test_missing_ledger_still_blocks_mutations_but_not_inspection(self):
        self.ledger.directory.mkdir()
        for command in ("git status", "but diff"):
            host.handle(self.event("PreToolUse", tool_name="Bash", tool_input={"command": command}))
        with self.assertRaises(p.Refused):
            host.handle(self.event("PreToolUse", tool_name="Bash", tool_input={"command": "git commit -m Update"}))

    def test_claude_agent_cannot_use_portable_operator_to_issue_keys(self):
        self.command("on")
        script = host.SCRIPT.as_posix()
        with self.assertRaises(p.Refused):
            host.handle(self.event("PreToolUse", tool_name="Bash",
                tool_input={"command": f'python "{script}" operator start'}))


class ResolutionTests(unittest.TestCase):
    def setUp(self):
        self.repo = FakeRepository(".")

    def test_current_workspace_branch_must_be_unambiguous(self):
        self.repo.head = "refs/heads/gitbutler/workspace"
        with self.assertRaises(p.Refused):
            self.repo.branch()
        self.repo.stack_names = ["work/example"]
        self.assertEqual(self.repo.branch(), WORK)

    def test_prefix_and_detached_head_are_not_guessed(self):
        with self.assertRaises(p.Refused):
            self.repo.branch("work")
        self.repo.head = ""
        with self.assertRaises(p.Refused):
            self.repo.branch()

    def test_push_checks_both_source_and_destination(self):
        effects = operations.classify(self.repo, ["git", "push", "origin", "work/example:main"])
        self.assertEqual(set(effects), {(WORK, "push"), (MAIN, "push")})

    def test_bulk_push_and_unknown_flags_are_refused(self):
        for argv in (["git", "push", "--all"], ["git", "push", "origin", "main"],
                     ["but", "commit", "--switch", "-m", "Update"], ["git", "-C", "elsewhere", "push"]):
            with self.subTest(argv=argv), self.assertRaises(p.Refused):
                operations.classify(self.repo, argv)

    def test_amend_checks_other_stack_branches(self):
        effects = operations.classify(self.repo, ["but", "amend", "-t", "work/example", "file"])
        self.assertIn((MAIN, "rewrite"), effects)
        self.assertIn((WORK, "amend"), effects)

    def test_commit_checks_possible_descendant_rewrites(self):
        effects = operations.classify(self.repo, ["but", "commit", "-b", "work/example", "-m", "Update", "file"])
        self.assertIn((MAIN, "rewrite"), effects)

    def test_recreating_a_protected_name_is_a_ref_write(self):
        effects = operations.classify(self.repo, ["but", "branch", "new", "main"])
        self.assertIn((MAIN, "rewrite"), effects)

    def test_but_rename_resolves_a_fresh_branch_selector(self):
        rename = operations.renamed_branch(self.repo, ["but", "reword", "b0", "-m", "renamed"])
        self.assertEqual(rename, (MAIN, "refs/heads/renamed"))

    def test_merge_checks_source_and_destination(self):
        self.assertEqual(set(operations.classify(self.repo, ["git", "merge", "work/example"])),
                         {(MAIN, "merge"), (WORK, "merge")})


class AdapterTests(TemporaryLedgerTest):
    def setUp(self):
        super().setUp()
        # A protected branch outside the selected stack must not block that stack.
        self.repo.stack_names = ["work/example"]
        self.lock()

    def allowed_command(self, argv, sid="session-A", turn="turn-1"):
        return p.run_guarded(self.repo, self.ledger, argv, sid, turn, execute=lambda _: 19)

    def test_gitbutler_push_and_pr_ignore_unrelated_lock(self):
        for argv in (["but", "push", "work/example"], ["but", "pr", "new", "work/example"]):
            with self.subTest(argv=argv):
                self.assertEqual(self.allowed_command(argv), 19)

    def test_gitbutler_remote_destination_lock_blocks_push(self):
        self.repo.push_rows = [{"branchName": "work/example", "remote": "origin",
                               "remoteRef": "refs/remotes/origin/main"}]
        with self.assertRaisesRegex(p.Refused, "push denied on refs/heads/main"):
            self.allowed_command(["but", "push", "work/example"])

    def test_gitbutler_preview_includes_protected_ancestor(self):
        self.repo.push_rows = [{"branchName": "main", "remote": "origin",
                               "remoteRef": "refs/remotes/origin/main"}]
        with self.assertRaises(p.Refused):
            self.allowed_command(["but", "push", "work/example"])

    def test_scoped_key_allows_but_push_only_for_its_holder(self):
        with self.ledger.transaction() as state:
            p.control(state, self.repo, "on", ["work/example"], "session-A", "turn-1")
            p.control(state, self.repo, "sessionkey", ["work/example"], "session-A", "turn-1")
            p.control(state, self.repo, "off", ["work/example"], "session-A", "turn-1")
        self.assertEqual(self.allowed_command(["but", "push", "work/example"]), 19)
        with self.assertRaises(p.Refused):
            self.allowed_command(["but", "push", "work/example"], sid="session-B")

    def test_custom_remote_mapping_refuses_instead_of_guessing(self):
        self.repo.config["remote.origin.fetch"] = "+refs/heads/*:refs/remotes/origin/mapped/*"
        with self.assertRaises(p.Refused):
            self.allowed_command(["but", "push", "work/example"])

    def test_gerrit_destination_is_not_treated_as_an_ordinary_branch(self):
        self.repo.config["gitbutler.gerritMode"] = "true"
        with self.assertRaises(p.Refused):
            self.allowed_command(["but", "push", "work/example"])

    def test_branch_update_checks_renamed_upstream(self):
        self.assertEqual(self.allowed_command(["but", "branch", "update", "work/example"]), 19)
        self.repo.config["branch.work/example.merge"] = MAIN
        with self.assertRaises(p.Refused):
            self.allowed_command(["but", "branch", "update", "work/example"])

    def test_branch_update_scoped_key_still_cannot_override_anchor(self):
        with self.ledger.transaction() as state:
            p.control(state, self.repo, "anchor", ["work/example"], "session-A", "turn-1")
            p.control(state, self.repo, "sessionkey", ["work/example"], "session-A", "turn-1")
            p.control(state, self.repo, "off", ["work/example"], "session-A", "turn-1")
        with self.assertRaises(p.Refused):
            self.allowed_command(["but", "branch", "update", "work/example"])

    def test_gitbutler_targeted_history_does_not_touch_unrelated_lock(self):
        for argv in (["but", "branch", "delete", "work/example"],
                     ["but", "reword", "work/example", "-m", "renamed"],
                     ["but", "move", "work/example", "--unstack"],
                     ["but", "uncommit", "c0"],
                     ["but", "squash", "c0", "-t", "work/example", "-m", "Update"]):
            with self.subTest(argv=argv):
                self.assertEqual(self.allowed_command(argv), 19)

    def test_delete_of_lower_branch_checks_stack_rewrite(self):
        self.repo.stack_names = ["main", "work/example"]
        with self.assertRaises(p.Refused):
            self.allowed_command(["but", "branch", "delete", "work/example"])

    def test_merge_and_pull_check_target_even_when_stack_unlocked(self):
        for argv in (["but", "merge", "work/example", "--yes"], ["but", "pull"]):
            with self.subTest(argv=argv), self.assertRaises(p.Refused):
                self.allowed_command(argv)

    def test_pull_includes_linked_worktrees(self):
        status = self.repo.but_status()
        status["worktrees"] = [{"branches": [{"name": "main", "commits": []}]}]
        self.repo.config["gitbutler.project.targetRef"] = WORK
        with patch.object(self.repo, "but_status", return_value=status):
            with self.assertRaises(p.Refused):
                self.allowed_command(["but", "pull"])

    def test_pull_and_merge_ignore_unapplied_unrelated_lock(self):
        self.repo.config["gitbutler.project.targetRef"] = WORK
        for argv in (["but", "pull"], ["but", "merge", "work/example", "--yes"]):
            with self.subTest(argv=argv):
                self.assertEqual(self.allowed_command(argv), 19)

    def test_move_checks_destination_stack(self):
        status = self.repo.but_status()
        status["stacks"].append({"branches": [{"name": "main", "commits": []}]})
        with patch.object(self.repo, "but_status", return_value=status):
            with self.assertRaises(p.Refused):
                self.allowed_command(["but", "move", "work/example", "--above", "main"])

    def test_readonly_runner_ignores_corrupt_ledger(self):
        self.ledger.path.write_text("broken", encoding="utf-8")
        self.assertEqual(self.allowed_command(["git", "log"]), 19)

    def test_status_reads_committed_state_while_writer_is_active(self):
        with self.ledger.transaction() as state:
            state["rules"][MAIN]["locked"] = False
            self.assertTrue(self.ledger.read()["rules"][MAIN]["locked"])
        self.assertFalse(self.ledger.read()["rules"][MAIN]["locked"])

    def operator(self, action, *words, identity=None):
        args = [] if identity is None else ["--session", identity["session"], "--turn", identity["turn"]]
        return portable.operate(self.repo, self.ledger, p.parser().parse_args([*args, "operator", action, *words]))

    def test_portable_controls_lock_grant_toggle_and_release(self):
        identity = self.operator("start")
        self.operator("command", "on", "work/example", identity=identity)
        self.operator("command", "sessionkey", "work/example", identity=identity)
        self.operator("command", "off", "work/example", identity=identity)
        self.assertEqual(self.allowed_command(["but", "push", "work/example"],
                                             identity["session"], identity["turn"]), 19)
        self.operator("close", identity=identity)
        with self.assertRaises(p.Refused):
            self.allowed_command(["but", "push", "work/example"], identity["session"], identity["turn"])

    def test_portable_master_budget_and_stale_identity(self):
        identity = self.operator("start")
        self.operator("command", "masterkey", "3", identity=identity)
        for _ in range(3):
            self.assertTrue(p.master_active(self.ledger.read(), identity["session"], identity["turn"]))
            self.operator("end", identity=identity)
            previous, identity = identity, self.operator("next", identity=identity)
            self.assertFalse(p.master_active(self.ledger.read(), previous["session"], previous["turn"]))
        self.assertFalse(p.master_active(self.ledger.read(), identity["session"], identity["turn"]))
        with self.assertRaises(p.Refused):
            self.operator("command", "masterkey", identity=previous)

    def test_portable_inline_request_is_one_turn_and_end_prevents_grants(self):
        identity = self.operator("start")
        result = self.operator("command", "masterkey", "make", "changes", identity=identity)
        self.assertIn("make changes", result["message"])
        self.operator("end", identity=identity)
        with self.assertRaises(p.Refused):
            self.operator("command", "masterkey", identity=identity)
        identity = self.operator("next", identity=identity)
        self.assertFalse(p.master_active(self.ledger.read(), identity["session"], identity["turn"]))

    def test_portable_cli_dispatches_without_claude_events(self):
        with patch.object(p, "Repository", return_value=self.repo), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(p.main(["operator", "start"]), 0)
        identity = json.loads(output.getvalue())
        with patch.object(p, "Repository", return_value=self.repo), redirect_stdout(io.StringIO()):
            self.assertEqual(p.main(["--session", identity["session"], "--turn", identity["turn"],
                                     "operator", "command", "anchor", "work/example"]), 0)
        self.assertTrue(self.ledger.read()["rules"][WORK]["anchored"])


if __name__ == "__main__":
    unittest.main()
