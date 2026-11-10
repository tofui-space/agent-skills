# Evidence on model behaviour

These entries record published evidence on which the rules of this skill rest. Each entry has a stable ID, a statement worded to match the evidence, a verdict, the scope of the evidence, the known gaps, and the events that require a re-evaluation. Source IDs resolve in `sources.md`.

Findings apply to the models and settings that were tested. They are not measured error rates for current models or for this skill.

Verdict values:

- **Supported**: published empirical evidence supports the statement as worded, in the tested settings.
- **Supported by theoretical argument**: a published argument supports the statement, without measurement on a deployed model.
- **Partly supported**: evidence supports part of the statement, or comes from an adjacent domain.
- **Contradicted**: evidence points against the statement.
- **Not studied**: no published study was found.

Last full review: 2026-10-14. Read levels are recorded in `sources.md`.

## Contents

- E-1: Model answers to programming questions were often wrong, and users missed the errors
- E-2: Training and evaluation methods reward a plausible guess over an admission of uncertainty
- E-3: User pressure changed model answers, whether the earlier answer was right or wrong
- E-4: In simulated multi-turn conversations, model performance fell, and models seldom recovered from early wrong assumptions
- E-5: Model-generated test oracles mostly followed the current behaviour of the code, and weak benchmark test suites overstated agent results
- E-6: A model that evaluated its own output favoured it
- E-7: AI products describe model output with words for human activities, and this can overstate what the output is
- E-8: AI assistance and the confidence of its users
- E-9: Training data and methods of frontier models are largely undisclosed

## E-1: Model answers to programming questions were often wrong, and users missed the errors

- **Verdict**: Supported.
- **Evidence**: In a study of 517 Stack Overflow questions, 52% of ChatGPT answers contained incorrect information, and study participants overlooked the misinformation 39% of the time [LIT-KABIR-2024]. Across 576,000 code samples from 16 models, the share of suggested packages that did not exist averaged at least 5.2% for commercial models and 21.7% for open-source models [LIT-SPRACKLEN-2025].
- **Scope**: ChatGPT in 2023 for the first study; 16 code-generating models for the second.
- **Gaps**: No study was found on questions about engineering terminology or test-type taxonomies.
- **Re-evaluate when**: a study repeats these measurements on current models, or measures answers to terminology questions directly.
- **Used by**: Rule 3, Rule 5.

## E-2: Training and evaluation methods reward a plausible guess over an admission of uncertainty

- **Verdict**: Supported by theoretical argument.
- **Evidence**: The authors argue that pretraining makes plausible errors statistically likely, and that benchmarks graded as right or wrong reward guessing over abstaining [LIT-KALAI-2025].
- **Gaps**: The paper does not diagnose a specific deployed model.
- **Re-evaluate when**: major benchmarks start to credit abstention, or measurements on deployed models confirm or contradict the argument.
- **Used by**: Rule 4 (no invented category names), Rule 5.

## E-3: User pressure changed model answers, whether the earlier answer was right or wrong

- **Verdict**: Supported.
- **Evidence**: Five AI assistants adapted their answers to views stated by the user. Human preference ratings, which favour agreeing answers, are a likely partial cause [LIT-SHARMA-2024].
- **Scope**: Assistants from 2023, on four free-form text tasks.
- **Consequence for this skill**: Insisting until a model changes its answer is not a verification method. Rule 6 requires a re-check and a reason for any change. Restating a confirmed conclusion in the same words is a skill policy for readability, not a research finding.
- **Re-evaluate when**: a study shows that current models keep correct answers under user pressure.
- **Used by**: Rule 6.

## E-4: In simulated multi-turn conversations, model performance fell, and models seldom recovered from early wrong assumptions

- **Verdict**: Supported.
- **Evidence**: Across six generation tasks and more than 200,000 simulated conversations in which task information arrived over several turns, all tested models performed on average 39% worse than in single-turn conversations. Most of the loss came from unreliability rather than from lower capability. Models made assumptions early, proposed final solutions too soon, and relied on them afterwards [LIT-LABAN-2025].
- **Scope**: Simulated conversations with incremental task information; models from 2025.
- **Gaps**: This is not a general law of conversation length. No evidence shows that the tagging and self-check of this skill prevent degradation.
- **Re-evaluate when**: a study shows no multi-turn degradation in current models, or the skill is evaluated in long conversations.
- **Used by**: "Keeping the rules applied in long conversations" in `SKILL.md`.

## E-5: Model-generated test oracles mostly followed the current behaviour of the code, and weak benchmark test suites overstated agent results

These are two separate findings.

- **Verdict**: Supported.
- **Evidence on test oracles**: Test oracles generated by language models mostly captured the actual behaviour of the code, not the expected behaviour, which makes bug detection difficult. The same study found that the models were better at generating oracles than at classifying them, and that their oracles had higher fault-detection potential than those of EvoSuite [LIT-KONSTANTINOU-2024, version 2].
- **Evidence on benchmark test suites**: After strengthening the tests of SWE-Bench Verified, about one in five patches previously marked as solved was found semantically incorrect, and the top agent's score fell from 78.80% to 62.20% [LIT-YU-2026]. A separate study found that reported SWE-bench resolution rates were inflated by 6.2 percentage points [LIT-WANG-2026].
- **Gaps**: The benchmark studies measure the adequacy of benchmark test suites, not of tests generated in daily use.
- **Re-evaluate when**: a study shows that current models derive expected values from requirements rather than from the implementation.
- **Used by**: criteria entries Test and Verification.

## E-6: A model that evaluated its own output favoured it

- **Verdict**: Supported.
- **Evidence**: Models used as evaluators recognized their own output and rated it higher than output from other sources. Controlled experiments suggest that self-recognition causes the preference [LIT-PANICKSSERY-2024].
- **Scope**: GPT-4 and Llama 2 evaluating their own output.
- **Gaps**: This does not establish that every model evaluator lacks independence, or that a shared provider by itself fails IV&V. Evaluation across providers was not reviewed.
- **Re-evaluate when**: a study measures evaluation by models from different providers.
- **Used by**: criteria entries Review and IV&V.

## E-7: AI products describe model output with words for human activities, and this can overstate what the output is

- **Verdict**: Partly supported.
- **Evidence**:
  - Philosophical argument: anthropomorphic description works as hype, because it credits systems with human abilities that they lack [LIT-PLACANI-2024].
  - Regulatory precedent: a US regulator charged two investment advisers over false claims about their use of AI [REG-SEC-2024]. This case is outside software tooling.
- **Counter-evidence**: In a survey of 954 people, anthropomorphic descriptions of fictitious systems did not increase trust overall. Product type and the kind of anthropomorphic wording mattered more [LIT-INIE-2024].
- **Not studied**: No study was found on AI vendors redefining "test", "review" or "verification". The intent behind vendor terminology is not established.
- **Re-evaluate when**: a study of vendor terminology for testing and review is published.
- **Used by**: criteria entry Production-ready.

## E-8: AI assistance and the confidence of its users

Three separate findings, on three different outcomes.

- **Security and confidence**: Participants with an AI assistant wrote less secure code and were more likely to believe that their code was secure [LIT-PERRY-2023]. **Verdict**: Supported. **Scope**: codex-davinci-002, controlled user study.
- **Perceived competence**: Novices who struggled with generative AI ended with an illusion of competence about their own performance [LIT-PRATHER-2024]. **Verdict**: Supported. **Scope**: 21 lab sessions with novice programmers.
- **Productivity and perception**: In a randomized trial with 16 experienced developers and 246 issues in their own repositories, tasks with AI allowed took 19% longer. The developers had forecast a 24% speedup and estimated afterwards a 20% speedup. Pull requests were of similar quality with and without AI, so this finding concerns time and perception, not code quality [LIT-METR-2025]. **Verdict**: Supported for early-2025 tools.
- **Follow-up**: A late-2025 study by the same group estimated changes of -18% for returning developers and -4% for new developers, with wide confidence intervals. The group considers these new data unreliable because of selection bias, which likely understates speedup, and did not retract the 2025 finding [LIT-METR-2026].
- **Gaps**: Small samples. The models used are older than current models.
- **Re-evaluate when**: larger or more recent studies report results on any of the three outcomes.
- **Used by**: Rule 7.

## E-9: Training data and methods of frontier models are largely undisclosed

- **Verdict**: Supported for non-transparency. The mechanism "models hold their own definition of a term" is not studied.
- **Evidence**: The average transparency score of foundation-model developers fell from 58 in 2024 to 40 in 2025. Training data, training compute, and usage and impact after deployment are the most opaque areas [LIT-FMTI-2025].
- **Gaps**: The index does not show that every individual error is untraceable. The published explanations for wrong answers are training and evaluation incentives (E-2) and preference tuning (E-3), not model-specific definitions.
- **Consequence for this skill**: Source checks apply regardless of how open a model provider is. Knowing how an answer arose does not show that it matches a standard, its current edition, or the applicable context.
- **Re-evaluate when**: a new edition of the transparency index is published.
- **Used by**: Rule 5, Rule 9.
