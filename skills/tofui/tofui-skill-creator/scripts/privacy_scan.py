#!/usr/bin/env python3
"""Privacy scan for skill directories.

Scans every text file under one or more directories for content that could
identify the person who authored the skill or the projects they work on.
Nothing private is stored in this script: the identifying signals are derived
at runtime from the machine it runs on (OS username, home directory, git
identity, git remotes, hostname) plus an optional denylist file that lives
OUTSIDE any repository.

Usage:
    python -m scripts.privacy_scan <skill-dir> [<more-dirs>...]
        [--terms FILE] [--strict] [--no-auto]

    --terms FILE   Denylist, one term per line (# comments allowed).
                   Default: $PRIVATE_TERMS_FILE, else ~/.claude/private-terms.txt
    --strict       Treat WARN findings as failures (exit 1)
    --no-auto      Skip machine-derived signals (username, git identity, ...)

Exit codes: 0 clean, 1 findings, 2 usage error.

Findings come in two severities:
    ERROR  definite leak: denylist term, OS username, git identity, e-mail
           address, home-directory path, git remote org/repo name
    WARN   needs a human look: URL hostnames outside the reserved example
           domains

A clean scan is necessary, not sufficient. It cannot see a domain choice
that mirrors the author's work; that judgment stays with the model and the
human, per the skill's privacy seal.
"""

from __future__ import annotations

import argparse
import getpass
import os
import re
import socket
import subprocess
import sys
from pathlib import Path

SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist"}
SKIP_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip",
    ".skill", ".pyc", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4",
}
MAX_FILE_BYTES = 4_000_000

# RFC 2606 / RFC 6761 names plus hosts that cannot identify anyone.
SAFE_HOST_SUFFIXES = (
    "example.com", "example.org", "example.net", ".example", ".test",
    ".invalid", ".localhost", "localhost",
    # Public infrastructure and standards hosts that identify nobody.
    "apache.org", "googleapis.com", "gstatic.com", "sheetjs.com", "w3.org",
    "opensource.org",
)
SAFE_EMAIL_LOCAL = {"user", "name", "someone", "you", "me", "alex", "sam"}

# Path segments that are obviously placeholders, not a real account name.
PLACEHOLDER_SEGMENT = re.compile(
    r"^(<[^>]*>|\$\w+|\$\{[^}]*\}|%[^%]*%|\{[^}]*\}|\*|user|username|name|"
    r"you|yourname|your-name|your_name|me|someone|USERNAME|USER)$"
)

EMAIL_RE = re.compile(r"\b[\w.+-]+@([\w-]+\.)+[a-z]{2,}\b", re.IGNORECASE)
HOME_PATH_RE = re.compile(
    r"(?:/Users/|/home/|[A-Za-z]:[\\/]+Users[\\/]+)([^\s/\\\"'`)\]>,;]+)"
)
URL_RE = re.compile(r"https?://([^\s/\"'`)\]>]+)", re.IGNORECASE)

# Tokens too short or too generic to be useful identity signals on their own.
MIN_TOKEN_LEN = 4
GENERIC_TOKENS = {
    "user", "admin", "root", "test", "main", "master", "origin", "upstream",
    "skills", "skill", "agent", "agents", "claude", "anthropic", "github",
    "gitlab", "local", "home", "users", "desktop", "laptop", "windows",
    "linux", "macos", "default", "null", "none", "true", "false",
}


def _run(cmd: list[str], cwd: Path | None = None) -> str:
    try:
        out = subprocess.run(
            cmd, capture_output=True, text=True, cwd=cwd, timeout=10
        )
        return out.stdout if out.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def _useful(token: str) -> bool:
    t = token.strip().strip("'\"").lower()
    return len(t) >= MIN_TOKEN_LEN and t not in GENERIC_TOKENS and t.isprintable()


def auto_signals(scan_roots: list[Path]) -> dict[str, str]:
    """Derive identity signals from this machine. Returns term -> label."""
    signals: dict[str, str] = {}

    def add(term: str, label: str) -> None:
        if _useful(term):
            signals.setdefault(term.strip(), label)

    try:
        add(getpass.getuser(), "os username")
    except Exception:  # getuser can fail in unusual environments
        pass
    for var in ("USER", "USERNAME", "LOGNAME"):
        add(os.environ.get(var, ""), "os username")
    add(Path.home().name, "home directory name")
    add(socket.gethostname().split(".")[0], "hostname")

    name = _run(["git", "config", "--global", "user.name"]).strip()
    email = _run(["git", "config", "--global", "user.email"]).strip()
    if name:
        add(name, "git user.name")
        for part in re.split(r"[\s._-]+", name):
            add(part, "git user.name")
    if email:
        add(email, "git user.email")
        add(email.split("@")[0], "git user.email local part")

    seen_dirs: set[Path] = set()
    for root in [Path.cwd(), *scan_roots]:
        top = _run(["git", "rev-parse", "--show-toplevel"], cwd=root).strip()
        if not top:
            continue
        top_path = Path(top)
        if top_path in seen_dirs:
            continue
        seen_dirs.add(top_path)
        for line in _run(["git", "remote", "-v"], cwd=top_path).splitlines():
            m = re.search(r"[:/]([^/\s:]+)/([^/\s]+?)(?:\.git)?\s", line + " ")
            if m:
                add(m.group(1), "git remote org")
                add(m.group(2), "git remote repo")
    return signals


def load_terms(path: Path | None) -> dict[str, str]:
    terms: dict[str, str] = {}
    if path is None or not path.is_file():
        return terms
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        terms[line] = "denylist term"
    return terms


def iter_text_files(root: Path):
    if root.is_file():
        yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in sorted(filenames):
            p = Path(dirpath) / fn
            if p.suffix.lower() in SKIP_SUFFIXES:
                continue
            try:
                if p.stat().st_size > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            yield p


def _safe_host(host: str) -> bool:
    h = host.lower().split(":")[0]
    return any(h == s.lstrip(".") or h.endswith(s) for s in SAFE_HOST_SUFFIXES)


def scan_line(line: str, terms: dict[str, str]) -> list[tuple[str, str, str]]:
    """Return (severity, kind, match) triples for one line."""
    hits: list[tuple[str, str, str]] = []

    for term, label in terms.items():
        pattern = r"(?<![\w-])" + re.escape(term) + r"(?![\w-])"
        if re.search(pattern, line, re.IGNORECASE):
            hits.append(("ERROR", label, term))

    for m in EMAIL_RE.finditer(line):
        addr = m.group(0)
        local, _, host = addr.partition("@")
        if _safe_host(host) or local.lower() in SAFE_EMAIL_LOCAL:
            continue
        hits.append(("ERROR", "e-mail address", addr))

    for m in HOME_PATH_RE.finditer(line):
        seg = m.group(1)
        # Real account names start with a word character; anything else is a
        # placeholder (<name>, $HOME, {user}) or regex/markup noise.
        if not re.match(r"[\w.]", seg) or PLACEHOLDER_SEGMENT.match(seg):
            continue
        hits.append(("ERROR", "home-directory path", m.group(0)))

    for m in URL_RE.finditer(line):
        host = m.group(1)
        if _safe_host(host):
            continue
        hits.append(("WARN", "external URL host (review)", host))

    return hits


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Scan skill files for identifying content.")
    parser.add_argument("paths", nargs="+", help="skill directories or files to scan")
    parser.add_argument("--terms", help="denylist file (one term per line)")
    parser.add_argument("--strict", action="store_true", help="fail on WARN too")
    parser.add_argument("--no-auto", action="store_true", help="skip machine-derived signals")
    args = parser.parse_args(argv)

    roots = [Path(p).resolve() for p in args.paths]
    missing = [r for r in roots if not r.exists()]
    if missing:
        for r in missing:
            print(f"error: path not found: {r}", file=sys.stderr)
        return 2

    terms_path: Path | None
    if args.terms:
        terms_path = Path(args.terms).expanduser()
    else:
        env = os.environ.get("PRIVATE_TERMS_FILE")
        terms_path = Path(env).expanduser() if env else Path.home() / ".claude" / "private-terms.txt"
    terms = load_terms(terms_path)
    if not terms:
        print(f"note: no denylist loaded (looked for {terms_path}); "
              "only machine-derived signals and generic patterns apply")
    if not args.no_auto:
        for term, label in auto_signals(roots).items():
            terms.setdefault(term, label)

    errors = warns = 0
    for root in roots:
        for file in iter_text_files(root):
            try:
                text = file.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if "\x00" in text[:4096]:
                continue
            try:
                rel = file.relative_to(Path.cwd())
            except ValueError:
                rel = file
            for n, line in enumerate(text.splitlines(), 1):
                for severity, kind, match in scan_line(line, terms):
                    if severity == "ERROR":
                        errors += 1
                    else:
                        warns += 1
                    print(f"{rel}:{n}: [{severity}] {kind}: {match}")

    if errors == 0 and warns == 0:
        print("privacy scan: clean")
        return 0
    print(f"privacy scan: {errors} error(s), {warns} warning(s)")
    if errors or (args.strict and warns):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
