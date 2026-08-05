import fs from 'node:fs'
import path from 'node:path'
import type { Catalog, CatalogEntry, RuleEntry, SkillEntry } from './types.ts'

type FrontmatterValue = string | string[]

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
}

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length > 1 && /^(".*"|'.*')$/s.test(trimmed))
    return trimmed.slice(1, -1)
  return trimmed
}

/**
 * Parses the YAML subset these files use: scalars, folded and literal blocks,
 * and dash lists. Only `name`, `description` and `paths` are read, none of
 * which need anchors, nesting or flow collections.
 */
export function parseFrontmatter(
  text: string,
): Record<string, FrontmatterValue> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match?.[1]) return {}

  const result: Record<string, FrontmatterValue> = {}
  let key: string | null = null
  let block: string[] | null = null
  let list: string[] | null = null

  const flush = (): void => {
    if (key !== null && block !== null) result[key] = block.join(' ').trim()
    if (key !== null && list !== null) result[key] = list
    block = null
    list = null
  }

  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([A-Za-z0-9_-]+):(.*)$/.exec(line)
    if (entry?.[1] !== undefined && !/^\s/.test(line)) {
      flush()
      key = entry[1]
      const rest = (entry[2] ?? '').trim()
      if (rest === '>' || rest === '>-' || rest === '|' || rest === '|-')
        block = []
      else if (rest === '') list = []
      else result[key] = stripQuotes(rest)
      continue
    }
    if (block !== null && line.trim()) block.push(line.trim())
    else if (list !== null && /^\s*-\s+/.test(line))
      list.push(stripQuotes(line.replace(/^\s*-\s+/, '')))
  }

  flush()
  return result
}

function readFrontmatter(file: string): Record<string, FrontmatterValue> {
  try {
    return parseFrontmatter(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function asText(value: FrontmatterValue | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(' ')
  return ''
}

function asList(value: FrontmatterValue | undefined): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) return [value]
  return []
}

/**
 * Discovers `skills/<name>/SKILL.md` and `skills/<category>/<name>/SKILL.md`.
 * A skill found at the shallower level shadows anything nested beneath it,
 * matching the discovery rule used by the `skills` CLI.
 */
export function discoverSkills(root: string): SkillEntry[] {
  const base = path.join(root, 'skills')
  const located: Array<{ name: string; category: string | null; dir: string }> =
    []

  for (const first of listDirs(base)) {
    const flat = path.join(base, first)
    if (fs.existsSync(path.join(flat, 'SKILL.md'))) {
      located.push({ name: first, category: null, dir: flat })
      continue
    }
    for (const second of listDirs(flat)) {
      const nested = path.join(flat, second)
      if (fs.existsSync(path.join(nested, 'SKILL.md'))) {
        located.push({ name: second, category: first, dir: nested })
      }
    }
  }

  return located
    .map(({ name, category, dir }): SkillEntry => {
      const meta = readFrontmatter(path.join(dir, 'SKILL.md'))
      // The directory name is what becomes the skill name once installed, so
      // it is the identity here even if frontmatter disagrees.
      return {
        type: 'skill',
        id: name,
        name,
        category,
        dir,
        description: asText(meta.description),
        source: path.relative(root, dir),
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Discovers every `.md` file below `rules/`, at any depth. The path below
 * `rules/` is preserved on install, because rule discovery is recursive and
 * the grouping carries meaning.
 */
export function discoverRules(root: string): RuleEntry[] {
  const base = path.join(root, 'rules')
  const found: RuleEntry[] = []

  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.name.endsWith('.md')) continue

      const relPath = path.relative(base, full)
      const dirName = path.dirname(relPath)
      const meta = readFrontmatter(full)
      found.push({
        type: 'rule',
        id: relPath.replace(/\.md$/, '').split(path.sep).join('/'),
        name: path.basename(entry.name, '.md'),
        category: dirName === '.' ? null : dirName.split(path.sep).join('/'),
        file: full,
        relPath,
        paths: asList(meta.paths),
        description: asText(meta.description),
        source: path.relative(root, full),
      })
    }
  }

  walk(base)
  return found
}

export function loadCatalog(root: string): Catalog {
  return { root, skills: discoverSkills(root), rules: discoverRules(root) }
}

/**
 * Resolves user-supplied selectors. A skill matches on its id, a rule on its
 * path below `rules/` or on its bare filename when that is unambiguous.
 */
export function selectEntries(
  catalog: Catalog,
  selectors: readonly string[],
): { chosen: CatalogEntry[]; missing: string[] } {
  const chosen: CatalogEntry[] = []
  const missing: string[] = []

  for (const raw of selectors) {
    const selector = raw.replace(/\.md$/, '').replace(/\/+$/, '')

    const skill = catalog.skills.find((candidate) => candidate.id === selector)
    if (skill) {
      chosen.push(skill)
      continue
    }

    const ruleById = catalog.rules.find(
      (candidate) => candidate.id === selector,
    )
    if (ruleById) {
      chosen.push(ruleById)
      continue
    }

    const byName = catalog.rules.filter(
      (candidate) => candidate.name === selector,
    )
    const only = byName.length === 1 ? byName[0] : undefined
    if (only) {
      chosen.push(only)
      continue
    }

    missing.push(raw)
  }

  return { chosen, missing }
}
