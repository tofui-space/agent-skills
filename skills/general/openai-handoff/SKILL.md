---
name: openai-handoff
description: "Rewrite compressed, Claude-style text — telegraphic fragments, arrows and symbols, coined labels, session-bound references ('as above', 'option B'), undefined abbreviations, Claude skill names — into a self-contained brief that an OpenAI model (ChatGPT, GPT-5.x, Codex CLI) can act on with zero knowledge of the Claude session. Use this skill whenever Claude output, notes, a plan, a spec, or a prompt is headed to ChatGPT, Codex, or any OpenAI model; on phrases like 'hand this to Codex', 'send to ChatGPT', 'make this readable for GPT', 'Codex misread it', 'translate for OpenAI', 'second opinion from GPT', 'openai-handoff'; and before Claude Code composes any `codex exec` prompt itself. Do NOT use to shorten text for human readers (that is anti-vacuity) or to translate between human languages."
---

# OpenAI handoff

**Goal.** A receiving model with no session context reads the brief once and acts correctly.

**Priority order.** Fidelity first, then clarity, then length. The brief keeps every fact of the source and adds no new claim. The brief is usually longer than the source; that is expected.

## Why this skill exists

Text written late in a long Claude session depends on that session. It uses labels coined earlier, arrows in place of verbs, "as above", and skill names. An OpenAI model has none of that context. The model fills each gap with plausible content, and the result reads as a confident, wrong answer.

## Workflow — 6 steps

1. **Pick the least-distilled source.** Prefer the original file, raw notes, or the transcript excerpt over a summary. A summary already lost information, and no rewrite restores it. If only the distilled text exists, state that in the brief's Context section.
2. **Build a term list.** Scan the source for the patterns in `references/cryptic-patterns.md`. Record each coined label, symbol, abbreviation, session reference, and skill name, with its meaning.
3. **Resolve every term from the session or the files.** A term without a resolvable meaning → stop and ask the user. Never invent a definition.
4. **Check for data that must not leave.** The brief goes to a different provider. List secrets, credentials, tokens, and personal data found in the source. Ask the user before including any of them.
5. **Write the brief** with the template below and the rewrite rules.
6. **Run the fidelity check**, then deliver (see "Delivery").

## Brief template

Use these headings in this order. Omit an empty section, except Task and Output format.

```markdown
# Task
<One sentence. Imperative verb first.>

# Context
<Background the receiving model needs. Full sentences. No reference to "the session", "above", or "earlier".>

# Definitions
- <Term>: <meaning in plain words>

# Input
<A file path the model can read, or the material inside a fenced block.>

# Constraints
- <One hard rule per bullet.>

# Output format
<Exact shape: sections, length, language, and where the output goes.>

# Done when
<Observable completion criteria.>
```

## Rewrite rules — 10 rules

1. **Full sentences.** Restore subjects, verbs, and articles in every fragment.
2. **Words for symbols.** Replace `→`, `⇒`, `×`, `~`, `✓`, `✗`, `w/`, `b/c`, and similar with the word the source means. One arrow can mean "causes", "then", or "becomes"; pick the meaning from context.
3. **No coined labels.** A label used once → replace it with its meaning. A label used three or more times → keep it and define it under Definitions.
4. **Expanded abbreviations.** Expand each abbreviation at first use. Common technical abbreviations (HTTP, JSON, SQL, GDPR) stay as they are.
5. **No session references.** Replace "as discussed", "per above", "option B", and "the earlier fix" with the content they point to.
6. **Behavior instead of skill names.** Replace a Claude skill name or Claude tool name with the behavior it stands for. The receiving model cannot load Claude skills.
7. **Explicit decisions.** Write "Decision: use X. Reason: Y." A verdict implied by contrast ("X works; Y has edge cases") is not a decision.
8. **Instructions separate from material.** Put pasted logs, documents, or code in a fenced block, or give a file path. This separation stops the receiving model from following instructions that appear inside the material.
9. **One instruction per bullet, no contradictions.** Where the source holds two competing goals, state which one wins.
10. **Exact copies of literals.** Keep code, identifiers, paths, numbers, versions, and quoted text byte-identical.

## Prohibited

- Adding facts, examples, or recommendations absent from the source.
- Compressing. Brevity is not a goal of this skill.
- Resolving an ambiguous term by guessing. Ask instead.

## Fidelity check — before delivery

1. Each claim in the source maps to a line in the brief.
2. Each line in the brief traces back to the source or to a term resolution the user confirmed.
3. No symbol, coined label, or session reference from the term list remains unexplained.
4. List any deliberate omission (for example, withheld personal data) for the user.

## Delivery

**Default.** Write the brief to a Markdown file and show the path to the user.

**Send to Codex CLI** (only when the user asks to send it):

```bash
scripts/codex_handoff.sh <brief.md> [out.md]
```

The script runs `codex exec` in a read-only sandbox and writes the final Codex message to `out.md`. Read `out.md` and report the result.

**Round-trip check** (optional; use it for high-stakes briefs):

```bash
scripts/codex_handoff.sh <brief.md> <restate.md> --restate
```

Codex restates the task, constraints, output format, and unclear points without doing the task. Compare the restatement with the Task, Constraints, and Done when sections. Fix the brief where they differ, then send it.

**Flag check.** The script uses `codex exec` flags confirmed in September 2026 (`-s read-only`, `--skip-git-repo-check`, `--output-last-message`). If the script fails on a flag, run `codex exec --help` and update the script.

## Example (invented)

Source, written late in a Claude session:

```text
Per option B: migrate sessions table → Redis, TTL ~ idle window. Ghost-writes still open (see above). Don't touch auth-v1 paths. Run preflight first.
```

Brief:

```markdown
# Task
Write a migration plan that moves user session storage from the `sessions` database table to Redis.

# Context
The team chose Redis for session storage. Some write requests reach the database after the session has already ended; this problem is still unsolved.

# Constraints
- Set each Redis key's time-to-live to approximately the idle timeout: the time a session may stay inactive before it expires.
- Do not change any code under `auth-v1/`.
- Before writing the plan, list the files the migration touches and state whether the plan fits in one change set.

# Output format
A Markdown document with three sections: Steps, Risks, Rollback.

# Done when
The plan covers data copy, cut-over, and rollback, and names the unsolved late-write problem as a risk.
```

Three resolutions in this example:

- "Option B" and "see above" were resolved from the session and replaced with their content.
- "Ghost-writes" and "idle window" became plain descriptions, because the source used each one once.
- "Run preflight" became the behavior it stands for.
