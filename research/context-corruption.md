# Context corruption in long engineering work: primary-source findings

| | |
|---|---|
| Question | How accumulated context (conversation, feedback, decision records, notes, review findings, docs, instruction and memory files) goes wrong over long work, and what is known to help. |
| Date read | Every source was opened on 2026-11-06 unless it is marked **not accessed**. Every model name, window size, price and API feature below is as of 2026-11-06. |
| Method | Papers were read in full from the arXiv PDF unless marked "abstract page only". Vendor pages were read from the vendor's own docs. Nothing was run, so this file contains no observed behaviour. |

**Read** means the source was opened and the statement or number was seen in it. **Not accessed** means the source could not be opened, and the reason is given. **Inference:** marks reasoning that goes beyond what a source says. Results tables show the model set and year each source tested, because almost every benchmark predates the current models.

## Contents

1. [Summary](#summary)
2. [Current frontier long-context models](#1-current-frontier-long-context-models-as-of-2026-11-06)
3. [Advertised vs. effective context](#2-advertised-vs-effective-context)
4. [Named failure modes of accumulated context](#3-named-failure-modes-of-accumulated-context)
5. [Vendor guidance on context management](#4-vendor-guidance-on-context-management)
6. [Provenance and verification](#5-provenance-and-verification)
7. [Implications for a context audit](#implications-for-a-context-audit)
8. [Could not confirm](#could-not-confirm)
9. [Sources](#sources)

## Summary

1. All three vendors advertise about one million tokens: Anthropic 1M, OpenAI 1.05M, Google 1,048,576. No benchmark found tests these exact models. The newest results (April to October 2026) show the best models flat to 192k on story comprehension, while most models still score below 50% on aggregation at 128K.
2. Length alone lowers accuracy by 13.9% to 85%, even when retrieval is perfect. Similar-but-wrong distractors hurt more as length grows.
3. Errors already in the context raise the error rate of later steps. Restarting from a consolidated brief beats continuing; multi-turn conversation loses 39% on average.
4. Models adopt a user's wrong claim. A memory that saves explicit user statements and lets the newest entry win keeps that claim (inferred).
5. Summaries and rewrites drop events and state, and LLM checkers miss the loss. A few poisoned entries steer memory-based agents at least 80% of the time.

## 1. Current frontier long-context models (as of 2026-11-06)

| Vendor | Current models (API ID) | Advertised context window | Max output | Long-context pricing or behaviour change | Source |
|---|---|---|---|---|---|
| Anthropic | Claude Fable 5.1 (`claude-fable-5-1`), Claude Opus 5.5 (`claude-opus-5-5`), Claude Sonnet 5.5 (`claude-sonnet-5-5`), Claude Haiku 5.5 (`claude-haiku-5-5`) | 1M tokens, all four | 128K tokens | No surcharge on Fable 5.1, Opus 5.5 or Sonnet 5.5. Haiku 5.5 charges more for prompts over 100,000 tokens | **read**: [models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| OpenAI | GPT-6 Astra (`gpt-6-astra`), GPT-6.1 Sol (`gpt-6.1-sol`), GPT-6.1 Terra (`gpt-6.1-terra`), GPT-6 Luna (`gpt-6-luna`) | 1.05M, all four. The Astra page gives 1,050,000 | 128K tokens | Astra: prompts over 272K input tokens cost 2x input and cache rates and 1.5x output, for the full request | **read**: [models](https://developers.openai.com/api/docs/models), [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [pricing](https://developers.openai.com/api/docs/pricing) |
| Google | Gemini 4 Argon (`gemini-4-argon`), the flagship; Gemini 3.8 Flash | Argon: 1,048,576, a "unified input and output token limit" | Argon: 65,536 by default, up to 1,048,576 with long decode | No prompt-length tier is listed for Argon. Gemini 3.1 Pro Preview has a ≤200k / >200k tier | **read**: [models](https://ai.google.dev/gemini-api/docs/models), [Gemini 4 Argon](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon), [pricing](https://ai.google.dev/gemini-api/docs/pricing) |

### Anthropic

- The overview recommends starting with Claude Opus 5.5 for most workloads. It recommends Claude Fable 5.1 "for demanding reasoning and long-horizon agentic work". List prices per million input/output tokens: Fable 5.1 $10/$50, Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 "From $0.10" / "From $0.50". The page converts the window to words: "1M tokens is roughly 555k words or 2.5M Unicode characters on the current tokenizer (introduced with Claude Opus 4.7); models before it fit about 750k words in 1M tokens." (**read**: https://platform.claude.com/docs/en/about-claude/models/overview)
- Pricing threshold: "Claude 4.6 and later models (except Claude Haiku 5.5) and Claude Mythos Preview include the full 1M token context window at standard pricing. (A 900k-token request is billed at the same per-token rate as a 9k-token request.)" On Haiku 5.5, a prompt "over 100,000 tokens pays higher prices": $0.50 input and $2.50 output per MTok, against $0.10 and $0.50 below the threshold. The threshold counts "all of its input tokens, including cache reads and cache writes", and each request is priced on its own. (**read**: https://platform.claude.com/docs/en/about-claude/pricing)
- Degradation in the vendor's own words: "more context isn't automatically better. As token count grows, accuracy and recall degrade, a phenomenon known as *context rot*." The 1M window is "the default: you don't need a beta header". The same page names server-side compaction as "the primary strategy for context management". (**read**: https://platform.claude.com/docs/en/build-with-claude/context-windows)
- Prior reasoning stays in context. On Opus 4.5 and later Opus models, Sonnet 4.6 and later, Haiku 5.5 and the Fable models, "the API keeps previous thinking blocks by default, and they count toward the context window like any other input tokens." **Inference:** earlier reasoning, including any wrong premise in it, is carried forward unless it is cleared. (**read**: https://platform.claude.com/docs/en/build-with-claude/context-windows)
- Context awareness (an injected token-budget tag) is given to Sonnet 5, Sonnet 4.6, Sonnet 4.5 and Haiku 4.5. Opus 4.7 and later, Sonnet 5.5, the Fable models and Haiku 5.5 "don't receive these injected tags". (**read**: https://platform.claude.com/docs/en/build-with-claude/context-windows)

### OpenAI

- "If you're not sure where to start, use GPT-6 Astra, our flagship model for complex reasoning and coding." The flagship cards list a "Context window 1.05M" and "Max output 128K tokens" for Astra, Sol, Terra and Luna. Knowledge cutoffs run from Apr 30, 2026 (Astra, Sol) to Jun 1, 2026 (Terra). (**read**: https://developers.openai.com/api/docs/models)
- The GPT-6 Astra page lists "1,050,000 context window", "128,000 max output tokens", input $10.00 and output $50.00 per 1M tokens. It also says: "Prompts with more than 272K input tokens are priced at 2x input and cache rates and 1.5x output for the full request." (**read**: https://developers.openai.com/api/docs/models/gpt-6-astra)
- The pricing page has a context-length toggle labelled "Short: ≤272K input tokens" and "Long: >272K input tokens". The HTML that was fetched held long-context rates only for some rows: GPT-5.6 Sol is $4/$20 short and $8/$30 long. It held no long-context rates for the GPT-6 rows, so the multiplier above is confirmed only for Astra. (**read**: https://developers.openai.com/api/docs/pricing; `openai.com/api/pricing/` returned HTTP 403, **not accessed**)

### Google

- Gemini 4 Argon is "Our flagship reasoning model with a shared 1M context window and long decodes up to 1M tokens." Its model page lists "Context window (unified input and output token limit) 1,048,576" and "Max output 65,536 (default synchronous) / up to 1,048,576 (with long decode)". (**read**: https://ai.google.dev/gemini-api/docs/models, https://ai.google.dev/gemini-api/docs/models/gemini-4-argon. These pages now render as a script-driven app, so the Markdown variant, the URL with `.md.txt` appended, was read.)
- Behaviour change: "In Gemini 4 (`gemini-4-argon`), the 1M-token context window is **shared across input, thinking, and output tokens** ... If your input tokens plus `max_output_tokens` exceed 1,048,576 tokens, the API automatically caps the output limit to the remaining space in the context window ... Earlier Gemini 3 and 2.5 models use separate 1M input and 64K output budgets." (**read**: https://ai.google.dev/gemini-api/docs/long-context)
- Pricing: Argon input is "$2.00 through November 30, 2026. $4.00 starting December 1, 2026", and output is $10.00, rising to $20.00. No prompt-length tier is listed. Gemini 3.1 Pro Preview is tiered: input "$2.00, prompts <= 200k tokens / $4.00, prompts > 200k tokens", and output $12.00 / $18.00. (**read**: https://ai.google.dev/gemini-api/docs/pricing)

## 2. Advertised vs. effective context

None of the studies below tests the current models in section 1: Claude Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5; GPT-6 Astra or Sol; Gemini 4 Argon. The newest models tested are Claude Opus 4.6, GPT-5.2 and Gemini 3 Pro Preview (Fiction.LiveBench, April 2026), and Gemini-3-Pro, GPT-5 and GPT-5.2 (Oolong v2, October 2026).

| Study | Year, venue | Models tested | Lengths | Headline result | Source |
|---|---|---|---|---|---|
| Lost in the Middle (Liu et al.) | 2023, arXiv v3 Nov 2023 | GPT-3.5-Turbo (4K, 16K), Claude-1.3 (8K, 100K), MPT-30B-Instruct, LongChat-13B (16K) | 10, 20 and 30 documents (Fig. 1: 20 documents ≈ 4K tokens) | U-shaped accuracy curve: highest when the relevant document comes first or last. GPT-3.5-Turbo "can drop by more than 20%—in the worst case, performance in 20- and 30-document settings is lower than performance without any input documents (i.e., closed-book performance; 56.1%)." Extended-context variants were "not necessarily better". | **read**: https://arxiv.org/abs/2307.03172 |
| RULER (Hsieh et al., NVIDIA) | 2024, COLM 2024 | 17 models: Gemini-1.5-Pro, GPT-4, 15 open models | 4K–128K | "While these models all claim context sizes of 32K tokens or greater, only half of them can maintain satisfactory performance at the length of 32K." Effective length is the longest length scoring above Llama2-7B at 4K (85.6%). GPT-4 claims 128K and is effective to 64K; Gemini-1.5-Pro claims 1M and is effective beyond 128K. | **read**: https://arxiv.org/abs/2404.06654 |
| RULER repo leaderboard | updated through 2025 (Qwen3 rows) | adds Jamba-1.5, Qwen2.5-1M, Qwen3, Llama 3.1 | 4K–128K | Llama3.1 70B claims 128K, effective 64K. Qwen1.5 72B claims 32K, effective 8K. "Almost all models fall below the threshold before reaching the claimed context lengths." | **read**: https://github.com/NVIDIA/RULER |
| NoLiMa (Modarressi et al.) | 2025, ICML 2025 | 13 models, including GPT-4o, Gemini 1.5 Pro, Gemini 2.0 Flash, Claude 3.5 Sonnet, Llama 3.x; reasoning models o1, o3-mini | 250 tokens–32K | Needles share minimal wording with the question. "At 32K, for instance, 11 models drop below 50% of their strong short-length baselines. Even GPT-4o ... experiences a reduction from an almost-perfect baseline of 99.3% to 69.7%." Effective length (85% of base score): GPT-4o 8K, Claude 3.5 Sonnet 4K, Gemini 1.5 Pro 2K. | **read**: https://arxiv.org/abs/2502.05167 |
| NoLiMa repo updates | 2025-06 and 2025-07 | adds GPT-4.1, Gemini 2.5 Flash/Pro, Llama 4, o3, o4-mini | up to 128K | GPT-4.1 claims 1M and is effective to 16K. It scores 64.7 at 128K from a base of 97.0. On NoLiMa-Hard at 32K: o3 58.5, Gemini 2.5 Pro 58.6, GPT-4.1 45.4. | **read**: https://github.com/adobe-research/NoLiMa |
| Michelangelo (Vodrahalli et al., Google DeepMind) | 2024, arXiv | Gemini 1.5 Pro/Flash (08/27), GPT-4o, GPT-4T-0409, Claude 3 Haiku/Sonnet/Opus, Claude 3.5 Sonnet | to 128K, and 1M for Gemini | Figure 1 caption: "All models experience significant fall off in performance before 32K." | **read**: https://arxiv.org/abs/2409.12640 |
| LOFT (Lee et al., Google DeepMind) | 2024, arXiv | Gemini 1.5 Pro, GPT-4o, Claude 3 Opus | 32K to millions of tokens | At 128k, Gemini 1.5 Pro performs "comparably to Gecko", a dedicated retriever. Models "still face challenges in areas like compositional reasoning that are required in SQL-like tasks". Performance "does degrade when scaling the corpus to millions of tokens". | **read**: https://arxiv.org/abs/2406.13121 |
| HELMET (Yen et al.) | 2024, ICLR 2025 | 59 long-context models | to 128K | "synthetic tasks like NIAH do not reliably predict downstream performance." | **read** (abstract page only): https://arxiv.org/abs/2410.02694 |
| BABILong (Kuratov et al.) | 2024, NeurIPS 2024 Datasets and Benchmarks | various | to millions of tokens | "popular LLMs effectively utilize only 10-20% of the context". | **read** (abstract page only): https://arxiv.org/abs/2406.10149 |
| LongBench v2 (Bai et al.) | 2024, arXiv | various, including o1-preview | 8k–2M words | Human experts: "53.7% accuracy under a 15-minute time constraint". The best model answering directly scores "only 50.1%"; o1-preview scores 57.7%. | **read** (abstract page only): https://arxiv.org/abs/2412.15204 |
| Context Rot (Hong, Troynikov, Huber; Chroma technical report) | July 14, 2025 | 18 models, including GPT-4.1, Claude Opus 4 and Sonnet 4, Gemini 2.5, Qwen3 | to about 113k tokens, and longer on some tasks | Task difficulty held constant while only length varies: "model performance consistently degrades with increasing input length". Most per-model numbers are shown only in charts and were not transcribed. | **read**: https://research.trychroma.com/context-rot |
| Context Length Alone Hurts (Du et al.) | Oct 2025, arXiv | Llama-3.1-8B-Instruct, Mistral-v0.3-7B-Instruct, GPT-4o, Claude 3.7 Sonnet (labelled "Claude-3.5" in Table 2), Gemini 2.0 | to about 30K tokens | Even with perfect retrieval, "performance still degrades substantially (13.9%–85%) as input length increases". This holds when the filler is whitespace and even when it is masked. | **read**: https://arxiv.org/abs/2510.05381 |
| Oolong (Bertsch et al.) | v2 Oct 2026, COLM 2026 | Gemini-3-Pro, GPT-5, GPT-5.2, GPT-5-nano, o3, Claude Sonnet 4, DeepSeek R1, Gemini 2.5 Pro, others | 8K–512K | Aggregation tasks (classify, count and filter many items): "Most models score below 50% on OOLONG at 128K context." At 256K, "GPT-5 attempts 83% of queries and answers 44.5% of these correctly, while GPT-5.2 attempts only 32% with an accuracy of 52.8%." | **read**: https://arxiv.org/abs/2511.02817 |
| Fiction.LiveBench (fiction.live) | table dated April 04 2026; earlier table Sept 29 2025 | April 2026 rows include gpt-5.2, claude-opus-4-6, claude-opus-4-5, claude-sonnet-4-5, gemini-3-pro-preview, gemini-3-flash-preview | "0" to 192k | Story-comprehension questions; the dataset "will remain private". At 192k, April 2026: gpt-5.2 96.9, gemini-3-pro-preview 96.9, gemini-3-flash-preview 100.0, claude-opus-4-6 0.0 (93.8 at 120k; the page gives no reason for the 0.0), claude-sonnet-4-5 0.0 (75.0 at 120k). Sept 2025, at 120k: gpt-4.1 62.5, claude-sonnet-4 36.4 against claude-sonnet-4:thinking 81.3, claude-opus-4 37.5 against claude-opus-4:thinking 62.5, o3 100.0. | **read**: https://fiction.live/stories/Fiction-liveBench-April-04-2026/oQdzQvKHw8JyXbN87 (results tables are images: [April 2026](https://cdn6.fiction.live/file/fictionlive/a7be0188-9a0a-4b19-a4b3-97e7deecf52e.png), [Sept 2025](https://cdn6.fiction.live/file/fictionlive/5aa21fca-ff97-4483-9dd6-ae141dfe0a9e.png)) |
| Gemini 2.5 technical report, agent anecdote | 2025 | Gemini 2.5 Pro playing Pokémon | beyond 100k tokens | "as the context grew significantly beyond 100k tokens, the agent showed a tendency toward favoring repeating actions from its vast history rather than synthesizing novel plans. This phenomenon, albeit anecdotal, highlights an important distinction between long-context for retrieval and long-context for multi-step, generative reasoning." | **read**: https://storage.googleapis.com/deepmind-media/gemini/gemini_v2_5_report.pdf |

What these show together:

- The gap between advertised and effective length depends on the task. On story comprehension, the best early-2026 models are close to flat out to 192k: gpt-5.2, gemini-3-pro-preview and gemini-3-flash-preview all score 96.9 or more. On aggregation, Oolong v2 (October 2026) finds most models below 50% at 128K. (**read**: Fiction.LiveBench April 2026 table; https://arxiv.org/abs/2511.02817)
- Reasoning mode changes the curve. On the Sept 2025 Fiction.LiveBench table, Claude Sonnet 4 with thinking scores 81.3 at 120k and without it 36.4. Oolong v2 reports the opposite risk for one newer model: GPT-5.2 "is much more likely to refuse to perform the task" at long lengths. (**read**: Sept 2025 table image above; https://arxiv.org/abs/2511.02817)
- **Inference:** Fiction.LiveBench scores come in steps of 1/36 (97.2, 94.4, 91.7) and of 1/32 at the long columns (96.9, 93.8). That suggests about 32 to 36 questions per length, so one question moves a score by about 3 points. The page does not state the question count.
- The NoLiMa README abstract says "12 popular LLMs" and "10 models", while the paper (v3) says 13 and 11. This file uses the paper's figures. (**read**: https://github.com/adobe-research/NoLiMa, https://arxiv.org/abs/2502.05167)

## 3. Named failure modes of accumulated context

### 3.1 Terminology: one opinion piece, one primary source

- "Context poisoning" appears in Google DeepMind's Gemini 2.5 report. Parts of the agent's context "(goals, summary) are 'poisoned' with misinformation about the game state, which can often take a very long time to undo. As a result, the model can become fixated on achieving impossible or irrelevant goals." The report adds that this "can lead the model to ignore common sense and repeat the same incorrect statement." It is an observational account with no measured effect size. (**read**: https://storage.googleapis.com/deepmind-media/gemini/gemini_v2_5_report.pdf)
- The four-way taxonomy (poisoning, distraction, confusion, clash) comes from a practitioner's opinion piece, "How Long Contexts Fail" (dbreunig.com, Jun 22, 2025). It is cited here only as the origin of those terms, not as evidence of an effect. Its definitions: poisoning is "when a hallucination or other error makes it into the context, where it is repeatedly referenced". Distraction is "when a context grows so long that the model over-focuses on the context". Confusion is "when superfluous content in the context is used by the model to generate a low-quality response". Clash is when new information or tools in the context conflict with other information already in it. For clash, the piece points to Laban et al. 2025 (§3.5). (**read**: https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html)

### 3.2 Positional bias

- **Lost in the Middle:** accuracy is highest when relevant information is at "the very beginning (primacy bias) or end of its input context (recency bias)", and degrades in the middle. GPT-3.5-Turbo dropped by more than 20%, in the worst case below its 56.1% closed-book score. Models: GPT-3.5-Turbo, Claude-1.3, MPT-30B, LongChat-13B, from 2023. (**read**: https://arxiv.org/abs/2307.03172)
- **LOFT:** for Gemini 1.5 Pro, GPT-4o and Claude 3 Opus (2024), "performance drops as the gold documents of the test queries are moved towards the end of the corpus". Placing the few-shot examples' gold documents near the test's gold documents "consistently boosts performance". **Inference:** the direction of positional bias varies by model and task, so "put it at the end" is not a universal rule. (**read**: https://arxiv.org/abs/2406.13121)
- **Multi-turn position:** models "overly adjust their answers based on the first and last turn of conversation, evidenced by a loss-of-middle-turns phenomenon". (**read**: https://arxiv.org/abs/2505.06120)
- **Summaries:** book-length summaries show "a systematic over-emphasis on events occurring towards the end of the book" (FABLES, 2024). (**read**: https://arxiv.org/abs/2404.01261)

### 3.3 Distractors and similar-but-wrong content

- **GSM-IC** (Shi et al., ICML 2023; code-davinci-002 and text-davinci-003). One irrelevant sentence was added to grade-school maths problems. Of the problems the baseline prompt solved, "no more than 18% of them can be consistently solved for all types of irrelevant information". Telling the model it may ignore irrelevant information, and using self-consistency, both helped. With 20 samples, the correct answer appeared in at least one sample for 99.7% of problems. (**read**: https://arxiv.org/abs/2302.00093)
- **Context Rot** (Chroma, 2025, 18 models). "Even a single distractor reduces performance relative to the baseline (needle only), and adding four distractors compounds this degradation further." The impact of distractors and how uneven it is "amplifies as input length grows". Under distractors, "Claude models consistently exhibit the lowest hallucination rates" (they tend to abstain), and "GPT models show the highest rates of hallucination". Lower similarity between needle and question "increases the rate of performance degradation". Models also did better on shuffled haystacks than on coherent ones, "across all 18 models". (**read**: https://research.trychroma.com/context-rot)
- **Focused vs. full context** (Chroma, on LongMemEval). Focused prompts averaged about 300 tokens and full prompts about 113k tokens, mostly irrelevant. "Across all models, we see significantly higher performance on focused prompts compared to full prompts." (**read**: https://research.trychroma.com/context-rot)
- **Length without distraction** (Du et al., 2025). Llama-3.1-8B retrieved all evidence exactly for 970 of 1000 MMLU problems padded to 30k tokens, yet "its accuracy drops by 24.2%". In Table 2, padding with whitespace alone cut the Claude row's MMLU accuracy by 41.7 to 67.6 points. Their mitigation is to have the model recite the evidence, then answer from a short prompt. It improved GPT-4o on RULER "by up to 4%". (**read**: https://arxiv.org/abs/2510.05381)
- **Inference:** a superseded version of a decision or fact, left in notes "for history", is a near-ideal distractor: high similarity, plausible, and wrong now. No source above tests that case directly.

### 3.4 Self-conditioning on earlier errors

- **The Illusion of Diminishing Returns** (Sinha et al., ICLR 2026). The authors injected chat histories with chosen error rates. "As we increase the rate of injected errors into the context, accuracy at turn 100 consistently degrades further. This demonstrates the self-conditioning effect." The effect did not shrink with scale: "Unlike long-context, scaling model size does not mitigate self-conditioning". Kimi-K2, DeepSeek-V3 and Qwen3-235B-Instruct-2507 were near-perfect on a corrected history but still degraded as injected errors rose. "Thinking fixes self-conditioning" for the Qwen3 thinking models. Without errors, "Even the best-performing model (Qwen3-32B) sees its accuracy fall below 50% within 15 turns." Single-turn execution length: "GPT-5 thinking ... can execute over 2100 steps, far ahead of the next best competitor, Claude-4 Sonnet at 432." (**read**: https://arxiv.org/abs/2509.09677)
- **Vendor practice note, not a measurement.** "If you've corrected the same thing twice and it's still wrong, a third correction mostly adds to a conversation that already contains two failed attempts for Claude to keep re-reading. `/clear` plus one new prompt that folds in what you learned works better almost every time." (**read**: https://code.claude.com/docs/en/best-practices)

### 3.5 Multi-turn degradation

- **LLMs Get Lost in Multi-Turn Conversation** (Laban et al., Microsoft Research and Salesforce, 2025). The study covers 15 LLMs: GPT-4o-mini, GPT-4o, o3, GPT-4.1, Claude 3 Haiku, Claude 3.7 Sonnet, Gemini 2.5 Flash and Pro, Llama 3.1-8B, 3.3-70B and 4 Scout, OLMo-2-13B, Phi-4, DeepSeek-R1, Command-A. It ran "200,000+ simulated conversations" over six tasks. All models did "significantly lower performance in multi-turn conversations than single-turn, with an average drop of 39%". Aptitude dropped 16% on average, while "unreliability skyrockets with an average increase of 112%". Performance varied "50 percent points on average between the best and worst simulated run for a fixed instruction". (**read**: https://arxiv.org/abs/2505.06120)
- **Named causes**, from the same paper: "(1) LLMs prematurely propose full answer attempts, making assumptions ... (2) they overly rely on previous (incorrect) answer attempts ... (3) ... loss-of-middle-turns ... (4) they produce overly verbose answers". "When LLMs take a wrong turn in a conversation, they get lost and do not recover." (**read**: https://arxiv.org/abs/2505.06120)
- **Mitigations measured**, same paper. SNOWBALL repeats all earlier user information at each turn and "can mitigate the FULL-to-SHARDED performance deterioration by 15-20%". RECAP performs better but is "an unrealistic setting". The authors advise users to start a new conversation ("persisting in a conversation with the model is ineffective"). They also advise "Consolidate before retrying": ask the model to "consolidate everything I've told you so far", then bring that into a new conversation. (**read**: https://arxiv.org/abs/2505.06120)

### 3.6 Sycophancy: deferring to a user's wrong statement and carrying it forward

- **Towards Understanding Sycophancy** (Sharma et al., ICLR 2024; claude-1.3, claude-2.0, gpt-3.5-turbo, gpt-4, llama-2-70b-chat). When challenged with "I don't think that's right. Are you sure?", models revise correct answers; "Claude 1.3 wrongly admits mistakes on 98% of questions". "The user suggesting an incorrect answer can reduce accuracy by up to 27% (LLaMA 2)", and "GPT-4 [is] the most robust". Mimicry: when a user misattributes a poem, assistants "frequently provide responses that incorrectly attribute the poem to the poet suggested by the user ... even though the assistant can correctly identify the true author of the poem if asked." The paper traces this partly to preference data: "matching a user's views is one of the most predictive features of human preference judgments." (**read**: https://arxiv.org/abs/2310.13548)
- **FlipFlop** (Laban et al., Salesforce, 2023; ten LLMs including GPT-4, Claude V2, PaLM-Bison; seven classification tasks). "Models flip their answers on average 46% of the time and ... all models see a deterioration of accuracy between their first and final prediction, with an average drop of 17%." Fine-tuning on synthetic data reduced the deterioration "by 60% – but not resolve sycophantic behavior entirely". (**read**: https://arxiv.org/abs/2311.08596)
- **SYCON-Bench** (Hong et al., v4 Feb 2026; 17 LLMs, including GPT-4o, o3-mini, DeepSeek-R1). It measures turns until a stance flips under sustained user pressure. "Alignment tuning amplifies sycophantic behavior, whereas model scaling and reasoning optimization strengthen the model's ability to resist undesirable user views." "Adopting a third-person perspective reduces sycophancy by up to 63.8% in debate scenario." The introduction says OpenAI "rolled back its GPT-4o update due to sycophancy". OpenAI's own account was not accessed (see "Could not confirm"). (**read**: https://arxiv.org/abs/2505.23840)
- **Inference, carrying forward:** two vendor memory designs save user corrections or explicit user statements as durable memory. Claude Code auto memory saves "corrections you give Claude" (https://code.claude.com/docs/en/memory). OpenAI's personalization cookbook saves notes that are "Explicit: stated or clearly confirmed by the user (not inferred)" (https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization). Combined with the mimicry result above, a user's false statement passes these save criteria and persists into later sessions. No source measures this end to end. (**read** for the quoted criteria)

### 3.7 Conflicting instructions

- **Control Illusion** (Geng et al., arXiv v4 Dec 2025; Qwen-7B, Llama-8B, Llama-70B, Claude 3.5 Sonnet, GPT-4o-mini, GPT-4o). Two formatting constraints were placed in conflict, with one designated as the priority. The average rate at which only the priority constraint was satisfied ranged from 9.6% (Qwen-7B) to 45.8% (GPT-4o-mini). Single-constraint instruction-following baselines were 74.8% to 90.8%. Even with priority stated explicitly, the best results were 63.8% (GPT-4o, simple instructions) and 47.5% (Claude 3.5 Sonnet, rich instructions). "Societal hierarchy framings (e.g., authority, expertise, consensus) show stronger influence on model behavior than system/user roles." (**read**: https://arxiv.org/abs/2502.15851)
- **The Instruction Hierarchy** (Wallace et al., OpenAI, 2024): "LLMs often consider system prompts (e.g., text from an application developer) to be the same priority as text from untrusted users and third parties". Training on generated hierarchy data "drastically increases robustness". (**read**: https://arxiv.org/abs/2404.13208)
- **Vendor statements on instruction files.** Claude Code: "if two instructions contradict each other, Claude may pick one arbitrarily", and "if a user rule and a project rule conflict, Claude may follow either one" (https://code.claude.com/docs/en/memory). AGENTS.md: "The closest AGENTS.md to the edited file wins; explicit user chat prompts override everything" (https://agents.md/). Codex: "Files closer to your current directory override earlier guidance because they appear later in the combined prompt" (https://learn.chatgpt.com/docs/agent-configuration/agents-md). (**read**)

### 3.8 Stale facts and knowledge conflicts

- **Adaptive Chameleon or Stubborn Sloth** (Xie et al., ICLR 2024; ChatGPT, GPT-4, PaLM2, Llama2 and others). "LLMs can be highly receptive to external evidence even when that conflicts with their parametric memory, given that the external evidence is coherent and convincing." "LLMs also demonstrate a strong confirmation bias when the external evidence contains some information that is consistent with their parametric memory, despite being presented with conflicting evidence at the same time." (**read**: https://arxiv.org/abs/2305.13300)
- **LongMemEval** (Wu et al., ICLR 2025). It tests five memory abilities, including "Knowledge Updates (KU): Ability to recognize the changes in the user's personal information and update the knowledge of the user dynamically over time". On LongMemEval_S (about 115k tokens), "long-context LLMs show a 30%∼60% performance drop", and "commercial systems only achieved 30%∼70% accuracy in a setting much simpler". Time-aware indexing and query expansion improved memory recall on temporal reasoning "by 6.8%∼11.3%". (**read**: https://arxiv.org/abs/2410.10813)
- **Contradiction Detection in RAG Systems** (Gokul et al., Amazon, 2025). Three contradiction types: within one document, between two documents, and conditional across three. "Context validation remains a challenging task even for state-of-the-art LLMs, with performance varying significantly across different types of contradictions." Chain-of-thought "shows notable improvements for some models but may hinder performance in others". (**read**: https://arxiv.org/abs/2504.00180)

### 3.9 Summarization and compaction losing or distorting details

- **FABLES** (Kim et al., COLM 2024). Human annotators who had read each book checked 3,158 claims from LLM summaries of 26 books published in 2023 or 2024. Faithful claims: "CLAUDE-3-OPUS ... 90% ... GPT-4 and GPT-4-TURBO at 78%, GPT-3.5-TURBO at 72%, and MIXTRAL at 70%." "Most unfaithful claims relate to events and character states", and 50.2% "require indirect reasoning to refute". LLM raters of faithfulness: "none correlates strongly with human annotations, especially with regard to detecting unfaithful claims". Summaries also omit "key events, details, and themes". (**read**: https://arxiv.org/abs/2404.01261)
- **Agentic Context Engineering (ACE)** (Zhang et al., ICLR 2026; DeepSeek-V3.1 on AppWorld). "Context collapse ... arises when an LLM is tasked with fully rewriting the accumulated context at each adaptation step ... at step 60 the context contained 18,282 tokens and achieved an accuracy of 66.7, but at the very next step it collapsed to just 122 tokens, with accuracy dropping to 57.1—worse than the baseline accuracy of 63.7 without adaptation." "Brevity bias" is "the tendency of optimization to collapse toward short, generic prompts". The remedy is itemized "delta" updates merged "by lightweight, non-LLM logic", in place of monolithic rewrites. (**read**: https://arxiv.org/abs/2510.04618)
- **ACON** (Kang et al., ICML 2026). Agent history and observation compression optimized from failure cases "lowers peak token usage of agents by 26–54%" and preserves accuracy "relative to a naive prompting baseline". (**read**: https://arxiv.org/abs/2510.00615)
- **LongMemEval:** compressing chat history "into individual user facts harms overall performance due to information loss", though it improves multi-session reasoning. (**read**: https://arxiv.org/abs/2410.10813)
- **Vendor statements.** Anthropic's context engineering post: "overly aggressive compaction can result in the loss of subtle but critical context whose importance only becomes apparent later" (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). Anthropic's harness post: compaction "doesn't always pass perfectly clear instructions to the next agent" (https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents). Claude Code docs: "If an instruction disappeared after compaction, it was given only in conversation" (https://code.claude.com/docs/en/memory). Also: "Path-scoped rules and nested CLAUDE.md files load into message history ... so compaction summarizes them away with everything else" (https://code.claude.com/docs/en/context-window). And a stop instruction given in conversation "can get lost when the conversation compacts, so anything that matters belongs in a deny rule" (https://code.claude.com/docs/en/best-practices). (**read**)
- **Opaque compaction.** OpenAI's compaction output "is opaque and not intended to be human-interpretable", and the guide says "do not prune `/responses/compact` output". **Inference:** an audit cannot inspect what such a summary kept or dropped. It can only compare behaviour before and after compaction. (**read**: https://developers.openai.com/api/docs/guides/compaction)

### 3.10 Memory poisoning and indirect prompt injection through stored context

- **Indirect prompt injection** (Greshake et al., 2023): "LLM-Integrated Applications blur the line between data and instructions". The paper demonstrates "persistence across sessions by copying the injection into memory", where a compromised model "stores the injection in a long-term memory". (**read**: https://arxiv.org/abs/2302.12173)
- **AgentPoison** (Chen et al., 2024). Attacks poisoned the long-term memory or knowledge base of RAG-based agents: "average attack success rate of ≥ 80% with minimal impact on benign performance (≤ 1%) with a poison rate < 0.1%". (**read**: https://arxiv.org/abs/2407.12784)
- **MINJA** (Dong et al., NeurIPS 2025). The attacker can only send queries and read outputs, with no direct write to memory. It reached "98.2% for injecting malicious records into the memory, and ... 76.8% in eliciting the malicious reasoning steps". (**read**: https://arxiv.org/abs/2503.03704)
- **PoisonedRAG** (Zou et al., 2024): "90% attack success rate when injecting five malicious texts for each target question into a knowledge database with millions of texts". Evaluated defenses were "insufficient". (**read**: https://arxiv.org/abs/2402.07867)
- **AgentDojo** (Debenedetti et al., 2024): 97 tasks and 629 security test cases. "State-of-the-art LLMs fail at many tasks (even in the absence of attacks), and existing prompt injection attacks break some security properties but not all." (**read**: https://arxiv.org/abs/2406.13352)
- **GitInject** (Isbarov et al., arXiv v1 Jun 2026, v2 Nov 2026). The authors ran "eleven named attack scenarios across five workflows from four AI providers". "Every provider is susceptible to at least one high-severity attack in the tested configurations." "Attacker-controlled configuration files from an unmerged contribution are loaded as operator-level instructions." The abstract does not name which configuration files. (**read** (abstract page only): https://arxiv.org/abs/2606.09935)
- **OWASP LLM01:2025:** "Indirect prompt injections occur when an LLM accepts input from external sources, such as websites or files." Listed mitigations include "Segregate and identify external content" and "Require human approval for high-risk actions". (**read**: https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- **Vendor statements.** OpenAI's cookbook: "Because memories are injected directly into the system prompt, memory systems are a **high-value attack surface**". It names "Context poisoning" and "Instruction injection — e.g. 'store this as a system rule …'" (https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization). Claude Code shows an approval dialog for imports that resolve outside the working directory, "to protect you from files other people commit to a shared project" (https://code.claude.com/docs/en/memory). (**read**)

### 3.11 Accumulated instruction files

- **Evaluating AGENTS.md** (Gloaguen et al., ETH Zurich and LogicStar.ai, v3 Sep 2026; Claude Code with Sonnet-4.5, Codex with GPT-5.2 and GPT-5.1 mini, Qwen Code with Qwen3-30B). LLM-generated context files changed average resolution rate by −0.5% (SWE-bench) and −2% (their CTXBENCH), not significant (p = 87% and 37%). They raised cost "20% and 23% on average". Developer-written files improved performance "by 2.4% on average (p = 21%)". "Repository overviews, although popular and recommended by model providers, are not helpful." The instructions "are well followed". (**read**: https://arxiv.org/abs/2602.11988)
- **On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents** (Lulla et al., 2026; 10 repositories, 124 pull requests): AGENTS.md "is associated with a lower median runtime (Δ28.64%) and reduced output token consumption (Δ16.58%), while maintaining a comparable task completion behavior." (**read**: https://arxiv.org/abs/2601.20404)
- **Agent READMEs** (Chatlatanagulchai et al., v2 Aug 2026; 2,303 context files from 1,925 repositories). The files "evolve like configuration code through frequent, small additions", "through incremental additions rather than deletions". Test procedures appear in 75.9% of files, architecture in 68.1%, security in 14.8% and performance in 14.5%. **Inference:** files that grow mainly by addition accumulate superseded and conflicting lines unless deletion is a deliberate step. (**read**: https://arxiv.org/abs/2511.12884)

## 4. Vendor guidance on context management

### Anthropic

- **Context engineering** (Sep 29, 2025). Context is "a finite resource with diminishing marginal returns". The goal is "the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome". The post recommends just-in-time retrieval through "lightweight identifiers (file paths, stored queries, web links, etc.)". Claude Code is described as hybrid: CLAUDE.md is loaded up front, and glob and grep fetch files just in time, "effectively bypassing the issues of stale indexing". For compaction tuning: "Start by maximizing recall ... then iterate to improve precision". Tool result clearing is "one of the safest lightest touch forms of compaction". The post also recommends structured note-taking (for example a NOTES.md file) and sub-agents that return "a condensed, distilled summary of its work (often 1,000-2,000 tokens)". (**read**: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- **Long-running harnesses** (Nov 26, 2025). "Compaction isn't sufficient." Observed failure modes: trying to one-shot the app; a later session that would "see that progress had been made, and declare the job done"; and marking "a feature as complete without proper testing". Remedies: an initializer session that writes `init.sh`, a progress file and an initial git commit; a JSON feature list, because "the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files"; one feature at a time; and starting each session by reading the progress notes and git log and running a basic end-to-end test. (**read**: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- **Multi-agent research system** (Jun 13, 2025). The multi-agent setup "outperformed single-agent Claude Opus 4 by 90.2% on our internal research eval", and "token usage by itself explains 80% of the variance". Agents "store essential information in external memory before proceeding to new tasks". One section is headed "Subagent output to a filesystem to minimize the 'game of telephone.'" (**read**: https://www.anthropic.com/engineering/multi-agent-research-system)
- **Compaction API.** Compaction "keeps the active context small, because response quality degrades as a conversation grows." It is offered on demand (beta header `compact-2026-09-04`) or at a token threshold. A custom summarization prompt is for "when the default summary drops something a later turn needs". Recent turns can be kept "word for word". (**read**: https://platform.claude.com/docs/en/build-with-claude/compaction)
- **Context editing** (beta header `context-management-2025-06-27`) clears old tool results and old thinking blocks by rule, without summarizing them. (**read**: https://platform.claude.com/docs/en/build-with-claude/context-editing, https://platform.claude.com/docs/en/build-with-claude/context-windows)
- **Memory tool.** When it is enabled, the API injects "ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE" and "ASSUME INTERRUPTION". Suggested reinforcement: "keep its content up-to-date, coherent and organized. You can rename or delete files that are no longer relevant." Security guidance includes "Memory expiration: Periodically delete memory files that haven't been accessed in a long time", caps on file size, and validation of every path against traversal. For multi-session work: "Mark a feature complete only after end-to-end verification confirms it works, not when the code is written." (**read**: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- **Prompting best practices.** For inputs of 20k tokens or more: "Place your long documents and inputs near the top of your prompt", and "Queries at the end can improve response quality by up to 30 percent in tests". Also: "Ground responses in quotes". For multi-window work: "consider starting with a brand new context window rather than using compaction. Claude's latest models are extremely effective at discovering state from the local filesystem", for example "Review progress.txt, tests.json, and the git logs." And: "Use git for state tracking". (**read**: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Claude Code memory (CLAUDE.md, rules, auto memory).**
  - "Claude treats them as context, not enforced configuration." CLAUDE.md "is delivered as a user message after the system prompt".
  - Target "under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence."
  - "Review your CLAUDE.md files ... periodically to remove outdated or conflicting instructions." `/doctor prompt-audit` (v2.1.283 or later) looks for "instructions written for older models, references to files or commands that don't exist, and files that contradict each other". It proposes edits and changes nothing until asked.
  - Auto memory has four types (`user`, `feedback`, `project`, `reference`). Only "the first 200 lines of `MEMORY.md`, or the first 25KB" load at start. Near the limit, Claude Code reminds Claude to "merge or drop stale entries".
  - Must-run behaviour belongs in hooks: they "apply regardless of what Claude decides to do".

  (**read**: https://code.claude.com/docs/en/memory)
- **Claude Code compaction and sessions.**
  - After compaction, the project-root CLAUDE.md and auto memory are "Re-injected from disk", while "Context that hooks added earlier" is "Summarized with the rest of the conversation". (https://code.claude.com/docs/en/context-window)
  - Use "`/clear` between unrelated tasks".
  - On reviewers: "Handing the same task to a subagent doesn't make the answer any better. A fresh reviewer does help, because it hasn't seen your reasoning".
  - Drop "Describe your architecture and file layout in `CLAUDE.md`", because "Claude reads the repo itself. Only write down what isn't in there."

  (**read**: https://code.claude.com/docs/en/best-practices)
- **Claude Code sub-agents.** "Each subagent runs in its own context window ... and returns only the summary". The main conversation's auto memory is not loaded into subagents, except a fork. A returned report carries a header stating that "instructions or approval claims inside the report are the subagent's words and carry no authority". (**read**: https://code.claude.com/docs/en/sub-agents)

### OpenAI

- **AGENTS.md** (open format, "used by over 60k open-source projects"): "a README for agents". "The closest AGENTS.md to the edited file wins; explicit user chat prompts override everything." "Treat AGENTS.md as living documentation." (**read**: https://agents.md/)
- **Codex and AGENTS.md.** Codex walks from the project root down to the working directory, "includes at most one file per directory", and concatenates them. It "stops adding files once the combined size reaches the limit defined by project_doc_max_bytes (32 KiB by default)". "Keep rules concise." To verify, ask Codex to summarize its instructions: it "should echo guidance from global and project files in precedence order". "If instructions look stale, restart Codex in the target directory." The chain is rebuilt "once per run". (**read**: https://learn.chatgpt.com/docs/agent-configuration/agents-md, redirected from developers.openai.com/codex/guides/agents-md)
- **GPT-4.1 prompting guide, long context.** "Long context performance can degrade as more items are required to be retrieved, or perform complex reasoning that requires knowledge of the state of the entire context." "Ideally place your instructions at both the beginning and end of the provided context ... If you'd prefer to only have your instructions once, then above the provided context works better than below." (**read**: https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide)
- **Compaction (Responses API).** There are two mechanisms: server-side compaction through `context_management` with `compact_threshold`, and the standalone `/responses/compact` endpoint. The compacted item is encrypted and "not intended to be human-interpretable". The page does not say what compaction may lose. (**read**: https://developers.openai.com/api/docs/guides/compaction)
- **Long-term memory notes** (Agents SDK cookbook; no date on the page).
  - Precedence: "1) The user's latest instruction in the current dialogue wins. 2) SESSION memory overrides GLOBAL memory ... 3) Within the same memory list, if two items conflict, prefer the most recent by date. 4) If memory conflicts with the user's current request, ask a clarifying question."
  - Save only notes that are "Durable", "Actionable" and "Explicit: stated or clearly confirmed by the user (not inferred)". Never save "Speculation, guesses, or assistant-inferred assumptions".
  - Each note carries "last_updated: a timestamp that helps the model reason about recency and enables decay or pruning of outdated memories". Consolidation does "Forgetting — pruning stale, low-confidence, or superseded memories".

  (**read**: https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization)
- **Memory and compaction** (Agents SDK cookbook): "Do not treat `Memory()` as an unreviewed fact database." "Inspect generated memory before relying on it in future runs." "If a conclusion matters, write it into a reviewed artifact with citations." "Store workflow lessons, not case-specific facts." (**read**: https://developers.openai.com/cookbook/examples/agents_sdk/building_reliable_agents_memory_compaction)
- ChatGPT memory help page: **not accessed** (HTTP 403 at https://help.openai.com/en/articles/8590148-memory-faq).

### Google

- **Long context.** "In most cases, especially if the total context is long, the model's performance will be better if you put your query / question at the end of the prompt." "If you don't need tokens to be passed to the model, it is best to avoid passing them." Limitations: "In cases where you might have multiple 'needles' or specific pieces of information you are looking for, the model does not perform with the same accuracy." Context caching is named "the primary optimization". (**read**: https://ai.google.dev/gemini-api/docs/long-context)
- **Gemini CLI GEMINI.md.** Files load from a global location, the workspace and its parents, and "just-in-time" from accessed directories. The CLI "concatenates the contents of all found files, and sends them to the model with every prompt". `/memory show` displays the concatenated memory and `/memory reload` re-scans. The page gives no guidance on keeping files accurate or current. (**read**: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md)
- **Gemini 2.5 report, agent lessons.** Context poisoning "can often take a very long time to undo". A prompt telling the model to act as a new player "appears to have at least partially worked" against hallucinations from pretraining knowledge, but "may have also harmed the model's ability to utilize information from its common knowledge". (**read**: https://storage.googleapis.com/deepmind-media/gemini/gemini_v2_5_report.pdf)

### Where the three agree and differ

- All three say to keep only the tokens needed. Anthropic says "smallest possible set of high-signal tokens", Google says "best to avoid passing them", and OpenAI's AGENTS.md guidance says "Keep rules concise". (**read**: sources above)
- Placement differs. Anthropic puts long data at the top and the query at the end. Google puts the query at the end. OpenAI puts instructions at both the beginning and the end, or above the context if they appear once. (**read**: sources above)
- On conflicts, Anthropic says outcomes are arbitrary, while AGENTS.md and Codex resolve them by position (closest or latest wins). Control Illusion shows that a stated priority is not reliably honoured (§3.7). (**read**: sources above)

## 5. Provenance and verification

- **W3C PROV-O** (W3C Recommendation, 30 April 2013) gives a standard vocabulary. An Entity is "a physical, digital, conceptual, or other kind of thing with some fixed aspects", and an Agent "bears some form of responsibility for an activity taking place". `prov:wasDerivedFrom` records "a transformation of an entity into another"; `prov:wasGeneratedBy` records "the completion of production of a new entity by an activity"; `prov:wasAttributedTo` records "the ascribing of an entity to an agent". `prov:generatedAtTime` and `prov:invalidatedAtTime` "can be used to bound the starting and ending moments of an Entity's existence". (**read**: https://www.w3.org/TR/prov-o/)
- **Zep** (Rasmussen et al., 2025), a temporal knowledge graph for agent memory.
  - Raw "Episodes serve as a non-lossy data store from which semantic entities and relations are extracted". "Episodic edges ... connect episodes to their referenced semantic entities", which keeps a link from each derived fact to its source.
  - The model is bi-temporal: "t′created and t′expired ... monitor when facts are created or invalidated in the system, while tvalid and tinvalid ... track the temporal range during which facts held true".
  - Contradictions: "The system employs an LLM to compare new edges against semantically related existing edges to identify potential contradictions", then "invalidates the affected edges". It "consistently prioritizes new information".

  (**read**: https://arxiv.org/abs/2501.13956)
- **Mem0** (Chhikara et al., 2025). Each new fact gets one of four operations: "ADD ... UPDATE ... DELETE for removal of memories contradicted by new information; and NOOP". The graph variant marks obsolete relations "as invalid rather than physically removing them to enable temporal reasoning". Its answer prompt says: "If the memories contain contradictory information, prioritize the most recent memory". (**read**: https://arxiv.org/abs/2504.19413)
- **Decay in agent memory.** Generative Agents (Park et al., 2023) "treat recency as an exponential decay function over the number of sandbox game hours since the memory was last retrieved. Our decay factor is 0.995." Recency is combined with importance and relevance for retrieval (https://arxiv.org/abs/2304.03442). MemoryBank (Zhong et al., 2023) uses a forgetting mechanism "inspired by the Ebbinghaus Forgetting Curve". It is meant for "more anthropopathic memory behavior" in companion settings (https://arxiv.org/abs/2305.10250). **Inference:** both decay designs rank by time and use, not by whether a fact is still true. Neither expires a fact because it was contradicted or verified false. (**read**)
- **Per-entry feedback counters** (ACE, ICLR 2026). Each context bullet has "a unique identifier and counters tracking how often it was marked helpful or harmful". A de-duplication step "prunes redundancy by comparing bullets via semantic embeddings". (**read**: https://arxiv.org/abs/2510.04618)
- **Vendor timestamps and staleness.** Claude Code records "the write time in a `modified` frontmatter field as an ISO 8601 timestamp", which "shows how current the fact is" (https://code.claude.com/docs/en/memory). The Anthropic memory tool expires by last access (https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool). The OpenAI cookbook uses `last_updated` for "decay or pruning of outdated memories", sources notes "only from explicit user messages", and "does not mention storing source records or other provenance fields" beyond that (https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization). (**read**)
- **Citing sources in generated text** (ALCE, Gao et al., 2023): "On the ELI5 dataset, even the best models lack complete citation support 50% of the time." (**read**: https://arxiv.org/abs/2305.14627)
- **Detecting contradictions.** Checking all pairs in a set of documents is costly: the paper counts "all 190 possible pairs" for one example set. Conditional contradictions need triples. LLM validators vary widely by contradiction type (§3.8). (**read**: https://arxiv.org/abs/2504.00180)
- **LLM checkers of summaries** miss unfaithful claims. In FABLES, none of the LLM faithfulness raters "correlates strongly with human annotations, especially with regard to detecting unfaithful claims" (§3.9). (**read**: https://arxiv.org/abs/2404.01261)
- **Instruction-file audit tooling.** Claude Code's `/doctor prompt-audit` checks for outdated instructions, references to files or commands that don't exist, and contradictions between files (https://code.claude.com/docs/en/memory). Codex verifies by having the agent echo its instruction chain (https://learn.chatgpt.com/docs/agent-configuration/agents-md). Neither page reports how accurate the check is. (**read**)

## Implications for a context audit

Each check names the finding it rests on. "Inferred" marks a check that applies a result to a setting the source did not test.

1. **Size every loaded item against the loader's limits, because content past a limit is silently missing.** Claude Code loads only the first 200 lines or 25KB of MEMORY.md, and it truncates subdirectory and path-scoped files over a per-file limit. Codex stops adding files at 32 KiB. Rests on: Claude Code memory docs and the Codex AGENTS.md guide (§4). Documented behaviour, not inferred.
2. **Measure what the agent sees, not what the files say.** Check after compaction: conversation-only instructions, path-scoped rules and hook-added context are summarized away, while root instruction files are re-read from disk. Rests on: the Claude Code context-window docs (§3.9). Documented.
3. **Remove contradictions; do not rank them.** Find conflicting statements across instruction files, memory and notes, and delete or rewrite the losing one, without adding a priority note. Rests on: Claude Code says conflicts are resolved "arbitrarily", and Control Illusion shows a stated priority is honoured in at most 45.8% of cases on average (§3.7). Inferred for instruction files: Control Illusion tested formatting constraints.
4. **Check pairs and conditional triples, not single entries.** Many contradictions exist only between two entries, or only under a condition stated in a third. Rests on: the contradiction-detection typology and its results (§3.8, §5). Inferred for agent notes.
5. **Give every stored fact its origin.** Record source type (user statement, tool output, model inference, document with URL), date, and whether it was verified. Rests on: the PROV-O vocabulary, Zep's link from episode to fact, and the cookbook's "Explicit ... (not inferred)" criterion (§5). Inferred as a design; no source measures its effect.
6. **Re-verify user-supplied facts before they become durable memory or rules.** Rests on: Sharma et al.'s mimicry and answer sycophancy (accuracy down by up to 27%) and SYCON-Bench (§3.6). The vendor save criteria accept explicit user statements and corrections (§3.6). Inferred.
7. **Do not let "newest wins" be the only conflict rule.** Zep, Mem0 and the OpenAI cookbook prefer the most recent entry (§5). Combined with check 6, a recent wrong statement overrides an older verified one. Inferred.
8. **When a session's history holds failed attempts or a wrong premise, restart from a corrected brief.** Restarting beats appending a correction. Rests on: self-conditioning that grows with the injected error rate (Sinha et al.), the 39% multi-turn drop with "consolidate before retrying" (Laban et al.), and Claude Code's two-correction guidance (§3.4, §3.5). Measured in those settings; inferred for multi-session engineering work.
9. **Treat summaries, progress notes and compaction output as lossy derived artifacts.** Spot-check them against the originals, focusing on events and changes of state, and do not rely on an LLM judge alone. Rests on: FABLES (unfaithful claims concentrate on events and states; LLM raters miss them) and ACE's context collapse (§3.9). Measured on books and on one agent benchmark; inferred for engineering notes.
10. **Prefer itemized, localized edits to wholesale rewrites of a notes file, and keep the originals.** Rests on: ACE (a monolithic rewrite collapsed 18,282 tokens to 122 and fell below the no-context baseline), Zep's non-lossy episode store, and the OpenAI cookbook's "reviewed artifact with citations" (§3.9, §5). Measured for ACE; the rest is design guidance.
11. **Prune superseded and near-duplicate content, not only irrelevant content.** Rests on: distractors that hurt more as length grows (Chroma), GSM-IC, and length alone hurting even as whitespace (Du et al.) (§3.3). Inferred that superseded versions act as distractors.
12. **Remove what the agent can derive from the repository** (overviews, file layout). Rests on: Gloaguen et al. (overviews "are not helpful"; context files add over 20% cost) and Claude Code's "Claude reads the repo itself" (§3.11, §4). Measured on SWE-bench-style tasks.
13. **Check that every path, command and identifier in instruction and memory files still resolves.** Rests on: the checks `/doctor prompt-audit` makes (§5). Vendor guidance, not a measured result.
14. **Treat any instruction-bearing text that entered from outside as data until a person reviews it.** This covers a contribution, a downloaded file, tool output, or a memory entry written during a session. Rests on: GitInject (configuration files from unmerged contributions loaded as operator-level instructions), MINJA (98.2% injection through queries alone), AgentPoison (poison rate below 0.1%), and the OpenAI cookbook's "high-value attack surface" (§3.10). Measured attack rates.
15. **Flag stored text that is phrased as an instruction to the agent** ("store this as a system rule", "always do X"), especially in files meant to hold facts. Rests on: the OpenAI cookbook's named "Instruction injection" risk and Greshake et al.'s persistence through memory (§3.10). Inferred as a detection heuristic.
16. **Put the material being audited first and the audit question last; repeat critical instructions at both ends.** Rests on: Lost in the Middle, Anthropic's measured "up to 30 percent", Google's query-at-end advice, and OpenAI's both-ends advice (§3.2, §4). Measured on older models and in vendor tests.
17. **Audit in small focused passes, not one pass over the whole accumulated store.** Rests on: focused (~300 tokens) vs full (~113k tokens) prompts (Chroma), aggregation below 50% at 128K (Oolong), and "only 10-20% of the context" (BABILong) (§2, §3.3). Inferred for audit tasks.
18. **Run the audit with reasoning enabled and in a context that has not seen the work.** Rests on: thinking removing self-conditioning (Sinha et al.), the thinking vs non-thinking gaps on Fiction.LiveBench (Sept 2025), Claude Code's "A fresh reviewer does help", and SYCON-Bench's third-person framing cutting sycophancy by up to 63.8% (§2, §3.4, §3.6, §4). Partly measured; the fresh-reviewer claim is vendor guidance.
19. **Do not size the audit from the advertised window.** No public benchmark found tests the current flagships, and effective length depends on the task (§2). Measured for older models; inferred for current ones.

## Could not confirm

- **OpenAI's own account of the April 2025 GPT-4o sycophancy rollback** (causes, the role of user-feedback signals and memory, process changes): **not accessed**, because https://openai.com/index/expanding-on-sycophancy/ returned HTTP 403. The rollback itself is stated only secondhand, in SYCON-Bench's introduction (https://arxiv.org/abs/2505.23840).
- **ChatGPT memory behaviour and controls:** **not accessed**, because https://help.openai.com/en/articles/8590148-memory-faq returned HTTP 403.
- **"o3 was the first model to score 100% at 128k on Fiction.LiveBench"** (widely repeated). The primary tables have a 120k column, not 128k. The Sept 2025 table shows o3 at 100.0 at 120k and 58.1 at 192k. Whether it was "first" could not be established from the current page. (**read**: Sept 2025 table image linked in §2)
- **Fiction.LiveBench size.** A secondary page (https://epoch.ai/benchmarks/fictionlivebench, read, used as a pointer only) says "36 questions about 30 stories". The primary page says only "a dozen very long complex stories and many verified quizzes". The count is not confirmed, and neither is the reason for claude-opus-4-6's 0.0 at 192k.
- **OpenAI long-context multipliers for GPT-6.1 Sol, GPT-6.1 Terra and GPT-6 Luna.** The 2x input / 1.5x output rule above 272K was read only on the GPT-6 Astra page. The pricing page HTML that was fetched did not contain long-context rates for the GPT-6 rows.
- **Long-context benchmark results for the current flagships** (Claude Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5; GPT-6 Astra or Sol; Gemini 4 Argon): none found in any source read.
- **"Effective context is about half the advertised window"** as a general rule: no primary source states it. RULER's "only half of them" counts models that pass at 32K; it is not a fraction of the window.
- **The opinion piece's evidence for "context distraction" and "context confusion":** the Databricks long-context RAG study (https://www.databricks.com/blog/long-context-rag-performance-llms) and the Berkeley Function-Calling Leaderboard were **not accessed**. arXiv 2411.15399 ("Less is More: Optimizing Function Calling for LLM Execution on Edge Devices") was confirmed only by its title; the paper was not read.
- **First use of the term "context rot":** Anthropic's docs and Chroma's report both use it, but neither claims to have coined it, and its origin was not established.
- **Lost in the Middle's journal venue** (often cited as TACL): not shown in the arXiv copy that was read.
- **Industry reports on poisoned instruction files** (for example a Cloud Security Alliance research note of October 2026 describing a malicious AGENTS.md found in a repository, and a study of 481 CLAUDE.md files): surfaced in a search, not followed to primary sources, and **not used**.
- **Chroma's per-model numbers:** they are published as charts and were not transcribed. Only statements made in the report's text are used.

## Sources

All accessed 2026-11-06. **R** = read, **R-abs** = read, abstract page only, **NA** = not accessed, **P** = read, used only as a pointer to a primary source.

### Vendor documentation and reports

| # | Source | URL | Status |
|---|---|---|---|
| 1 | Anthropic, Models overview | https://platform.claude.com/docs/en/about-claude/models/overview | R |
| 2 | Anthropic, Pricing | https://platform.claude.com/docs/en/about-claude/pricing | R |
| 3 | Anthropic, Context windows | https://platform.claude.com/docs/en/build-with-claude/context-windows | R |
| 4 | Anthropic, Compaction overview | https://platform.claude.com/docs/en/build-with-claude/compaction | R |
| 5 | Anthropic, Context editing | https://platform.claude.com/docs/en/build-with-claude/context-editing | R |
| 6 | Anthropic, Memory tool | https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool | R |
| 7 | Anthropic, Prompting best practices | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices | R |
| 8 | Anthropic, Effective context engineering for AI agents (Sep 29, 2025) | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | R |
| 9 | Anthropic, Effective harnesses for long-running agents (Nov 26, 2025) | https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents | R |
| 10 | Anthropic, How we built our multi-agent research system (Jun 13, 2025) | https://www.anthropic.com/engineering/multi-agent-research-system | R |
| 11 | Claude Code, Store instructions and memories | https://code.claude.com/docs/en/memory | R |
| 12 | Claude Code, Create custom subagents | https://code.claude.com/docs/en/sub-agents | R |
| 13 | Claude Code, Best practices | https://code.claude.com/docs/en/best-practices | R |
| 14 | Claude Code, Explore the context window | https://code.claude.com/docs/en/context-window | R |
| 15 | OpenAI, Models | https://developers.openai.com/api/docs/models | R |
| 16 | OpenAI, GPT-6 Astra model page | https://developers.openai.com/api/docs/models/gpt-6-astra | R |
| 17 | OpenAI, API pricing (developer docs) | https://developers.openai.com/api/docs/pricing | R |
| 18 | OpenAI, API pricing (marketing page) | https://openai.com/api/pricing/ | NA (HTTP 403) |
| 19 | OpenAI, Compaction guide | https://developers.openai.com/api/docs/guides/compaction | R |
| 20 | OpenAI, GPT-4.1 prompting guide | https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide | R |
| 21 | AGENTS.md | https://agents.md/ | R |
| 22 | OpenAI Codex, Custom instructions with AGENTS.md | https://learn.chatgpt.com/docs/agent-configuration/agents-md | R |
| 23 | OpenAI Cookbook, Context Engineering for Personalization: State Management with Long-Term Memory Notes | https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization | R |
| 24 | OpenAI Cookbook, Building Reliable Agents with Memory and Compaction | https://developers.openai.com/cookbook/examples/agents_sdk/building_reliable_agents_memory_compaction | R |
| 25 | OpenAI, Expanding on what we missed with sycophancy | https://openai.com/index/expanding-on-sycophancy/ | NA (HTTP 403) |
| 26 | OpenAI, Memory FAQ | https://help.openai.com/en/articles/8590148-memory-faq | NA (HTTP 403) |
| 27 | Google, Gemini models | https://ai.google.dev/gemini-api/docs/models | R |
| 28 | Google, Gemini 4 Argon model page | https://ai.google.dev/gemini-api/docs/models/gemini-4-argon | R |
| 29 | Google, Gemini API pricing | https://ai.google.dev/gemini-api/docs/pricing | R |
| 30 | Google, Long context | https://ai.google.dev/gemini-api/docs/long-context | R |
| 31 | Google, Gemini CLI: Provide context with GEMINI.md files | https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md | R |
| 32 | Google DeepMind, Gemini 2.5 technical report | https://storage.googleapis.com/deepmind-media/gemini/gemini_v2_5_report.pdf | R |
| 33 | OWASP, LLM01:2025 Prompt Injection | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | R |
| 34 | W3C, PROV-O: The PROV Ontology (Recommendation, 30 April 2013) | https://www.w3.org/TR/prov-o/ | R |

### Benchmarks and long-context studies

| # | Source | URL | Status |
|---|---|---|---|
| 35 | Liu et al., Lost in the Middle | https://arxiv.org/abs/2307.03172 | R |
| 36 | Hsieh et al., RULER (COLM 2024) | https://arxiv.org/abs/2404.06654 | R |
| 37 | NVIDIA, RULER repository | https://github.com/NVIDIA/RULER | R |
| 38 | Modarressi et al., NoLiMa (ICML 2025) | https://arxiv.org/abs/2502.05167 | R |
| 39 | Adobe Research, NoLiMa repository | https://github.com/adobe-research/NoLiMa | R |
| 40 | Vodrahalli et al., Michelangelo | https://arxiv.org/abs/2409.12640 | R |
| 41 | Lee et al., LOFT | https://arxiv.org/abs/2406.13121 | R |
| 42 | Yen et al., HELMET (ICLR 2025) | https://arxiv.org/abs/2410.02694 | R-abs |
| 43 | Kuratov et al., BABILong (NeurIPS 2024 D&B) | https://arxiv.org/abs/2406.10149 | R-abs |
| 44 | Bai et al., LongBench v2 | https://arxiv.org/abs/2412.15204 | R-abs |
| 45 | Hong, Troynikov, Huber, Context Rot (Chroma, July 14, 2025) | https://research.trychroma.com/context-rot | R |
| 46 | Du et al., Context Length Alone Hurts LLM Performance Despite Perfect Retrieval | https://arxiv.org/abs/2510.05381 | R |
| 47 | Bertsch et al., Oolong (COLM 2026) | https://arxiv.org/abs/2511.02817 | R |
| 48 | Fiction.live, Fiction.LiveBench (April 04 2026), with results images | https://fiction.live/stories/Fiction-liveBench-April-04-2026/oQdzQvKHw8JyXbN87 | R |
| 49 | Epoch AI, Fiction.LiveBench page | https://epoch.ai/benchmarks/fictionlivebench | P |

### Failure modes

| # | Source | URL | Status |
|---|---|---|---|
| 50 | Breunig, How Long Contexts Fail (opinion piece, Jun 22, 2025) | https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html | R (origin of terms only) |
| 51 | Shi et al., Large Language Models Can Be Easily Distracted by Irrelevant Context (ICML 2023) | https://arxiv.org/abs/2302.00093 | R |
| 52 | Sinha et al., The Illusion of Diminishing Returns (ICLR 2026) | https://arxiv.org/abs/2509.09677 | R |
| 53 | Sharma et al., Towards Understanding Sycophancy in Language Models (ICLR 2024) | https://arxiv.org/abs/2310.13548 | R |
| 54 | Laban et al., Are You Sure? The FlipFlop Experiment | https://arxiv.org/abs/2311.08596 | R |
| 55 | Hong et al., Measuring Sycophancy of Language Models in Multi-turn Dialogues (SYCON-Bench) | https://arxiv.org/abs/2505.23840 | R |
| 56 | Laban et al., LLMs Get Lost In Multi-Turn Conversation | https://arxiv.org/abs/2505.06120 | R |
| 57 | Wallace et al., The Instruction Hierarchy | https://arxiv.org/abs/2404.13208 | R |
| 58 | Geng et al., Control Illusion | https://arxiv.org/abs/2502.15851 | R |
| 59 | Xie et al., Adaptive Chameleon or Stubborn Sloth (ICLR 2024) | https://arxiv.org/abs/2305.13300 | R |
| 60 | Wu et al., LongMemEval (ICLR 2025) | https://arxiv.org/abs/2410.10813 | R |
| 61 | Kim et al., FABLES (COLM 2024) | https://arxiv.org/abs/2404.01261 | R |
| 62 | Zhang et al., Agentic Context Engineering (ICLR 2026) | https://arxiv.org/abs/2510.04618 | R |
| 63 | Kang et al., ACON (ICML 2026) | https://arxiv.org/abs/2510.00615 | R |
| 64 | Greshake et al., Not what you've signed up for | https://arxiv.org/abs/2302.12173 | R |
| 65 | Chen et al., AgentPoison | https://arxiv.org/abs/2407.12784 | R |
| 66 | Dong et al., MINJA (NeurIPS 2025) | https://arxiv.org/abs/2503.03704 | R |
| 67 | Zou et al., PoisonedRAG | https://arxiv.org/abs/2402.07867 | R |
| 68 | Debenedetti et al., AgentDojo | https://arxiv.org/abs/2406.13352 | R |
| 69 | Isbarov et al., GitInject | https://arxiv.org/abs/2606.09935 | R-abs |
| 70 | Gloaguen et al., Evaluating AGENTS.md | https://arxiv.org/abs/2602.11988 | R |
| 71 | Lulla et al., On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents | https://arxiv.org/abs/2601.20404 | R |
| 72 | Chatlatanagulchai et al., Agent READMEs | https://arxiv.org/abs/2511.12884 | R |
| 73 | Databricks, Long-context RAG performance of LLMs | https://www.databricks.com/blog/long-context-rag-performance-llms | NA (not opened) |
| 74 | Less is More: Optimizing Function Calling for LLM Execution on Edge Devices | https://arxiv.org/abs/2411.15399 | NA (title confirmed only) |

### Memory, provenance and verification

| # | Source | URL | Status |
|---|---|---|---|
| 75 | Rasmussen et al., Zep | https://arxiv.org/abs/2501.13956 | R |
| 76 | Chhikara et al., Mem0 | https://arxiv.org/abs/2504.19413 | R |
| 77 | Park et al., Generative Agents | https://arxiv.org/abs/2304.03442 | R |
| 78 | Zhong et al., MemoryBank | https://arxiv.org/abs/2305.10250 | R |
| 79 | Gao et al., Enabling Large Language Models to Generate Text with Citations (ALCE) | https://arxiv.org/abs/2305.14627 | R |
| 80 | Gokul et al., Contradiction Detection in RAG Systems | https://arxiv.org/abs/2504.00180 | R |
