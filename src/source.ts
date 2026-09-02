import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ResolvedSource } from './types.ts'

export const PACKAGE_NAME = '@tofui-space/agent-skills'
export const DEFAULT_REPO = 'https://github.com/tofui-space/agent-skills.git'

const packageRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..')

export function cacheDir(): string {
  const override = process.env.TOFUI_SKILLS_HOME
  if (override) return path.resolve(override)
  return path.join(os.homedir(), '.cache', 'tofui-skills')
}

export function cacheRepoDir(): string {
  return path.join(cacheDir(), 'repo')
}

export function repoUrl(explicit?: string | undefined): string {
  return explicit ?? process.env.TOFUI_SKILLS_REPO ?? DEFAULT_REPO
}

function isCatalog(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'skills')) ||
    fs.existsSync(path.join(dir, 'rules'))
  )
}

/**
 * A checkout of this repository is identified by its package name,
 * so an unrelated project that happens to contain a `skills/` directory is never mistaken for the catalog.
 */
function findCheckoutFrom(startDir: string): string | null {
  let dir = path.resolve(startDir)
  for (;;) {
    const manifest = path.join(dir, 'package.json')
    if (fs.existsSync(manifest)) {
      try {
        const parsed: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'))
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          (parsed as { name?: unknown }).name === PACKAGE_NAME
        ) {
          return dir
        }
      } catch {
        // An unparseable package.json is simply not a match.
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function git(args: readonly string[], cwd?: string): string {
  return execFileSync('git', args, {
    ...(cwd === undefined ? {} : { cwd }),
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim()
}

export function hasGit(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export interface SyncResult {
  readonly dir: string
  readonly url: string
  readonly commit: string
}

/**
 * Clones the catalog into the cache, or fast-forwards an existing clone.
 * Local edits inside the cache are discarded; the remote is authoritative.
 */
export function syncCache(
  options: {
    repo?: string | undefined
    ref?: string | undefined
    log?: (message: string) => void
  } = {},
): SyncResult {
  if (!hasGit())
    throw new Error('`git` was not found on PATH; sync requires git.')

  const url = repoUrl(options.repo)
  const ref = options.ref
  const log = options.log ?? ((): void => {})
  const dir = cacheRepoDir()

  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(dir), { recursive: true })
    log(`cloning ${url}`)
    git(['clone', '--quiet', url, dir])
  } else {
    log(`fetching ${url}`)
    git(['remote', 'set-url', 'origin', url], dir)
    git(['fetch', '--quiet', '--prune', 'origin'], dir)
  }

  const target = ref ? `origin/${ref}` : git(['rev-parse', 'origin/HEAD'], dir)
  git(['checkout', '--quiet', '--force', '--detach', target], dir)

  return { dir, url, commit: git(['rev-parse', '--short', 'HEAD'], dir) }
}

export interface CacheInfo {
  readonly dir: string
  readonly url?: string
  readonly commit?: string
  readonly age?: string
}

export function describeCache(): CacheInfo | null {
  const dir = cacheRepoDir()
  if (!fs.existsSync(path.join(dir, '.git'))) return null
  try {
    return {
      dir,
      url: git(['remote', 'get-url', 'origin'], dir),
      commit: git(['rev-parse', '--short', 'HEAD'], dir),
      age: git(['log', '-1', '--format=%cr'], dir),
    }
  } catch {
    return { dir }
  }
}

/** Full commit the cache is checked out at, when a cache exists. */
export function cacheHeadCommit(): string | null {
  const dir = cacheRepoDir()
  if (!fs.existsSync(path.join(dir, '.git'))) return null
  try {
    return git(['rev-parse', 'HEAD'], dir)
  } catch {
    return null
  }
}

/**
 * Some pnpm layouts embed the resolved commit in the store path itself (…tar.gz+<sha>…).
 * Fragile by nature, so callers must treat null as "unknown", never as "current".
 */
export function commitFromInstallPath(realPath: string): string | null {
  const match = /tar\.gz[+/\\]([0-9a-f]{7,40})/.exec(realPath)
  return match?.[1] ?? null
}

/**
 * Reads the commit a global install was resolved from out of the package manager's lockfile, walking up from the invoked script.
 * pnpm records the codeload tarball URL; npm records a #<sha> fragment on the git URL.
 * Matches on the repo basename because npm's resolved URL omits the scope.
 * A dev checkout's own lockfile has neither, so it yields null there.
 */
export function commitFromLockfiles(
  startDir: string,
  packageName: string,
): string | null {
  const basename = packageName.split('/').pop() ?? packageName
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `${escaped}[^\\n]*?(?:tar\\.gz[+/]|#)([0-9a-f]{7,40})`,
  )
  let dir = path.resolve(startDir)
  for (;;) {
    for (const name of [
      'pnpm-lock.yaml',
      '.package-lock.json',
      'package-lock.json',
    ]) {
      const file = path.join(dir, name)
      if (fs.existsSync(file)) {
        const match = pattern.exec(fs.readFileSync(file, 'utf8'))
        if (match?.[1] !== undefined) return match[1]
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export interface InstallInfo {
  readonly realPath: string
  /** Commit this install was built from, when a lockfile or path reveals it. */
  readonly commit: string | null
  readonly manager: 'pnpm' | 'npm'
}

/** Describes the package the running CLI was loaded from. */
export function describeInstall(): InstallInfo | null {
  const script = process.argv[1]
  if (script === undefined) return null
  try {
    // argv[1] keeps the symlinked project path the bin shim invoked,
    // which sits under the package manager's global project dir;
    // import.meta.url would already be resolved into the content-addressed store.
    const invokedDir = path.dirname(path.resolve(script))
    const realPath = fs.realpathSync(packageRoot)
    return {
      realPath,
      commit:
        commitFromLockfiles(invokedDir, PACKAGE_NAME) ??
        commitFromInstallPath(realPath),
      manager:
        /[\\/]pnpm[\\/]/.test(invokedDir) || /[\\/]pnpm[\\/]/.test(realPath)
          ? 'pnpm'
          : 'npm',
    }
  } catch {
    return null
  }
}

/**
 * Picks the catalog to install from, most explicit source first.
 * A local checkout wins over the cache, so that editing the repo and running the CLI inside it exercises the working tree rather than the last sync.
 */
export function resolveSource(
  explicitFrom?: string | undefined,
): ResolvedSource {
  const explicit = explicitFrom ?? process.env.TOFUI_SKILLS_SOURCE
  if (explicit) {
    const dir = path.resolve(explicit)
    if (!isCatalog(dir))
      throw new Error(`No skills/ or rules/ directory found in ${dir}`)
    return { dir, kind: 'explicit' }
  }

  const checkout = findCheckoutFrom(process.cwd())
  if (checkout && isCatalog(checkout))
    return { dir: checkout, kind: 'checkout' }

  const cached = cacheRepoDir()
  if (isCatalog(cached)) return { dir: cached, kind: 'cache' }

  if (isCatalog(packageRoot)) return { dir: packageRoot, kind: 'bundled' }

  throw new Error('No catalog available. Run `tofui-skills sync` to fetch it.')
}
