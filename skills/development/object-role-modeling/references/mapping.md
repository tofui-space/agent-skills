# Mapping reference — conceptual model → relational / OO / API

The ORM conceptual model is target-neutral. Map it only when the user asks, and
ask which target and which naming conventions first (see the conventions section
of `references/naming.md`). All three mappings read the same JSON model spec.

Precondition: don't map an unfinished model. Every entity type must have a
reference scheme; every elementary fact type must have a uniqueness constraint.

## Contents
- Relational mapping (Rmap)
- Object-oriented mapping
- API / JSON mapping

---

## Relational mapping (Rmap)

Rmap produces a redundancy-free, normalized relational schema while keeping the
table count reasonable. It guarantees each fact appears once. The two grouping
rules (Halpin & Morgan §11.3):

1. **Each fact type with a compound (spanning) internal uniqueness constraint
   maps to its own table**, keyed on that uniqueness constraint. This is every
   m:n binary and every n-ary (n ≥ 3) that isn't objectified.
2. **Fact types whose functional roles attach to the same object type are grouped
   into one table**, keyed on that object type's identifier. So an entity plus all
   its n:1 and 1:1 facts collapse into a single table.

Mechanics:
- **Object type → attribute(s).** An entity becomes one or more columns depending
  on its reference scheme (simple ref = one column; compound ref = several). A
  value type becomes a column of the corresponding data type.
- **Functional (n:1 / 1:1) binary → a column** in the player's table (the "many"
  or either "one" side), typically a foreign key to the other entity's key.
- **m:n binary and n-aries → their own table** (rule 1), columns = the
  participating keys/values, primary key = the spanning UC.
- **Unary fact type → a boolean column** (or, if you avoid nullable booleans, a
  membership sub-table). Name it as a predicate.
- **Mandatory role → NOT NULL** on the corresponding column; optional → nullable.
- **Value constraint → CHECK constraint** (or enum type / lookup table).
- **Alternate identifiers → UNIQUE constraints**; the preferred identifier → the
  primary key.

Subtype mapping — choose per case:
- **Absorption** (default): fold subtype-specific columns into the supertype's
  table as nullable columns plus a discriminator. Fewest tables; some nulls.
- **Separation**: a table per subtype sharing the supertype's key. Fewer nulls;
  more joins.
- **Partition**: separate tables with no supertype table (only when the subtypes
  are exhaustive and rarely queried together).

Naming during Rmap (from the book, and directly relevant to the whole point of
this skill):
- Give a relationship table a name close to the **predicate reading**.
- Take column names from the **object/value type names**, or a concatenation of
  object + value type names where needed (e.g. `Drives(empNr, carRegNr)`).
- When the **same object** appears across multiple tables, use the **same column
  name** for it (e.g. `empNr` in both `Employee` and `Drives`) — this documents
  the connection and simplifies natural joins — *unless* doing so would erase a
  real semantic difference between two roles (then disambiguate, e.g.
  `authorId` vs `reviewerId`).
- Apply the target engine's casing/pluralization convention consistently (see
  `references/naming.md`).

Worked shape (the demo model): `Employee works for Department` (n:1, mandatory)
and `Employee earns Money` (n:1) both have functional roles on `Employee`, so by
rule 2 they group into the `employee` table:
`employee(emp_nr PK, department_name NOT NULL FK→department, salary)` plus
`department(name PK)`. An m:n such as `Employee has Skill` would, by rule 1,
become its own `employee_skill(emp_nr, skill_code)` table.

---

## Object-oriented mapping

- **Entity type → class** (`PascalCase`, singular). Value type → a field's type.
- **Reference scheme → identity field** (`id` / `empNr`), plus `equals`/`hashCode`
  on it where the language needs them.
- **Functional (n:1 / 1:1) role → a single reference field** named for the role:
  `invoice.customer`, not `invoice.customerObject`.
- **1:n / m:n role → a collection field**, named plural for the related type or
  the role: `invoice.lineItems`, `student.courses`. Choose Set vs List by whether
  order/duplicates matter (uniqueness constraint tells you).
- **Unary fact type → a boolean property**, named as a predicate (`isArchived`).
- **Mandatory role → non-nullable field / constructor argument**; optional →
  nullable/optional type.
- **Subtype → subclass** (inheritance) when the subtypes genuinely add roles;
  otherwise a single class with an enum/status. Don't create subclasses that add
  nothing.
- **Value constraint → enum** or a validated value object.
- Methods that correspond to **derivation rules** (CSDP step 3) become computed
  properties/methods (`get age()` from `birthDate`), not stored fields.

## API / JSON mapping

- **Aggregate roots → resources.** An aggregate root is an entity that owns a
  cluster of facts and is fetched/updated as a unit. Resource nouns, pluralized
  in paths by REST convention (`/orders/{id}`).
- **Functional role → a scalar field or a nested/`<role>Id` reference.**
- **1:n composition (owned, read together, bounded) → embed** the children as a
  nested array named plural for the role (`order.lineItems`).
- **Shared or large related entity → reference by id** (`order.customerId`), not
  embed — avoids duplication and unbounded payloads. Cardinality + ownership from
  the ORM model make this call; don't decide it ad hoc.
- **m:n → either a sub-collection endpoint** (`/students/{id}/courses`) **or an
  explicit link resource** if the relationship carries its own facts (grade,
  enrolledAt) — that's an objectified association and deserves its own resource.
- **Mandatory role → required field** in the schema; optional → optional/nullable.
- **Value constraint → an `enum` / `pattern` / range** in the JSON schema.
- Hold one key-casing convention (`camelCase` or `snake_case`) across the entire
  surface; mixed casing is a permanent tax on every consumer.

## Diagrams for the mapped views (Mermaid)

Once you've mapped to a target, Mermaid's native diagram types *are* the right
notation for that target (unlike at the conceptual stage), and they honor the
same `TD`/`LR` direction toggle:

- **Relational → `erDiagram`.** ER is a relational-shaped notation, so it fits
  the mapped schema exactly. Entities become tables; functional roles become
  columns/FKs; m:n and n-aries have already been resolved into their own tables
  by Rmap, so the binary-only limitation no longer bites.

  ```mermaid
  erDiagram
    CUSTOMER ||--o{ "ORDER" : places
    "ORDER"  ||--|{ ORDER_LINE : contains
    PRODUCT  ||--o{ ORDER_LINE : "appears in"
    CUSTOMER { string customer_id PK
               string email
               string name }
  ```
  Crow's-foot ends carry cardinality/optionality: `||` one-mandatory, `o{`
  many-optional, `|{` many-mandatory — read these straight off the conceptual
  uniqueness/mandatory constraints.

- **OO → `classDiagram`.** Classes with typed fields and methods; associations
  with multiplicities; `<|--` for subtype inheritance.

  ```mermaid
  classDiagram
    class Order { +OrderId id
                  +Customer customer
                  +LineItem[] lineItems
                  +total() Money }
    Order "1" --> "*" LineItem
    Employee <|-- Manager
  ```

These are generated from the *mapped* schema (which carries target decisions),
not mechanically from the conceptual spec — so author them alongside the mapping
rather than expecting `orm_mermaid.py` to produce them (that script renders the
conceptual `graph` view only).

## Choosing between targets

If the user is unsure which target they need, the deciding questions are: is the
deliverable persisted storage (relational), in-memory domain behavior (OO), or a
wire contract between systems (API)? Often all three are needed and derive from
the one conceptual model — which is exactly why the model was kept neutral. Map to
each in turn, applying that target's naming conventions, without re-deciding the
facts.
