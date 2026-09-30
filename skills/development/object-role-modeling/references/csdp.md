# CSDP reference — the method in depth

Depth for the seven-step Conceptual Schema Design Procedure and the checks and
constraints it uses. Read the section you need; the SKILL.md workflow says when.

Source: Halpin & Morgan, *Information Modeling and Relational Databases*, 3rd ed.
The seven steps, verbatim (§3.2):

1. Transform familiar examples into elementary facts.
2. Draw the fact types, and apply a population check.
3. Check for entity types to be combined, and note any arithmetic derivations.
4. Add uniqueness constraints, and check the arity of fact types.
5. Add mandatory role constraints, and check for logical derivations.
6. Add value, set-comparison, and subtyping constraints.
7. Add other constraints and perform final checks.

Large domains: divide the universe of discourse (UoD) into manageable subareas,
apply the CSDP to each, then integrate. Reach consensus on terminology so the
same name is used for the same concept across subareas — synonym/homonym control
is a first-class modeling task, not cleanup.

## Contents
- Core concepts (fact, object type, role, predicate, value vs entity)
- Step 1 — elementary facts and the quality checks
- Step 2 — fact types and the population check
- Step 3 — trimming and derivation
- Step 4 — uniqueness constraints (cardinality) and arity/elementarity
- Step 5 — mandatory roles and reference schemes
- Step 6 — value, set-comparison, subtype constraints
- Step 7 — frequency, ring, other constraints, final checks

---

## Core concepts

- **Fact (instance):** a proposition taken to be true in the domain. The system
  does not care whether it is true in reality, only that users act as if it is.
- **Elementary fact:** an irreducible assertion that particular object(s) play
  particular role(s). Either a unary property ("Employee 7 is a smoker") or a
  relationship among objects ("Employee 7 works for the Sales department"). No
  logical connectives (*not/and/or/if*), no quantifiers (*all/some*).
- **Object type:** a kind of thing that plays roles. Two flavors:
  - **Entity type** — has identity independent of its name; referenced via a
    **reference scheme** (e.g. `Employee` identified by `empNr`). Rendered solid.
  - **Value type** — a self-identifying label or measure (a character string or
    number), e.g. `Money`, `EmployeeName`. Rendered dashed. Values need no
    separate identifier — the value *is* the reference.
- **Role:** a part played by an object type in a fact type. A binary fact type
  has two roles; unary one; n-ary n.
- **Predicate / reading:** the verb phrase that, with its role players, forms a
  true sentence: `... works for ...`. The reading is the relationship's name.

The distinction that trips people: is a thing an entity or a value? Test: does it
need to be identified by something *other than itself*, and does the domain talk
about it as a thing with properties of its own? `Country` is an entity (it has a
code, a name, a population). `CountryCode` is a value. When unsure, this is a
fork for the user (see the interactive contract).

---

## Step 1 — Elementary facts and the quality checks

Get **concrete, familiar examples** from the domain: output reports, screen
layouts, filled forms, sample spreadsheets, a requirements paragraph. Verbalize
each datum as an elementary fact in the domain's own words.

Quality checks on step-1 output:
- **Irreducible?** Can the sentence be split into two sentences without losing
  information? If yes, split it. ("Room 5 seats 30 students and has a projector"
  → two facts.)
- **No connectives/quantifiers?** Rewrite conditionals and quantified statements
  as the plain facts they stand for.
- **Every object referenced properly?** Each entity appears via its reference
  scheme (a name, code, number), each value as itself.
- **Does it read naturally to a domain expert?** If you have to explain the
  sentence, the wording — and therefore a future name — is off.

Why this step carries the whole model: the nouns become object type names, the
verb phrases become predicate/relationship names, and the identifiers become
reference modes. Names extracted from validated sentences are defensible; names
invented at a blank table are not.

---

## Step 2 — Fact types and the population check

Abstract fact instances into **fact types**. Choose a **reading** that is a true
natural sentence in both directions where useful (`Employee works for
Department` / `Department employs Employee`). 

**Population check:** put a small sample population against each fact type — a few
rows of real-looking instances. Two payoffs: it validates the structure with the
domain expert ("could one employee appear twice here?" surfaces uniqueness), and
it catches awkward readings early. If a populated row does not read as a sensible
fact, fix the fact type or the name now.

---

## Step 3 — Trim schema; note derivations

- **Combine duplicate object types.** If two names denote the same concept, unify
  them (pick the better name — a naming decision). If one apparent object type is
  really a value of another, demote it.
- **Note derivations.** If a fact type's values can be computed from others, do
  not store it; record the **derivation rule**. Arithmetic (`lineTotal = qty ×
  unitPrice`, `age` from `birthDate`) and logical derivations both count. Storing
  derivable data invites contradiction and forces redundant names.

---

## Step 4 — Uniqueness constraints (this is where cardinality lives)

An **internal uniqueness constraint (UC)** over a set of roles of one fact type
says: in any population, the combination of values in those roles occurs at most
once. UCs are what actually encode cardinality — read them off, don't guess:

- Binary with a UC on **one** role → that role is **functional** (n:1). Each
  player on that side maps to at most one on the other. (`Employee works for
  Department`, UC on the Employee role → each employee ≤ one department: n:1.)
- Binary with a UC on **each** role separately → **1:1**.
- Binary with a **single UC spanning both** roles → **m:n** (many-to-many).
- Unary fact type → UC over its one role (a role either holds or not).
- **External uniqueness constraint** — a UC spanning roles from *different* fact
  types, used for **compound identification** (e.g. a building+room number
  together identify a room). Marks composite identifiers.

**Arity / elementarity check:** every elementary binary or unary must have a UC.
If a fact type needs no single-role UC and is not genuinely m:n, it is probably
**not elementary** — it is two facts fused; split it. A three-role fact type is
legitimate only when no two roles carry the meaning alone; otherwise decompose.

Cardinality is the most common **fork**: if the source never says whether the
"many" side is really many, ask — don't default to n:1 just because it's common.

---

## Step 5 — Mandatory roles and reference schemes

**Mandatory role:** every instance of the player must play this role (in the
mapped schema, the corresponding column is NOT NULL). **Optional** otherwise
(nullable). Mark mandatory only when the domain truly requires it; over-marking
mandatory is a frequent source of real-world data that can't be entered.

**Logical derivation check:** before finalizing, re-check whether a fact type is
implied by others (e.g. via a subtype or a chain of functional facts); if so,
derive it.

**Reference schemes — how entities are identified** (§5.3). Every entity type
needs one. Kinds:
- **Simple 1:1 reference:** one value type identifies the entity, via a reference
  mode: `Country(.code)`, `Employee(.empNr)`, `Product(.sku)`. The reference mode
  is the parenthesized part; choose it to match how the domain actually refers to
  the thing.
- **Compound reference:** two or more values together identify the entity
  (captured by an external UC), e.g. a `Room` identified by `Building` + roomNr.
- **Preferred vs alternate identifiers:** an entity may have several candidate
  identifiers; designate one **preferred** (becomes the primary key on mapping),
  the rest **alternate** (unique keys).
- Avoid identifying entities by mutable, meaning-laden attributes when a stable
  surrogate is available in the domain; but do not invent surrogates the domain
  never uses if a natural stable key exists. This is often a fork.

The reference mode is simultaneously an identity decision and a naming decision —
it will surface as a key column / id field name. Make it explicit, don't leave it
implied.

---

## Step 6 — Value, set-comparison, and subtype constraints

- **Value constraint:** restricts a value type's population to an enumeration or
  range (`Rating ∈ {1..5}`, `Sex ∈ {'M','F'}`). Name the type by what it means,
  not by its value set.
- **Set-comparison constraints** between compatible role sequences:
  - **Subset:** if a player plays role A it must (also) play role B.
  - **Equality:** plays A iff plays B.
  - **Exclusion:** cannot play both A and B.
- **Subtyping:** a subtype is a subset of a supertype that plays roles the others
  don't. Introduce a subtype when the specific roles justify it; define it by a
  **subtype-defining rule** where possible. Prefer real subtypes over a nullable
  discriminator column when the subtypes genuinely differ in the roles they play
  — it names the distinction instead of hiding it in a flag.
- **Generalization:** conversely, factor shared roles up into a supertype.

---

## Step 7 — Other constraints and final checks

- **Frequency constraint:** a role (or role combination) must occur a specified
  number of times (e.g. a committee has exactly 3 members).
- **Ring constraints** on a fact type whose two roles are played by the same
  type: irreflexive, asymmetric, antisymmetric, symmetric, acyclic, intransitive,
  etc. (e.g. `Person is parent of Person` is irreflexive and acyclic). Naming a
  same-type predicate well (`is parent of`, `reports to`) plus the right ring
  constraint is what makes reflexive relationships correct.
- **Other rules:** anything remaining that the graphical constraints can't carry,
  stated as textual business rules / derivation rules.

**Final checks (the last cheap moment to fix a name):**
- Every object type is **identified** (has a reference scheme) and **reachable**
  (plays at least one fact-type role).
- Every elementary fact type has a **uniqueness** constraint.
- Nothing **redundant** or **stored-but-derivable** remains.
- Constraints are **consistent** (no rule makes a required population
  impossible).
- Every name passes the rubric in `references/naming.md`; synonyms/homonyms are
  resolved; readings are true sentences.
