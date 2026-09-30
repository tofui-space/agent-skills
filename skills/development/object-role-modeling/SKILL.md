---
name: object-role-modeling
description: >-
  Fact-based (Object-Role Modeling / ORM) method for turning specs, docs, or
  examples into a validated conceptual data model and, above all, good NAMES for
  the things in it: object types, relationships (fact types), fields, tables,
  columns, classes, methods, and their shapes (cardinality and optionality). Use
  whenever the user is deciding what to CALL things in a data model, schema, or
  API; is stuck naming a field / table / column / class / relationship; is
  pulling entities and relationships out of a requirements doc; is asking about
  entity-vs-value, identifiers / keys, or whether a relationship is 1:1 / 1:n /
  n:m and mandatory or optional; or wants to design or review a schema before the
  names calcify and get expensive to change. Trigger even when the user never
  says "ORM" or "conceptual model" — "help me name this table", "what should I
  call this field", "model this domain", "is this a good schema", or pasting a
  spec to turn into a data model all qualify.
---

# Object-Role Modeling: naming and shaping data models

## Why this method, and what it is for

The hardest, highest-cost decision in data modeling is what to **call** things.
A bad name is a bad name forever: it propagates into columns, foreign keys, API
fields, class members, code, docs, and every developer's mental model, and
renaming later is expensive and risky. This skill exists to make that decision
well and defensibly.

The engine is **Object-Role Modeling (ORM)**, the fact-based method of Halpin &
Morgan (*Information Modeling and Relational Databases*). ORM works for naming
for one structural reason: it forces every fact to be stated as a **sentence in
the domain's own language** *before* anything is committed to a schema. You do
not name a column and hope it's right — you write the true sentence
("`Employee` works for `Department`", "`Order` was placed by `Customer`"), and
the nouns and verb phrases in that sentence *become* the names. Names are
derived from validated facts, not guessed from a blank table.

ORM is also **attribute-free at the conceptual level**: there are no columns or
fields yet, only object types and the roles they play in relationships. That is
deliberate. It keeps the model target-neutral, so the same conceptual model can
map to a relational schema, an OO class model, or a JSON/API shape — each with
its own naming conventions — without redoing the thinking.

**Default posture for this skill: stay conceptual first, then map on request.**
Produce the full formalism (fact types + constraints + an ORM diagram), and work
through the genuine decisions *with* the user rather than guessing.

## The interactive contract (read this first)

This skill is collaborative by design. The failure modes are (a) silently
guessing at forks the user cares about, and (b) death-by-questions. Avoid both:

1. **Do a full first pass yourself.** Verbalize, propose object types and fact
   types, propose names with brief rationale, and propose the obvious
   constraints. Pick sensible defaults everywhere the source determines the
   answer. Don't stop to ask about things the examples already settle.
2. **Then surface only the genuine forks — batched.** A fork is a decision that
   (i) the source under-determines and (ii) has real downstream cost. The usual
   forks: entity vs value type; the reference scheme / identifier; a name choice
   between real candidates; whether a fact type is elementary or should split;
   mandatory vs optional; a uniqueness call that changes cardinality; subtype vs
   optional-role. Present these together as a short numbered list (or via the
   `ask_user_input` tool if available — it's easier on mobile), each with your
   recommendation and the trade-off, so the user resolves them in one pass.
3. **Never invent certainty the source lacks.** If the spec doesn't say whether
   an employee can work for more than one department, that's a fork, not a
   default. Name the assumption.
4. **Iterate.** Fold the answers in, update the model and diagram, and only
   re-ask if a resolved fork opened a new one.

## Workflow (CSDP steps 1–7, then map)

Follow the seven CSDP steps below. For depth on any step — the elementarity and
population checks, the full constraint catalog, reference schemes, subtyping —
read `references/csdp.md`. For every naming decision, apply the rubric in
`references/naming.md` (don't reproduce it here; read it once per session and
keep it in mind). It's normal to run all seven steps on one chunk of the domain,
then move to the next chunk, rather than step 1 across the whole domain first.

**Step 1 — From examples to elementary facts.** Get concrete examples: sample
output reports, screen mock-ups, form fields, a filled-in table, a paragraph of
requirements. Turn each into **elementary facts** — irreducible sentences, each
asserting that specific objects play specific roles, with no *and/or/if* and no
implicit splitting. "Ann and Bob smoke" → two facts. Verbalize using the
domain's real terms. This step looks trivial and is the most important; do not
rush it, because it is the foundation the names rest on.

**Step 2 — Draw fact types and populate.** Generalize the fact instances into
**fact types** (predicates with typed roles): `Employee works for Department`.
Give each predicate a **reading** that is a true, natural sentence. Then do a
**population check**: invent a few rows and confirm they read as sensible facts.
If a sentence sounds forced, the fact type or a name is wrong. Emit the model as
the JSON spec below and render the diagram.

**Step 3 — Trim schema; note derivations.** Combine object types that are really
the same thing under different names (a synonym check — a naming win). Remove any
fact type whose values are **derivable** from others (e.g. `age` from
`birthdate`); record the derivation rule instead of storing it. Fewer, sharper
concepts means fewer things to name.

**Step 4 — Uniqueness constraints, and check arity.** Add **internal uniqueness
constraints** — these are what actually encode cardinality. A UC over one role
of a binary = that role is functional (n:1). A UC spanning both roles = m:n. Then
**check elementarity/arity**: if a fact type is really two facts glued together,
split it. Uniqueness is where 1:1 / 1:n / n:m gets decided — a fork if the source
is silent.

**Step 5 — Mandatory roles, and reference schemes.** Mark each role **mandatory**
(every instance of the player must play it) or **optional** (may be null once
mapped). Then nail down each entity's **reference scheme** — how it is
identified in the domain (`Country(.code)`, `Employee(.empNr)`). The reference
mode is both an identity decision and a naming decision; get it explicit. See
`references/csdp.md` for simple vs compound vs external identification.

**Step 6 — Value, set-comparison, and subtype constraints.** Add value
constraints (enumerations / ranges), set-comparison constraints (subset,
equality, exclusion between roles), and **subtypes** where a subset of a type
plays roles the others don't. Name subtypes as the domain does. Prefer subtyping
over a nullable "type" flag when the subtypes genuinely play different roles.

**Step 7 — Other constraints and final checks.** Add frequency, ring
(reflexive/symmetric/etc. on same-type predicates), and any remaining rules. Do
the final checks: every object type is identified and reachable; every fact type
has uniqueness; nothing is redundant or derivable-but-stored; every name passes
the rubric. This is the last cheap moment to fix a name — spend it.

**Then, on request — map to a target.** The conceptual model is target-neutral.
When the user wants tables, classes, or an API shape, read
`references/mapping.md` and apply the relevant mapping (relational via Rmap, OO,
or JSON/API), including that target's naming conventions (casing, pluralization,
foreign-key style). Ask which target and which conventions before mapping.

## The model spec (single source of truth)

Maintain one JSON object as the canonical model. The diagram script and the
mapping procedures both consume it, so keep it current as decisions are made.

```json
{
  "title": "Payroll",
  "objectTypes": [
    {"name": "Employee",   "refMode": "empNr", "kind": "entity"},
    {"name": "Department", "refMode": "name",  "kind": "entity"},
    {"name": "Money",      "kind": "value"},
    {"name": "Manager",    "kind": "entity", "supertype": "Employee"}
  ],
  "factTypes": [
    {"reading": "Employee works for Department",
     "roles": [{"player": "Employee"}, {"player": "Department"}],
     "uniqueness": [[0]], "mandatory": [0]},
    {"reading": "Employee earns Money",
     "roles": [{"player": "Employee"}, {"player": "Money"}],
     "uniqueness": [[0]], "mandatory": []}
  ]
}
```

Field meanings:
- `objectTypes[].kind`: `"entity"` (has identity; may carry `refMode`) or
  `"value"` (a plain label/measure; renders dashed).
- `objectTypes[].refMode`: reference mode, e.g. `empNr`, `code`, `name`.
- `objectTypes[].supertype`: name of the supertype, for subtypes.
- `factTypes[].reading`: the natural-sentence predicate reading.
- `factTypes[].uniqueness`: list of internal uniqueness constraints; each is a
  list of role indices it spans. `[[0]]` = role 0 functional (n:1). `[[0,1]]` =
  the pair is unique (m:n binary or an n-ary key). Unary fact types use `[[0]]`.
- `factTypes[].mandatory`: role indices whose player must play that role.

## Rendering the diagram — ask which format

Two renderers consume the same model spec. They are not ranked; they trade off,
so **ask the user which they want** the first time you draw (unless they've
already stated a standing preference — then honor it silently and don't re-ask):

- **ORM SVG** — the exact ORM glyphs: uniqueness *bar* over roles, mandatory
  *dot*, contiguous role boxes. Highest notational fidelity. Best when the user
  wants a canonical ORM figure. Static image.
- **Mermaid flowchart (`graph TD|LR`)** — plain-text, editable, auto-laid-out,
  and the direction toggles to fit the page/screen (`--dir TD` vs `--dir LR`).
  Renders natively wherever Mermaid is supported. Fidelity trade-off: the bar and
  dot become edge styling and labels (a thick `==>` edge labelled `UC` marks the
  functional/n:1 side; `mand` marks mandatory; a spanning UC is noted on the
  predicate node; value types are dashed; subtype is a dotted arrow). Predicates
  are nodes, so n-ary fact types still render (Mermaid `erDiagram` can't do that —
  don't use it for the conceptual view; it's for the mapped relational view, see
  `references/mapping.md`).
- **Both** — some users want the editable Mermaid to iterate on plus the SVG for
  the final figure. Offer this as the third option.

A compact way to ask: "Diagram as ORM SVG (exact notation), Mermaid flowchart
(toggleable/editable), or both?" — via the `ask_user_input` tool if available.

Commands (both dependency-free, need only `python3`; both accept `--in FILE`,
stdin, or `--self-test`, and write with `--out`):

```bash
python3 scripts/orm_svg.py     --in model.json --out schema.svg
python3 scripts/orm_mermaid.py --in model.json --dir LR --out schema.mermaid
# sanity-check either generator in a new environment:
python3 scripts/orm_svg.py     --self-test --out /tmp/demo.svg
python3 scripts/orm_mermaid.py --self-test --dir TD
```

For Mermaid, if the user later says the layout is cramped, just re-emit with the
other `--dir` — that's the toggle, no model change needed. If an inline display
capability is available (a visualization tool, or a `.mermaid`/`.svg` that the
client renders), show the diagram inline; otherwise present the file. Both
renderers target small/medium schemas (~12 object types, ~15 fact types); for
larger domains, split into subareas per the CSDP and diagram each.

## What a finished run hands the user

Because the mode is "decide with me," a run is a short conversation, not a
one-shot dump. Aim to deliver, incrementally:

1. The **elementary facts / verbalizations** for each part of the domain.
2. The **conceptual model**: object types (with reference schemes), fact types
   with readings, and constraints — as the JSON spec and a **diagram** in the
   format the user picked (ORM SVG, Mermaid flowchart, or both).
3. A **naming rationale**: for each non-obvious name, the candidates considered
   and why the chosen one wins (this is the artifact that prevents the future
   cost). Keep it brief and per-element.
4. The **open forks** clearly flagged whenever the source was silent, with your
   recommendation — resolved with the user, not silently.
5. On request, the **mapping** to the chosen target with its naming conventions.

Keep the running commentary lean and technical; the value is correct facts,
sharp names, and explicit shapes, not prose.
