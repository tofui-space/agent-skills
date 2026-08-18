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

`sync` pulls the latest catalog from GitHub. Reinstalling the CLI is only needed when the CLI itself changes.

### Install

Run the appropriate commands according to the scope you wish the skills/rules to apply.

```sh
tofui-skills add a11y-writing                    # ./.claude — this project
tofui-skills add --all --global                  # global config — every project
tofui-skills add anti-vacuity --dir ../app       # ../app/.claude
tofui-skills add --all --agent codex             # ./.codex + AGENTS.md
tofui-skills add --all --agent all --global      # both agents, global
```

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
