#!/usr/bin/env python3
"""
orm_mermaid.py -- render an ORM model spec as a Mermaid flowchart.

Same input as orm_svg.py (one JSON model spec is the single source of truth), but
emits Mermaid `graph TD|LR` text instead of SVG. Chosen when the user wants a
diagram that (a) toggles direction for the page/screen (`--dir TD` vs `--dir LR`),
(b) auto-lays-out via Mermaid's engine, and (c) stays plain-text editable.

Fidelity note: a flowchart cannot draw the exact ORM glyphs (the uniqueness *bar*
over roles, the mandatory *dot*). Those semantics are preserved as edge styling
and labels instead:
  - a thick edge `==>` marks the role carrying a single-role uniqueness
    constraint (the functional / n:1 side); label "UC"
  - "mand" on an edge label marks a mandatory role
  - a spanning uniqueness constraint (m:n binary or n-ary key) is noted on the
    predicate node, e.g. "(uc: Order+Product)"
  - value types get a dashed node style
  - a dotted arrow "subtype of" runs from subtype to supertype
Predicates are their own nodes, so n-ary fact types render fine (unlike Mermaid
`erDiagram`, which is binary-only). For the exact ORM notation, use orm_svg.py.

USAGE:
  python orm_mermaid.py --in model.json --dir LR --out schema.mermaid
  python orm_mermaid.py --self-test --dir TD
"""

import argparse
import json
import re
import sys


def nid(name):
    """Stable Mermaid node id from an object/predicate name."""
    s = re.sub(r"[^0-9A-Za-z]", "", str(name))
    if not s:
        s = "n"
    if s[0].isdigit():
        s = "n" + s
    return s


def qlabel(s):
    """Escape a label for a Mermaid quoted string."""
    return str(s).replace('"', "&quot;")


def derive_verb(reading, players):
    """Best-effort strip of the leading/trailing player names to get the verb phrase.
    Falls back to the full reading if stripping leaves nothing."""
    r = reading.strip()
    if players:
        first = players[0]
        if r.lower().startswith(first.lower()):
            r = r[len(first):].strip()
        last = players[-1]
        if r.lower().endswith(last.lower()):
            r = r[: len(r) - len(last)].strip()
    return r or reading.strip()


def render(model, direction="TD"):
    direction = direction.upper()
    if direction not in ("TD", "LR", "TB", "RL", "BT"):
        direction = "TD"

    ots = model.get("objectTypes", [])
    fts = model.get("factTypes", [])
    ot_by_name = {o["name"]: o for o in ots}

    lines = []
    if model.get("title"):
        lines.append(f"%% {model['title']}")
    lines.append(f"graph {direction}")

    # object type nodes
    value_ids = []
    for o in ots:
        oid = nid(o["name"])
        if o.get("kind") == "value":
            lines.append(f'  {oid}(["{qlabel(o["name"])}"])')
            value_ids.append(oid)
        else:
            ref = o.get("refMode")
            label = f'{o["name"]} (.{ref})' if ref else o["name"]
            lines.append(f'  {oid}(["{qlabel(label)}"])')

    lines.append("")

    # predicate nodes + edges
    for i, ft in enumerate(fts):
        fidn = f"F{i}"
        roles = ft["roles"]
        players = [r["player"] for r in roles]
        verb = derive_verb(ft.get("reading", ""), players)

        # spanning uniqueness note (len > 1)
        span_notes = []
        single_uc_roles = set()
        for uc in ft.get("uniqueness", []):
            if len(uc) == 1:
                single_uc_roles.add(uc[0])
            elif len(uc) > 1:
                span_notes.append("+".join(players[j] for j in uc))
        plabel = verb
        if span_notes:
            plabel += "<br><small>uc: " + ", ".join(span_notes) + "</small>"
        lines.append(f'  {fidn}[/"{qlabel(plabel)}"/]')

        mand = set(ft.get("mandatory", []))
        for ri, r in enumerate(roles):
            oid = nid(r["player"])
            tags = []
            thick = ri in single_uc_roles
            if thick:
                tags.append("UC")
            if ri in mand:
                tags.append("mand")
            label = ("|" + ", ".join(tags) + "|") if tags else ""
            arrow = "==>" if thick else "-->"
            # player -> predicate keeps the sentence reading direction
            lines.append(f"  {oid} {arrow}{label} {fidn}")
        lines.append("")

    # subtype links
    for o in ots:
        sup = o.get("supertype")
        if sup and sup in ot_by_name:
            lines.append(f'  {nid(o["name"])} -.->|subtype of| {nid(sup)}')

    # value type styling
    if value_ids:
        lines.append("")
        lines.append("  classDef value stroke-dasharray:5 5,fill:#fff,color:#374151;")
        lines.append(f"  class {','.join(value_ids)} value;")

    return "\n".join(lines) + "\n"


SELF_TEST = {
    "title": "Payroll (demo)",
    "objectTypes": [
        {"name": "Employee", "refMode": "empNr", "kind": "entity"},
        {"name": "Department", "refMode": "name", "kind": "entity"},
        {"name": "Money", "kind": "value"},
        {"name": "Manager", "kind": "entity", "supertype": "Employee"},
    ],
    "factTypes": [
        {"reading": "Employee works for Department",
         "roles": [{"player": "Employee"}, {"player": "Department"}],
         "uniqueness": [[0]], "mandatory": [0]},
        {"reading": "Employee earns Money",
         "roles": [{"player": "Employee"}, {"player": "Money"}],
         "uniqueness": [[0]], "mandatory": []},
        {"reading": "Employee reports to Employee",
         "roles": [{"player": "Employee"}, {"player": "Employee"}],
         "uniqueness": [[0]], "mandatory": []},
    ],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp")
    ap.add_argument("--out", dest="out")
    ap.add_argument("--dir", dest="direction", default="TD",
                    help="graph direction: TD (top-down) or LR (left-right)")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        model = SELF_TEST
    elif args.inp:
        with open(args.inp) as f:
            model = json.load(f)
    else:
        model = json.load(sys.stdin)

    out = render(model, args.direction)
    if args.out:
        with open(args.out, "w") as f:
            f.write(out)
        print(f"wrote {args.out} ({len(out)} bytes)")
    else:
        sys.stdout.write(out)


if __name__ == "__main__":
    main()
