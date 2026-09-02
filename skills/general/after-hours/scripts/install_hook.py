#!/usr/bin/env python3
"""Install (or print) the PreToolUse hook entry that runs the after-hours guard.

The guard only enforces when a lock file is present, so installing this hook is safe
and inert for normal sessions — it becomes active only while an after-hours run is
armed.

Usage
-----
  python install_hook.py            # print the settings snippet and instructions
  python install_hook.py --write    # merge the hook into <project>/.claude/settings.json
  python install_hook.py --write --project /path/to/project

The command is pinned to this Python interpreter and this guard file's absolute path,
so it keeps working regardless of the caller's PATH or working directory.
"""

import argparse
import json
import os
import sys

GUARD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "after_hours_guard.py")


def hook_command():
    return '"{py}" "{guard}"'.format(py=sys.executable, guard=GUARD)


def hook_entry():
    return {
        "matcher": "*",
        "hooks": [{"type": "command", "command": hook_command()}],
    }


def settings_path(project):
    return os.path.join(os.path.abspath(project), ".claude", "settings.json")


def do_write(project):
    path = settings_path(project)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    settings = {}
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                settings = json.load(fh) or {}
        except Exception as exc:
            print("could not parse existing settings.json ({}); aborting.".format(exc), file=sys.stderr)
            return 1
    hooks = settings.setdefault("hooks", {})
    pre = hooks.setdefault("PreToolUse", [])
    for entry in pre:
        for h in entry.get("hooks", []):
            if "after_hours_guard.py" in h.get("command", ""):
                print("after-hours guard hook already installed in {}".format(path))
                return 0
    pre.append(hook_entry())
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(settings, fh, indent=2)
    print("installed after-hours guard hook into {}".format(path))
    print("restart Claude Code (or reload settings) for it to take effect.")
    return 0


def do_print():
    snippet = {"hooks": {"PreToolUse": [hook_entry()]}}
    print("Add this to your project's .claude/settings.json:\n")
    print(json.dumps(snippet, indent=2))
    print("\nOr run:  python install_hook.py --write")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Install the after-hours guard PreToolUse hook.")
    parser.add_argument("--write", action="store_true", help="merge into .claude/settings.json")
    parser.add_argument("--project", default=os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    args = parser.parse_args(argv)
    if not os.path.exists(GUARD):
        print("guard script not found at {}".format(GUARD), file=sys.stderr)
        return 1
    return do_write(args.project) if args.write else do_print()


if __name__ == "__main__":
    sys.exit(main())
