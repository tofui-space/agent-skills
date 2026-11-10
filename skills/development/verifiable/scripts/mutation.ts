import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, matchesGlob, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'ts6'
import type { Obligation } from './inventory.ts'
import { type Project, loadProject, rootFrom } from './project.ts'

type Position = { readonly line: number; readonly column: number }
type Mutant = {
  readonly mutatorName: string
  readonly replacement?: string
  readonly status: string
  readonly location: { readonly start: Position; readonly end: Position }
}
type Report = {
  readonly files: Readonly<
    Record<string, { readonly source: string; readonly mutants: Mutant[] }>
  >
}
export type Explanation = {
  readonly file: string
  readonly mutator: string
  readonly original: string
  readonly replacement: string
  readonly reason: string
}
export type Survivor = {
  readonly file: string
  readonly line: number
  readonly mutator: string
  readonly original: string
  readonly replacement: string
  readonly unit: string | undefined
  readonly verdict: 'open' | 'explained' | 'outside'
  readonly reason?: string
}

const alive = new Set(['Survived', 'NoCoverage'])

function offsetOf(source: string, at: Position): number {
  const lines = source.split('\n')
  let offset = 0
  for (let i = 0; i < at.line - 1; i++) offset += (lines[i]?.length ?? 0) + 1
  return offset + at.column - 1
}

function unitAt(
  source: string,
  offset: number,
  obligations: readonly Obligation[],
  file: string,
): string | undefined {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true)
  const holder = parsed.statements.find(
    (s) => s.getStart(parsed) <= offset && offset < s.getEnd(),
  )
  const name =
    holder && ts.isFunctionDeclaration(holder)
      ? holder.name?.text
      : holder && ts.isVariableStatement(holder)
        ? holder.declarationList.declarations[0]?.name.getText(parsed)
        : undefined
  const found = obligations.find((o) => o.file === file && o.name === name)
  return found
    ? `${found.kind} ${found.name}, ${found.cases} checks`
    : undefined
}

export function mutateGlobs(project: Project): string[] {
  const { settings } = project
  const specs = settings.specs.includes('{name}')
    ? [settings.specs.replaceAll('{dir}', '**').replaceAll('{name}', '*')]
    : []
  return [
    ...settings.include,
    ...[...settings.exclude, ...settings.outside, ...specs].map(
      (glob) => `!${glob}`,
    ),
  ]
}

export function readSurvivors(options: { project: Project; report: string }): {
  survivors: Survivor[]
  stale: Explanation[]
  mutants: number
  killed: number
  other: number
} {
  const { project } = options
  const report: Report = JSON.parse(readFileSync(options.report, 'utf8'))
  const obligations: Obligation[] = existsSync(project.obligations)
    ? JSON.parse(readFileSync(project.obligations, 'utf8')).obligations
    : []
  const explanations: Explanation[] = existsSync(project.equivalents)
    ? JSON.parse(readFileSync(project.equivalents, 'utf8'))
    : []
  const underClaim = (file: string) =>
    project.settings.include.some((glob) => matchesGlob(file, glob)) &&
    !project.settings.exclude.some((glob) => matchesGlob(file, glob)) &&
    !project.isOutside(file)
  const used = new Set<Explanation>()
  const survivors: Survivor[] = []
  let mutants = 0
  let killed = 0
  let other = 0
  for (const [name, { source, mutants: listed }] of Object.entries(
    report.files,
  )) {
    const file = project.path(
      isAbsolute(name) ? name : join(project.root, name),
    )
    for (const mutant of listed) {
      mutants++
      if (mutant.status === 'Killed' || mutant.status === 'Timeout') killed++
      if (!alive.has(mutant.status)) {
        if (mutant.status !== 'Killed' && mutant.status !== 'Timeout') other++
        continue
      }
      const start = offsetOf(source, mutant.location.start)
      const original = source.slice(
        start,
        offsetOf(source, mutant.location.end),
      )
      const replacement = mutant.replacement ?? ''
      const explained = explanations.find(
        (e) =>
          e.file === file &&
          e.mutator === mutant.mutatorName &&
          e.original === original &&
          e.replacement === replacement,
      )
      if (explained) used.add(explained)
      survivors.push({
        file,
        line: mutant.location.start.line,
        mutator: mutant.mutatorName,
        original,
        replacement,
        unit: unitAt(source, start, obligations, file),
        verdict: !underClaim(file)
          ? 'outside'
          : explained
            ? 'explained'
            : 'open',
        ...(explained ? { reason: explained.reason } : {}),
      })
    }
  }
  return {
    survivors,
    stale: explanations.filter((e) => !used.has(e)),
    mutants,
    killed,
    other,
  }
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const project = loadProject(rootFrom())
  if (process.argv.includes('--mutate')) {
    console.log(JSON.stringify(mutateGlobs(project)))
    process.exit(0)
  }
  const report = join(
    project.root,
    argument('report') ?? 'reports/mutation.json',
  )
  if (!existsSync(report)) {
    console.log(
      `no mutation report at ${relative(project.root, report)}; run the mutation tool with its JSON reporter first, or name the file with --report=<file>`,
    )
    process.exit(2)
  }
  const { survivors, stale, mutants, killed, other } = readSurvivors({
    project,
    report,
  })
  const flat = (text: string) => text.replace(/\s+/g, ' ')
  const shown = (s: Survivor) =>
    `${s.file}:${s.line} ${s.mutator}  ${flat(s.original)}  ->  ${flat(s.replacement) || '(removed)'}`
  for (const s of survivors.filter((x) => x.verdict === 'open'))
    console.log(
      `open      ${shown(s)}\n          in ${s.unit ?? 'code that has no computed check'}`,
    )
  for (const s of survivors.filter((x) => x.verdict === 'explained'))
    console.log(`explained ${shown(s)}\n          ${s.reason}`)
  const outside = survivors.filter((x) => x.verdict === 'outside')
  for (const file of new Set(outside.map((s) => s.file)))
    console.log(
      `outside   ${file}: ${outside.filter((s) => s.file === file).length} surviving mutants in a file that is not under the claim; no computed check covers it, and it should not be in the mutate globs (--mutate prints them)`,
    )
  for (const e of stale)
    console.log(
      `stale     ${e.file} ${e.mutator}  ${flat(e.original)}  ->  ${flat(e.replacement) || '(removed)'}\n          no surviving mutant matches this explanation any more; remove it from ${relative(project.root, project.equivalents)}`,
    )
  const open = survivors.filter((x) => x.verdict === 'open').length
  const explained = survivors.filter((x) => x.verdict === 'explained').length
  console.log(
    `\n${mutants} mutants, ${killed} killed, ${survivors.length} survived: ${explained} explained, ${open} open, ${outside.length} outside the claim${other > 0 ? `; ${other} neither killed nor survived (errors or ignored)` : ''}; ${stale.length} stale explanations`,
  )
  if (open > 0)
    console.log(
      `an open survivor in counted code is an input the checks do not tell apart from the mutant: add the condition that separates it to the spec, or record in ${relative(project.root, project.equivalents)} why no input can, as { file, mutator, original, replacement, reason }`,
    )
  process.exit(open + stale.length > 0 || other > 0 ? 1 : 0)
}
