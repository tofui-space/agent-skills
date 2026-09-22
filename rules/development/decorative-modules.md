---
paths:
  - "**/*"
---

# Decorative modules

This rule governs the creation, naming, and review of modules: files, classes, packages, layers, services, and interfaces.

A module is decorative when its presence is the deliverable.
It exists so the project appears to satisfy a requirement, follow a pattern, or reflect expertise, not because a caller needs the behavior it provides.
Its name promises more than its body delivers.

Generated code is judged by what it looks like before it is judged by what it does.
A file named after a requirement passes for the requirement.
A class named after a pattern passes for the pattern.
Reviewers, human and automated, read the name as the behavior and move on.
The cost lands on maintainers, who inherit an interface built for an appearance, and in security-relevant code on users, who are told a control exists when it does not.

An explicit user instruction to create a module, interface, or extension point wins over this rule; the post-generation pass still runs, and its report says the module exists on instruction.

## Before creating a module

Answer three questions before a new module is written.
If any answer is missing, do not create the module; put the behavior at the call site.

* **Who calls it.** Name the existing caller, or the caller in the same change.
  A caller that "will exist later" does not count.
* **Which requirement, design decision, or observable behavior it serves.** Point to the line, the test, or the decision.
  A requirement that merely uses the same noun as the module name does not count.
* **What breaks if it is deleted.** If the answer is "nothing", it is decorative.

The same questions apply to every method, parameter, option, and extension point on an interface.
Do not generalize for callers that do not exist.
An interface is as wide as its current callers need, not as wide as the pattern it is named after suggests.

A file that a framework, build tool, or packaging convention requires by name or location is not a module under this rule; its caller is the tool, and that answer counts.

## Naming

* Name a module for what its body does, in the vocabulary of the domain or the concrete operation.
* Do not name a module for a property it is meant to provide unless the body enforces that property.
  A module named for retry safety, sanitization, resilience, or isolation is a claim; the body must make the claim true.
* Use a pattern name only when the pattern's structural obligation is met.
  A strategy has more than one strategy chosen at runtime.
  A repository hides a store that could be swapped.
  An event bus has more than one subscriber, or a producer that does not know its consumers.
* Do not use role nouns that describe no operation: manager, handler, processor, engine, orchestrator, helper, utility, core.
  Each one hides the question of what the module does.
* When no precise name comes, do not reach for a broader one.
  A hard-to-name module has a murky identity; split it or redefine it until a plain name appears.
* Use the word the codebase already uses for a concept.
  A synonym introduced so a new module sounds distinct from an existing one is decorative vocabulary.
* A rename that makes a module sound more advanced without changing its body is a decorative change.
  Decline it.

## Tells

Any of these marks a module as decorative until shown otherwise:

* A wrapper with one caller that adds no behavior, only a layer.
* An interface or abstract base with one implementation and no second one in any requirement.
  A test double counts as a second implementation only when a test actually uses it.
* An exported decorator, middleware, hook, or plugin point that nothing applies.
* A configuration surface that nothing configures.
* A body that is `pass`, `return True`, a bare log line, a `TODO`, or a `NotImplemented` behind a name that claims completeness.
* A module that satisfies a requirement by name only: the requirement asks for a behavior, and the module exports something with the behavior's name that does not perform it.
* Pattern vocabulary over a plain data structure: a repository that is a dictionary, a pipeline that is one function call, a factory that returns one constructor.

## Cheap tests

Each of these takes a minute and needs no tooling.
Run them on every new or renamed module, and on every interface that gained a method or parameter.

* **Predict, then read.** Read the name and signature alone and write down what the body must do.
  Then read the body.
  Any difference is a defect in the name or in the body; fix one of them.
* **Signature test.** If the signature already tells a reader everything the body does except its error cases, the module hides nothing and is not paying for its interface.
  Merge it into its caller.
* **Pass-through test.** If the body is one call and the signature has the same parameters as the callee's, possibly renamed or reordered, delete the layer.
  The exception is a layer that isolates a dependency the project does not own, such as a third-party API or a transport; hiding that dependency is the functionality.
* **Adjacent-layer test.** If two adjacent layers expose the same operations under different names, one of them is not earning its place.
  Merge them or give one a different abstraction.
* **Interface comment test.** Write the interface comment before the body.
  If the comment can say nothing the signature does not, the module has no abstraction.
  If it needs several "unless" or "however" clauses, the interface is too complex; simplify the contract, not the comment.
* **Suffix test.** Strip manager, processor, handler, helper, service, util, impl, info, data, base, or core from the name.
  If what remains still fits and collides with nothing, the suffix was noise; use the shorter name.
  If nothing remains, the module has no identity.
* **Responsibility sentence.** State what the module is responsible for in one sentence without "and", "or", or "but".
  If the sentence is the name restated, the module has no responsibility.
  If the sentence needs a conjunction, it has more than one; split along the conjunction.
* **Side-effect test.** The name must cover everything the body does.
  A function named as a check that also writes, sends, or caches is misnamed; rename it to say so, or split it.
* **Second-caller test.** A general interface is justified only by a second caller that can be named.
  If the only argument for the general shape is that a second caller might appear, build the specific shape.
* **Parameter test.** Every parameter and option exports a decision to a caller with less context.
  A parameter that no caller sets to anything but its default is a decision nobody needed; remove it.

## Requirements are met by behavior

A requirement is satisfied by behavior that can be observed at a boundary: a test, a response, a persisted state, an emitted event.
It is not satisfied by a file whose name matches the requirement's noun.

When a requirement cannot be met in the current change, say so in the report.
Do not ship a module that stands in for it.
A named placeholder is worse than an absent one, because it closes the question for everyone who reads the tree.

## The post-generation pass

The pass that writes code rates its output by appearance; a separate pass is needed to rate it by function.
After generating or restructuring code, and before reporting the work as done, walk every module that was added, renamed, or given a new interface and answer, per module:

1. Who calls it, by name.
2. Which requirement, decision, or observable behavior it serves, by reference.
3. What is lost if its body is inlined at the call site.
4. Whether the name claims a property, pattern, or role that the body does not implement.

A module added in this change that fails 1, 2, or 3 is removed or inlined; an existing module that fails is reported under Existing decorative modules.
A module that fails 4 is renamed for what it does, or its body is completed so the name is true.
When a fresh agent or a subagent is available, have it run the pass with only the diff and the requirement, not the generation context; the context that produced the module is the context that will excuse it.

Report the pass in the completion message: which modules were removed, inlined, or renamed, and why.
If nothing was found, say the pass ran and found nothing.

## Security-relevant modules

For authentication, authorization, input sanitization, rate limiting, secret handling, cryptography, and any control a requirement or threat model names, a decorative module is a vulnerability.
It convinces every later reader that the control is in place.

* Never create a module named for a security control whose body does not implement the control.
* If the control is incomplete, make the incompleteness loud: raise at import or at call, and name the module for what it is.
  Do not let it pass silently.
* Do not close a security requirement on the strength of a module name or a docstring.

## Review

* Treat every module name as a claim and open the body before accepting it.
* A name that matches a requirement does not close the requirement; the behavior does.
* Run the four questions of the post-generation pass on every new module in the change under review.
* When a decorative module is found, name it as such: which claim the name makes, and what the body actually does.

## Existing decorative modules

* Do not extend it.
  Adding behavior to a decorative module makes its name partly true and harder to remove.
* Do not delete or rename it without an explicit go from the user; it may be a deliberate seam.
