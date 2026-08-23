#!/usr/bin/env python3
"""Keep the upstream skill-creator files in this fork in sync.

Layout contract (see upstream.json):

    mirrored  upstream files copied byte-for-byte; never edited here
    body      upstream SKILL.md with its frontmatter stripped, stored as
              references/upstream-skill-creator.md; never edited here
    overlay   files this fork owns: SKILL.md, the privacy seal, the scanner,
              the sealed wrappers, this script, upstream.json
    anchors   phrases in upstream files that the overlay's overrides or
              wrappers depend on; a missing anchor means an override needs
              a human look after syncing

Usage:
    python -m scripts.sync_upstream check  [--source DIR | --fetch]
    python -m scripts.sync_upstream apply  [--source DIR | --fetch]

Source resolution: --source, else --fetch (shallow git clone of the upstream
repository into a temp dir), else the installed marketplace copy named in
upstream.json, located through ~/.claude/plugins/known_marketplaces.json.

Exit codes: 0 in sync (check) or applied cleanly (apply); 1 update available,
local drift, or missing anchors; 2 usage or source error.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
MANIFEST = SKILL_DIR / "upstream.json"
SKIP_DIRS = {"__pycache__", ".git", "node_modules"}
SKIP_SUFFIXES = {".pyc"}
FRONTMATTER = re.compile(r"^---\r?\n.*?\r?\n---\r?\n", re.S)


def sha256_bytes(data: bytes) -> str:
    # Line endings are normalised so a CRLF checkout hashes like an LF one.
    return hashlib.sha256(data.replace(b"\r\n", b"\n")).hexdigest()


def sha256(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def save_manifest(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n", encoding="utf-8")


def walk(root: Path) -> dict[str, Path]:
    out: dict[str, Path] = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            p = Path(dirpath) / fn
            if p.suffix in SKIP_SUFFIXES:
                continue
            out[p.relative_to(root).as_posix()] = p
    return out


def marketplace_dir(name: str) -> Path | None:
    known = Path.home() / ".claude" / "plugins" / "known_marketplaces.json"
    if known.is_file():
        try:
            entry = json.loads(known.read_text(encoding="utf-8")).get(name)
            if entry and entry.get("installLocation"):
                return Path(entry["installLocation"])
        except (OSError, ValueError):
            pass
    fallback = Path.home() / ".claude" / "plugins" / "marketplaces" / name
    return fallback if fallback.is_dir() else None


def resolve_source(args: argparse.Namespace, m: dict, tmp: list[tempfile.TemporaryDirectory]) -> Path:
    src = m["source"]
    if args.source:
        return Path(args.source).expanduser().resolve()
    if args.fetch:
        td = tempfile.TemporaryDirectory(prefix="skill-creator-upstream-")
        tmp.append(td)
        url = f"https://github.com/{src['repo']}.git"
        subprocess.run(
            ["git", "clone", "--depth", "1", "--quiet", url, td.name],
            check=True,
        )
        return Path(td.name) / src["path"]
    root = marketplace_dir(src["marketplace"])
    if root is None:
        print("error: marketplace copy not found; pass --source DIR or --fetch", file=sys.stderr)
        sys.exit(2)
    return root / src["path"]


def upstream_body(skill_md: Path) -> bytes:
    text = skill_md.read_text(encoding="utf-8")
    m = FRONTMATTER.match(text)
    return (text[m.end():] if m else text).encode("utf-8")


def check_anchors(source: Path, m: dict, local: bool = False) -> list[str]:
    """Verify anchor phrases. With local=True the upstream SKILL.md anchors are
    looked up in the stored body file, since SKILL.md here is the overlay."""
    missing: list[str] = []
    body = m["body"]
    for rel, phrases in m.get("anchors", {}).items():
        p = source / (body["to"] if local and rel == body["from"] else rel)
        text = p.read_text(encoding="utf-8", errors="replace") if p.is_file() else ""
        for phrase in phrases:
            if phrase not in text:
                missing.append(f"{rel}: {phrase!r}")
    return missing


def compare(source: Path, m: dict) -> dict:
    up = walk(source)
    mirrored = m["files"]
    body = m["body"]
    changed, new, removed, drift = [], [], [], []

    for rel, p in up.items():
        if rel == body["from"]:
            if sha256_bytes(upstream_body(p)) != body["sha256"]:
                changed.append(f"{rel} -> {body['to']}")
            continue
        if rel not in mirrored:
            new.append(rel)
        elif sha256(p) != mirrored[rel]:
            changed.append(rel)
    for rel in mirrored:
        if rel not in up:
            removed.append(rel)

    for rel, digest in mirrored.items():
        local = SKILL_DIR / rel
        if not local.is_file() or sha256(local) != digest:
            drift.append(rel)
    local_body = SKILL_DIR / body["to"]
    if not local_body.is_file() or sha256(local_body) != body["sha256"]:
        drift.append(body["to"])

    return {
        "changed": sorted(changed),
        "new": sorted(new),
        "removed": sorted(removed),
        "drift": sorted(drift),
        "anchors_missing": check_anchors(source, m),
    }


def report(result: dict, source: Path, m: dict) -> int:
    print(f"upstream source: {source}")
    print(f"last synced:     {m.get('synced', 'never')}")
    status = 0
    for key, label in (
        ("changed", "changed upstream"),
        ("new", "new upstream"),
        ("removed", "removed upstream"),
        ("drift", "LOCAL DRIFT (mirrored file edited here)"),
        ("anchors_missing", "ANCHOR MISSING (override needs review)"),
    ):
        items = result[key]
        if items:
            status = 1
            print(f"\n{label}:")
            for it in items:
                print(f"  {it}")
    if status == 0:
        print("\nin sync: nothing to do")
    return status


def apply(source: Path, m: dict) -> int:
    up = walk(source)
    body = m["body"]
    old_body_path = SKILL_DIR / body["to"]
    old_body = old_body_path.read_text(encoding="utf-8") if old_body_path.is_file() else ""

    for rel in list(m["files"]):
        if rel not in up:
            target = SKILL_DIR / rel
            if target.is_file():
                target.unlink()
                print(f"removed  {rel}")
            del m["files"][rel]

    new_files: dict[str, str] = {}
    for rel, p in sorted(up.items()):
        if rel == body["from"]:
            data = upstream_body(p)
            target = SKILL_DIR / body["to"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            m["body"]["sha256"] = sha256_bytes(data)
            print(f"updated  {body['to']}")
            continue
        target = SKILL_DIR / rel
        if rel in m.get("overlay", []):
            print(f"SKIPPED  {rel} (upstream now ships a file the overlay owns; resolve by hand)")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, target)
        new_files[rel] = sha256(p)
        print(f"synced   {rel}")
    m["files"] = new_files
    m["synced"] = date.today().isoformat()
    save_manifest(m)

    new_body = (SKILL_DIR / body["to"]).read_text(encoding="utf-8")
    if old_body and old_body != new_body:
        diff = list(difflib.unified_diff(
            old_body.splitlines(), new_body.splitlines(),
            "upstream-skill-creator.md (before)", "upstream-skill-creator.md (after)",
            lineterm="", n=1,
        ))
        print(f"\nupstream SKILL.md body changed ({len(diff)} diff lines). "
              "Read the diff and re-check every override in SKILL.md against it:")
        print("\n".join(diff[:200]))
        if len(diff) > 200:
            print(f"... {len(diff) - 200} more lines")

    missing = check_anchors(SKILL_DIR, m, local=True)
    if missing:
        print("\nANCHOR MISSING after sync — fix the matching override or wrapper:")
        for it in missing:
            print(f"  {it}")
        return 1
    print("\nsynced; anchors intact. Run `python -m scripts.privacy_scan .` before committing.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync upstream skill-creator files into this fork.")
    parser.add_argument("command", choices=["check", "apply"], nargs="?", default="check")
    parser.add_argument("--source", help="directory holding the upstream skill (overrides marketplace lookup)")
    parser.add_argument("--fetch", action="store_true", help="shallow-clone the upstream repository instead")
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if not MANIFEST.is_file():
        print(f"error: {MANIFEST} not found", file=sys.stderr)
        return 2
    m = load_manifest()
    tmp: list[tempfile.TemporaryDirectory] = []
    try:
        source = resolve_source(args, m, tmp)
        if not (source / "SKILL.md").is_file():
            print(f"error: no SKILL.md under {source}", file=sys.stderr)
            return 2
        if args.command == "check":
            return report(compare(source, m), source, m)
        return apply(source, m)
    finally:
        for td in tmp:
            td.cleanup()


if __name__ == "__main__":
    sys.exit(main())
