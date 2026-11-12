# Assurance model

## Words

- The **inventory** is the selected language tool that admits code and computes its checks.
- A **check** is one computed input with its expected result. The tools print checks as "cases".
- A **cell** is a set of inputs that the conditions of the code and of the spec cannot tell apart. One check per cell is enough, which is why cells are what gets counted.
  For a text classifier and a classifier over several numbers the TypeScript tool adds inputs at each boundary, so its count is the cells plus those inputs.
- A **unit** is one function or dispatch map that the tool admits.
- The **obligations file** is the computed list of every unit with its checks. The project commits it.
- **Paths** and **tests** are the words people arrive with. The answer to "how many tests does this need" is the number of checks, and it exists only for code in the shapes.

## What the claim covers

For code that the inventory admits, the claim is: every unit agrees with its spec on one input per cell of its input space, where the cells come from the unit's types and from the constants in the code and the spec together. For a decision over finite types that is every input. The tool computes the cells; a person answers for the spec.

The claim does not cover:

- code outside the selected scope (TypeScript lists declared outside files; C# only inspects the selected file, so the report must name the surrounding code it did not inspect);
- whether the spec matches the requirement, which a person reviews;
- database constraints, transactions, concurrency, and UI rendering;
- anything a library does beyond what a reviewed contract declares.

Say which of these apply whenever you report a result. A green run of the computed checks is a statement about the admitted code and its specs, not about the application.

## The five shapes

A decision maps finite inputs to finite outputs. A classifier partitions an open input domain into finite outcomes. An adapter maps an external call's outcomes. Wiring joins admitted units through guards and dispatch. A conversion transforms a value in a restricted vocabulary. These are shared concepts, not a promise that every backend implements them. The language profile defines the admitted syntax and semantics.
