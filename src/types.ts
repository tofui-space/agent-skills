/** A skill directory containing a `SKILL.md`. */
export interface SkillEntry {
  readonly type: 'skill'
  /** Selector and installed directory name, e.g. `a11y-writing`. */
  readonly id: string
  readonly name: string
  /** Catalog grouping, dropped on install. */
  readonly category: string | null
  readonly dir: string
  readonly description: string
  /** Path within the catalog, recorded in the manifest. */
  readonly source: string
}

/** A single rule file below `rules/`. */
export interface RuleEntry {
  readonly type: 'rule'
  /** Selector and install path below `rules/`, e.g. `development/comments`. */
  readonly id: string
  readonly name: string
  readonly category: string | null
  readonly file: string
  /** Path below `rules/`, preserved on install. */
  readonly relPath: string
  /** Glob patterns from `paths:` frontmatter; empty when the rule is unscoped. */
  readonly paths: readonly string[]
  readonly description: string
  readonly source: string
}

export type CatalogEntry = SkillEntry | RuleEntry

export interface Catalog {
  readonly root: string
  readonly skills: readonly SkillEntry[]
  readonly rules: readonly RuleEntry[]
}

export type InstallMode = 'copy' | 'link'

export interface ManifestEntry {
  readonly type: CatalogEntry['type']
  readonly id: string
  readonly source: string
  readonly mode: InstallMode
  readonly installedAt: string
  readonly origin?: string
  readonly commit?: string
}

export interface Manifest {
  version: 1
  entries: Record<string, ManifestEntry>
}

/** Where a catalog was resolved from, in decreasing order of explicitness. */
export type SourceKind = 'explicit' | 'checkout' | 'cache' | 'bundled'

export interface ResolvedSource {
  readonly dir: string
  readonly kind: SourceKind
}
