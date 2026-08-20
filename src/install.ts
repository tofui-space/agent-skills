import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {
  AgentDefinition,
  CatalogEntry,
  InstallMode,
  Manifest,
  ManifestEntry,
  RuleEntry,
} from './types.ts'

const MANIFEST_FILE = '.tofui-skills.json'

const BLOCK_BEGIN = '<!-- tofui-skills:begin -->'
const BLOCK_END = '<!-- tofui-skills:end -->'

export interface TargetOptions {
  readonly dir?: string | undefined
  readonly global?: boolean | undefined
}

/**
 * Resolves the config directory an agent actually reads. A global install
 * follows the agent's own home variable (CLAUDE_CONFIG_DIR, CODEX_HOME) when
 * set, because relocating that directory is how both agents are configured.
 */
export function targetRoot(
  agent: AgentDefinition,
  options: TargetOptions = {},
): string {
  if (options.dir) return path.resolve(options.dir, agent.configDir)
  if (options.global) {
    const configured = process.env[agent.homeEnv]
    return configured
      ? path.resolve(configured)
      : path.join(os.homedir(), agent.configDir)
  }
  return path.resolve(process.cwd(), agent.configDir)
}

/** True when this entry is written as a file rather than folded into AGENTS.md. */
export function isFileDelivered(
  entry: CatalogEntry,
  agent: AgentDefinition,
): boolean {
  return entry.type === 'skill' || agent.ruleDelivery === 'files'
}

export function destinationFor(
  entry: CatalogEntry,
  agent: AgentDefinition,
  root: string,
): string {
  if (entry.type === 'skill') return path.join(root, 'skills', entry.id)
  if (agent.ruleDelivery === 'files') {
    return path.join(root, 'rules', entry.relPath)
  }
  return agentsFileFor(root)
}

/**
 * AGENTS.md sits beside the config directory, since Codex scopes it to the
 * directory tree containing it rather than to its own config folder.
 */
export function agentsFileFor(root: string): string {
  return path.join(path.dirname(root), 'AGENTS.md')
}

export function manifestKey(entry: Pick<CatalogEntry, 'type' | 'id'>): string {
  return `${entry.type}:${entry.id}`
}

export function readManifest(root: string): Manifest {
  const file = path.join(root, MANIFEST_FILE)
  if (!fs.existsSync(file)) return { version: 1, entries: {} }
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    const entries =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { entries?: unknown }).entries
        : undefined
    return {
      version: 1,
      entries:
        typeof entries === 'object' && entries !== null
          ? (entries as Record<string, ManifestEntry>)
          : {},
    }
  } catch {
    return { version: 1, entries: {} }
  }
}

export function writeManifest(root: string, manifest: Manifest): void {
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(
    path.join(root, MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
}

function replaceWithCopy(from: string, to: string): void {
  fs.rmSync(to, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true, dereference: true })
}

function replaceWithLink(from: string, to: string): void {
  fs.rmSync(to, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.symlinkSync(from, to, fs.statSync(from).isDirectory() ? 'dir' : 'file')
}

export interface Placement {
  readonly dest: string
  /** True when something already occupies the destination, including a broken symlink. */
  readonly exists: boolean
  /** True when the manifest records this CLI as the installer. */
  readonly tracked: boolean
  readonly key: string
}

/**
 * Anything present that the manifest does not claim was put there by hand,
 * so replacing it requires an explicit --force.
 */
export function inspect(
  entry: CatalogEntry,
  agent: AgentDefinition,
  root: string,
  manifest: Manifest,
): Placement {
  const dest = destinationFor(entry, agent, root)
  const key = manifestKey(entry)
  // A rule folded into AGENTS.md shares one file with every other rule, so
  // the file existing says nothing about this entry. The manifest decides.
  const exists = isFileDelivered(entry, agent)
    ? fs.lstatSync(dest, { throwIfNoEntry: false }) !== undefined
    : manifest.entries[key] !== undefined
  return { dest, exists, tracked: manifest.entries[key] !== undefined, key }
}

/** True when the installed copy matches the catalog byte-for-byte. */
export function contentEquals(from: string, to: string): boolean {
  const source = fs.statSync(from, { throwIfNoEntry: false })
  const installed = fs.lstatSync(to, { throwIfNoEntry: false })
  if (source === undefined || installed === undefined) return false
  if (source.isDirectory()) {
    if (!installed.isDirectory()) return false
    const sourceNames = fs.readdirSync(from).sort()
    const installedNames = fs.readdirSync(to).sort()
    return (
      sourceNames.length === installedNames.length &&
      sourceNames.every(
        (name, index) =>
          name === installedNames[index] &&
          contentEquals(path.join(from, name), path.join(to, name)),
      )
    )
  }
  if (!installed.isFile()) return false
  if (source.size !== installed.size) return false
  return fs.readFileSync(from).equals(fs.readFileSync(to))
}

/**
 * True when the installed entry already reflects the catalog: a copy that
 * matches byte-for-byte, or a link that resolves into the catalog source.
 * Only meaningful for file-delivered entries; AGENTS.md rules are compared
 * at the file level by syncAgentsFile.
 */
export function isCurrent(
  entry: CatalogEntry,
  agent: AgentDefinition,
  root: string,
  mode: InstallMode,
): boolean {
  const from = entry.type === 'skill' ? entry.dir : entry.file
  const dest = destinationFor(entry, agent, root)
  if (mode === 'link') {
    try {
      return (
        fs.lstatSync(dest).isSymbolicLink() &&
        fs.realpathSync(dest) === fs.realpathSync(from)
      )
    } catch {
      return false
    }
  }
  return contentEquals(from, dest)
}

export interface InstallOptions {
  readonly mode: InstallMode
  readonly origin?: string | undefined
  readonly commit?: string | undefined
}

/**
 * Returns the path written, or null when the entry only became a manifest
 * record because it is delivered through AGENTS.md. Callers must then call
 * syncAgentsFile to materialise it.
 */
export function install(
  entry: CatalogEntry,
  agent: AgentDefinition,
  root: string,
  manifest: Manifest,
  options: InstallOptions,
): string | null {
  const { dest, key } = inspect(entry, agent, root, manifest)

  manifest.entries[key] = {
    type: entry.type,
    id: entry.id,
    source: entry.source,
    mode: options.mode,
    installedAt: new Date().toISOString(),
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(options.commit === undefined ? {} : { commit: options.commit }),
  }

  if (!isFileDelivered(entry, agent)) return null

  const from = entry.type === 'skill' ? entry.dir : entry.file
  if (options.mode === 'link') replaceWithLink(from, dest)
  else replaceWithCopy(from, dest)
  return dest
}

export function uninstall(
  entry: CatalogEntry,
  agent: AgentDefinition,
  root: string,
  manifest: Manifest,
): string | null {
  const { dest, key } = inspect(entry, agent, root, manifest)
  delete manifest.entries[key]

  if (!isFileDelivered(entry, agent)) return null

  fs.rmSync(dest, { recursive: true, force: true })

  // A category directory left empty by a removed rule is noise.
  const stopAt = path.join(root, entry.type === 'skill' ? 'skills' : 'rules')
  let dir = path.dirname(dest)
  while (dir.startsWith(stopAt) && dir !== stopAt) {
    if (!fs.existsSync(dir) || fs.readdirSync(dir).length > 0) break
    fs.rmdirSync(dir)
    dir = path.dirname(dir)
  }

  return dest
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart()
}

/**
 * Inlines rule bodies, because AGENTS.md has no include mechanism. A rule's
 * `paths:` globs survive as a prose line: Codex cannot enforce glob scoping,
 * so the scope has to be stated where the model will read it.
 */
export function renderRulesBlock(rules: readonly RuleEntry[]): string {
  const sections = rules.map((rule) => {
    const scope =
      rule.paths.length > 0
        ? `Applies to files matching ${rule.paths.map((glob) => `\`${glob}\``).join(', ')}.\n\n`
        : ''
    return `## ${rule.id}\n\n${scope}${stripFrontmatter(fs.readFileSync(rule.file, 'utf8')).trimEnd()}\n`
  })

  return [
    BLOCK_BEGIN,
    '<!-- Managed by tofui-skills. Edits inside this block are overwritten. -->',
    '',
    ...sections,
    BLOCK_END,
  ].join('\n')
}

/**
 * Replaces the managed block in place, leaving any hand-written AGENTS.md
 * content untouched. Passing no rules removes the block entirely. Returns
 * true when the file actually changed.
 */
export function syncAgentsFile(
  file: string,
  rules: readonly RuleEntry[],
): boolean {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const block = rules.length > 0 ? renderRulesBlock(rules) : ''

  const begin = existing.indexOf(BLOCK_BEGIN)
  const end = existing.indexOf(BLOCK_END)

  let next: string
  if (begin !== -1 && end !== -1 && end > begin) {
    const before = existing.slice(0, begin).trimEnd()
    const after = existing.slice(end + BLOCK_END.length).trimStart()
    next = [before, block, after].filter((part) => part.length > 0).join('\n\n')
  } else if (block.length > 0) {
    next = [existing.trimEnd(), block]
      .filter((part) => part.length > 0)
      .join('\n\n')
  } else {
    next = existing.trimEnd()
  }

  if (next.length === 0) {
    const existed = fs.existsSync(file)
    fs.rmSync(file, { force: true })
    return existed
  }

  const output = `${next}\n`
  if (output === existing) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, output)
  return true
}

/** Rules the manifest still claims, in catalog order, for re-rendering. */
export function trackedRules(
  manifest: Manifest,
  catalog: readonly RuleEntry[],
): RuleEntry[] {
  return catalog.filter(
    (rule) => manifest.entries[manifestKey(rule)] !== undefined,
  )
}
