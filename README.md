# @tofui-space/agent-skills

## Introduction

Agent skills and rules to add to repositories, local, or remote settings of coding agents.

## Instructions

### Getting started

```sh
pnpm add -g git+https://github.com/tofui-space/agent-skills.git
# or: npm i -g github:tofui-space/agent-skills

tofui-skills sync
tofui-skills list
```

`sync` pulls the latest catalog from GitHub. Reinstalling the CLI is only needed when the CLI itself changes.

### Install

Run the appropriate commands according to the scope you wish the skills/rules to apply.

```sh
tofui-skills add a11y-writing               # ./.claude — this project
tofui-skills add --all --global             # global config — every project
tofui-skills add anti-vacuity --dir ../app  # ../app/.claude
```

| Flag            | Effect                                        |
|-----------------|-----------------------------------------------|
| `-g, --global`  | target `$CLAUDE_CONFIG_DIR`, else `~/.claude` |
| `--dir <path>`  | target `<path>/.claude`                       |
| `--link`        | symlink instead of copy                       |
| `-f, --force`   | replace files this CLI did not install        |
| `--from <path>` | read a catalog directory instead of the cache |
| `--ref <ref>`   | sync a branch or tag                          |

Skills land in `.claude/skills/<name>/`, rules in `.claude/rules/<category>/<name>.md`. Both load automatically;
`paths:` frontmatter scopes a rule to matching files.

### Disabling and removal

Being able to clean up after addons is important. Follow these steps to remove them.

```sh
tofui-skills status                         # what is installed where
tofui-skills remove a11y-writing            # from ./.claude
tofui-skills remove a11y-writing --global   # from ~/.claude
pnpm remove -g @tofui-space/agent-skills    # uninstall the CLI
```

Removal only touches entries recorded in `.claude/.tofui-skills.json`. Files you wrote by hand are left alone, and
installing over one is skipped unless you pass `--force`.
