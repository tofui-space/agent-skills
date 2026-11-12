import fs from 'node:fs'
import path from 'node:path'
import { AGENTS, isAgentId } from './agents.ts'
import { readManifest } from './install.ts'
import { cacheDir } from './source.ts'
import type { AgentDefinition } from './types.ts'

const REGISTRY_FILE = 'installs.json'

/** Directory names never descended into while scanning, because they hold no project of their own. */
const SCAN_SKIP = new Set(['node_modules', 'dist', 'build', 'target', 'vendor'])

/** One agent config directory that holds a manifest written by this CLI. */
export interface Target {
  readonly agent: AgentDefinition
  readonly root: string
}

/**
 * The file listing every config directory this CLI has installed into.
 * It sits beside the catalog cache, so `TOFUI_SKILLS_HOME` relocates both.
 */
export function registryFile(): string {
  return path.join(cacheDir(), REGISTRY_FILE)
}

function sameRoot(left: string, right: string): boolean {
  const a = path.resolve(left)
  const b = path.resolve(right)
  return process.platform === 'win32'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b
}

/** True when both name the same agent and the same directory; Windows paths compare without case. */
export function sameTarget(left: Target, right: Target): boolean {
  return left.agent.id === right.agent.id && sameRoot(left.root, right.root)
}

/** Drops repeats of the same agent and directory, keeping the first. */
export function dedupeTargets(targets: readonly Target[]): Target[] {
  const kept: Target[] = []
  for (const target of targets) {
    if (!kept.some((other) => sameTarget(other, target))) kept.push(target)
  }
  return kept
}

/** True when the manifest at `root` records at least one entry. */
export function hasInstalls(root: string): boolean {
  return Object.keys(readManifest(root).entries).length > 0
}

/** Reads the registry; a missing or unreadable file, and entries naming an unknown agent, read as nothing. */
export function readRegistry(file: string): Target[] {
  if (!fs.existsSync(file)) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return []
  }
  const list =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as { targets?: unknown }).targets
      : undefined
  if (!Array.isArray(list)) return []

  const targets: Target[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const { agent, root } = item as { agent?: unknown; root?: unknown }
    if (typeof agent !== 'string' || !isAgentId(agent)) continue
    if (typeof root !== 'string') continue
    targets.push({ agent: AGENTS[agent], root: path.resolve(root) })
  }
  return dedupeTargets(targets)
}

export function writeRegistry(file: string, targets: readonly Target[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const data = {
    version: 1,
    targets: dedupeTargets(targets).map((target) => ({
      agent: target.agent.id,
      root: target.root,
    })),
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

/**
 * Brings the registry in line with the manifest at `target.root`.
 * The target is listed while its manifest tracks anything and dropped once it tracks nothing.
 */
export function recordTarget(file: string, target: Target): void {
  const others = readRegistry(file).filter(
    (other) => !sameTarget(other, target),
  )
  writeRegistry(file, hasInstalls(target.root) ? [...others, target] : others)
}

/**
 * Finds every `<dir>/<agent config dir>` holding a manifest with entries, starting at each directory in `starts` and descending at most `maxDepth` levels.
 * Hidden directories, build output, and dependency folders are not descended into, and symbolic links and junctions are not followed.
 */
export function scanForTargets(
  starts: readonly string[],
  maxDepth = 4,
): Target[] {
  const found: Target[] = []

  const visit = (dir: string, depth: number): void => {
    for (const agent of Object.values(AGENTS)) {
      const root = path.join(dir, agent.configDir)
      if (hasInstalls(root)) found.push({ agent, root })
    }
    if (depth >= maxDepth) return

    let children: fs.Dirent[]
    try {
      children = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const child of children) {
      if (!child.isDirectory()) continue
      if (child.name.startsWith('.') || SCAN_SKIP.has(child.name)) continue
      visit(path.join(dir, child.name), depth + 1)
    }
  }

  for (const start of starts) visit(path.resolve(start), 0)
  return dedupeTargets(found)
}
