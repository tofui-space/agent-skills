---
name: bento-code
description: Run coding work as a sequence of separately briefed subagents, so that every artifact which must not depend on something is generated without it — interface docstrings and input/output schemas before the implementation exists, tests without seeing the implementation, usage-first API definitions, user-facing documentation without internals — and so that every step leaves examinable records (decision records written at decision time, script-extracted tool-call logs, exposure records) instead of after-the-fact explanations. Use this skill whenever a code change in a typed language creates or changes an interface, a data schema, a public API, a module, its tests, or its documentation, even when the user does not name the skill. Also use it for postmortems on earlier runs ("what went wrong with this file", "why did that run do this", "list runs", "clean runs"). Do NOT use it for conversational questions, code exploration, trivial edits (typos, formatting, renames), or tasks with no code deliverable.
---

# Bento Code

This skill splits a coding task into steps, runs each step in a subagent whose context
holds only what that step is allowed to know, and records what every step saw, decided,
and produced.

Two failures motivate it:

1. **Knowing too much.** An artifact written with the implementation in context copies the
   implementation. Tests reproduce its bugs as expected behavior; docstrings describe what
   the code does instead of what it should do; schemas follow the current code instead of
   the requirement. An instruction to ignore what is already in context does not remove
   its influence, and the agent cannot tell whether it was influenced.
2. **Explaining afterwards.** An agent asked later why it did something has no access to
   the computation that produced it. It reads the transcript and infers a plausible story.
   Only records captured while the work happens show what happened.

The subagents in this skill are processes with a context and a set of tools. They are not
stand-ins for people, and nothing in this skill describes them as such.

## Agent names

Name every agent with a mechanical noun that says what it transforms: generator, reader,
analyzer, processor, parser, classifier, retriever, extractor, comparator, checker.
Prefix "AI" for model-driven steps and "automatic" for scripted ones where the difference
matters. Examples: "interface definition generator", "AI test generator", "data type
analyzer", "API definition processor", "documentation generator", "context retriever".

Never use a job title or a human role (designer, engineer, reviewer, tester, architect,
writer, author, expert) for an agent, a step, or the main agent — not in briefs, records,
reports, or chat.

## When the skill runs

**Status: pending.** The gate below is an interim draft; the final gate comes with the
pipeline catalog in `references/pipelines.md`.

Answer each question in one word, in order. Stop at the first answer that decides.

1. Does the request produce or change code, tests, schemas, or code documentation? No → do not run.
2. Is it trivial (typo, formatting, rename, one-line change with no contract impact)? Yes → do not run.
3. Does it create or change a contract — an interface, a type, a schema, a public API, or behavior that tests or docs describe? No → do not run.
4. Does a pipeline in `references/pipelines.md` fit? Yes → run it. No → do not run, and say which part did not fit.

When the skill does not run, work normally. When it runs, tell the user the run id and the
pipeline in one line before the first step.

## Run lifecycle

The main agent (the session that loaded this skill) runs every step below. Subagents never
talk to each other; the main agent relays, reviews, and records.

1. **Open the run.**
   `python <skill-dir>/scripts/runs.py new --repo <repo-root> --task "<one-line summary>"`
   prints the run id and the two run directories as JSON (see *Storage*).
2. **Write the grant table** to `<run-dir>/grants.md` before spawning anything: every
   agent the pipeline uses, its grant (see *Grants*), what it must not see, and how that
   is enforced.
3. **For each step, in pipeline order:**
   1. Prepare the agent's workspace under `<workspace-dir>/agents/<agent-name>/`: copy in
      the permitted artifacts; build redacted copies per `references/redaction.md` where
      ordering cannot hide something.
   2. Write the brief to `<run-dir>/briefs/<step>-<agent-name>.md`, then spawn the agent
      with exactly that brief. The brief lists absolute paths to the instruction files the
      agent must open itself (`agents/framing.md` always, plus its own file) — never
      paraphrase instruction files into the brief.
   3. Review the returned artifacts against `references/records.md` → *Review*. Write the
      review to `<run-dir>/reviews/<step>-<agent-name>.md`. A step without a decision
      record is incomplete: reject it.
   4. Record every file written to the repository:
      `python <skill-dir>/scripts/runs.py record <run-id> --repo <repo-root> <paths...>`.
4. **Close the run.** Extract the observed layer (see *Records*), then
   `python <skill-dir>/scripts/runs.py close <run-id> --repo <repo-root>` archives the
   workspace into the run directory. Set status with `runs.py status`.

If a GitButler virtual branch is created for the run, put the run id in the branch name.
Never put the run id in a commit message.

## Grants

Every agent is defined by its grant. Choose the narrowest grant that lets the step work.

| Part | Options |
|---|---|
| Context | full session (a forked subagent: inherits the conversation) · curated brief (a fresh subagent: knows only its brief) |
| Artifacts | an explicit list of files under `<workspace-dir>` it may read |
| Tools | full · read-only · none (the agent returns text; the main agent writes it to disk) |

To give one agent another agent's knowledge, either grant it the other agent's artifacts,
or resume the other agent, ask it the question, and put the answer in the brief (a relayed
query). Do not hand over raw transcripts.

Project instruction files (CLAUDE.md and similar) reach most subagents automatically. Never
put hidden material in them.

## Information hiding

In order of strength:

1. **Ordering.** Run the step before the thing it must not know exists: the interface
   definition before the implementation, tests before the implementation, the usage
   example before the API is built. Prefer ordering whenever the task allows it.
2. **Tool-less agent with a curated brief.** It can read nothing but its brief.
3. **Redacted workspace.** Signature-only copies built per `references/redaction.md`, in
   a directory outside the repository with no version-control history.
4. **Instruction to disregard.** Weak. Use it only when nothing above is possible, and
   write it into the grant table and the agent's exposure record as
   `exposure: read <what>, instructed to disregard`.

Whoever prepares a redacted workspace sees what it hides: that is the main agent or a
script, never a subagent whose output must stay independent.

A subagent with file tools can still reach the repository. Hiding violations are not
prevented by this skill; they are detected from the observed layer and recorded. A run with
a violation is marked `weak hiding` in its review and produces an issue report.

## Records

Every record entry carries one of three labels. Never mix them in one sentence.

| Label | Written by | Contents |
|---|---|---|
| `observed` | a script, from transcripts and the filesystem | agents spawned, model, grant, files provided, every tool call, reads outside the grant, artifacts written with hashes |
| `stated` | the agent, at decision time, as required output | decisions, alternatives considered, the input each decision relied on, exposure |
| `inferred` | anyone, afterwards | any explanation not directly shown by an `observed` record |

Formats and the review checklist: `references/records.md`.

**Status: pending.** Extraction of the `observed` layer from subagent transcripts depends
on the transcript location and format, still being verified. Until the extraction script
exists, write the `observed` section of each review from the tool results visible to the
main agent, and mark it `observed (partial: main-agent view only)`.

## "I can't know"

While this skill is active, this rule binds the main agent and every subagent, whoever is
asking — including the user:

- Offer a cause for a failure only if an `observed` record directly shows it. Write it as
  `inferred: <cause>` followed by the record that shows it.
- Otherwise answer `I can't know.` and then list the records that exist for that step,
  with paths, so the user can check them. Do not add a guess, a "probably", or a "likely".

A record being *consistent with* a theory is not the record *showing* it.

## Issue reports

Write an issue report to `~/.claude/bento-code-reports/` when any of these happens:

- a hiding violation appears in the `observed` layer;
- the main agent's review rejects an artifact;
- tests, type checks, or builds fail on a generated artifact;
- a step returns without a decision record;
- the user says a result is bad.

Format in `references/records.md` → *Issue report*. The *pattern* section says what kind of
failure it was in general terms; the *case evidence* section holds the code, paths, and
excerpts. Only the pattern section may inform changes to this skill.

## Storage

| Location | Readers | Contents |
|---|---|---|
| `~/.claude/bento-code/runs/<project>/<run-id>/` | main agent only | `grants.md`, `briefs/`, `reviews/`, `redaction-map.md`, `observed/`, archived `workspace/` after close |
| `<temp>/bento-code/<project>/<run-id>/` | subagents, by explicit path | `shared/` (artifacts every permitted agent may read), `agents/<agent-name>/` (one agent's workspace) |
| `~/.claude/bento-code/runs/<project>/index.jsonl` | main agent, scripts | one line per run: id, date, repo, task, files written with hashes, status |
| `~/.claude/bento-code-reports/` | main agent | issue reports |
| the repository | everyone | final deliverables only |

Give subagents paths inside their own workspace and `shared/` only. A subagent read under
the main-only directory or another agent's workspace is a hiding violation.

Run ids are three lowercase letters, consonant–vowel–consonant while unused ones remain in
the project, then any three letters. They are unique per project and never reused.

## Postmortems

When the user asks what went wrong with a file or a run, check the records before saying
anything:

1. `python <skill-dir>/scripts/runs.py find <path> --repo <repo-root>` lists the runs that
   wrote the file and whether its current hash still matches.
2. Read that run's reviews, decision records, and `observed/` records.
3. Answer under the "I can't know" rule.

`runs.py list` shows the pile; `runs.py clean` removes runs (see `runs.py --help`).
Reported runs are kept unless named explicitly.

## Reference files

| File | Read by | When |
|---|---|---|
| `references/pipelines.md` | main agent only | choosing and running a pipeline |
| `references/redaction.md` | main agent only | building a redacted workspace |
| `references/records.md` | main agent only | reviewing a step, writing records and issue reports |
| `agents/framing.md` | every subagent | always in the brief |
| `agents/<agent-name>.md` | that subagent only | in its brief |
| `scripts/runs.py` | main agent | run ids, index, archive, list, clean, find |
