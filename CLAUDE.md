# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Two things in one: a catalog of authored agent skills (`skills/`) and rules (`rules/`), and the TypeScript CLI in `src/` that installs them into any working directory. The catalog is Markdown/JSON; only the CLI is code.

`WORKBENCH.md` tracks skills that are drafted but not landed, and records the decisions already made about each one. Read it before starting or resuming work on a skill — it exists so a session does not re-run a review, reopen a declined option, or re-grind a description that was deliberately left as it is. Update the entry when a stage closes, and delete the section when the skill lands.

## Commands

```sh
pnpm install          # also runs prepare → tsc
pnpm test             # node --test over test/*.test.ts
pnpm test:watch       # same, re-running on change
pnpm typecheck        # tsc -p tsconfig.test.json (src + test, no emit)
pnpm build            # tsc -p .                  (src only, emits dist/)
pnpm lint             # biome check .             (lint:fix to apply)
pnpm dev list         # run src/cli.ts directly, no build
node dist/cli.js list # run the built CLI
```

Run a single test file or a single case:

```sh
node --experimental-strip-types --test test/install.test.ts
node --experimental-strip-types --test --test-name-pattern 'prunes category' 'test/*.test.ts'
```

## Toolchain constraints

Four settings that look arbitrary and will break something if "tidied":

- **`.ts` import extensions.** Source files import each other as `./catalog.ts`, not `./catalog.js`, via `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`. This is what lets `pnpm dev` and `pnpm test` run `src/` under Node's type stripping with no build step; tsc rewrites the specifiers to `.js` on emit. Rewriting them to `.js` breaks both.
- **Two tsconfigs.** `tsconfig.json` is src-only so `build` emits just the shipped CLI. `tsconfig.test.json` widens `include` and sets `noEmit` so tests get typechecked without landing in `dist/`.
- **`prepare` runs `tsc`.** That is what makes `npm i -g github:tofui-space/agent-skills` work with no published package and no committed `dist/`. Do not remove it.
- **Biome excludes `skills/` and `rules/`.** Those are catalog content, not code; letting Biome reformat `knowledge-map.json` would churn data the skill reads at runtime. `.editorconfig` is markdown-only for the same reason — Biome has no markdown formatter, and prose here uses semantic line breaks, so nothing sets a column limit.

## Structure

```
src/                  # the CLI (cli, catalog, source, install, types)
test/                 # node:test suites + helpers.ts fixture builder
skills/<category>/<skill-name>/
  SKILL.md            # required: frontmatter + instructions
  references/         # optional: deep material, loaded on demand
  knowledge-map.json  # developer-experience only: coverage ledger
rules/<category>/*.md # rule files with `paths:` frontmatter globs
```

## Testing

Zero test dependencies — `node:test` plus `node:assert/strict`, run under type stripping. `test/helpers.ts` builds a throwaway catalog in a temp directory covering every layout discovery cares about: flat skills, category-nested skills, a flat skill shadowing a nested one, directories with no `SKILL.md`, rules at three depths, and two rules sharing a basename so ambiguous selectors can be asserted.

Tests must never write into a real config directory. Every target is a `mkdtemp` directory passed as `--dir`, and the one case that touches `CLAUDE_CONFIG_DIR` asserts the computed path only. `node --test` gives each file its own process, so mutating `process.env` or `process.cwd()` in one file cannot leak into another — restore both anyway.

## How the CLI works

`tofui-skills` copies catalog entries into an agent's config directory. `src/agents.ts` holds the per-agent table; adding an agent should mean adding a row there, not branching at call sites.

Skills are portable — both agents read `<config>/skills/<name>/SKILL.md`, and the catalog category is dropped because the folder name becomes the skill name. Rules are not portable, and the asymmetry is the core of the design:

| | Claude Code | Codex |
|---|---|---|
| config dir | `.claude`, `$CLAUDE_CONFIG_DIR` | `.codex`, `$CODEX_HOME` |
| rules | `rules/<category>/<name>.md`, loaded recursively | inlined into `AGENTS.md` |
| `paths:` globs | enforced natively | restated as prose, not enforced |

**Do not install rules into `~/.codex/rules/`.** That directory is a sandbox approval DSL — entries look like `prefix_rule(pattern=["uv","run"], decision="allow")` — not instructions. Markdown there is wrong and may break Codex's parser. Prose reaches Codex only through `AGENTS.md`, which Codex scopes to the directory tree containing it; that is why `agentsFileFor` puts it beside the config directory rather than inside it.

The `AGENTS.md` block is delimited by `<!-- tofui-skills:begin -->` / `:end` markers and rewritten wholesale from the manifest on every add and remove. Content outside the markers is never touched. Rule bodies are inlined because `AGENTS.md` has no include mechanism.

Catalog resolution order is `--from` → env → enclosing checkout → `~/.cache/tofui-skills/repo` → the bundled copy inside the installed package. Running the CLI inside this repo therefore uses the working tree, not the cache — which is what makes local edits testable.

`<config>/.tofui-skills.json` records what the CLI installed, one manifest per agent. Anything not in it is treated as hand-written and skipped rather than overwritten unless `--force` is passed; preserve that behavior. For a rule folded into `AGENTS.md` the manifest is the *only* evidence of presence, since every rule shares one file — that is why `inspect` consults the manifest instead of the filesystem for those entries.

`install` and `uninstall` return `null` rather than a path when an entry is delivered through `AGENTS.md`; callers must then call `syncAgentsFile` with `trackedRules(manifest, catalog.rules)`. Passing the whole `Catalog` there typechecks as an error but would only fail at runtime, so keep `pnpm typecheck` in the loop.

This machine sets `CLAUDE_CONFIG_DIR` to `~/.claude-personal`. That directory also holds third-party skills installed via the separate `skills` CLI and tracked in `~/.agents/.skill-lock.json` — only entries present in this repo are authored here.

## How skills load (progressive disclosure)

Three tiers, each loaded later than the last:

1. **Frontmatter `description`** — injected into every session. It is the routing text that decides whether the skill fires, so it must spell out trigger phrases, when to invoke, and when to skip. Existing skills write these as long, explicit trigger specs — keep that style.
2. **SKILL.md body** — loaded only on invocation. The actual instructions.
3. **`references/*.md`** — loaded only when the body tells the model to read them. The body must say when each reference is worth reading, or it never will be.

When editing a skill, keep the description and body consistent: a behavior promised in the description must exist in the body.

## Skill-specific invariants

- **developer-experience**: knowledge is stored as *conditional rules* (prefer X when …, overridden by …), never as a good/bad checklist — that framing is the skill's entire point. `knowledge-map.json` is the per-entry coverage ledger (status/depth/richness/sources/confidence) that the skill reads at runtime; update the matching entry whenever you change the skill's content.
- **a11y-writing** and **anti-vacuity** are companion output-shaping skills (structure vs. clause-level density) with overlapping trigger words ("concise", "shorter", "no fluff") — intentional, since both should fire together.

## Rules

Files under `rules/` use a `paths:` frontmatter key with glob patterns that scope where the rule applies (see `rules/development/comments.md`). They are deployable content, not conventions for this repo itself.

<!-- gitbutler-agent-setup:start -->
## Version control

- Use GitButler (`but`) for version-control inspection and write operations, including status, diffs, branching, committing, pushing, and history edits.
- Assume multiple agents may be working in this repository. Do not move, amend, squash, discard, commit, push, or otherwise modify another agent's work unless the user asks.
- For commit just/only/specific changes on a new branch (selected-change requests), use the two-command fast path from the GitButler skill: `but diff`, then `but commit -b <branch> -m "message" <id> <id>`.
- For that fast path, after the commit succeeds, stop and summarize; do not run separate branch, staging, status, or diff commands unless the commit output is missing information you need.
- Use the installed GitButler skill for command recipes and syntax before guessing flags, using `--help`, or translating Git habits directly.
- Mutation commands report their result without appending workspace status. Add `--status-after` only when the next step needs resulting workspace IDs or details; otherwise do not rerun status or diff to verify success.
- Use a dedicated GitButler branch for each agent session, unless the user asks for a different branch structure. Commit only changes that belong to that session.
- Do not push or open pull requests unless the user asks.
- Keep commit messages and pull request descriptions succinct: explain what changed, why it changed, and any important decision.

### Amend local fixes into the right commits

- For small cleanup or follow-up fixes, amend an unpublished local commit when the change clearly belongs with that commit's intent.
- Do not create tiny fixup commits unless the user asks.
- Use GitButler to move the relevant changes into the commit where they belong.
- Ask before rewriting pushed, reviewed, shared, or ambiguous history.

### Split unrelated changes into separate commits

- If one file contains unrelated changes, split them by hunk instead of committing the whole file.
- Keep tests with the behavior they verify.
- Split generated output, docs-only edits, or mechanical cleanup into separate commits when each commit remains coherent on its own.
- If the split is ambiguous, summarize the options before committing.

### Create stacked pull requests

- If this session depends on another in-flight branch, stack its branch on top of that dependency instead of mixing the changes.
- If this session is working in a stack, put commits on the branch where they belong.
- Ask before moving commits onto lower, pushed, reviewed, or shared branches.
- Use `but move` for branch stacking and restacking. Do not recreate branches to simulate stacking.
- For stacked branches, create pull requests with `but pr`, not `gh`, so GitButler keeps the right PR base branches and stack metadata.

### Branch naming

- When creating a GitButler branch for an agent session, use `'work/<area>/<short-topic>`.

### Commit message convention

- Follow the `<type>(<scope>): <imperative summary>` commit-message convention when writing commit messages.
<!-- gitbutler-agent-setup:end -->
