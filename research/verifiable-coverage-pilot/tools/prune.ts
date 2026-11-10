import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProject, rootFrom } from './project.ts'
import type { Row } from './reconcile.ts'

export type Action = 'remove' | 'covered' | 'keep'
export type Planned = {
  readonly test: string
  readonly action: Action
  readonly why: string
  readonly evidence: string[]
  readonly sameEvidenceAs: string[]
}

export function plan(rows: readonly Row[]): Planned[] {
  return rows.map((row): Planned => {
    const library = row.library ?? []
    const guarded = library.filter((seen) => seen.noticed.length > 0)
    const same = row.sameEvidenceAs ?? []
    const of = (action: Action, why: string, evidence: string[]): Planned => ({
      test: row.test,
      action,
      why,
      evidence,
      sameEvidenceAs: same,
    })
    if (row.status === 'skipped')
      return of('remove', 'it is skipped, so it runs nothing', [])
    if (row.status !== 'pass')
      return of('keep', 'it fails already; repair or remove it by hand', [])
    if (
      row.verdict.startsWith('cannot fail on the counted code') &&
      guarded.length === 0
    )
      return of(
        'remove',
        'no change to anything it reaches makes one of its assertions fail',
        [...row.reaches, ...library.map((seen) => seen.cell)],
      )
    if (guarded.length > 0)
      return of(
        'keep',
        `it guards ${guarded.length} library cells, and no computed check covers a library call or its options`,
        guarded.map((seen) => `${seen.cell} | ${seen.noticed.join('; ')}`),
      )
    if (row.reaches.length === 0 && library.length === 0)
      return of(
        'keep',
        'it runs none of the counted code and no observed library call, so there is no evidence about it',
        [],
      )
    if (row.checks.length > 0)
      return of(
        'covered',
        'every cell it notices has a computed check; whether it also guards something that no cell models is not shown here',
        row.checks,
      )
    return of('keep', row.verdict, row.reaches)
  })
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const project = loadProject(rootFrom())
  const file = resolve(
    project.root,
    argument('rows') ?? 'reports/reconciliation.jsonl',
  )
  if (!existsSync(file)) {
    console.log(
      `no reconciliation at ${relative(project.root, file)}; run reconcile.ts on the whole suite, without --units, or name its output with --rows=<file>`,
    )
    process.exit(2)
  }
  const rows: Row[] = readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const planned = plan(rows)
  const titles: Record<Action, string> = {
    remove:
      'may be removed: each one is skipped, or no change to what it reaches makes it fail',
    covered:
      'duplicates computed checks as far as this evidence goes; not removed on this evidence alone',
    keep: 'kept',
  }
  for (const action of ['remove', 'covered', 'keep'] as const) {
    const listed = planned.filter((p) => p.action === action)
    console.log(`\n${titles[action]} (${listed.length})`)
    for (const p of listed) {
      console.log(`  ${p.test}\n    ${p.why}`)
      for (const line of p.evidence) console.log(`      ${line}`)
    }
  }
  const seen = new Set<string>()
  const groups = planned
    .filter((p) => p.action !== 'remove' && p.sameEvidenceAs.length > 0)
    .flatMap((p) => {
      const group = [p.test, ...p.sameEvidenceAs].sort()
      const key = group.join('\n')
      if (seen.has(key)) return []
      seen.add(key)
      return [group]
    })
  console.log(
    `\nidentical evidence, so candidates to merge after a person has read them (${groups.length} groups)`,
  )
  for (const group of groups) console.log(`  ${group.join('\n  = ')}`)
  console.log(
    '\nnothing was deleted. This plan rests on the reconciliation alone; a per-test kill matrix from a mutation run of the existing suite is not read.',
  )
  const out = resolve(
    project.root,
    argument('out') ?? 'reports/prune-plan.json',
  )
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(planned, null, 2)}\n`)
}
