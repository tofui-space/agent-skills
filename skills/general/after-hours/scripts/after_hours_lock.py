#!/usr/bin/env python3
"""Arm, disarm, or inspect the after-hours guard envelope.

The envelope is a lock file at <project>/.claude/after-hours-lock.json. Its presence
is what switches the guard (after_hours_guard.py) from no-op to enforcing. Paths are
stored absolute and normalized so the guard's prefix matching is reliable.

Usage
-----
  python after_hours_lock.py arm  --task "docs for the parser"
      [--read DIR ...] [--write DIR ...] [--bash "PREFIX" ...] [--domain HOST ...]
      [--project DIR]
  python after_hours_lock.py disarm [--project DIR]
  python after_hours_lock.py status [--project DIR]

Notes
-----
- `arm` must be run while DISARMED (the guard blocks the model from writing the lock
  once armed). The model runs `arm` at the start of the unattended run.
- `disarm` is the human's morning action. Because the guard only intercepts the
  model's tool calls, running this in your own terminal (or just deleting the lock
  file) always works, even while armed.
- Every path is resolved to an absolute, real path. List only directories/files that
  were actually part of today's work — the observed envelope.
"""

import argparse
import json
import os
import sys


def _project_dir(args):
    return os.path.abspath(args.project or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())


def _lock_path(project):
    return os.path.join(project, ".claude", "after-hours-lock.json")


def _abspaths(paths):
    out = []
    for p in paths or []:
        out.append(os.path.realpath(os.path.abspath(os.path.expanduser(p))))
    return out


def cmd_arm(args):
    project = _project_dir(args)
    lock = _lock_path(project)
    if os.path.exists(lock):
        print("refusing to arm: lock already present at {}".format(lock), file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(lock), exist_ok=True)
    envelope = {
        "task": args.task,
        "allowed_read_paths": _abspaths(args.read),
        "allowed_write_paths": _abspaths(args.write),
        "allowed_bash_prefixes": [s.strip() for s in (args.bash or []) if s.strip()],
        "allowed_network_domains": [d.strip().lower().lstrip(".") for d in (args.domain or []) if d.strip()],
        "network": bool(args.domain),
    }
    with open(lock, "w", encoding="utf-8") as fh:
        json.dump(envelope, fh, indent=2)
    print("armed. envelope written to {}".format(lock))
    print(json.dumps(envelope, indent=2))
    return 0


def cmd_disarm(args):
    project = _project_dir(args)
    lock = _lock_path(project)
    if not os.path.exists(lock):
        print("already disarmed (no lock at {})".format(lock))
        return 0
    os.remove(lock)
    print("disarmed. removed {}".format(lock))
    return 0


def cmd_status(args):
    project = _project_dir(args)
    lock = _lock_path(project)
    if not os.path.exists(lock):
        print("DISARMED — guard is a no-op (no lock at {})".format(lock))
        return 0
    print("ARMED — envelope at {}:".format(lock))
    try:
        with open(lock, "r", encoding="utf-8") as fh:
            print(fh.read())
    except Exception as exc:
        print("(lock present but unreadable: {})".format(exc))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Arm/disarm the after-hours guard envelope.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_arm = sub.add_parser("arm", help="write the envelope lock (must be disarmed first)")
    p_arm.add_argument("--task", required=True, help="short label for the run")
    p_arm.add_argument("--read", nargs="*", default=[], help="directories/files readable during the run")
    p_arm.add_argument("--write", nargs="*", default=[], help="directories/files writable during the run")
    p_arm.add_argument("--bash", nargs="*", default=[], help="allowed command prefixes, e.g. \"python -m pytest\"")
    p_arm.add_argument("--domain", nargs="*", default=[], help="pre-approved WebFetch hosts, e.g. docs.python.org")
    p_arm.add_argument("--project", default=None)
    p_arm.set_defaults(func=cmd_arm)

    p_dis = sub.add_parser("disarm", help="remove the envelope lock")
    p_dis.add_argument("--project", default=None)
    p_dis.set_defaults(func=cmd_disarm)

    p_stat = sub.add_parser("status", help="show whether the guard is armed")
    p_stat.add_argument("--project", default=None)
    p_stat.set_defaults(func=cmd_status)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
