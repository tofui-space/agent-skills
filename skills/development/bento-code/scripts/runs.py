#!/usr/bin/env python3
"""
runs.py -- run ids, run directories, and the per-project run index for bento-code.

Layout (all derived at runtime, nothing hard-coded to a machine):
  <home>/.claude/bento-code/runs/<project>/index.jsonl     one JSON object per run
  <home>/.claude/bento-code/runs/<project>/<run-id>/       main-agent-only run dir
  <temp>/bento-code/<project>/<run-id>/{shared,agents}/    subagent workspace

<project> is the repository directory name plus a short hash of its absolute path, so two
repositories with the same name do not share an index.

Run ids: three lowercase letters. Consonant-vowel-consonant while unused ones remain in the
project, then any three letters. Unique per project; deleted runs stay in the index as
tombstones so an id is never reused.

USAGE:
  python runs.py new    --repo . --task "add late-fee calculation"
  python runs.py record <run-id> --repo . src/fees.ts tests/fees.test.ts
  python runs.py status <run-id> --repo . --set accepted
  python runs.py close  <run-id> --repo .
  python runs.py list   [--repo . | --all]
  python runs.py find   src/fees.ts --repo .
  python runs.py clean  --repo . [--older-than 30] [--status accepted] [--run bak ...] [--yes]
  python runs.py --self-test
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import secrets
import shutil
import string
import sys
import tempfile
from pathlib import Path

SKILL = "bento-code"
CONSONANTS = "bcdfghjklmnpqrstvwxyz"
VOWELS = "aeiou"
STATUSES = ("open", "accepted", "reported", "deleted")


# ---------------------------------------------------------------- paths

def home_root(home=None):
    return Path(home or Path.home()) / ".claude" / SKILL / "runs"


def temp_root(temp=None):
    return Path(temp or tempfile.gettempdir()) / SKILL


def project_key(repo):
    repo = Path(repo).resolve()
    digest = hashlib.sha256(str(repo).lower().encode("utf-8")).hexdigest()[:6]
    return f"{repo.name}-{digest}"


def paths(repo, run_id, home=None, temp=None):
    key = project_key(repo)
    return {
        "project": key,
        "index": home_root(home) / key / "index.jsonl",
        "run_dir": home_root(home) / key / run_id,
        "workspace_dir": temp_root(temp) / key / run_id,
    }


# ---------------------------------------------------------------- index

def read_index(index_path):
    if not index_path.exists():
        return []
    with index_path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def write_index(index_path, entries):
    index_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = index_path.with_suffix(".jsonl.tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        for entry in entries:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    tmp.replace(index_path)


def get_entry(entries, run_id):
    for entry in entries:
        if entry["id"] == run_id:
            return entry
    sys.exit(f"error: no run '{run_id}' in this project's index")


# ---------------------------------------------------------------- ids

def cvc_ids():
    return [c1 + v + c2 for c1 in CONSONANTS for v in VOWELS for c2 in CONSONANTS]


def any_ids():
    letters = string.ascii_lowercase
    return [a + b + c for a in letters for b in letters for c in letters]


def allocate_id(used):
    for pool in (cvc_ids(), any_ids()):
        free = [i for i in pool if i not in used]
        if free:
            return secrets.choice(free)
    sys.exit("error: all 17,576 run ids are used in this project")


# ---------------------------------------------------------------- helpers

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def dir_size(path):
    if not path.exists():
        return 0
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def rel_to_repo(repo, file_path):
    repo = Path(repo).resolve()
    p = Path(file_path)
    p = (repo / p).resolve() if not p.is_absolute() else p.resolve()
    try:
        return p, p.relative_to(repo).as_posix()
    except ValueError:
        sys.exit(f"error: {file_path} is outside the repository")


# ---------------------------------------------------------------- commands

def cmd_new(a):
    probe = paths(a.repo, "x", a.home, a.temp)
    entries = read_index(probe["index"])
    run_id = allocate_id({e["id"] for e in entries})
    p = paths(a.repo, run_id, a.home, a.temp)
    for sub in ("briefs", "reviews", "observed"):
        (p["run_dir"] / sub).mkdir(parents=True, exist_ok=True)
    for sub in ("shared", "agents"):
        (p["workspace_dir"] / sub).mkdir(parents=True, exist_ok=True)
    entries.append({
        "id": run_id,
        "created": now(),
        "repo": str(Path(a.repo).resolve()),
        "task": a.task,
        "status": "open",
        "files": [],
    })
    write_index(p["index"], entries)
    print(json.dumps({
        "run_id": run_id,
        "project": p["project"],
        "run_dir": str(p["run_dir"]),
        "workspace_dir": str(p["workspace_dir"]),
    }, indent=2))


def cmd_record(a):
    p = paths(a.repo, a.run_id, a.home, a.temp)
    entries = read_index(p["index"])
    entry = get_entry(entries, a.run_id)
    for f in a.files:
        abs_path, rel = rel_to_repo(a.repo, f)
        if not abs_path.is_file():
            sys.exit(f"error: {f} does not exist")
        entry["files"] = [x for x in entry["files"] if x["path"] != rel]
        entry["files"].append({"path": rel, "sha256": sha256_file(abs_path), "recorded": now()})
    write_index(p["index"], entries)
    print(f"{a.run_id}: {len(entry['files'])} file(s) recorded")


def cmd_status(a):
    p = paths(a.repo, a.run_id, a.home, a.temp)
    entries = read_index(p["index"])
    entry = get_entry(entries, a.run_id)
    if entry["status"] == "deleted":
        sys.exit(f"error: run '{a.run_id}' was deleted")
    entry["status"] = a.set
    write_index(p["index"], entries)
    print(f"{a.run_id}: {a.set}")


def cmd_close(a):
    p = paths(a.repo, a.run_id, a.home, a.temp)
    entries = read_index(p["index"])
    entry = get_entry(entries, a.run_id)
    target = p["run_dir"] / "workspace"
    if p["workspace_dir"].exists():
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(p["workspace_dir"], target)
        shutil.rmtree(p["workspace_dir"])
        print(f"{a.run_id}: workspace archived to {target}")
    else:
        print(f"{a.run_id}: no workspace to archive (already closed or removed)")
    entry["closed"] = now()
    write_index(p["index"], entries)


def project_indexes(a):
    if a.all:
        root = home_root(a.home)
        return sorted(root.glob("*/index.jsonl")) if root.exists() else []
    return [paths(a.repo, "x", a.home, a.temp)["index"]]


def cmd_list(a):
    rows = []
    for index in project_indexes(a):
        for e in read_index(index):
            if e["status"] == "deleted" and not a.deleted:
                continue
            size = dir_size(index.parent / e["id"])
            rows.append((e["created"][:10], index.parent.name, e["id"], e["status"],
                         f"{size / 1024:.0f}K", e["task"]))
    if not rows:
        print("no runs")
        return
    widths = [max(len(r[i]) for r in rows) for i in range(5)]
    for r in rows:
        print("  ".join(r[i].ljust(widths[i]) for i in range(5)) + "  " + r[5])


def cmd_find(a):
    abs_path, rel = rel_to_repo(a.repo, a.path)
    current = sha256_file(abs_path) if abs_path.is_file() else None
    p = paths(a.repo, "x", a.home, a.temp)
    hits = []
    for e in read_index(p["index"]):
        for f in e["files"]:
            if f["path"] == rel:
                match = "unchanged" if f["sha256"] == current else "changed since"
                hits.append(f"{e['id']}  {e['created'][:10]}  {e['status']:<9} {match}  {e['task']}")
    print("\n".join(hits) if hits else f"no run recorded writing {rel}")


def cmd_clean(a):
    p = paths(a.repo, "x", a.home, a.temp)
    entries = read_index(p["index"])
    cutoff = None
    if a.older_than is not None:
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=a.older_than)
    named = set(a.run or [])
    chosen = []
    for e in entries:
        if e["status"] == "deleted":
            continue
        if named:
            if e["id"] in named:
                chosen.append(e)
            continue
        if e["status"] == "reported":
            continue
        if a.status and e["status"] != a.status:
            continue
        if cutoff and dt.datetime.fromisoformat(e["created"]) > cutoff:
            continue
        if not a.status and cutoff is None:
            continue
        chosen.append(e)
    if not chosen:
        print("nothing to clean (reported runs are only removed when named with --run)")
        return
    for e in chosen:
        print(f"{'delete' if a.yes else 'would delete'}: {e['id']}  {e['status']}  {e['task']}")
    if not a.yes:
        print("dry run; add --yes to delete")
        return
    for e in chosen:
        for d in (p["index"].parent / e["id"], temp_root(a.temp) / p["project"] / e["id"]):
            if d.exists():
                shutil.rmtree(d)
        e["status"] = "deleted"
        e["deleted"] = now()
    write_index(p["index"], entries)


# ---------------------------------------------------------------- self-test

def self_test():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        repo, home, temp = tmp / "repo", tmp / "home", tmp / "temp"
        repo.mkdir()
        (repo / "a.txt").write_text("one", encoding="utf-8")
        base = ["--repo", str(repo), "--home", str(home), "--temp", str(temp)]

        def run(*argv):
            main(list(argv) + base)

        main(["new", "--task", "t1"] + base)
        index = paths(repo, "x", home, temp)["index"]
        e = read_index(index)[0]
        assert len(e["id"]) == 3 and e["id"][1] in VOWELS and e["id"][0] in CONSONANTS
        rid = e["id"]
        assert (paths(repo, rid, home, temp)["workspace_dir"] / "shared").is_dir()
        run("record", rid, "a.txt")
        assert read_index(index)[0]["files"][0]["path"] == "a.txt"
        run("close", rid)
        assert (paths(repo, rid, home, temp)["run_dir"] / "workspace" / "shared").is_dir()
        assert not paths(repo, rid, home, temp)["workspace_dir"].exists()
        run("status", rid, "--set", "reported")
        main(["clean", "--older-than", "0", "--yes"] + base)
        assert read_index(index)[0]["status"] == "reported", "reported run must survive clean"
        main(["clean", "--run", rid, "--yes"] + base)
        assert read_index(index)[0]["status"] == "deleted"
        assert rid not in {allocate_id({rid}) for _ in range(50)}
        used = set(cvc_ids())
        fallback = allocate_id(used)
        assert fallback not in used and len(fallback) == 3
        assert len(cvc_ids()) == 2205
    print("self-test passed")


# ---------------------------------------------------------------- cli

def main(argv=None):
    ap = argparse.ArgumentParser(description="bento-code run management")
    ap.add_argument("--self-test", action="store_true")
    sub = ap.add_subparsers(dest="cmd")

    def common(sp):
        sp.add_argument("--repo", default=".", help="repository root (default: .)")
        sp.add_argument("--home", help=argparse.SUPPRESS)
        sp.add_argument("--temp", help=argparse.SUPPRESS)
        return sp

    sp = common(sub.add_parser("new", help="allocate a run id and create run directories"))
    sp.add_argument("--task", required=True, help="one-line task summary")

    sp = common(sub.add_parser("record", help="record repository files written by a run"))
    sp.add_argument("run_id")
    sp.add_argument("files", nargs="+")

    sp = common(sub.add_parser("status", help="set a run's status"))
    sp.add_argument("run_id")
    sp.add_argument("--set", required=True, choices=("open", "accepted", "reported"))

    sp = common(sub.add_parser("close", help="archive the subagent workspace into the run dir"))
    sp.add_argument("run_id")

    sp = common(sub.add_parser("list", help="list runs"))
    sp.add_argument("--all", action="store_true", help="all projects")
    sp.add_argument("--deleted", action="store_true", help="include deleted runs")

    sp = common(sub.add_parser("find", help="runs that wrote a repository file"))
    sp.add_argument("path")

    sp = common(sub.add_parser("clean", help="delete runs (dry run unless --yes)"))
    sp.add_argument("--older-than", type=int, metavar="DAYS")
    sp.add_argument("--status", choices=("open", "accepted"))
    sp.add_argument("--run", action="append", metavar="ID", help="delete this run, even if reported")
    sp.add_argument("--yes", action="store_true")

    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.cmd:
        ap.print_help()
        return
    {"new": cmd_new, "record": cmd_record, "status": cmd_status, "close": cmd_close,
     "list": cmd_list, "find": cmd_find, "clean": cmd_clean}[a.cmd](a)


if __name__ == "__main__":
    main()
