# Output shapes

The parts each task's output contains, after a one- or two-sentence verdict or recommendation. In a design session the parts go into the design record and the chat carries the decision in focus (`session-style.md`).

## Contents

- Per task
- Labels and Contents lists

## Per task

- **Design**: consumers and top scenarios; consumer code per scenario for the chosen option; a surface table (element, call / extension / internal, why it is published); the scenario walkthrough summary; prototype measurements, if any; the options compared (gates, adjusted weights, weighted table, sensitivity result); what was left out or deferred and what evidence would bring it in; enforcement; research log; open decisions for the user.
- **Review**: verdict; findings ranked by reach (extension surface, then call surface on top scenarios, then the rest of the call surface, then documentation, then internals); each finding with location, what the consumer runs into, the red flag or problem-map entry and principle, the fix (consumer code before and after when the surface changes), and its compatibility impact. Say which parts are deep and must survive refactoring, and end with the single change that would help most.
- **Change**: per consumer role (callers, implementers, subclassers, producers and readers of files, config, and output), whether the change is compatible at source, binary, and behavioral level; the version bump; the migration path; deprecation steps; the check that will catch a regression.
- **Release**: the checklist in `release.md` with each item's result.
- **Constraints**: each constraint, its choke point, its default, the name and scope of its opt-out, and the check that proves every entry point passes through it.
- **Enforce**: each rule, its stage, its message, its suppression mechanism, and its valid and invalid fixtures.
- **Stack**: the layer table, the options with gates and weights, and each option's exit cost.
- **Fit**: the convention as observed, the history measurements, the project's forces, each candidate convention's fit with evidence, the recommendation, the migration path, and its enforcement.
- **Patterns**: the verdict, the comparison table, and one card per pattern (`pattern-comparison.md`).
- **Document**: the documentation map by kind, the reference-page anatomy, and the gaps found, each with the consumer question it leaves unanswered (`documentation.md`).
- **UI**: as for Design or Review, plus the accessibility responsibility table: which success criteria each component takes care of and which remain the application's (`ui-frameworks.md`).
- **Retro**: the candidate table (finding, evidence, classification, decision, reason), including declined candidates so the next retro does not raise them again without new evidence.
- **Distill**: the distilled preferences, one line each, with scope, kind (stated or observed), support, and counter-examples, for the user to confirm.
- **Record check**: the inventory, the findings table (missing, contradicted, drifted, duplicate, orphaned, and mechanical findings, those that change a decision first), the repairs applied, the batched list of changes awaiting approval, and the updated current-state block (`record-check.md`).
- **Evolve**: the maturity check result, then the proposed changes to this skill, one line each (file, entry, change, evidence, grade), for the user to approve; after applying, the rows added to `evolution-log.md`.

Every proposed fix in any shape states what it costs elsewhere.

## Labels and Contents lists

Every claim taken from research carries its source; every claim from training that was not checked says so; every guideline that depends on a language or ecosystem carries its scope label and, when applied outside its origin, whether it transfers (`cheat-sheet.md`).

A Markdown file this skill creates, a design record it keeps, and every file of this skill open with a Contents list of their sections once they pass 50 lines, after the title and status lines. Files the skill only edits in passing (a changelog, a README) keep the structure they have.
