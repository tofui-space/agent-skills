# Naming reference — how to choose names that don't cost you later

Apply this to every naming decision. The premise: a name is a long-lived
interface. It ends up in columns, keys, API fields, class members, code, and
docs, and renaming later is expensive and risky. The goal is names that stay
correct when the system grows.

## Where names come from (ORM's advantage)

Do not invent names at a blank table. Derive them from validated elementary
facts (CSDP step 1):
- **Object type name** = the domain noun for the thing. Singular common noun.
- **Predicate / relationship name** = the verb phrase that makes the fact a true
  sentence: `Employee` **works for** `Department`. The reading *is* the name.
- **Reference mode** = how the domain identifies the thing: `Country(.code)`,
  `Employee(.empNr)`. This becomes the key/id name on mapping.
- **Value type name** = what the value *means*, not its representation
  (`AnnualSalary`, not `Decimal12`).

If you cannot write a natural true sentence with a proposed name, the name is
wrong. That sentence test is the single most reliable naming check ORM gives you.

## The name-quality rubric

Score each candidate against these. They occasionally conflict; when they do,
prefer clarity-at-the-point-of-use over brevity.

1. **Intention-revealing.** The name says what the thing *is* or the relationship
   *asserts*, not how it's implemented. `submittedAt` over `date2`.
2. **One concept, one word.** Pick a single term per concept and use it
   everywhere (synonym control). Don't mix `customer` / `client` / `account` for
   the same thing, or `buy` / `purchase` / `order` for the same act. Equally,
   don't reuse one word for two concepts (homonym control): if `order` means both
   a purchase and a sort direction, rename one.
3. **Right part of speech.** Types/entities: nouns. Relationships/predicates: verb
   phrases that read as sentences. Booleans: predicate phrases (`isActive`,
   `hasShipped`) — see traps. Methods: verb phrases (`calculateTotal`).
4. **Correct number and tense, consistently.** Decide singular-vs-plural per
   target and hold it (see conventions). Keep verb tense consistent across
   readings.
5. **No leaky abbreviations.** Spell words out unless the abbreviation is a
   domain standard everyone uses (`sku`, `iso`, `url`, `id`). `emp`, `qty`,
   `desc` save keystrokes and cost comprehension.
6. **No type-encoding noise.** Don't bake the datatype or container into the name
   (`strName`, `orderList`, `tblCustomer`). The name should survive a type
   change.
7. **Searchable and pronounceable.** A name you can say out loud and grep for.
   Single letters and number-suffixed names (`d`, `data2`) fail both.
8. **Scoped, not redundant.** Inside `Customer`, a field is `email`, not
   `customerEmail`. Across tables, reuse the *same* column name for the *same*
   object (helps joins) unless doing so loses a real semantic distinction (e.g.
   two different date roles).
9. **Not a reserved word / not collision-prone.** Avoid SQL/keyword clashes
   (`order`, `user`, `group`, `value`, `desc`) unless the target's quoting is
   acceptable; avoid names that differ only by case or a plural `s`.

## The future-cost check (the point of the whole exercise)

Before committing a name, ask what happens when the model changes. Bad names
usually encode a current assumption that later breaks:

- **Does the name hard-code a cardinality that could change?** `primaryPhone`
  assumes one; if a person can have several, you're stuck. If the fact type is
  n:1 *today* but might become m:n, name for the relationship, not the count.
- **Does it hard-code ownership/role that could move?** `managerName` on
  `Project` breaks when a project has a lead and a sponsor. Name the *role*
  (`leadName`) or model it as a relationship.
- **Does it hard-code a value that could be added to?** A boolean `isRefunded`
  becomes a lie when a third state ("partially refunded") appears; a `status`
  enum named for its meaning survives it.
- **Is it over-specific?** `emailForNewsletter` vs `email` + a separate
  consent fact. Fold specifics into relationships, not into names.
- **Is it a temporary/technical word?** `newTable`, `tempStatus`, `flag2`,
  `legacyId` calcify and mislead. Name for the concept, not the moment.
- **Would a new team member guess its meaning correctly?** If not, it will be
  misused, and misuse of a field is a data-quality bug that outlives the name.

If a name only works under today's constraints, either widen the name or model
the varying thing as a first-class fact type instead of a column.

## Common naming traps (and the fix)

- **Boolean flags that want to be enums/subtypes.** `isPremium`, `type='A'`.
  If the states carry different roles, model subtypes; if they'll grow, use a
  named status value type. Reserve booleans for genuinely binary, stable facts,
  and name them as predicates (`hasShipped`).
- **`*_id` that isn't a key.** Only call something `id` if it identifies. A
  `sortId` that's really a rank is misnamed; call it `sortOrder` / `rank`.
- **`data`, `info`, `value`, `object`, `item`, `details`.** Content-free. Name
  the actual content.
- **Suffix soup** (`OrderData`, `OrderInfo`, `OrderManager`, `OrderService`) that
  hides that they're the same concept split by accident.
- **Direction-ambiguous relationships.** `Employee`–`Employee` `manages`: which
  role manages? Give both readings (`manages` / `is managed by`) so the direction
  is unambiguous, and add the ring constraint.
- **Meaningful primary keys that mutate.** Using a value that changes (email,
  name) as the identifier. Prefer a stable domain key or an explicit surrogate;
  this is a fork — raise it.
- **Plural/singular drift.** `users` table, `Customer` table, `orderItems`,
  `Payment` — inconsistency makes every join a lookup. Fix the convention once.
- **Encoding hierarchy in a name** (`address_line_1`, `address_line_2`) when a
  repeating fact type is meant. Model the repetition.

## Naming conventions by target

The conceptual model is neutral; apply the target's conventions only at mapping
time, and apply them *consistently*.

**Relational (SQL).**
- Casing: `snake_case` is the safe cross-engine default (PostgreSQL folds unquoted
  identifiers to lower case; quoted mixed-case identifiers are a lasting
  annoyance). Match the existing schema's convention above all.
- Table number: pick singular (`customer`) or plural (`customers`) and never mix.
  Both are defensible; consistency is what matters.
- Columns: the object/value type name; for foreign keys, a consistent style —
  `<referenced_entity>_id` (`department_id`) is the common one. Reuse the same
  column name for the same object across tables to simplify natural joins.
- Association tables (from m:n): name after the relationship reading
  (`enrollment`) when the domain has a word for it, else a clear join of the two
  (`student_course`). Keys = the two foreign keys.
- Avoid reserved words; avoid abbreviations except domain-standard ones.

**Object-oriented / application code.**
- Classes: `PascalCase` singular noun (`Invoice`).
- Fields/properties/methods: language convention (`camelCase` in Java/JS/TS/C#,
  `snake_case` in Python/Ruby). Fields = nouns; methods = verb phrases.
- A functional (n:1) role becomes a reference field named for the role
  (`invoice.customer`); an m:n or 1:n becomes a collection named plural for the
  related type or the role (`invoice.lineItems`).
- Booleans as predicates (`isPaid`, `hasDiscount`).

**API / JSON.**
- Keys: pick `camelCase` or `snake_case` and hold it across the whole surface.
- Resources: named for aggregate roots (nouns), pluralized in paths by REST
  convention (`/orders/{id}`).
- Embed vs reference: embed a child when it's owned and small (a 1:n composition
  read together); reference by id when it's shared or large. The cardinality and
  ownership from the ORM model decide this — name embedded objects for their role,
  referenced ids as `<role>Id`.

## When names conflict, use the sentence

If two candidate names both seem fine, write the elementary fact both ways and
read them to a domain expert (or imagine doing so). The one that produces the
truer, more natural sentence — and stays true under the future-cost check — wins.
That is the whole method in one move.
