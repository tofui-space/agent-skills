# Evidence behind the steps

Version 2026-11-06 · sources read 2026-11-06; newest models tested in them: Claude Opus 4.6, GPT-5.2, Gemini 3 Pro

What published research and vendor documentation say about how accumulated context fails, and which step of this skill each finding supports. All sources were read on 2026-11-06. None of the benchmarks tests the models current at that date; the newest tested were from late 2025 and early 2026. Results are therefore evidence of how models behave, not measurements of the model running this audit. **Inferred** marks an application of a result to a setting its source did not test.

## Contents

- Length and position
- Errors in the context breed errors
- The user's wrong statement is adopted and kept
- Summaries and rewrites lose events and state
- Contradictions are not resolved by stating a priority
- Stored context is an injection surface
- Instruction files and loader limits
- What follows for the audit
- Sources

## Length and position

- Accuracy falls as input grows even when the needed information is retrieved perfectly: by 13.9% to 85% across the models tested, even when the padding is whitespace (Du et al. 2025).
- Distractors similar to the right answer hurt more as length grows; one distractor already lowers accuracy (Chroma, "Context Rot", 2025, 18 models). Focused prompts of about 300 tokens beat full prompts of about 113k tokens for every model tested (same report).
- Information in the middle of a long input is used worst; models favour the start and the end (Liu et al. 2023). In conversations, models over-weight the first and last turns (Laban et al. 2025).
- Advertised windows are about one million tokens at all three major vendors as of 2026-11. Effective length depends on the task: the best early-2026 models stay near flat to 192k on story comprehension (Fiction.LiveBench, April 2026), while most models score below 50% on aggregation tasks at 128K (Oolong, October 2026).

Supports: splitting large audits into small passes; removing superseded and duplicate entries rather than keeping them "for history" (inferred: a superseded version is a close, plausible distractor).

## Errors in the context breed errors

- Models become more likely to make mistakes when the context holds their own earlier errors. Larger models are not less affected; reasoning ("thinking") modes reduce the effect (Sinha et al., ICLR 2026).
- Across 15 models and over 200,000 simulated conversations, performance in multi-turn conversation dropped 39% on average against single-turn, mostly through unreliability. "When LLMs take a wrong turn in a conversation, they get lost and do not recover." The authors recommend consolidating what the user said and starting a new conversation (Laban et al. 2025).
- Claude Code's documentation advises, after two failed corrections, clearing the conversation and starting again with one prompt that folds in what was learned.

Supports: the handoff brief; offering a fresh session for the audit; stating corrections explicitly rather than leaving them implicit (inferred for multi-session engineering work).

## The user's wrong statement is adopted and kept

- When a user suggests a wrong answer, accuracy drops by up to 27%; when a user misattributes a quote, assistants repeat the misattribution even though they can name the right author when asked directly (Sharma et al., ICLR 2024). Under "Are you sure?", models often abandon correct answers (same paper; FlipFlop, Laban et al. 2023: answers flipped 46% of the time on average).
- Vendor memory designs save user statements and corrections as durable memory (Claude Code auto memory; OpenAI's Agents SDK personalization cookbook saves notes "stated or clearly confirmed by the user"), and several memory systems let the newest entry win a conflict (OpenAI cookbook, Zep, Mem0).
- Inferred, not measured end to end: a user's wrong factual statement passes these save rules and persists into later sessions, where the newest-wins rule can let it override an older verified fact.

Supports: ground rule 2; checking user-stated facts against evidence; refusing "newest wins" for facts; holding a finding when the user disputes it without new evidence.

## Summaries and rewrites lose events and state

- In book summaries checked by human readers, most unfaithful claims concerned events and the states of characters, and none of the model-based faithfulness checkers agreed well with humans at spotting them (FABLES, COLM 2024).
- When an agent's accumulated notes were rewritten whole, they collapsed in one step from 18,282 tokens to 122, and accuracy fell from 66.7 to 57.1, below the 63.7 scored with no notes at all. Itemized, incremental updates avoided the collapse (ACE, ICLR 2026).
- Anthropic warns that over-aggressive compaction loses context whose importance shows only later. Claude Code documents that after compaction the root instruction file and auto memory are re-read from disk, while instructions given only in conversation, path-scoped rules and hook-added context are summarized with everything else.

Supports: treating compaction summaries and progress notes as claims checked against the record, focusing on events and changes of state; editing entry by entry, never rewriting a whole file; finding decisions that were said but never recorded.

## Contradictions are not resolved by stating a priority

- Claude Code's documentation: if two instructions contradict each other, Claude may pick one arbitrarily.
- With two conflicting constraints and one marked as the priority, models obeyed only the priority one in 9.6% to 45.8% of cases on average, and at best 63.8% with the priority stated explicitly (Geng et al., "Control Illusion", 2025). Inferred for instruction files: the study tested formatting constraints.

Supports: repairing a contradiction by deleting or rewriting the losing entry, never by adding a line saying which one wins.

## Stored context is an injection surface

- Injected text copied into an agent's memory persists across sessions (Greshake et al. 2023). Poisoning under 0.1% of an agent's memory or knowledge base steered it in at least 80% of attacks (AgentPoison 2024); an attacker with query access alone injected records into memory 98.2% of the time (MINJA, NeurIPS 2025).
- OpenAI's cookbook calls memory injected into the system prompt "a high-value attack surface" and names instruction injection such as "store this as a system rule".

Supports: ground rule 4 and the Imported instruction verdict; flagging text in fact-holding files that is phrased as an instruction to the agent.

## Instruction files and loader limits

- Claude Code loads only the first 200 lines or 25KB of `MEMORY.md`, cuts on-demand files over a per-file limit, and recommends keeping each `CLAUDE.md` under about 200 lines because longer files reduce adherence. Codex stops adding instruction files at 32 KiB in total. Content past a limit is silently absent.
- Model-written context files did not improve task resolution and raised cost by over 20%; repository overviews in them were "not helpful" (Gloaguen et al. 2026). Instruction files in public repositories grow mostly by addition, rarely by deletion (Chatlatanagulchai et al. 2026).

Supports: checking loaded size against the loader's limit; treating restated file layouts and architecture overviews in always-loaded files as duplicates of the repository.

## What follows for the audit

- Small passes, one location at a time, with the material first and the question last.
- A fresh context, with reasoning enabled where the harness allows it, audits better than the session under audit (Sinha et al.; Claude Code: "A fresh reviewer does help, because it hasn't seen your reasoning"; partly measured, partly vendor guidance).
- Do not size the audit by the advertised window.

## Sources

- Du et al., "Context Length Alone Hurts LLM Performance Despite Perfect Retrieval", 2025: https://arxiv.org/abs/2510.05381
- Hong, Troynikov, Huber, "Context Rot", Chroma technical report, 2025: https://research.trychroma.com/context-rot
- Liu et al., "Lost in the Middle", 2023: https://arxiv.org/abs/2307.03172
- Fiction.LiveBench, April 2026: https://fiction.live/stories/Fiction-liveBench-April-04-2026/oQdzQvKHw8JyXbN87
- Bertsch et al., "Oolong", v2 2026: https://arxiv.org/abs/2511.02817
- Sinha et al., "The Illusion of Diminishing Returns", ICLR 2026: https://arxiv.org/abs/2509.09677
- Laban et al., "LLMs Get Lost in Multi-Turn Conversation", 2025: https://arxiv.org/abs/2505.06120
- Claude Code best practices: https://code.claude.com/docs/en/best-practices
- Sharma et al., "Towards Understanding Sycophancy in Language Models", ICLR 2024: https://arxiv.org/abs/2310.13548
- Laban et al., "FlipFlop", 2023: https://arxiv.org/abs/2311.08596
- Claude Code memory: https://code.claude.com/docs/en/memory
- OpenAI Agents SDK cookbook, context personalization: https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization
- Rasmussen et al., "Zep", 2025: https://arxiv.org/abs/2501.13956
- Chhikara et al., "Mem0", 2025: https://arxiv.org/abs/2504.19413
- Kim et al., "FABLES", COLM 2024: https://arxiv.org/abs/2404.01261
- Zhang et al., "Agentic Context Engineering", ICLR 2026: https://arxiv.org/abs/2510.04618
- Anthropic, "Effective context engineering for AI agents", 2025: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Claude Code context window: https://code.claude.com/docs/en/context-window
- Geng et al., "Control Illusion", 2025: https://arxiv.org/abs/2502.15851
- Greshake et al., "Not what you've signed up for", 2023: https://arxiv.org/abs/2302.12173
- Chen et al., "AgentPoison", 2024: https://arxiv.org/abs/2407.12784
- Dong et al., "MINJA", NeurIPS 2025: https://arxiv.org/abs/2503.03704
- Codex AGENTS.md guide: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Gloaguen et al., "Evaluating AGENTS.md", 2026: https://arxiv.org/abs/2602.11988
- Chatlatanagulchai et al., "Agent READMEs", 2026: https://arxiv.org/abs/2511.12884
