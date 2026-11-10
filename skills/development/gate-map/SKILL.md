---
name: gate-map
description: Map every check in a project that can stop something — CI jobs, required status checks, build steps, typecheck, lint, tests, container builds, migrations, entrypoint scripts, config and env validation at boot, health, readiness and startup probes, service start order, runtime guards — and write a plain-language Markdown map of what each check stops and where the gaps are. Use this skill whenever the user asks what blocks a merge, a build, a deploy or app startup; asks for a map, diagram, overview or audit of checks, gates, CI, pipeline or startup order; asks "can the app start without X", "what runs before the migrations", "is this check enforced", "why did this reach production", or "what happens if the migration fails"; or says "gate map" or "/gate-map". Use it even when the user names only one stage (CI only, startup only); the skill scopes itself. Do NOT use it to write or judge test quality, to fix a failing build, to run the pipeline, or to set up CI from scratch.
---

# Gate map

## Contents

- Scope
- Precedence
- Method
  1. Fix the reference point
  2. Inventory the files that define checks
  3. Record each check
  4. Trace the run order
  5. Find what the app relies on
  6. Decide which gaps to report
  7. Write the report
  8. Check the diagram renders
- Writing the report
- Reference files

A gate is a check whose failure stops something: a merge, a build, an image, a deploy, a container start, traffic to an instance, or a request. This skill produces one Markdown file that a developer of the project can read in a few minutes. Afterwards they know:

1. What runs, in order, from a merge to a request, and what each check stops when it fails.
2. Where the app relies on something that nothing checked first, or that a check catches too late.

The map is the report. A gap is shown at the step where it bites, for example: "The app starts taking requests. Gap: nothing has applied the migrations yet, so on a fresh database the first request that touches a new table fails."

## Scope

The skill covers three stages, in this order:

| Stage | Covers |
|---|---|
| CI and build | CI workflows, required checks, typecheck, lint, tests, build commands, container image builds |
| Deploy and startup | release or pre-deploy steps, migration jobs, init containers, entrypoint scripts, config and env validation at boot, start order between services, health, startup and readiness probes |
| Runtime | checks that run per request or on first use: middleware guards, lazy connections, lazy config reads, schema or version checks, feature flags that disable a path |

Local tooling (editor settings, pre-commit hooks) is out of scope unless CI runs the same command. If the user names a narrower scope, map only that, and say so in the report's opening.

If the project has no deploy or startup stage (a library, a CLI tool, a batch script), map only the stages that exist, and name the missing ones in the report's opening. Do not invent a start sequence or a request for a project that has neither.

## Precedence

An explicit instruction from the user about scope, output path or which report sections to include overrides the method and the template here. The rule against editing the project's checks, CI files or code while mapping still applies; fixing a gap is a separate request. Against other skills, the template in `references/report-template.md` decides the structure and wording rules of the report file; other skills govern only the chat around it.

## Method

### 1. Fix the reference point

Record the repository root, the commit (`git rev-parse HEAD`, plus `git status --short` to note uncommitted changes) and today's date. Every statement in the report is about this commit. If the directory is not a git repository, record the date and say so in the report's opening.

### 2. Inventory the files that define checks

Read `references/where-checks-live.md` now. It lists where checks are defined for each stage, and it holds the verified failure behaviour of the common tools, with doc links.

Find candidate files with a file search, then **read each candidate file in full**. A grep hit shows that a word appears. It does not show what runs, in what order, or under which condition. Shell scripts, entrypoints and CI files often put the deciding detail (`|| true`, `set -e` missing, an `if:` condition) a few lines away from the command.

### 3. Record each check

For each check, write down as working notes:

- **What it runs**: the command, probe, job or code path, under the name the project uses for it.
- **When it runs**: on pull request, on push to a branch, at image build, before container start, on every request, and any filter that can skip it.
- **What its failure stops**: one of `blocks merge`, `fails build`, `no image`, `deploy aborted`, `container exits`, `restarted`, `no traffic`, `request fails`, `logged only`, `nothing`. Establish it from the code and from the tool's documentation, not from the check's name. A job called `required-checks` is not required unless something makes it so.
- **Where it is defined**: `file:line`.

When the failure effect depends on settings outside the repository (branch protection, a hosting platform's dashboard, an orchestrator's admin config), record it as unknown and name the setting that decides it. Do not guess the setting.

When a tool is not in the reference file, look its behaviour up in the tool's official documentation before recording the effect, and cite the page in the evidence block. Behaviour recalled from memory is the failure mode this report exists to catch, so it must not enter the report.

### 4. Trace the run order

Follow what actually executes, from a merge to a request: the CI run, the image build, the deploy step, the image's entrypoint and command, each script those call, the application's main function up to the point where it accepts requests, and what each request passes through before a handler runs. Write down the order as it happens, including what runs in the background, in parallel, or only on first use.

This trace becomes the numbered list in the report. Startup order is easy to assume and easy to get wrong: a service can be declared to depend on another and still only wait for it to *start*, not to finish or become healthy.

### 5. Find what the app relies on

List what must be true before the app serves its first request. Typical needs:

- the database schema matches the code (migrations applied);
- required configuration and secrets are present and valid;
- backing services (database, cache, queue, other APIs) are reachable;
- built assets and generated code exist and match the source;
- the code that is deployed passed the checks that were meant to block it.

Add the needs specific to this project: the tables, settings and outside services its code actually uses.

For each need, find the check that guarantees it **before** the app relies on it. These words help the analysis. The report never shows them; it says what happens instead.

| Word | Meaning | Example |
|---|---|---|
| gated | A check whose failure stops the next step guarantees the need in time. | An init container runs migrations; the app container starts only after it succeeds. |
| missing | Nothing guarantees the need. | Nothing runs or verifies migrations before the app starts. |
| soft | A check exists but its failure is ignored. | `migrate || true` in the entrypoint; a CI job with `continue-on-error: true`. |
| late | The check runs after the need is already relied on. | Migrations run in a background thread after the server starts listening; a setting is read for the first time inside a request. |
| early | The check runs where it cannot see what will actually run, and nothing re-checks later. | CI tests run against a schema built from the models, not from the migration files. |
| hollow | The check passes without testing the need. | A readiness endpoint that returns 200 without touching the database it depends on. |
| bypassable | The check is skipped under conditions a normal change can meet. | A path filter that skips the test workflow for a directory that still affects the build. |

Walk the CI and build stage the same way: for each thing a merge or a build is assumed to guarantee ("main always typechecks", "the image only contains tested code"), find the check or record the gap.

### 6. Decide which gaps to report

Before reporting a gap, look for the check that would close it: another workflow, a platform release step, a wrapper script, a retry loop in the app's startup, a check in the application's main function. If you find it, the gap is ruled out; record it for the evidence block in one plain sentence.

Sort each remaining gap into one of three groups:

- **What can break**: with the files as they are today, a change that touches only application code, or a deploy that follows the project's own documented steps, produces a broken result, such as a failed request, untested code merged, or an app that starts in a broken state. These are marked in the map and described under "What can break".
- **Also noted**: a weakened check that guards code quality only (lint, formatting, coverage), not something the app relies on to serve requests, such as a formatting check allowed to fail; or a gap that no code path reaches today. One line each.
- **Not visible from the repository**: the answer depends on a setting outside it. One line each, naming the setting and where it lives.

### 7. Write the report

Read `references/report-template.md` now. It holds the template, the rules for each section, the rules for the rare diagram, and the Mermaid syntax rules.

Write the report to `docs/gate-map.md` unless the user named another path. If the file exists and was not written by this skill (its first line is not the `<!-- gate-map -->` marker), ask before overwriting it.

### 8. Check the diagram renders

Only if the report has a diagram: if `mmdc` (Mermaid CLI) is installed, render it to a temporary file, fix any parse error, and check its width against the limit in `references/report-template.md`. If `mmdc` is not installed, follow the syntax rules there strictly and say in the evidence block that the diagram was not rendered.

## Writing the report

- Write for a developer of the project who knows what the app does but has not read its CI files, its deploy files or its start code.
- Every sentence says what happens to a merge, an image, the app or a request. Name things the way that developer does: the service, job, script or command name.
- Outside the evidence block, write no file paths, no line numbers, no IDs for checks or gaps, none of the words from the table in step 5, and no severity labels.
- One fact per sentence. No parenthetical asides.
- Keep the audit trail in the evidence block: no run timestamps, no "not read", and no account of how you searched in the rest of the report. When a statement rests on something you did not read or run, add one plain sentence after it: "This assumes <what>; not checked."
- Do not mention earlier reports, task lists, reviews or other work from the session. The report describes this commit.
- The part outside the evidence block should take a few minutes to read. If it passes about 800 words, merge steps that stop the same thing and move detail into the evidence block. Never drop a step that has a check or a gap.
- Do not edit the project's checks, CI files or code while mapping.

## Reference files

- `references/where-checks-live.md`: where checks are defined, by stage, and the verified failure behaviour of GitHub Actions, Docker Compose and Kubernetes gates. Read at step 2.
- `references/report-template.md`: the report template, the rules for each section, the diagram rules and the Mermaid syntax rules. Read at step 7.
