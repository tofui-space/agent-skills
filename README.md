# @tofui-space/agent-skills

## Introduction

Agent skills and rules to add to repositories, local, or remote settings of coding agents.

## Instructions

### Getting started

```sh
pnpm add -g --allow-build='@tofui-space/agent-skills@git+https://github.com/tofui-space/agent-skills.git' git+https://github.com/tofui-space/agent-skills.git
# or: npm i -g github:tofui-space/agent-skills

tofui-skills sync
tofui-skills list
```

`sync` (alias `pull`) fetches the latest catalog from GitHub. Reinstalling the CLI is only needed when the CLI
itself changes.

### Install

Run the appropriate commands according to the scope you wish the skills/rules to apply.

```sh
tofui-skills add a11y-writing                    # <repo root>/.claude — this project
tofui-skills add --all --global                  # global config — every project
tofui-skills add anti-vacuity --dir ../app       # ../app/.claude
tofui-skills add --all --agent codex             # <repo root>/.codex + AGENTS.md
tofui-skills add --all --agent all --global      # both agents, global
```

Without `--dir` or `--global`, the target is the root of the git repository around the current directory, so running the CLI from a package inside a monorepo still installs at the repository root. Outside a repository it is the current directory. To install into a package on purpose, pass `--dir .` from inside it.

| Flag             | Effect                                         |
|------------------|------------------------------------------------|
| `--agent <list>` | `claude`, `codex`, or `all` (default `claude`) |
| `-g, --global`   | target the agent's home config directory       |
| `--dir <path>`   | target `<path>/<agent config dir>`             |
| `--link`         | symlink instead of copy                        |
| `-f, --force`    | replace files this CLI did not install         |
| `--from <path>`  | read a catalog directory instead of the cache  |
| `--ref <ref>`    | sync a branch or tag                           |

Where things land:

|              | Claude Code                            | Codex                          |
|--------------|----------------------------------------|--------------------------------|
| skills       | `.claude/skills/<name>/`               | `.codex/skills/<name>/`        |
| rules        | `.claude/rules/<category>/<name>.md`   | `AGENTS.md`, managed block     |
| `-g` targets | `$CLAUDE_CONFIG_DIR`, else `~/.claude` | `$CODEX_HOME`, else `~/.codex` |

Claude Code loads both directories automatically, and `paths:` frontmatter scopes a rule to matching files.

Codex has no equivalent — its own `rules/` directory holds a sandbox approval DSL, not instructions — so rules are
inlined into an `AGENTS.md` block instead. Content outside the block is left alone. A rule's `paths:` globs are
written into that block as a sentence rather than enforced, because Codex cannot scope instructions by glob.

### Keeping up to date

`update` refreshes what is already installed and nothing else — unlike `add --all`, it never brings in catalog
entries you don't have.

```sh
tofui-skills update                              # ./.claude — refresh everything installed here
tofui-skills update --global                     # the global config
tofui-skills update --agent all --global         # both agents' global configs
tofui-skills update concise-docs                 # just the named entries
```

It pulls the catalog first when the cache is the active source (a checkout or `--from` is used as-is, and being
offline falls back to the last pull), keeps each entry's original copy/link mode, and skips entries whose installed
files already match the catalog byte-for-byte — no version numbers involved. Local edits to a tracked entry count
as stale and are overwritten; entries the CLI didn't install are never touched. Linked installs are already live,
so for them `update` (or `sync` alone) is a no-op.

### Using a local checkout

To install skills and rules that are not pushed — work in progress, or a catalog you never intend to publish — point the CLI at a checkout with `--from`. It reads the working tree as it is on disk, so uncommitted and untracked entries are installable too, and no `sync` is needed.

Run it from the root of the checkout and aim at the project with `--dir`, or at the global config with `--global`:

```sh
tofui-skills list --from .                                 # what the checkout offers
tofui-skills add a11y-writing --from . --dir ../app        # copy into ../app/.claude
tofui-skills add --all --link --from . --dir ../app        # symlink — edits in the checkout are live
tofui-skills add --all --from . --global                   # into the global config
tofui-skills update --from . --dir ../app                  # re-copy after editing the checkout
```

`--from .` can be left out there: the CLI detects the checkout it is run from and uses it ahead of the cache.

The path is resolved against the current directory, so the same works from the other side — inside the project, pointing back at the checkout:

```sh
tofui-skills add a11y-writing --from ../agent-skills       # copy into ./.claude
```

Set `TOFUI_SKILLS_SOURCE` to drop the flag everywhere:

```sh
export TOFUI_SKILLS_SOURCE=~/src/agent-skills
```

The CLI picks its catalog in this order: `--from`, `TOFUI_SKILLS_SOURCE`, a checkout enclosing the current directory, the synced cache, then the copy bundled with the installed package.

Keep the source consistent for `update`. Run without `--from` or the variable from another project, it pulls the cache and refreshes from that instead: entries that also exist on the remote are overwritten with the pushed version, and entries that only exist locally are reported as `gone` and left as they are.

### Disabling and removal

Being able to clean up after addons is important. Follow these steps to remove them.

```sh
tofui-skills status --agent all                  # what is installed where
tofui-skills remove a11y-writing                 # from ./.claude
tofui-skills remove a11y-writing --global        # from the global config
tofui-skills remove --agent codex comments       # drops it from AGENTS.md too
pnpm remove -g @tofui-space/agent-skills         # uninstall the CLI
```

Removal only touches entries recorded in `.tofui-skills.json` inside each agent's config directory. Files you wrote
by hand are left alone, and installing over one is skipped unless you pass `--force`. Removing the last Codex rule
takes the `AGENTS.md` block with it and deletes the file only if nothing else was in it.
