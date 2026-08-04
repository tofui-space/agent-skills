# Rationale and sources

Purpose of this file: prevent future erosion of the rules in SKILL.md. Each rule maps to published accessibility guidance or established writing research. Do not relax a rule without checking its source here.

## Sources

1. **W3C COGA — "Making Content Usable for People with Cognitive and Learning Disabilities"** (W3C Working Group Note, supplemental to WCAG). Objectives used here: clear language, findable and understandable content, no reliance on user memory, predictable design. https://www.w3.org/TR/coga-usable/
2. **UK Home Office accessibility posters** (Home Office Digital accessibility team). https://ukhomeoffice.github.io/accessibility-posters/
3. **Plain-language research** (general): comprehension and task-completion times improve for expert readers too, not only for readers who need the accommodation. This is the basis of the universal-benefit claim.
4. **Cognitive Load Theory** (Sweller): minimize extraneous load; structural novelty per response is itself extraneous load.

## Rule → basis

| SKILL.md rule | Basis |
|---|---|
| Answer-first, verdict in first sentence | Attention budget and working-memory limits: a reader may only reliably process the opening. COGA — make the purpose of content clear immediately. |
| Skippable labeled sections (layered depth) | COGA — let users find what they need without processing everything. Home Office guidance — do not put too much information in one place. |
| Caveat adjacent to its claim; no state-holding | Home Office guidance — do not force the reader to remember things from previous sections. Working-memory load applies to all readers of technical text. |
| One idea per unit, short sentences | Home Office guidance — simple sentences, no wall of text. COGA clear-language objective. |
| Vocabulary the reader can look up | COGA clear-language objective — avoid unusual words and constructions the reader must resolve from context. Implied meaning forces inference, which is exactly the load being removed. |
| Signal scope ("3 steps:") | COGA predictability objective. Lets the reader budget attention before committing it. |
| Consistent response shape every turn | COGA — predictable, consistent layouts. Novel structure per response is a cost paid on every turn. |
| Separate labeled answers per question | Interleaved answers force the reader to de-multiplex: inference plus state-holding combined. |
| Descriptive labels | COGA — users must recognize what an element is and what it contains without reading it. |
| Grouping of related points | Minto Pyramid Principle: scattered related points force the reader to reassemble them. |
| Front-loaded sentences | GOV.UK style guide: key word early per sentence, not only per response. |
| Fixed label vocabulary | Information Mapping: labels are navigation; synonyms break recognition. |
| Representation matching (tables, diagrams, trees) | COGA recommends visual support for text. Multimedia principle (Mayer): dual coding lowers load when the visual carries structure. Guard — information-bearing only; the decoration prohibition targets ornament, not structure. |

## Design decisions (locked with the user)

- **Elaboration model: layered.** Answer first, then labeled skippable sections. Chosen over strict opt-in, which costs a round-trip, and over a hybrid, whose inconsistent shape violates predictability.
- **Scope: chat prose only.** File contents, code, commit messages, and generated documents are out of scope. Arrangement rules are safe to apply widely because they never remove information, but a generated document is read later and out of context, so it should not inherit a conversational shape by default.
- **Variable: arrangement and vocabulary.** This skill decides what units exist, in what order, under what labels, in what words. It does not decide whether a clause carries information, and it does not decide total length.
- **Length is not the target; burial is.** A long response with the verdict in line 1 and clearly separated optional depth is acceptable. A short response with a diffused verdict is not. Rules here are stated in ideas and units, never in lines or word counts.
- **Coinage rule is about generation, not vocabulary age.** Established recent coinages ("rage-quit", "yak-shaving") are lookupable and permitted. A term invented mid-response is not, and repeating one presents it as established terminology the reader should already recognize.

## Known tensions

- Bullets aid scanning, but over-bulleting fragments reasoning and drops function words. Resolution: bullets for genuine lists only; full sentences everywhere.
- Some readers prefer exhaustive explicit detail; others prefer minimal content. Resolution: the layered structure serves both — the detail exists but is skippable.
- Established idioms are lookupable, so the coinage rule permits them, but they remain non-literal. Resolution: prefer a literal phrasing where one exists at equal length.
