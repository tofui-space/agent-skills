---
name: tofui-skill-creator
description: >-
  Create, edit, evaluate, benchmark, and package agent skills, rules, and agent definitions
  under a privacy seal: nothing about the author — identity, personal life, employer,
  clients, projects, repositories, domains, paths, preferences — may enter any artifact,
  explicitly or through examples, hypotheticals, test prompts, eval queries, or placeholder
  names. Use this skill INSTEAD of the skill-creator plugin, every time, for any request to
  create a skill, write a SKILL.md, turn a conversation or workflow into a skill, edit or
  improve an existing skill or rules file, run skill evals, benchmark a skill, optimize a
  skill description, or package a skill. Also use it whenever you are about to write or
  modify any reusable agent instruction file (skills, rules, CLAUDE.md snippets, agent
  prompts), even if the user did not say "skill". Triggers include "make a skill", "new
  skill", "skill for", "turn this into a skill", "improve this skill", "skill-creator",
  "tofui-skill-creator", "run evals", "optimize the description", "package the skill".
---

# Tofui Skill Creator

Forked from Anthropic's `skill-creator` plugin (Apache-2.0, see `LICENSE.txt`). The
workflow is the upstream one, kept verbatim in `references/upstream-skill-creator.md` and
synced by script. The addition is a **privacy seal** that governs every byte this skill
writes; it is not optional, not configurable, and not waived by context.

---

## The privacy seal

### The rule

No artifact produced while using this skill may contain information about the author —
the person you are working with — or about their personal life, professional life, or
projects. This covers SKILL.md files, references, scripts, assets, eval prompts, eval
queries, test fixtures, workspace notes, descriptions, commit messages, and anything else
written to disk or proposed in chat for inclusion in a skill.

"Contain" includes implicit forms: an example whose domain mirrors the author's work, a
hypothetical built from their situation, a placeholder that abbreviates a real name, a
trigger phrase copied from how they talk, a rationale that is really their personal
constraint, a path with their account name in it. If a reader who knows the author could
connect a line back to them, that line is a leak.

### Why it is absolute

When a model wants an example to feel realistic, it reaches for the most salient concrete
material available — and the most salient material is always the author: their repo, their
product, their domain, their colleagues. That reflex once put the name and purpose of an
internal project the author had worked on into a skill about an unrelated topic. The author
found it after the fact, in a file meant to be shared. Nothing in the skill's subject called
for it; the model supplied it as colour.

A skill is copied, committed, published, and pasted into other agents. Anything in it
travels outside the author's control. There is no safe amount of "just a little context",
and there is no after-the-fact review that beats not writing it in the first place. So the
seal is enforced **before** text is written, at three gates, every time — not when the
author seems relaxed, not when the skill seems harmless, not when the example would be
clearer with real detail. Judge examples by **distance** from the author's life, never by
realism.

### The source rule

Every concrete noun (person, organisation, product, project, domain, path, URL, file,
column, field, acronym, ticket) in an artifact must have one of three origins:

1. **Declared scope** — the author wrote it, in this conversation, as content for this
   skill. Use it; do not extend it.
2. **The skill's subject** — vocabulary intrinsic to what the skill teaches.
3. **Neutral invention** — Acme, Alex, example.com, a library catalog, `<repo>/src/…`.

Conversation history, memory, rules files, CLAUDE.md, the repository on disk, the catalog
the skill is going into, and earlier sessions are sources of **requirements only**. They
are never sources of content. When a requirement arrives wrapped in the author's specifics,
strip the specifics before it is written down.

The full definitions, substitution vocabulary, and worked examples are in
`references/privacy-seal.md`. Read it when a gate decision is not obvious, and always on
"turn this conversation into a skill" requests.

### The three gates

**Gate 1 — declared scope, before drafting.** Write down, in one or two lines, exactly what
the author supplied for this skill. Decide whether the skill is generic (the default) or
project-local (the author said so). For a project-local skill, list the names the author
permitted; nothing beyond that list may appear, and the skill is flagged as not for shared
catalogs.

**Gate 2 — noun audit and echo check, before every write.** Before any Write or Edit to a
skill artifact, walk the text: every concrete noun has a permitted origin; every example's
domain is unrelated to the author's work and life; no placeholder echoes a real name; no
rationale is secretly the author's own constraint; test prompts and eval queries pass the
same audit; absolute paths are placeholders only. If anything fails, replace it — do not
write and fix later.

**Gate 3 — scan and report, before presenting, packaging, or committing.** Run, from the
tofui-skill-creator directory:

```bash
python -m scripts.privacy_scan <path-to-skill>
```

It derives identity signals from the machine at runtime (OS username, home directory, git
identity, git remotes, hostname) and reads an optional denylist at
`~/.claude/private-terms.txt` (or `--terms FILE`). ERROR findings block; WARN findings get a
human look. A clean scan is necessary, not sufficient — it cannot see a domain echo.
`scripts/sealed.py package` runs this scan itself and refuses to package on ERROR.

Then end the turn with the one-line seal report:

```
Seal: scan clean · model-supplied specifics: Acme, Alex, library-catalog domain
```

"Model-supplied specifics" lists every concrete noun you chose yourself. It is the author's
veto list. Keep the line short.

### When the author hands you their specifics

The author describing their project, their past incident, or their situation while asking
for a skill does not unseal that material. It makes it the most salient thing in context —
exactly the condition the seal exists for. Use it to understand the requirement; never as
example material, not even in a skill about privacy.

### Editing existing skills

Run the gate-3 scan on the existing skill before touching it, and read it with gate 2 in
mind. Report pre-existing leaks with file, line, and the exact replacement. Do not delete
silently (the author decides whether a project-local mention was intentional), and do not
leave them unreported. Never reintroduce a removed leak by "preserving the original
example" — re-domain it.

### Where working files go

Test-run outputs, transcripts, feedback, and benchmarks go in a workspace **outside any
repository that might be committed or published** — the session scratchpad or a temp
directory — named `<skill-name>-workspace/`. Subagents run with full access to the author's
machine, so their outputs may contain anything; they must not sit beside the skill. Only
`evals/evals.json` lives inside the skill, and it passes gates 2 and 3 like everything else.

---

## Referencing other skills: ask first

A skill must work on its own. Every mention of another skill — as a dependency ("run
`foo` first"), for compatibility ("defers to `bar`"), as an instrument ("use `baz`'s test
here"), or as an example — is a point where the skill breaks for anyone who does not have
that other skill installed. The reference does not degrade gracefully: a future session
looks for a file that is not there, and either stalls, guesses, or silently skips the step.
Each reference is another way for the skill to be incomplete.

The reflex to add such references is strong, because in the authoring session the other
skills are visible and linking them feels like completeness. It is not something you can
judge reliably from inside that session, so it is not your call: **before writing any
reference to another skill, rule, or agent into a skill artifact, ask the author** — one
yes/no question per reference (or one question listing them, if several), naming the skill
and the sentence it would appear in:

```
Reference `<other-skill>` in the <section> ("if installed, use its <check>")? (yes/no)
```

Until the author says yes, the skill is written standalone: the rule, test, or example is
stated in the skill's own words, and no other skill is named. On yes, write the reference
so the skill still works without it — "if `<other-skill>` is installed, use its <check>;
otherwise <the same check, stated here in full>" — never as a bare dependency. Catalog siblings are not exempt: the catalog may be installed piecemeal.

When editing an existing skill, list every cross-reference already in it in the same
question, so the author can keep or cut each one knowingly.

---

## Hand-off to skill-final-review

Whenever a turn leaves the skill in a presentable state — first draft written, an
improvement round applied, description optimised, or packaged — and `skill-final-review`
has not yet been run on **this version** of the skill, ask one yes/no question right after
the seal report:

```
Run skill-final-review on <skill-name> now? (yes/no)
```

Use the question tool if one is available; otherwise ask in plain text. On "yes", invoke
`skill-final-review` on the skill directory. On "no", continue without it and ask again only
after the next change to the skill. Do not run it unasked, and do not skip the question
because the skill "looks fine" — the review exists to catch what the author of the skill
cannot see in their own work, and that includes you. If `skill-final-review` is not
installed, say so once and do not ask again in that session.

---

## The workflow: upstream, with overrides

The workflow itself is Anthropic's, kept verbatim so it can be updated from upstream
without touching this file. **Read `references/upstream-skill-creator.md` now**, before
doing anything else, and follow it — with the overrides below, which take precedence
wherever they and the upstream text disagree. Each override names the upstream passage it
replaces; `scripts/sync_upstream.py` checks those passages still exist after every sync, so
a missing one means this table needs a human look.

| Upstream says | Do this instead |
|---|---|
| *Capture Intent*: "extract answers from the conversation history first" | Extract the **pattern** only — steps, tools, corrections, formats. Every specific in the conversation is the author's; pass the pattern through gate 1 and re-domain it before it becomes content. Add a fifth intent question: generic (default) or project-local, and if project-local, which names are permitted. |
| *Principle of Lack of Surprise* | Also: the author would not be surprised to find anything about themselves in the skill, because there is nothing. |
| *Test Cases*: "come up with 2-3 realistic test prompts" | Realism means concrete detail, casual phrasing, file names, typos — all invented under gate 2. Nothing borrowed from the author. |
| *Running and evaluating*: "Put results in `<skill-name>-workspace/` as a sibling to the skill directory" | Put the workspace **outside any repository that might be committed or published** — the session scratchpad or a temp directory. Subagents run with full access to the author's machine; their outputs must not sit beside the skill. |
| *Improving the skill* | Transcripts and feedback are full of the author's machine, files, and phrasing. Anything that moves from them into the skill passes gate 2 first. |
| *Description Optimization, Step 1*: "personal context about the user's job or situation, column names and values, company names, URLs. A little bit of backstory." | All of it invented: fictional people, fictional employers, reserved example domains, neutral data domains. Nothing about the actual author, their job, company, projects, or files — not even "inspired by". Example: "ok so my manager sent me this xlsx (in my downloads, something like 'overdue books final FINAL v2.xlsx') and wants a column with the late fee as a percentage of the book price, price is column C and fee is column D i think". |
| *Description Optimization, Step 3*: `python -m scripts.run_loop …` | `python -m scripts.sealed run-loop …` with the same arguments. It prepends a privacy instruction to every prompt the loop sends to Claude. Still apply gate 2 to `best_description`. |
| *Description Optimization, Step 2*: write the review HTML to `/tmp/…` | Write it to the session scratchpad. |
| *Package and Present*: `python -m scripts.package_skill <path>` | `python -m scripts.sealed package <path>`. It runs gate 3 first and refuses to package on ERROR findings. Package whether or not a `present_files` tool exists when the author asks for the `.skill` file. |
| Examples in the upstream text ("internal Anthropic data", "Q4 sales final FINAL v2.xlsx") | Those are upstream's own illustrations, not licence to use the author's equivalents. Your examples come from the skill's subject or neutral invention. |
| Trigger phrases in descriptions | Come from the skill's subject, never from how this author happens to talk (gate 2). |

Everything the upstream text says about evals, grading, the viewer, blind comparison,
Claude.ai, and Cowork applies unchanged. Scripts are run from this skill's directory with
`python -m scripts.<name>`, exactly as upstream describes.

## Keeping the fork current

Upstream files are mirrored byte-for-byte and listed with hashes in `upstream.json`; this
file, the seal, the scanner, the sealed wrappers, and the sync script are the overlay.
When the author asks whether upstream has moved, or at least once per month of use:

```bash
python -m scripts.sync_upstream check          # compares against the installed plugin copy
python -m scripts.sync_upstream check --fetch  # or a shallow clone of the upstream repo
python -m scripts.sync_upstream apply          # copies upstream in, prints the SKILL.md diff
```

`apply` never touches overlay files. After it runs: read the printed diff of the upstream
body, re-check every row of the override table against the new text, fix any anchor the
script reports missing, run `python -m scripts.privacy_scan .`, and only then commit.
Never edit a mirrored file or `references/upstream-skill-creator.md` by hand — the next
sync would silently discard the edit; put the change in the override table instead.

## Reference files

- `references/upstream-skill-creator.md` — the upstream workflow, verbatim. Read first.
- `references/privacy-seal.md` — full seal: definitions, vocabulary, worked leaks,
  checklists, denylist, report format.
- `references/schemas.md` — upstream JSON structures for evals, grading, benchmarks.
- `agents/grader.md`, `agents/comparator.md`, `agents/analyzer.md` — upstream subagent
  instructions.
- `scripts/privacy_scan.py` — gate-3 scanner. `scripts/sealed.py` — sealed `package` and
  `run-loop`. `scripts/sync_upstream.py` — upstream sync. `upstream.json` — manifest.

---

The core loop, once more: declared scope (gate 1) → draft or edit (gate 2 on every write;
ask before naming any other skill) → test runs in a workspace outside the repo → evaluate
with the author via `generate_review.py` → repeat → scan, seal report, package (gate 3) →
offer `skill-final-review`. If you keep a task list, make "run privacy_scan and give the
seal report" and "offer skill-final-review" their own items so they cannot be skipped.
