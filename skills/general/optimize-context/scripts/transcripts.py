#!/usr/bin/env python3
"""List and read agent session transcripts (Claude Code and Codex JSONL).

Both formats are undocumented. Field names were observed, not read from a
specification: the script prints a warning to stderr when a file yields no
recognisable records, and a silent empty result must not be read as "nothing
was said".

Usage:
  transcripts.py sessions PATH [PATH ...] [--store DIR ...]
  transcripts.py show FILE [--grep REGEX] [--context N] [--width N]
                           [--tools] [--injected] [--user]
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

INJECTED_PREFIXES_CLAUDE = (
    "<system-reminder>",
    "<task-notification>",
    "<local-command-",
)
VERSION = "2026-11-06"
QUESTION_TOOL = re.compile(r"question|user_input", re.IGNORECASE)


def is_question_tool(name):
    return bool(name) and bool(QUESTION_TOOL.search(str(name)))
INJECTED_PREFIXES_CODEX = (
    "# AGENTS.md instructions",
    "<environment_context>",
    "<user_instructions>",
    "<skill>",
    "<turn_aborted>",
)


def default_stores():
    stores = []
    claude = os.environ.get("CLAUDE_CONFIG_DIR") or str(Path.home() / ".claude")
    stores.append(Path(claude) / "projects")
    codex = os.environ.get("CODEX_HOME") or str(Path.home() / ".codex")
    stores.append(Path(codex) / "sessions")
    return [s for s in stores if s.is_dir()]


def read_records(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def detect_format(path):
    for rec in read_records(path):
        if rec.get("type") == "session_meta":
            return "codex"
        if "sessionId" in rec or rec.get("type") in ("user", "assistant"):
            return "claude"
    return None


def session_info(path):
    fmt = detect_format(path)
    info = {"file": str(path), "agent": fmt, "cwd": None, "branch": None,
            "session": None, "start": None}
    if fmt == "codex":
        for rec in read_records(path):
            if rec.get("type") == "session_meta":
                p = rec.get("payload", {})
                info["cwd"] = p.get("cwd")
                info["session"] = p.get("id") or p.get("session_id")
                info["start"] = p.get("timestamp") or rec.get("timestamp")
                git = p.get("git") or {}
                info["branch"] = git.get("branch") if isinstance(git, dict) else None
                break
    elif fmt == "claude":
        for rec in read_records(path):
            if rec.get("cwd") and rec.get("timestamp"):
                info["cwd"] = rec.get("cwd")
                info["branch"] = rec.get("gitBranch")
                info["session"] = rec.get("sessionId")
                info["start"] = rec.get("timestamp")
                break
    return info


def inside(child, roots):
    try:
        c = Path(child).resolve()
    except (OSError, RuntimeError):
        return False
    for r in roots:
        if c == r or r in c.parents:
            return True
    return False


def cmd_sessions(args):
    roots = [Path(p).expanduser().resolve() for p in args.paths]
    stores = [Path(s).expanduser() for s in args.store] if args.store else default_stores()
    if not stores:
        print("no transcript store found; pass --store DIR", file=sys.stderr)
        return 1
    rows = []
    for store in stores:
        for f in store.rglob("*.jsonl"):
            info = session_info(f)
            if info["cwd"] and inside(info["cwd"], roots):
                info["subagent"] = "subagents" in f.parts
                rows.append(info)
    rows.sort(key=lambda r: r["start"] or "")
    for r in rows:
        kind = r["agent"] + ("/subagent" if r["subagent"] else "")
        print("\t".join(str(x) for x in (
            r["start"], kind, r["session"], r["branch"] or "-", r["cwd"], r["file"])))
    print(f"{len(rows)} transcript(s) in {len(stores)} store(s)", file=sys.stderr)
    return 0


def text_blocks(content, kinds):
    if isinstance(content, str):
        return [content]
    out = []
    if isinstance(content, list):
        for b in content:
            if isinstance(b, dict) and b.get("type") in kinds and isinstance(b.get("text"), str):
                out.append(b["text"])
    return out


def tool_result_text(block):
    c = block.get("content")
    if isinstance(c, str):
        return c
    return "\n".join(text_blocks(c, ("text",)))


def attachment_event(att):
    kind = att.get("type")
    if kind == "queued_command":
        origin = att.get("origin") or {}
        who = origin.get("kind") if isinstance(origin, dict) else None
        if who == "human":
            return "USER (mid-turn)", att.get("prompt") or ""
        return f"INJECTED queued_command/{who}", att.get("prompt") or ""
    if kind == "hook_additional_context":
        return f"INJECTED hook {att.get('hookName')}", str(att.get("content") or "")
    if kind == "nested_memory":
        return "INJECTED instruction file", str(att.get("path") or att.get("displayPath"))
    if kind == "instructions":
        return "INJECTED instruction files", json.dumps(att.get("files"))[:2000]
    return None


def events_claude(path, want_tools):
    tool_names = {}
    for rec in read_records(path):
        t = rec.get("type")
        ts = rec.get("timestamp", "")
        side = " (subagent)" if rec.get("isSidechain") else ""
        if t == "system" and rec.get("subtype") == "compact_boundary":
            yield ts, "COMPACTION", "context was compacted here; earlier turns were replaced by a summary"
            continue
        if t == "attachment" and isinstance(rec.get("attachment"), dict):
            ev = attachment_event(rec["attachment"])
            if ev:
                yield ts, ev[0] + side, ev[1]
            continue
        if t not in ("user", "assistant"):
            continue
        msg = rec.get("message") or {}
        content = msg.get("content")
        if t == "user":
            if rec.get("isCompactSummary"):
                for txt in text_blocks(content, ("text",)):
                    yield ts, "COMPACTION SUMMARY", txt
                continue
            for txt in text_blocks(content, ("text",)):
                injected = rec.get("isMeta") or txt.lstrip().startswith(INJECTED_PREFIXES_CLAUDE)
                yield ts, ("INJECTED" if injected else "USER") + side, txt
            if isinstance(content, list):
                for b in content:
                    if (isinstance(b, dict) and b.get("type") == "tool_result"
                            and is_question_tool(tool_names.get(b.get("tool_use_id")))):
                        yield ts, "USER (answer)" + side, tool_result_text(b)
        else:
            for txt in text_blocks(content, ("text",)):
                yield ts, "ASSISTANT" + side, txt
            if isinstance(content, list):
                for b in content:
                    if isinstance(b, dict) and b.get("type") == "tool_use":
                        tool_names[b.get("id")] = b.get("name")
                        if is_question_tool(b.get("name")):
                            yield ts, "ASSISTANT (question)" + side, json.dumps(b.get("input"))
                        elif want_tools:
                            yield ts, "TOOL " + str(b.get("name")) + side, json.dumps(b.get("input"))


def events_codex(path, want_tools):
    for rec in read_records(path):
        t = rec.get("type")
        ts = rec.get("timestamp", "")
        p = rec.get("payload") or {}
        if t == "compacted":
            msg = p.get("message") if isinstance(p, dict) else None
            yield ts, "COMPACTION", msg or "context was compacted here; earlier turns were replaced"
            continue
        if t != "response_item" or not isinstance(p, dict):
            continue
        pt = p.get("type")
        if pt == "message":
            role = p.get("role")
            for txt in text_blocks(p.get("content"), ("input_text", "output_text", "text")):
                if role == "assistant":
                    yield ts, "ASSISTANT", txt
                elif role == "user" and not txt.lstrip().startswith(INJECTED_PREFIXES_CODEX):
                    yield ts, "USER", txt
                else:
                    yield ts, "INJECTED", txt
        elif pt in ("function_call", "custom_tool_call"):
            if is_question_tool(p.get("name")):
                yield ts, "ASSISTANT (question)", str(p.get("arguments") or p.get("input"))
            elif want_tools:
                yield ts, "TOOL " + str(p.get("name")), str(p.get("arguments") or p.get("input"))


def cmd_show(args):
    path = Path(args.file).expanduser()
    fmt = detect_format(path)
    if fmt is None:
        print(f"warning: {path} is not a recognised transcript format", file=sys.stderr)
        return 1
    gen = events_codex if fmt == "codex" else events_claude
    events = [e for e in gen(path, args.tools)
              if args.injected or not e[1].startswith("INJECTED")]
    counts = {}
    for e in events:
        key = e[1].replace(" (subagent)", "")
        counts[key] = counts.get(key, 0) + 1
    print("events: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())
                                 if not k.startswith("TOOL ")), file=sys.stderr)
    if counts.get("ASSISTANT (question)") and not counts.get("USER (answer)"):
        print("warning: questions were asked but no answers were recognised; "
              "read the records after each question", file=sys.stderr)
    if args.user:
        events = [e for e in events if e[1].startswith("USER")]
    if not events:
        print(f"warning: no user or assistant text found in {path}; "
              "the format may have changed", file=sys.stderr)
        return 1
    if args.grep:
        rx = re.compile(args.grep, re.IGNORECASE)
        hits = [i for i, e in enumerate(events) if rx.search(e[2])]
        keep = sorted({j for i in hits for j in range(i - args.context, i + args.context + 1)
                       if 0 <= j < len(events)})
        print(f"{len(hits)} matching event(s)", file=sys.stderr)
    else:
        keep = range(len(events))
    prev = None
    for i in keep:
        if prev is not None and i != prev + 1:
            print("...")
        ts, role, txt = events[i]
        if args.width and len(txt) > args.width:
            txt = txt[: args.width] + f" [+{len(txt) - args.width} chars]"
        print(f"[{ts}] {role}: {txt}")
        prev = i
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--version", action="version", version=VERSION)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sessions", help="list transcripts whose working directory is inside PATH")
    s.add_argument("paths", nargs="+")
    s.add_argument("--store", action="append", default=[],
                   help="transcript directory to scan (repeatable)")
    s.set_defaults(func=cmd_sessions)
    w = sub.add_parser("show", help="print a transcript as a timeline")
    w.add_argument("file")
    w.add_argument("--grep", help="only events matching this regex (case-insensitive)")
    w.add_argument("--context", type=int, default=2, help="events around each match")
    w.add_argument("--width", type=int, default=600, help="truncate each event; 0 for full")
    w.add_argument("--tools", action="store_true", help="include tool calls")
    w.add_argument("--user", action="store_true",
                   help="only what the user typed or answered")
    w.add_argument("--injected", action="store_true",
                   help="include injected text (instruction files, hook output)")
    w.set_defaults(func=cmd_show)
    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
