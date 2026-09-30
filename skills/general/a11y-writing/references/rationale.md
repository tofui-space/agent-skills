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
| Reason inside the answer, not only in **Why** | Readers who lack background understand less when a text leaves the links between claims implicit, and most expert readers also do better with the links stated (McNamara et al. 1996; O'Reilly & McNamara 2007; see `comprehension-research.md`, Hypothesis 2). Leaving the reason to an optional section let the writer drop it whenever it judged the reason unneeded. |
| Restate what the reader has not seen; replies stand on their own | An agent reads tool output and files the user never saw. Anthropic's model-specific prompting guidance recommends telling the model to put any output the user needs into the reply and to close multi-step work with a recap that stands on its own. Overhearers understand less than addressees (Schober & Clark 1989). Names formed during solo work were never agreed with the reader (Brennan & Clark 1996). See `comprehension-research.md`, Hypotheses 4 and 6. |
| Skippable labeled sections (layered depth) | COGA — let users find what they need without processing everything. Home Office guidance — do not put too much information in one place. |
| Caveat adjacent to its claim; no state-holding | Home Office guidance — do not force the reader to remember things from previous sections. Working-memory load applies to all readers of technical text. |
| One idea per unit; sentence length follows content | Home Office guidance — simple sentences, no wall of text. COGA clear-language objective. Splitting keeps the relation because causal and contrastive connectives measurably aid comprehension (Kleijn, Pander Maat & Sanders 2019; Degand & Sanders 2002), and ASD-STE100 Rule 4.2 says not to omit words to shorten sentences. See `comprehension-research.md`. |
| Cut padding, not content | COGA literal-language and implied-content objectives: praise, reassurance, and softening filler carry meaning through tone and social implication, which the reader must infer. Verbosity research shows such padding is common in assistant replies (see `comprehension-research.md`, Hypothesis 5). The rule names what to cut, so the writer does not decide alone what the reader can do without. |
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
- **Variable: arrangement and vocabulary.** This skill decides what units exist, in what order, under what labels, in what words. It removes only the padding it names explicitly, and it does not decide total length. It does not ask the writer to judge in general whether a clause carries information, because that judgment is the one a writer holding full context gets wrong.
- **Length is not the target; burial is.** A long response with the verdict in line 1 and clearly separated optional depth is acceptable. A short response with a diffused verdict is not. Rules here are stated in ideas and units, never in lines or word counts.
- **No sentence-length word in the rules (design decision, not a research finding).** An earlier version said "short, one clause where possible" and "cut content, not grammar". One reader reported that replies under it were easy to skim but hard to understand on careful reading; this is a single report, not a measurement. The likely mechanism is that "one clause" removes the clause carrying a reason ("because …", "so …"), and "cut content" lets the writer delete what it judges unneeded, a judgment the curse-of-knowledge studies show to be biased (`comprehension-research.md`, Hypothesis 1). The research does not oppose short sentences: plain-language guidance and W3C COGA 4.4.5 recommend them, and COGA adds that a longer sentence is sometimes clearer. So the substance is kept — a sentence with two ideas is split, and the split keeps its "so" or "because" — while the word "short" is left out because it invites cutting to a length. Keep length and brevity words out of the triggers for the same reason.
- **On by default, with an off switch.** The layered shape suits most direct questions, so the skill starts on. Some readers or tasks are better served without it, for example when reasoning is the content being asked for, so "a11y-writing off" disables it until "a11y-writing on". The switch is sticky because re-enabling on topic match would make the off state unpredictable, which contradicts the predictability objective.
- **Coinage rule is about generation, not vocabulary age.** Established recent coinages ("rage-quit", "yak-shaving") are lookupable and permitted. A term invented mid-response is not, and repeating one presents it as established terminology the reader should already recognize.

## Known tensions

- Bullets aid scanning, but over-bulleting fragments reasoning and drops function words. Resolution: bullets for genuine lists only; full sentences everywhere.
- Some readers prefer exhaustive explicit detail; others prefer minimal content. Resolution: the layered structure serves both — the detail exists but is skippable.
- Established idioms are lookupable, so the coinage rule permits them, but they remain non-literal. Resolution: prefer a literal phrasing where one exists at equal length.
