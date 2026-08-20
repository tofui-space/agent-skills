---
name: no-confabulation
description: "Detect semantically empty text - word soup that is grammatically well-formed but carries no decidable meaning - and immediately stop and flag it as nonsense/vacuous/slop. The flag report is the primary deliverable, making this a review instrument for documents, specs, and AI-generated noise, not just a gate. Once loaded, stays active all session. Input direction: never construct a charitable reading of text that fails the meaning tests; stop at the failure, flag the spans verbatim, never build an artifact on a flagged span. Output direction: run the meaning tests on EVERY prose response before delivering it, catching meaning loss, slop, and vacuous sentences. Invoke on 'no-confabulation', '/no-confabulation', 'sense-check', 'is this gibberish', any request to review text for AI slop or filler, and whenever text reads fluent but resists paraphrase - buzzword chains, undefined referents, sentences whose negation is equally defensible. NOT fact-checking: targets absent meaning, not incorrect meaning."
---

# Sense Check

## The failure this skill exists to stop

Language models are strong charitable interpreters. Given text with no recoverable meaning, the default behavior is to invent a plausible meaning, proceed as if the author intended it, and produce output — because producing something feels like success and reporting "this doesn't parse semantically" feels like failure. The same bias applies to a model's own output: fluent text gets generated whether or not there is a proposition underneath it, and transformations (summarize, rewrite, "make this professional") can silently drop the meaning while keeping the fluency.

This skill inverts the default. Fluency is not evidence of meaning. The primary behavior is detection, not refusal: the moment a span fails the tests, stop interpreting, name it — nonsense, vacuous, slop, or confabulation risk — and quote it. The flag report is a first-class deliverable in its own right, which makes the skill usable as a review instrument: auditing a document for AI-generated noise, reviewing a spec before implementation, or checking a draft for filler. Refusing to build on top of a flagged span is a consequence of the detection, not the point of the skill.

Scope boundary: this is not fact-checking. "The Moon is made of basalt-flavored yogurt" is false but meaningful — it makes a decidable claim. "The Moon operationalizes a yogurt-adjacent basalt paradigm" is the target: well-formed, undecidable, empty.

## The meaning tests

Apply these to any span under suspicion. A span that fails two or more is treated as semantically empty. Run the tests mentally; quote results only for spans you flag.

**1. Paraphrase constraint test.** Restate the span in different words. Then restate it again, deliberately shifting the claim. If both paraphrases are equally faithful — if the text does not constrain what counts as a correct restatement — it carries no proposition. Meaningful text pushes back on wrong paraphrases.

**2. Negation test.** Assert the opposite. If the negation would be exactly as defensible, as citable, as at-home in the same document, the original asserts nothing. "Our architecture embraces composable resilience" and "Our architecture rejects composable resilience" are interchangeable; neither says anything.

**3. Referent test.** For each noun phrase, identify what it points to — a system, a person, a quantity, a defined term, an antecedent. The search space is ALL available context, not just the text under review: earlier conversation turns, project files, memory, prior artifacts in the session, and common knowledge. "No referent in this paragraph" is not a failure — "no referent reachable from anywhere I can see" is. Implied referents count: if earlier context makes the intended referent recoverable with ordinary inference, the test passes. One unresolved referent after a full-context search is a question to ask; a chain of them is gibberish.

**4. Consequence test.** Ask: if this sentence is true, what is different about the world? What observation would confirm it, what would violate it? If nothing changes either way, the sentence is decorative.

**5. Reconstruction divergence test.** Ask what the author would have had to mean. If several mutually incompatible reconstructions are all equally plausible, do not pick one. Picking one is the confabulation this skill prohibits — surface the divergence instead.

## Calibration: what is NOT gibberish

Flagging real meaning as nonsense is the over-trigger failure and it is just as bad as the under-trigger failure. Before flagging, rule these out:

- **Unfamiliar jargon.** Domain terms you do not recognize are not empty referents. If a term might be real terminology (a product name, a legal term of art, a niche technique), verify — search, or ask — before declaring it meaningless. Gibberish is established by failed tests, not by your unfamiliarity.
- **Underspecification.** "Make the dashboard faster" is vague but meaningful — it constrains paraphrase and has consequences. Vague text gets clarifying questions, not a gibberish flag. The dividing line: underspecified text has a recoverable intent with missing parameters; empty text has no recoverable intent.
- **Grammar errors and non-native phrasing.** This skill targets grammatically correct nonsense. Broken grammar with recoverable meaning is the opposite case — repair it charitably as usual.
- **Creative and poetic language.** Metaphor, surrealism, and deliberate absurdism are meaning delivered by other routes. In creative-writing contexts, apply the tests to whether the text achieves its intent, not to literal propositional content. "Colorless green ideas sleep furiously" quoted as a linguistics example is meaningful use of a meaningless sentence.
- **Compression among experts.** Terse expert-to-expert shorthand ("move the auth check above the tenant resolve, same as the webhook path") resolves all referents from shared context. Test against available context before flagging.

## Input direction: reading text

When a prompt, spec, requirement, pasted document, or quoted source contains spans that fail the tests:

1. **Stop at the failure and flag immediately.** Do not select the most plausible reading and continue interpreting past it. The first move is always the flag — verbatim span, verdict label (nonsense / vacuous / slop / likely AI noise), failed tests with one-line evidence. Interpreting past the failure is the prohibited move.
2. **Separate the salvageable from the empty.** Most gibberish-containing documents also contain real content. Process the meaningful parts normally; flag only what failed.
3. **Never build on a flagged span.** If the request is "build X from this spec" and the spec's load-bearing sections failed the tests, deliver the flag report plus whatever X can be built from the meaningful sections, with the exclusions listed. Building on a flagged span means inventing the missing meaning and laundering the invention through an authoritative-looking artifact — the exact harm this skill prevents.
4. **Ask, when the author is present.** In conversation, the flag can be a question: "This sentence doesn't constrain any reading I can check — what did you want it to claim?" With absent authors (pasted third-party docs), state the finding plainly.

**Review mode.** When the request IS the detection — "review this for slop", "is this AI noise", "audit this doc", "sense-check this" — the flag report is the entire deliverable. Walk the full text, flag every failing span with its verdict and evidence, and confirm what passed. In this mode a clean result is also a result: state that the text passed and which tests carried the verdict, so the review is auditable either way.

## Output direction: reviewing generated text

Run this pass on every prose response before delivering it — chat replies, deliverable documents (reports, docs, summaries, specs, explanations), everything. Once the skill is loaded, this is a standing per-turn obligation; do not re-decide whether a given response "deserves" the pass. Also run it on your own previous turns when asked ("sense-check this"). The pass is silent when everything passes — deliver the response with no meta-commentary. Speak up only when something failed and was removed, restored, or needs the user's input.

**Two tiers, so the standing obligation stays cheap.** The per-turn default is the screen, not the full walk:

- *Tier 1 — screen (every turn, done in-head while composing, zero output).* Negation and consequence only — they are the cheapest tests and catch nearly all self-generated emptiness. Applied to sentences, not words, and only to sentences worth suspecting: openers and closers, transitions, summary sentences, anything abstract-noun-heavy, anything you did not derive from a specific fact. Concrete sentences carrying code, numbers, names, commands, or steps pass on sight — they self-evidently constrain their paraphrase. A short technical answer often screens in a few seconds of attention.
- *Tier 2 — full walk (five tests, trace tables, per-span verdicts).* Escalate only when the screen fires, when the response is a transformation of source material, when the artifact is a deliverable document, or when the user asks for a review. Never run Tier 2 turn-by-turn as routine — that spends the effort budget where the failure rate is lowest and dulls the pass into ritual.

Deletion during the screen is free and silent: a vacuous transition caught while composing is simply not written. The reporting rules apply to flags, not to this.

**For transformations** (summarize, rewrite, shorten, formalize, translate registers) — always Tier 2 for the trace: trace every output sentence to a source claim. Three failure modes to catch:
- *Loss*: a source claim with no surviving trace. Report it or restore it — never let compression silently decide what mattered.
- *Slop*: an output sentence with no source trace — connective filler that appeared during rewriting and fails the negation test.
- *Drift*: an output sentence that traces to a source claim but no longer entails it or is no longer entailed by it — the paraphrase escaped the constraint.

**For generation from scratch**: the Tier 1 screen while composing; sentences that fail are deleted, not reworded — a vacuous sentence reworded is still vacuous. If deleting them collapses the document, the document had no content and the honest output is shorter or is a statement that more input is needed.

**The confidence asymmetry — direction-dependent.** You are biased toward finding meaning, so borderline results need a tiebreak — but the correct tiebreak differs by whose text it is. On YOUR OWN output, resolve borderline toward deletion: a false positive there costs one sentence nobody misses. On SOMEONE ELSE'S text, resolve borderline toward asking, not toward a verdict: wrongly branding an author's meaningful sentence as nonsense is the false positive that damages trust and reviews. Concretely, someone else's borderline span gets the verdict **unresolved** — "I can't recover what this claims; what did you mean?" — and only a clear multi-test failure after a full-context search gets nonsense/vacuous/slop. Unresolved is a question; it is never listed as a defect in a review report.

## When a flag is overturned

A false positive is a defect in this skill, and it must produce a learnable case, not just an apology. When the user (or further context) shows a flagged span was meaningful:

1. **Concede specifically.** Name which test failed falsely and what evidence resolved the span — do not relitigate.
2. **Capture the case** in this fixed shape, in the reply, so it can be distilled later:

```
FALSE POSITIVE
span: "<verbatim>"
verdict given: <nonsense | vacuous | slop | AI noise | unresolved>
missed evidence: <where the resolving meaning actually was — earlier turn, file, memory, domain convention>
root cause: <which step was skipped or misjudged — e.g., referent search stopped at document boundary; jargon not verified; expert compression misread>
guardrail: <the one-sentence rule that would have prevented it>
```

3. **Distill it.** If the morphogen skill is installed, run `/morphogen distill` on the captured case so the guardrail line is folded into this skill's Calibration section permanently. Without morphogen, append the guardrail line to Calibration manually. Either way, the lesson must land in the skill file — a concession that changes nothing repeats.

The overturn protocol is not symmetric: a false NEGATIVE (empty text that slipped through) is captured the same way but resolves by strengthening a test, never by weakening a calibration rule.

## Report format

Verdict labels, so they stay distinct rather than decorative: **nonsense** = incoherent even with maximal charity (category errors, no reconstruction survives); **vacuous** = fails negation/consequence — asserts nothing, though every word is ordinary; **slop** = filler that appeared during generation or transformation and traces to no claim; **AI noise** = vacuous/slop text bearing generation fingerprints (uniform register, symmetrical hedging, list-shaped padding) — use only when the provenance question is actually on the table; **unresolved** = borderline span in someone else's text — a question to the author, never a defect finding.

Keep flag reports compact. For each flagged span:

```
"<verbatim span>" — <verdict: nonsense | vacuous | slop | AI noise> — <failed test>: <one-line evidence>
```

End the report with the disposition: what was processed, what was excluded, what question would unblock the excluded parts. Do not editorialize about the author, speculate about why the text is empty, or pad the report with restatements of this skill's rules.

## Worked example

Input spec excerpt:
> The platform shall leverage a federated trust mesh to holistically operationalize stakeholder alignment across the value continuum. Users must be able to reset their password via email within 15 minutes of request.

Correct handling:
- Sentence 2 passes all tests: referents resolve (users, password, email), consequences are testable (15-minute window), negation changes the requirement. Process it.
- Sentence 1: "federated trust mesh" — no referent in the document, and not established terminology (verified); "holistically operationalize stakeholder alignment" — negation equally defensible, no consequence identifiable; "value continuum" — no referent. Three failures across two tests. Flag it; do not design a "trust mesh" component.

Incorrect handling (the default this skill overrides): inventing an architecture where "federated trust mesh" means OAuth federation, building it, and presenting the invention as if the spec required it.
