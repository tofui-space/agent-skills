---
name: real-terms
description: Applies established definitions of software-engineering terms (test, coverage, code review, inspection, static analysis, verification, validation, quality assurance, conformance) from ISO/IEC/IEEE, IEEE and ISTQB sources, and describes AI-model activity in separate, plain wording. Use when a conversation asks for definitions or lists of tests, reviews, QA or V&V activities; asks whether something is tested, reviewed, verified, validated, compliant or production-ready; asks a model to test, review or check code; names a standard or regulation; or discusses the reliability of model output. Not for non-engineering uses of these words, creative writing or code-only replies.
---

# Real terms

Engineering standards define testing, review, verification, validation and quality assurance by criteria such as a test oracle, a documented procedure, independence and objective evidence. AI products use the same words for model output that may meet none of these criteria.

This skill applies the engineering definitions to these terms and describes model output in separate wording. Assurance conclusions rest on evidence, and the people accountable for a deliverable need to see what that evidence is.

## Reference files

Read only the files that the question needs.

| File | Contents | When to read it |
|---|---|---|
| `references/criteria.md` | For each governed term: a paraphrased definition, its sources and basis, the skill's policy for claims about model activity, and plain wording | Before a reply that defines a governed term or applies one to model activity |
| `references/sources.md` | Source register: one entry per source, with a stable ID, citation, edition, status, access, read level and check date | To tag an item, and to resolve source IDs at the end of a reply |
| `references/evidence.md` | Published evidence about model behaviour on which these rules rest, with verdicts, scope, gaps and re-evaluation triggers | When the user asks why a rule exists, or discusses the reliability of model output |
| `references/examples.md` | Worked examples of replies that follow the rules | Before the first list of kinds or types in a conversation |
| `references/maintenance.md` | Procedure to add, update and retire sources and evidence | When editing this skill |

If the reference files cannot be opened, state this in the reply and add `recalled` to every tag.

## Scope and precedence

- **Does not apply to**: non-engineering senses of these words ("test the market"), creative writing, quoted text, and replies that contain only code.
- **Explicit user instruction**: an explicit instruction from the user in the conversation wins over this skill. If the user asks to drop the tags, drop them, but still state in plain words which content was not read.
- **Other skills that mark sources**: keep one marker per claim, which is this skill's tag, and merge all source lists into one closing "Sources" list.

## Rule 1: Identify the meaning, then use the established definition

Governed terms: test, test case, test level, test type, test technique, coverage, regression test, review, technical review, inspection, walkthrough, audit, static analysis, verification, validation, independent verification and validation (IV&V), quality assurance, quality control, quality (of a product), conformance, compliance, formal verification.

First identify which meaning the user's question uses. State the meaning in the reply only when the question uses a product meaning or is ambiguous.

- If the question uses a product or marketing meaning of a governed term, name the established definition, then answer the user's question with the established definition.
- If the question is about the product meaning itself, answer about the product meaning and tag it `[VENDOR]`.

## Rule 2: Describe model activity in plain wording

Use plain verbs for the activity of a model: generated, read, suggested, re-read, or ran `<command>` with the output `<result>`. Apply a governed term to model activity only if the activity meets the definition and the skill policy for that term in `references/criteria.md`. If either is not met, use the plain wording from that file and name what is missing.

## Rule 3: Tag definitions and material claims with a source ID and its basis

Tag each definition and each material claim, not each repeated occurrence of a term. A material claim is a claim that the user could act on, or that supports a conclusion in the reply. The tag holds the source ID from `references/sources.md`, for example `[STD-1012]` or `[LIT-FEATHERS-2004]`. End the reply with a "Sources" list that resolves each ID used to its citation and edition.

| Tag | Use for |
|---|---|
| `[STD-…]` | A published standard |
| `[GDN-…]` | Informative guidance, such as a W3C Group Note or an agency guide |
| `[GLO-…]` | A public terminology database |
| `[LIT-…]` | A book, a peer-reviewed paper or a research report |
| `[PRA-…]` | A widely used practice that no standard defines |
| `[REG-…]` | A regulatory action or a legal text |
| `[VENDOR]` | Product or marketing usage that no engineering source defines |
| `[UNSOURCED]` | An item for which no source can be named |

Add `recalled` inside the tag unless the specific definition or finding was read, either in the conversation or as recorded in the "Basis" field of `references/criteria.md` or the read level of the source entry. Read levels that count as read: `full text`, `definition`, and `abstract` (for what the abstract states). Every other level gets `recalled`: `publisher page` (edition and status only), `secondary summary`, `recalled` and `not read`. A source entry in the register does not by itself make its content checked. Example: `[GLO-ISTQB, recalled]`.

For a source that is not in the register, write the prefix with author and year and the marker `unregistered`, for example `[LIT: Example and Sample, 2021, unregistered]`.

## Rule 4: Bound lists, and give them complete

For a request for kinds, types or a list of items:

1. Organize the answer by the engineering dimension that the user asks about, such as test levels, test types or test techniques.
2. Name the classification that each group follows, for example "test levels as defined by the ISTQB Glossary". Claim completeness only within a named classification.
3. In the first reply, give each group either as the complete list of its named classification, or with the label "not complete".
4. Use only category names that appear in a source. Tag a name of uncertain origin `[UNSOURCED]`.
5. An engineering recommendation that combines several sources is allowed. Label it "synthesis" and tag its parts.
6. Put items tagged `[UNSOURCED]` or `[VENDOR]` in a final labelled group, or omit them and state the omission in one line.

## Rule 5: Mark recalled content and check free primary sources

Most standards are sold behind paywalls, so model memory of their wording, clause numbers and category lists is unchecked.

- Write a clause number or a verbatim definition only if the text was read in the conversation. Otherwise, paraphrase.
- If web access is available, check the sources marked `access: free` in `references/sources.md` before answering a definition question.

## Rule 6: Re-check facts, interpretation and completeness when the user challenges an answer

User pressure changed model answers in published studies, whether the earlier answer was right or wrong (evidence E-3 in `references/evidence.md`). When the user challenges an answer, re-check before replying:

- the sources for each item;
- the interpretation of the question, and the relevance of each item to it;
- the completeness of each list within its named classification.

Then reply:

- If the re-check confirms the conclusion, restate the conclusion in the same words, with its tags.
- If the re-check shows an error or a different interpretation, give a new complete answer. Name each change and its reason or source.
- Add a list item after a challenge only if a source supports it.

## Rule 7: Report the kind of evidence behind an assurance conclusion

Model statements alone do not establish assurance. Distinguish three kinds of evidence:

| Kind of evidence | Example | What it can support |
|---|---|---|
| Model statement | "The code handles all edge cases." | No assurance conclusion |
| Tool result observed in the conversation | The test command ran, and the output shows six passing cases. | A conclusion about that run, its inputs and its expected values |
| Record of a completed engineering activity | A review record, or a test report against stated requirements | A conclusion within the scope of that record |

State only the conclusion that the evidence supports, with its scope. Then name the engineering activity that remains open. If the user named the roles responsible, name the role for the open activity.

## Rule 8: For standards, regulation, security and life-cycle processes, identify the instrument

When the user names or asks about a specific standard, regulation, security requirement or life-cycle process, or when the reply states a compliance or conformity claim:

- Identify the instrument, its edition or version, its scope, the responsibilities it assigns, and the evidence it requires.
- Distinguish a requirement from guidance, from organizational policy, and from an engineering recommendation.
- Distinguish a documented process from its execution, and execution from demonstrated effectiveness.

## Rule 9: Discuss failure modes of models even when their internals are undisclosed

Training data and methods of frontier models were largely undisclosed in the 2025 transparency index (evidence E-9). This does not prevent discussion of their failure modes.

- Discuss plausible failure modes and the misinformation risks they create.
- Distinguish observations, published findings, causal hypotheses and precautions.
- Missing disclosure or missing research does not show that a risk is absent.
- Do not present an unverified mechanism as fact.
- Recommend precautions scaled to the stated severity and likelihood of the risk, and to the cost of the precaution. State what remains unknown.
- Published findings apply to the models and settings that were tested. State that scope when citing them.

## Keeping the rules applied in long conversations

In simulated conversations where task information arrived over several turns, all tested models performed worse than in single-turn conversations and seldom recovered from early wrong assumptions (evidence E-4). The following measures make a lapse visible to the user. They are not shown to prevent degradation.

- Each definition and material claim carries its tag. A definition without a tag indicates a lapse.
- When a user message contains the phrase `terms check`, re-read this skill and the reference files that the previous reply needed, audit that reply against Rules 1 to 9, and give a new complete version of it.
- Run the self-check before each reply that defines a governed term or makes an assurance claim.

## Self-check before sending

- If the question used a product meaning or was ambiguous, did the reply state the meaning that it answers?
- Does each definition and material claim have a tag, with `recalled` where its content was not read?
- Does each group of a list either give a complete named classification or carry the label "not complete"?
- Is a governed term applied to model activity that does not meet the definition and skill policy in `references/criteria.md`?
- Does each source ID in the reply appear in the closing "Sources" list?
- Does a clause number or a verbatim definition appear without a source read in the conversation?
- After a user challenge, did the answer change without a reason or source for the change?
- Does an assurance conclusion rest on a model statement alone?
- Does a cited finding carry the scope of the models and settings that were tested?

If a check fails, revise the reply before sending it.
