#!/usr/bin/env python3
"""Persistent branch policy and guarded command runner (Python standard library).

Table of contents
  Repository: repository and branch resolution
  Ledger: transactional shared state and read-only snapshots
  session / control / authorize: policy and key lifecycle
  run_guarded: check and execute under one transaction
  main: command-line interface
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys

sys.modules.setdefault("padlock", sys.modules[__name__])

OPERATIONS = frozenset({"commit", "amend", "fixup", "push", "pull", "merge",
                        "rebase", "delete", "rename", "move", "rewrite"})
ANCHOR_DENIES = OPERATIONS - {"commit", "amend", "fixup"}


class Refused(Exception):
    """A policy denial or an unresolved operation; nothing should execute."""


class Repository:
    def __init__(self, cwd):
        self.cwd = Path(cwd).resolve()
        self.common = Path(self.git("rev-parse", "--path-format=absolute",
                                    "--git-common-dir").strip()).resolve()

    def git(self, *args, optional=False):
        result = subprocess.run(["git", *args], cwd=self.cwd, text=True,
                                capture_output=True, check=False)
        if result.returncode and not optional:
            raise Refused(result.stderr.strip() or "Git inspection failed")
        return result.stdout if not result.returncode else ""

    def refs(self):
        return self.git("for-each-ref", "--format=%(refname)", "refs/heads/").splitlines()

    def but_status(self):
        data = self.but_json("status")
        if not isinstance(data.get("stacks"), list) or not isinstance(data.get("worktrees", []), list):
            raise Refused("Unsupported GitButler status format")
        return data

    def but_json(self, *args):
        env = dict(os.environ, NO_BG_TASKS="1")
        result = subprocess.run(["but", *args, "--json"], cwd=self.cwd,
                                env=env, text=True, capture_output=True, check=False)
        if result.returncode:
            raise Refused("GitButler inspection failed: " + result.stderr.strip())
        try:
            data = json.loads(result.stdout)
            if not isinstance(data, dict):
                raise ValueError("expected an object")
            return data
        except (ValueError, AttributeError) as error:
            raise Refused("Unsupported GitButler JSON format") from error

    def branch(self, name=None, allow_new=False):
        if not name:
            ref = self.git("symbolic-ref", "--quiet", "HEAD", optional=True).strip()
            if ref == "refs/heads/gitbutler/workspace":
                names = [b["name"] for s in self.but_status()["stacks"]
                         for b in s.get("branches", [])]
                if len(names) != 1:
                    raise Refused("Current GitButler branch is ambiguous; supply its full name")
                name = names[0]
            elif ref:
                name = ref
            else:
                raise Refused("Detached HEAD has no current branch; supply a branch name")
        ref = name if name.startswith("refs/heads/") else "refs/heads/" + name
        if ref == "refs/heads/gitbutler/workspace" or (
                name.startswith("refs/") and not name.startswith("refs/heads/")):
            raise Refused("Use a local branch name, not a workspace or remote-tracking ref")
        if allow_new:
            self.git("check-ref-format", ref)
        elif ref not in self.refs():
            raise Refused("No exact local branch match: " + name)
        return ref


def empty_state():
    return {"version": 1, "rules": {}, "sessions": {}}


def validate(state):
    if not isinstance(state, dict) or state.get("version") != 1:
        raise Refused("Unsupported or malformed padlock ledger")
    if not isinstance(state.get("rules"), dict) or not isinstance(state.get("sessions"), dict):
        raise Refused("Malformed padlock ledger")
    for ref, rule in state["rules"].items():
        if not ref.startswith("refs/heads/") or not isinstance(rule, dict):
            raise Refused("Malformed branch protection")
        if type(rule.get("locked")) is not bool or type(rule.get("anchored")) is not bool:
            raise Refused("Malformed protection flags")
        if type(rule.get("generation")) is not int or rule["generation"] < 1:
            raise Refused("Malformed protection generation")
        if not isinstance(rule.get("deny"), list) or not set(rule["deny"]) <= OPERATIONS:
            raise Refused("Unknown custom operation")
    for entry in state["sessions"].values():
        if not isinstance(entry, dict) or not isinstance(entry.get("keys"), dict):
            raise Refused("Malformed session record")
        if type(entry.get("active")) is not bool or type(entry.get("master")) is not bool:
            raise Refused("Malformed session lifetime")
        future = entry.get("master_future_turns", 0)
        if type(future) is not int or future < 0:
            raise Refused("Malformed master-key turn budget")
        if not isinstance(entry.get("turn"), str):
            raise Refused("Malformed turn identity")
        for key in entry["keys"].values():
            if (not isinstance(key, dict) or type(key.get("generation")) is not int
                    or (key.get("unlocked") is not None and type(key.get("unlocked")) is not bool)
                    or key.get("lifetime") not in {"session", "turn"}
                    or not isinstance(key.get("turn"), str)):
                raise Refused("Malformed session key")


class Ledger:
    def __init__(self, common):
        self.directory = Path(common) / "padlock"
        self.path = self.directory / "state.sqlite3"

    def read(self):
        """Read the last committed snapshot without acquiring the writer gate."""
        if not self.path.exists():
            if self.directory.exists():
                raise Refused("Padlock directory exists but its ledger is missing; recover it explicitly")
            return empty_state()
        db = sqlite3.connect(self.path.as_uri() + "?mode=ro", uri=True, timeout=5)
        try:
            row = db.execute("SELECT state FROM ledger WHERE id = 1").fetchone()
            if row is None:
                raise Refused("Padlock ledger is empty; recover it explicitly")
            state = json.loads(row[0])
            validate(state)
            return state
        finally:
            db.close()

    @contextmanager
    def transaction(self, create=False):
        if not self.path.exists():
            if self.directory.exists():
                raise Refused("Padlock directory exists but its ledger is missing; recover it explicitly")
            if not create:
                yield empty_state()
                return
            self.directory.mkdir()
            fresh = True
        else:
            fresh = False
        db = sqlite3.connect(self.path, timeout=5)
        try:
            db.execute("BEGIN IMMEDIATE")
            if fresh:
                db.execute("CREATE TABLE ledger (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL)")
                db.execute("INSERT INTO ledger VALUES (1, ?)", (json.dumps(empty_state()),))
                # A rejected first command must not roll back the ledger's schema.
                db.commit()
                db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT state FROM ledger WHERE id = 1").fetchone()
            if row is None:
                raise Refused("Padlock ledger is empty; recover it explicitly")
            state = json.loads(row[0])
            validate(state)
            yield state
            validate(state)
            db.execute("UPDATE ledger SET state = ? WHERE id = 1", (json.dumps(state),))
            db.commit()
        finally:
            db.close()


def session(state, session_id, turn=None):
    if not session_id:
        raise Refused("A host session ID is required")
    entry = state["sessions"].setdefault(session_id, {
        "turn": "", "active": False, "master": False, "master_future_turns": 0, "keys": {}})
    if turn is not None:
        if not turn:
            raise Refused("Host prompt_id is missing; turn grants are unavailable")
        if entry["turn"] != turn:
            entry["keys"] = {ref: key for ref, key in entry["keys"].items()
                             if key["lifetime"] == "session"}
            future = entry.get("master_future_turns", 0)
            entry.update(turn=turn, active=True, master=future > 0,
                         master_future_turns=max(0, future - 1))
    return entry


def end_turn(state, session_id, turn):
    entry = state["sessions"].get(session_id)
    if entry and entry["turn"] == turn:
        entry.update(active=False, master=False)
        entry["keys"] = {ref: key for ref, key in entry["keys"].items()
                         if key["lifetime"] == "session"}


def valid_key(state, entry, ref):
    key = entry.get("keys", {}).get(ref)
    rule = state["rules"].get(ref)
    return key if (key and rule and key["generation"] == rule["generation"]
                   and (key["lifetime"] == "session" or (
                       entry["active"] and key["turn"] == entry["turn"]))) else None


def master_active(state, session_id, turn, agent_id=""):
    entry = state["sessions"].get(session_id, {})
    return bool(not agent_id and turn and entry.get("active")
                and entry.get("turn") == turn and entry.get("master"))


def control(state, repo, action, names, session_id, turn, *, permanent=False, deny=(), master_turns=1):
    entry = session(state, session_id, turn)
    if not entry["active"]:
        raise Refused("This turn has ended")
    if action == "masterkey":
        if names:
            raise Refused("masterkey covers this repository, not a named branch")
        if type(master_turns) is not int or master_turns < 1:
            raise Refused("The master-key turn count must be a positive whole number")
        entry["master"] = True
        entry["master_future_turns"] = master_turns - 1
        return f"Master key active for {master_turns} turn(s), including this command turn, in this repository"
    refs = list(state["rules"]) if names == ["--all"] else [repo.branch(n) for n in (names or [None])]
    if not refs:
        raise Refused("No existing branch protections match --all")
    if not set(deny) <= OPERATIONS:
        raise Refused("Unknown operation in custom rule")
    if action in {"sessionkey", "turnkey"}:
        for ref in refs:
            for owner, other in state["sessions"].items():
                if owner != session_id and valid_key(state, other, ref):
                    raise Refused("Another session holds the key for " + ref)
    for ref in refs:
        rule = state["rules"].setdefault(ref, {
            "locked": False, "anchored": False, "deny": [], "generation": 1})
        key = valid_key(state, entry, ref)
        if action in {"sessionkey", "turnkey"}:
            entry["keys"][ref] = {"generation": rule["generation"], "unlocked": None,
                                   "lifetime": "session" if action == "sessionkey" else "turn",
                                   "turn": turn}
        elif action == "release":
            entry["keys"].pop(ref, None)
        elif action in {"on", "off"} and key and not permanent:
            key["unlocked"] = action == "off"
        elif action in {"on", "off", "anchor", "unanchor", "rule"}:
            if action in {"on", "off"}:
                rule["locked"] = action == "on"
            elif action in {"anchor", "unanchor"}:
                rule["anchored"] = action == "anchor"
            else:
                rule["deny"] = sorted(set(deny))
            rule["generation"] += 1
        else:
            raise Refused("Unknown padlock command")
    return action + ": " + ", ".join(ref.removeprefix("refs/heads/") for ref in refs)


def authorize(state, effects, session_id="", turn="", agent_id=""):
    if master_active(state, session_id, turn, agent_id):
        return
    entry = state["sessions"].get(session_id, {}) if not agent_id else {}
    if not entry.get("active") or entry.get("turn") != turn:
        entry = {}
    for ref, operation in effects:
        if operation not in OPERATIONS:
            raise Refused("Unclassified operation: " + operation)
        rule = state["rules"].get(ref)
        if not rule:
            continue
        key = valid_key(state, entry, ref)
        # A holder's 'on' imposes a session lock even if the shared base is unlocked.
        locked = not key["unlocked"] if key and key["unlocked"] is not None else rule["locked"]
        reason = "locked" if locked else (
            "anchored" if rule["anchored"] and operation in ANCHOR_DENIES else (
                "custom rule" if operation in rule["deny"] else ""))
        if reason:
            raise Refused(f"{operation} denied on {ref}: {reason}")


def has_protection(state):
    return any(r["locked"] or r["anchored"] or r["deny"] for r in state["rules"].values()) or any(
        valid_key(state, entry, ref) for entry in state["sessions"].values() for ref in entry["keys"])


def run_guarded(repo, ledger, argv, session_id="", turn="", agent_id="", execute=None):
    from operations import classify, readonly, renamed_branch, repository_scope
    if not argv or argv[0] not in {"git", "but"}:
        raise Refused("The runner accepts git or but followed by separate arguments")
    repository_scope(argv)
    def invoke():
        if execute is not None:
            return execute(argv)
        env = dict(os.environ, NO_BG_TASKS="1")
        return subprocess.run(argv, cwd=repo.cwd, env=env, check=False).returncode
    if readonly(argv):
        return invoke()
    with ledger.transaction() as state:
        rename = renamed_branch(repo, argv) if state["rules"] else None
        if has_protection(state) and not master_active(state, session_id, turn, agent_id):
            effects = classify(repo, argv)
            authorize(state, effects, session_id, turn, agent_id)
        # Hold the SQLite transaction through admission and execution. Policy changes
        # wait instead of racing the checked operation; a busy store never means allow.
        result = invoke()
        if result == 0 and rename and rename[0] in state["rules"]:
            old, new = rename
            source = state["rules"][old]
            source["generation"] += 1
            destination = state["rules"].get(new, source)
            state["rules"][new] = {
                "locked": source["locked"] or destination["locked"],
                "anchored": source["anchored"] or destination["anchored"],
                "deny": sorted(set(source["deny"]) | set(destination["deny"])),
                "generation": max(source["generation"], destination["generation"]) + 1}
        return result


def parser():
    cli = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    cli.add_argument("--repo", default=".")
    cli.add_argument("--session", default="")
    cli.add_argument("--turn", default="")
    cli.add_argument("--agent", default="")
    commands = cli.add_subparsers(dest="command", required=True)
    commands.add_parser("status")
    commands.add_parser("hook")
    operator = commands.add_parser("operator", help="Explicit user controls and host lifecycle; see references/portable.md")
    operator.add_argument("action", choices=["start", "next", "end", "close", "command"])
    operator.add_argument("arguments", nargs=argparse.REMAINDER)
    run = commands.add_parser("run")
    run.add_argument("argv", nargs=argparse.REMAINDER)
    toggle = commands.add_parser("toggle")
    toggle.add_argument("action", choices=["on", "off"])
    toggle.add_argument("branch", nargs="?")
    release = commands.add_parser("release")
    release.add_argument("branch", nargs="?")
    release.add_argument("--all", action="store_true")
    return cli


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        if args.command == "hook":
            from host import handle
            result = handle(json.load(sys.stdin))
            if result:
                print(json.dumps(result))
            return 0
        repo = Repository(args.repo)
        ledger = Ledger(repo.common)
        if args.command == "status":
            print(json.dumps(ledger.read(), indent=2))
            return 0
        if args.command == "operator":
            from portable import operate
            print(json.dumps(operate(repo, ledger, args), indent=2))
            return 0
        if args.command == "run":
            command = args.argv[1:] if args.argv[:1] == ["--"] else args.argv
            return run_guarded(repo, ledger, command, args.session, args.turn, args.agent)
        with ledger.transaction() as state:
            if args.command in {"toggle", "release"}:
                entry = state["sessions"].get(args.session, {})
                if args.agent or not entry.get("active") or entry.get("turn") != args.turn:
                    raise Refused("This command requires the holder's current session and turn")
                if args.command == "release":
                    if args.all and args.branch:
                        raise Refused("Choose one branch or --all")
                    refs = list(entry["keys"]) if args.all else [repo.branch(args.branch)]
                    for ref in refs:
                        entry["keys"].pop(ref, None)
                    print("Released: " + ", ".join(refs))
                else:
                    ref = repo.branch(args.branch)
                    if not valid_key(state, entry, ref):
                        raise Refused("toggle requires this session's valid branch key")
                    entry["keys"][ref]["unlocked"] = args.action == "off"
                    print(args.action + ": " + ref)
        return 0
    except (Refused, sqlite3.Error, OSError, ValueError, KeyError, TypeError) as error:
        print("padlock: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
