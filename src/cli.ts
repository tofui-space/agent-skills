#!/usr/bin/env node
import path from 'node:path'
import { AGENT_IDS, parseAgents } from './agents.ts'
import { loadCatalog, selectEntries } from './catalog.ts'
import {
  agentsFileFor,
  inspect,
  install,
  isFileDelivered,
  readManifest,
  syncAgentsFile,
  targetRoot,
  trackedRules,
  uninstall,
  writeManifest,
} from './install.ts'
import {
  DEFAULT_REPO,
  describeCache,
  repoUrl,
  resolveSource,
  syncCache,
} from './source.ts'
import type {
  AgentDefinition,
  Catalog,
  CatalogEntry,
  InstallMode,
} from './types.ts'

/** Flags that consume the following argument; every other flag is boolean. */
const VALUE_FLAGS = new Set(['from', 'repo', 'ref', 'dir', 'agent'])

interface Args {
  readonly command: string
  readonly positionals: readonly string[]
  readonly flags: Readonly<Record<string, string | boolean>>
}

function parseArgs(argv: readonly string[]): Args {
  const flags: Record<string, string | boolean> = {}
  const positionals: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === undefined) continue

    if (arg === '--') {
      positionals.push(
        ...argv
          .slice(index + 1)
          .filter((value): value is string => value !== undefined),
      )
      break
    }

    if (arg.startsWith('--')) {
      const equals = arg.indexOf('=')
      if (equals !== -1) {
        flags[arg.slice(2, equals)] = arg.slice(equals + 1)
        continue
      }
      const key = arg.slice(2)
      if (VALUE_FLAGS.has(key)) {
        const next = argv[index + 1]
        if (next === undefined) throw new Error(`--${key} requires a value`)
        flags[key] = next
        index += 1
      } else {
        flags[key] = true
      }
      continue
    }

    if (arg.startsWith('-') && arg.length > 1) {
      for (const letter of arg.slice(1)) flags[letter] = true
      continue
    }

    positionals.push(arg)
  }

  const [command = 'help', ...rest] = positionals
  return { command, positionals: rest, flags }
}

function stringFlag(args: Args, name: string): string | undefined {
  const value = args.flags[name]
  return typeof value === 'string' ? value : undefined
}

function boolFlag(args: Args, ...names: readonly string[]): boolean {
  return names.some((name) => args.flags[name] === true)
}

const styled =
  process.stdout.isTTY === true && process.env.NO_COLOR === undefined
const bold = (text: string): string =>
  styled ? `\u001B[1m${text}\u001B[0m` : text
const dim = (text: string): string =>
  styled ? `\u001B[2m${text}\u001B[0m` : text

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

function summarise(text: string, width = 88): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat
}

function openCatalog(args: Args): {
  catalog: Catalog
  kind: string
  dir: string
} {
  const source = resolveSource(stringFlag(args, 'from'))
  return {
    catalog: loadCatalog(source.dir),
    kind: source.kind,
    dir: source.dir,
  }
}

function agentsFrom(args: Args): AgentDefinition[] {
  return parseAgents(stringFlag(args, 'agent'))
}

function rootFor(args: Args, agent: AgentDefinition): string {
  return targetRoot(agent, {
    dir: stringFlag(args, 'dir'),
    global: boolFlag(args, 'global', 'g'),
  })
}

function describeEntry(entry: CatalogEntry): string {
  if (entry.type === 'skill') {
    const group = entry.category ? dim(` (${entry.category})`) : ''
    return `  ${entry.id}${group}\n      ${dim(summarise(entry.description))}`
  }
  const scope = entry.paths.length
    ? `scoped to ${entry.paths.join(', ')}`
    : 'always on'
  return `  ${entry.id}\n      ${dim(summarise(scope))}`
}

function commandList(args: Args): void {
  const { catalog, kind, dir } = openCatalog(args)
  const wantSkills = !boolFlag(args, 'rules')
  const wantRules = !boolFlag(args, 'skills')

  console.log(dim(`catalog: ${dir} (${kind})`))

  if (wantSkills) {
    console.log(`\n${bold(`skills (${catalog.skills.length})`)}`)
    for (const entry of catalog.skills) console.log(describeEntry(entry))
  }
  if (wantRules) {
    console.log(`\n${bold(`rules (${catalog.rules.length})`)}`)
    for (const entry of catalog.rules) console.log(describeEntry(entry))
  }
}

function commandAdd(args: Args): void {
  const { catalog, kind, dir } = openCatalog(args)
  const all = boolFlag(args, 'all')
  const mode: InstallMode = boolFlag(args, 'link') ? 'link' : 'copy'
  const force = boolFlag(args, 'force', 'f')
  const agents = agentsFrom(args)

  const selectors = args.positionals
  if (!all && selectors.length === 0) {
    throw new Error(
      'Name at least one skill or rule, or pass --all. `tofui-skills list` shows both.',
    )
  }

  const chosen: CatalogEntry[] = all
    ? [...catalog.skills, ...catalog.rules]
    : (() => {
        const { chosen: found, missing } = selectEntries(catalog, selectors)
        if (missing.length)
          throw new Error(`Not found in the catalog: ${missing.join(', ')}`)
        return found
      })()

  const cache = kind === 'cache' ? describeCache() : null
  console.log(dim(`catalog: ${dir} (${kind})`))

  let installed = 0
  let skipped = 0

  for (const agent of agents) {
    const root = rootFor(args, agent)
    const manifest = readManifest(root)
    console.log(`\n${bold(agent.label)} ${dim(root)}`)

    for (const entry of chosen) {
      const placement = inspect(entry, agent, root, manifest)
      if (placement.exists && !placement.tracked && !force) {
        console.log(
          `  skip    ${entry.type} ${entry.id} ${dim('(exists, not installed by this CLI; --force to replace)')}`,
        )
        skipped += 1
        continue
      }
      install(entry, agent, root, manifest, {
        mode,
        origin: cache?.url ?? undefined,
        commit: cache?.commit ?? undefined,
      })
      const where = isFileDelivered(entry, agent)
        ? path.relative(root, placement.dest)
        : path.basename(placement.dest)
      console.log(
        `  ${placement.tracked ? 'update ' : 'install'} ${entry.type} ${entry.id} ${dim(`→ ${where}`)}`,
      )
      installed += 1
    }

    writeManifest(root, manifest)
    if (agent.ruleDelivery === 'agents-md') {
      const file = agentsFileFor(root)
      syncAgentsFile(file, trackedRules(manifest, catalog.rules))
      console.log(dim(`  rules folded into ${file}`))
    }
  }

  console.log(`\n${installed} installed, ${skipped} skipped.`)
  if (mode === 'link')
    console.log(dim('Linked entries track the catalog directory directly.'))
}

function commandRemove(args: Args): void {
  const { catalog } = openCatalog(args)
  const agents = agentsFrom(args)

  if (args.positionals.length === 0)
    throw new Error('Name at least one installed skill or rule to remove.')

  const { chosen, missing } = selectEntries(catalog, args.positionals)
  if (missing.length)
    throw new Error(`Not found in the catalog: ${missing.join(', ')}`)

  for (const agent of agents) {
    const root = rootFor(args, agent)
    const manifest = readManifest(root)
    console.log(`\n${bold(agent.label)} ${dim(root)}`)

    for (const entry of chosen) {
      const placement = inspect(entry, agent, root, manifest)
      if (!placement.exists) {
        console.log(`  absent  ${entry.type} ${entry.id}`)
        continue
      }
      uninstall(entry, agent, root, manifest)
      console.log(`  removed ${entry.type} ${entry.id}`)
    }

    writeManifest(root, manifest)
    if (agent.ruleDelivery === 'agents-md') {
      syncAgentsFile(agentsFileFor(root), trackedRules(manifest, catalog.rules))
    }
  }
}

function commandSync(args: Args): void {
  const result = syncCache({
    repo: stringFlag(args, 'repo'),
    ref: stringFlag(args, 'ref'),
    log: (message) => console.log(dim(message)),
  })
  console.log(`Catalog at ${result.commit} in ${result.dir}`)

  const catalog = loadCatalog(result.dir)
  console.log(
    `${count(catalog.skills.length, 'skill')}, ${count(catalog.rules.length, 'rule')} available.`,
  )
}

function commandStatus(args: Args): void {
  const cache = describeCache()
  console.log(bold('remote'))
  console.log(`  ${repoUrl(stringFlag(args, 'repo'))}`)

  console.log(`\n${bold('cache')}`)
  if (!cache) console.log(dim('  not cloned yet — run `tofui-skills sync`'))
  else
    console.log(
      `  ${cache.dir}\n  ${cache.commit ?? 'unknown'} ${dim(cache.age ?? '')}`,
    )

  const source = resolveSource(stringFlag(args, 'from'))
  const catalog = loadCatalog(source.dir)
  console.log(`\n${bold('active catalog')}`)
  console.log(`  ${source.dir} ${dim(`(${source.kind})`)}`)
  console.log(
    `  ${count(catalog.skills.length, 'skill')}, ${count(catalog.rules.length, 'rule')}`,
  )

  for (const agent of agentsFrom(args)) {
    const root = rootFor(args, agent)
    const entries = Object.values(readManifest(root).entries)
    console.log(`\n${bold(`installed — ${agent.label}`)}`)
    console.log(`  ${root}`)
    if (entries.length === 0) console.log(dim('  nothing installed here'))
    for (const entry of entries) {
      console.log(
        `  ${entry.type} ${entry.id} ${dim(`${entry.mode}, ${entry.installedAt.slice(0, 10)}`)}`,
      )
    }
  }
}

function commandHelp(): void {
  console.log(`${bold('tofui-skills')} — install agent skills and rules into a working directory

${bold('Usage')}
  tofui-skills <command> [options]

${bold('Commands')}
  list                     Show every skill and rule in the catalog
  add <name...> | --all    Install skills and rules for the chosen agents
  remove <name...>         Remove previously installed entries
  sync                     Clone or fast-forward the catalog from the remote
  status                   Show remote, cache, active catalog and installs

${bold('Options')}
      --agent <list>       ${AGENT_IDS.join(', ')} or all (default claude)
  -g, --global             Target the agent's home config directory
      --dir <path>         Target <path>/<agent config dir>
      --link               Symlink to the catalog instead of copying
  -f, --force              Replace files this CLI did not install
      --from <path>        Use a catalog directory instead of the cache
      --repo <url>         Override the remote (default ${DEFAULT_REPO})
      --ref <ref>          Sync a branch or tag instead of the default head
      --skills / --rules   Restrict \`list\` to one kind

${bold('Where things land')}
  Claude Code   skills → .claude/skills/<name>/        catalog category dropped
                rules  → .claude/rules/<category>/<name>.md
  Codex         skills → .codex/skills/<name>/
                rules  → AGENTS.md, inside a managed block

  Codex has no glob-scoped rule mechanism, so a rule's \`paths:\` frontmatter
  is inlined as prose rather than enforced.

  -g targets $CLAUDE_CONFIG_DIR / $CODEX_HOME, falling back to ~/.claude
  and ~/.codex.

${bold('Environment')}
  TOFUI_SKILLS_REPO        Default remote URL
  TOFUI_SKILLS_SOURCE      Default catalog directory
  TOFUI_SKILLS_HOME        Cache location (default ~/.cache/tofui-skills)
`)
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (boolFlag(args, 'help', 'h')) {
    commandHelp()
    return
  }

  switch (args.command) {
    case 'list':
    case 'ls':
      commandList(args)
      break
    case 'add':
    case 'install':
      commandAdd(args)
      break
    case 'remove':
    case 'rm':
      commandRemove(args)
      break
    case 'sync':
    case 'update':
      commandSync(args)
      break
    case 'status':
      commandStatus(args)
      break
    case 'help':
      commandHelp()
      break
    default:
      console.error(`Unknown command: ${args.command}\n`)
      commandHelp()
      process.exitCode = 1
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
