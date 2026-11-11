# TypeScript setup

The existing TypeScript backend remains in `scripts/`; its executable paths and entry files are unchanged. The language split is in the references.

Below, `<skill>` is the skill root containing `SKILL.md` and `scripts/`, two directories above this reference. `<project>` is the root of the project under work.

**Requirements.** Node.js 24 or later, and a TypeScript project that compiles with `strictNullChecks`. Run `node --version` first. Below 24, say so and stop: the tools were not run there. They were run on Node 24.22. They bring their own TypeScript 6.0 compiler and the Z3 solver; the project's own TypeScript version does not matter to them.

**Install the tools' two dependencies once.** Look for `<skill>/scripts/node_modules` first; when it is there, skip this. Otherwise:

```sh
cd <skill>/scripts && pnpm install --frozen-lockfile --ignore-workspace
```

This writes `node_modules` into the skill's own `scripts` folder and nowhere else. pnpm is the package manager this was run with, and the lockfile is its; another package manager will resolve the two dependencies from `package.json` without it. If a tool stops with "Cannot find package 'ts6'", this step is missing.

**Run every tool with Node, from anywhere**, naming the project:

```sh
node <skill>/scripts/inventory.ts --root=<project>
```

A file argument may be relative to the project root.

**Settings.** A project may hold a `verifiable.json` at its root. Without one, the tools expect `src/decisions`, `src/classifiers`, `src/adapters`, `src/wiring`, `src/conversions` and specs in `spec/`. Read `references/typescript/tools.md` for every setting before you write the file; a setting the tools do not know is an error, by design.

**Entry file.** The computed checks run under the project's own runner through one small file. Copy `assets/entries/verifiable.node.test.mjs` (for `node:test`) or `assets/entries/verifiable.vitest.test.mjs` (for Vitest) to the project root, and set `VERIFIABLE_TOOLS=<skill>/scripts` in the environment of the command that runs it. The file names no path of this machine, so it can be committed. Give it a command of its own, such as a `test:computed` script, and keep it out of the glob of the project's ordinary test command: the entry file stops with an error when the variable is not set, and the ordinary tests should not depend on it.

Before running a command, read [commands.md](commands.md). For coverage also read [coverage.md](coverage.md).
