import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {
  CatalogEntry,
  InstallMode,
  Manifest,
  ManifestEntry,
} from './types.ts'

const MANIFEST_FILE = '.tofui-skills.json'

export interface TargetOptions {
  readonly dir?: string | undefined
  readonly global?: boolean | undefined
}

/**
 * Resolves the config directory that skills and rules are installed into.
 * A global install follows CLAUDE_CONFIG_DIR when set, since that is the
 * directory the agent actually reads.
 */
export function targetRoot(options: TargetOptions = {}): string {
  if (options.dir) return path.resolve(options.dir, '.claude')
  if (options.global) {
    const configured = process.env.CLAUDE_CONFIG_DIR
    return configured
      ? path.resolve(configured)
      : path.join(os.homedir(), '.claude')
  }
  return path.resolve(process.cwd(), '.claude')
}

export function destinationFor(entry: CatalogEntry, root: string): string {
  return entry.type === 'skill'
    ? path.join(root, 'skills', entry.id)
    : path.join(root, 'rules', entry.relPath)
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
  root: string,
  manifest: Manifest,
): Placement {
  const dest = destinationFor(entry, root)
  const key = manifestKey(entry)
  return {
    dest,
    exists: fs.lstatSync(dest, { throwIfNoEntry: false }) !== undefined,
    tracked: manifest.entries[key] !== undefined,
    key,
  }
}

export interface InstallOptions {
  readonly mode: InstallMode
  readonly origin?: string | undefined
  readonly commit?: string | undefined
}

export function install(
  entry: CatalogEntry,
  root: string,
  manifest: Manifest,
  options: InstallOptions,
): string {
  const { dest, key } = inspect(entry, root, manifest)
  const from = entry.type === 'skill' ? entry.dir : entry.file

  if (options.mode === 'link') replaceWithLink(from, dest)
  else replaceWithCopy(from, dest)

  manifest.entries[key] = {
    type: entry.type,
    id: entry.id,
    source: entry.source,
    mode: options.mode,
    installedAt: new Date().toISOString(),
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(options.commit === undefined ? {} : { commit: options.commit }),
  }

  return dest
}

export function uninstall(
  entry: CatalogEntry,
  root: string,
  manifest: Manifest,
): string {
  const { dest, key } = inspect(entry, root, manifest)
  fs.rmSync(dest, { recursive: true, force: true })
  delete manifest.entries[key]

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
