#!/usr/bin/env python3
"""
orm_svg.py -- render an ORM (Object-Role Modeling) conceptual schema to SVG.

The point of this script is that an ORM diagram is produced on nearly every run
of the object-role-modeling skill, and hand-writing SVG each time is slow and
error-prone. This turns one compact JSON model into a legible ORM diagram whose
notation matches the conventions in Halpin & Morgan (object types as named
shapes; predicates as contiguous role boxes; uniqueness as a bar over roles;
mandatory as a dot at the object end; value types dashed; subtypes as arrows).

It is NOT a full auto-layout engine. It uses a deterministic layered layout that
reads well for the small/medium schemas produced during modeling (roughly up to
~12 object types and ~15 fact types). For larger schemas, split the universe of
discourse into subareas -- which the CSDP tells you to do anyway.

INPUT (JSON, via --in FILE or stdin):
{
  "title": "Payroll",
  "objectTypes": [
    {"name": "Employee",   "refMode": "empNr", "kind": "entity"},
    {"name": "Department", "refMode": "name",  "kind": "entity"},
    {"name": "Money",      "kind": "value"},
    {"name": "Manager",    "kind": "entity", "supertype": "Employee"}
  ],
  "factTypes": [
    {
      "reading": "Employee works for Department",
      "roles": [{"player": "Employee"}, {"player": "Department"}],
      "uniqueness": [[0]],          # each inner list = one internal UC (role indices it spans)
      "mandatory": [0]              # role indices that are mandatory for their player
    },
    {
      "reading": "Employee earns Money",
      "roles": [{"player": "Employee"}, {"player": "Money"}],
      "uniqueness": [[0]], "mandatory": []
    }
  ]
}

Notes on the model fields:
- kind: "entity" (solid shape, may have refMode) or "value" (dashed shape).
- refMode: the reference mode, e.g. "empNr", "code", "name". Rendered as "(.empNr)".
- uniqueness: list of internal uniqueness constraints. [[0]] means role 0 is unique
  (functional / n:1 from that role's side). [[0,1]] means the pair is unique (a
  spanning UC -> m:n binary or an n-ary key). A unary fact type uses [[0]].
- mandatory: role indices whose player must play that role (>=1 in every population).

OUTPUT: SVG to --out FILE or stdout.

USAGE:
  python orm_svg.py --in model.json --out schema.svg
  python orm_svg.py --self-test --out demo.svg     # renders a canonical example
"""

import argparse
import json
import math
import sys

# ---- palette (hardcoded so the SVG is legible opened anywhere) ----
C_BG      = "#ffffff"
C_ENTITY  = "#eef3fb"   # entity fill
C_ENTITY_S= "#2f5da6"   # entity stroke
C_VALUE_S = "#6b7280"   # value type stroke (dashed)
C_TEXT    = "#111827"
C_MUTED   = "#6b7280"
C_ROLE_S  = "#374151"   # role-box stroke
C_ROLE_F  = "#ffffff"
C_LINE    = "#4b5563"   # connectors
C_UC      = "#b91c1c"   # uniqueness bar
C_MAND    = "#111827"   # mandatory dot

FONT = "Segoe UI, Helvetica, Arial, sans-serif"


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def text_w(s, size):
    # rough monospace-ish estimate; good enough for box sizing
    return max(1, len(str(s))) * size * 0.58


class Canvas:
    def __init__(self):
        self.parts = []
        self.maxx = 0
        self.maxy = 0

    def _grow(self, x, y):
        self.maxx = max(self.maxx, x)
        self.maxy = max(self.maxy, y)

    def add(self, s):
        self.parts.append(s)

    def rrect(self, x, y, w, h, r, fill, stroke, dashed=False, sw=1.6):
        dash = ' stroke-dasharray="6 4"' if dashed else ""
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
                 f'rx="{r}" ry="{r}" fill="{fill}" stroke="{stroke}" '
                 f'stroke-width="{sw}"{dash}/>')
        self._grow(x + w, y + h)

    def line(self, x1, y1, x2, y2, stroke=C_LINE, sw=1.4, dashed=False, arrow=False):
        dash = ' stroke-dasharray="5 4"' if dashed else ""
        marker = ' marker-end="url(#arrow)"' if arrow else ""
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                 f'stroke="{stroke}" stroke-width="{sw}"{dash}{marker}/>')
        self._grow(max(x1, x2), max(y1, y2))

    def dot(self, x, y, r=4.2, fill=C_MAND):
        self.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}"/>')
        self._grow(x + r, y + r)

    def txt(self, x, y, s, size=13, fill=C_TEXT, anchor="middle", weight="normal",
            italic=False):
        style = f'font-style:italic;' if italic else ""
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" '
                 f'font-size="{size}" fill="{fill}" text-anchor="{anchor}" '
                 f'font-weight="{weight}" style="{style}">{esc(s)}</text>')
        self._grow(x + text_w(s, size) / 2, y)

    def svg(self, title=None):
        pad = 24
        w = self.maxx + pad
        h = self.maxy + pad
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
                f'width="{w:.0f}" height="{h:.0f}" font-family="{FONT}">')
        defs = ('<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" '
                'markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
                f'<path d="M0,0 L10,5 L0,10 z" fill="{C_ENTITY_S}"/></marker></defs>')
        bg = f'<rect x="0" y="0" width="{w:.0f}" height="{h:.0f}" fill="{C_BG}"/>'
        return head + defs + bg + "".join(self.parts) + "</svg>"


# ---------- geometry helpers ----------

OT_H = 46          # object-type box height (2 text lines)
OT_MINW = 74
OT_GAP_X = 40      # horizontal gap between object types
OT_ROW_Y = 40      # y of first object-type row
ROLE_W = 26        # width of one role box
ROLE_H = 20
LANE_H = 96        # vertical spacing per fact-type lane
FIRST_LANE_Y = 160


def ot_width(ot):
    name_w = text_w(ot["name"], 14)
    ref = ot.get("refMode")
    ref_w = text_w(f"(.{ref})", 11) if ref else 0
    return max(OT_MINW, max(name_w, ref_w) + 26)


def layout_object_types(cv, ots, total_w):
    """Place object types in one row (wrapping if too wide). Returns dict name->rect."""
    widths = [ot_width(ot) for ot in ots]
    # simple wrap
    rows, cur, cur_w = [], [], 0
    for ot, w in zip(ots, widths):
        if cur and cur_w + w + OT_GAP_X > max(total_w, 520):
            rows.append(cur); cur, cur_w = [], 0
        cur.append((ot, w)); cur_w += w + OT_GAP_X
    if cur:
        rows.append(cur)

    pos = {}
    y = OT_ROW_Y
    for row in rows:
        row_w = sum(w for _, w in row) + OT_GAP_X * (len(row) - 1)
        x = max(24, (total_w - row_w) / 2)
        for ot, w in row:
            pos[ot["name"]] = {"x": x, "y": y, "w": w, "h": OT_H,
                               "cx": x + w / 2, "cy": y + OT_H / 2,
                               "bottom": y + OT_H, "top": y}
            x += w + OT_GAP_X
        y += OT_H + 34
    return pos, y  # y = bottom of object-type block


def draw_object_type(cv, ot, r):
    is_val = ot.get("kind") == "value"
    cv.rrect(r["x"], r["y"], r["w"], r["h"], 12,
             C_BG if is_val else C_ENTITY,
             C_VALUE_S if is_val else C_ENTITY_S,
             dashed=is_val)
    ref = ot.get("refMode")
    if ref:
        cv.txt(r["cx"], r["y"] + 20, ot["name"], size=14, weight="600")
        cv.txt(r["cx"], r["y"] + 36, f"(.{ref})", size=11, fill=C_MUTED)
    else:
        cv.txt(r["cx"], r["y"] + r["h"] / 2 + 5, ot["name"], size=14, weight="600")


def draw_predicate(cv, ft, x, y, pos):
    """Draw the role-box strip at (x,y) (top-left), connect to players, add UC & mandatory."""
    roles = ft["roles"]
    n = len(roles)
    strip_w = ROLE_W * n
    # role boxes (contiguous, shared vertical dividers)
    cv.rrect(x, y, strip_w, ROLE_H, 0, C_ROLE_F, C_ROLE_S, sw=1.4)
    for i in range(1, n):
        cv.line(x + ROLE_W * i, y, x + ROLE_W * i, y + ROLE_H, stroke=C_ROLE_S, sw=1.2)

    role_cx = [x + ROLE_W * i + ROLE_W / 2 for i in range(n)]

    # uniqueness bars (above the strip)
    for uc in ft.get("uniqueness", []):
        if not uc:
            continue
        lo = min(uc); hi = max(uc)
        bx1 = x + ROLE_W * lo + 3
        bx2 = x + ROLE_W * (hi + 1) - 3
        by = y - 6
        cv.line(bx1, by, bx2, by, stroke=C_UC, sw=2.2)
        # small end ticks
        cv.line(bx1, by - 3, bx1, by + 3, stroke=C_UC, sw=2.0)
        cv.line(bx2, by - 3, bx2, by + 3, stroke=C_UC, sw=2.0)

    # connectors to players + mandatory dots
    mand = set(ft.get("mandatory", []))
    for i, role in enumerate(roles):
        p = pos.get(role["player"])
        if not p:
            continue
        rx = role_cx[i]
        ry = y  # top of strip
        px, py = p["cx"], p["bottom"]
        # if the object type is below the predicate, connect to its top instead
        if p["top"] > y:
            py = p["top"]
        cv.line(px, py, rx, ry, stroke=C_LINE, sw=1.4)
        if i in mand:
            # mandatory dot sits at the object-type end of the connector
            cv.dot(px, py, r=4.2)

    # predicate reading (below the strip)
    cv.txt(x + strip_w / 2, y + ROLE_H + 15, ft["reading"], size=12,
           fill=C_TEXT, italic=True)
    return role_cx


def draw_subtypes(cv, ots, pos):
    for ot in ots:
        sup = ot.get("supertype")
        if sup and sup in pos and ot["name"] in pos:
            a = pos[ot["name"]]; b = pos[sup]
            cv.line(a["cx"], a["top"], b["cx"], b["bottom"], stroke=C_ENTITY_S,
                    sw=1.6, arrow=True)


def render(model):
    cv = Canvas()
    ots = model.get("objectTypes", [])
    fts = model.get("factTypes", [])

    # estimate a canvas width from object types
    total_w = max(560, sum(ot_width(o) for o in ots) + OT_GAP_X * max(0, len(ots) - 1) + 48)

    pos, ot_bottom = layout_object_types(cv, ots, total_w)

    # lay out fact types in vertical lanes, centered under the mean x of players
    lane_y = max(FIRST_LANE_Y, ot_bottom + 40)
    for ft in fts:
        players = [pos[r["player"]] for r in ft["roles"] if r["player"] in pos]
        cx = (sum(p["cx"] for p in players) / len(players)) if players else total_w / 2
        strip_w = ROLE_W * len(ft["roles"])
        x = cx - strip_w / 2
        x = max(18, min(x, total_w - strip_w - 18))
        draw_predicate(cv, ft, x, lane_y, pos)
        lane_y += LANE_H

    # draw object types on top of connectors so lines tuck under boxes
    for ot in ots:
        if ot["name"] in pos:
            draw_object_type(cv, ot, pos[ot["name"]])
    draw_subtypes(cv, ots, pos)

    # title
    if model.get("title"):
        cv.txt(24, 22, model["title"], size=15, fill=C_TEXT, anchor="start", weight="700")

    # legend
    ly = cv.maxy + 24
    cv.txt(24, ly, "UC bar = uniqueness (n:1 if over one role)   •  dot = mandatory   "
                   "•  dashed box = value type   •  arrow = subtype→supertype",
           size=10, fill=C_MUTED, anchor="start")
    cv._grow(24 + text_w("x" * 96, 10), ly)
    return cv.svg()


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
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        model = SELF_TEST
    elif args.inp:
        with open(args.inp) as f:
            model = json.load(f)
    else:
        model = json.load(sys.stdin)

    svg = render(model)
    if args.out:
        with open(args.out, "w") as f:
            f.write(svg)
        print(f"wrote {args.out} ({len(svg)} bytes)")
    else:
        sys.stdout.write(svg)


if __name__ == "__main__":
    main()
