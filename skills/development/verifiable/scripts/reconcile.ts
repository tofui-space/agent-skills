import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'ts6'
import { loadContracts } from './contracts.ts'
import {
  type Cell,
  type Change,
  type PortTable,
  alternativeLabel,
  alternatives,
  cellsOf,
  outside,
} from './flip.ts'
import type { Obligation } from './inventory.ts'
import {
  type Site,
  findSites,
  libraryUnits,
  refuted,
  scopeRefuted,
  unlisted,
} from './ports.ts'
import { type Project, loadProject, rootFrom } from './project.ts'

export type Status = 'pass' | 'fail' | 'error' | 'skipped'
export type LibraryEvidence = {
  readonly cell: string
  readonly noticed: string[]
  readonly unnoticed: string[]
  readonly threw: string[]
}
export type Row = {
  readonly test: string
  readonly status: Status
  readonly reaches: string[]
  readonly checks: string[]
  readonly breaksOn: string[]
  readonly noticedWith: string[]
  readonly outsideType: string[]
  readonly library: LibraryEvidence[]
  readonly sameEvidenceAs: string[]
  readonly failsWhenEveryOutcomeChanges: boolean
  readonly verdict: string
}
export type Gap = {
  readonly site: string
  readonly refutes: boolean
  readonly error: string
  readonly tests: string[]
}
type Unit = {
  readonly name: string
  readonly library: boolean
  readonly cells: readonly Cell[]
  readonly alternatives: (cell: string) => number
  readonly alternativeLabel: (
    cell: string,
    outcome: string | undefined,
    to: number,
  ) => string
  readonly carriesOn: (cell: string, to: number) => boolean
}

const tools = dirname(fileURLToPath(import.meta.url))
type Counted = Exclude<
  Obligation,
  { kind: 'handler' | 'contract' | 'conversion' }
>

export function wrapped(
  text: string,
  path: string,
  names: Set<string>,
  sites: readonly Site[] = [],
): string {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true)
  const edits: Array<{
    from: number
    to: number
    text: string
    span?: number
  }> = []
  const wrappers: string[] = []
  const around = (start: number, end: number, opening: string) => {
    edits.push({ from: start, to: start, text: opening, span: end - start })
    edits.push({ from: end, to: end, text: ')', span: start - end })
  }
  for (const site of sites) {
    around(site.start, site.end, `__port(${JSON.stringify(site.id)}, () => `)
    for (const object of site.objects)
      around(
        object.start,
        object.end,
        `__options(${JSON.stringify(site.id)}, ${JSON.stringify(object.unit)}, `,
      )
  }
  for (const statement of source.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      names.has(statement.name.text)
    ) {
      const name = statement.name.text
      const exported = (ts.getModifiers(statement) ?? []).find(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      )
      if (!exported) continue
      edits.push({
        from: exported.getStart(source),
        to: exported.getEnd(),
        text: '',
      })
      edits.push({
        from: statement.name.getStart(source),
        to: statement.name.getEnd(),
        text: `${name}__counted`,
      })
      wrappers.push(
        `export function ${name}(...args) {\n  return __flipped('${name}', ${name}__counted, args)\n}`,
      )
    }
    if (ts.isVariableStatement(statement))
      for (const d of statement.declarationList.declarations)
        if (
          ts.isIdentifier(d.name) &&
          names.has(d.name.text) &&
          d.initializer
        ) {
          edits.push({
            from: d.initializer.getStart(source),
            to: d.initializer.getStart(source),
            text: `__flippedMap('${d.name.text}', `,
          })
          edits.push({
            from: d.initializer.getEnd(),
            to: d.initializer.getEnd(),
            text: ')',
          })
        }
  }
  let out = text
  for (const edit of edits.sort(
    (a, b) => b.from - a.from || b.to - a.to || (a.span ?? 0) - (b.span ?? 0),
  ))
    out = out.slice(0, edit.from) + edit.text + out.slice(edit.to)
  return `import { flipped as __flipped, flippedMap as __flippedMap, options as __options, ported as __port } from '${join(tools, 'flip.ts')}'\n${out}\n${wrappers.join('\n')}\n`
}

let lastOutput = ''

export type Runner = 'node' | 'vitest'
type Result = { readonly status: Status; readonly ran: boolean }
type Only = { readonly file: string; readonly path: readonly string[] }

const alone = (only: Only) =>
  `^\\s*${only.path.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('( > | )')}$`

function nodeTest(
  project: Project,
  files: readonly string[],
  env: Record<string, string>,
  only?: Only,
): Map<string, Result> {
  const results = new Map<string, Result>()
  for (const file of only ? [only.file] : files) {
    const run = spawnSync(
      process.execPath,
      [
        `--import=${join(tools, 'flip-register.ts')}`,
        '--test',
        '--test-reporter=tap',
        ...(only ? [`--test-name-pattern=${alone(only)}`] : []),
        file,
      ],
      {
        cwd: project.root,
        env: { ...process.env, NODE_TEST_CONTEXT: undefined, ...env },
        encoding: 'utf8',
      },
    )
    lastOutput = `${run.stdout}${run.stderr}`
    const suites: string[] = []
    const parents: boolean[] = []
    let failing: string | undefined
    for (const line of run.stdout.split('\n')) {
      const level = (/^ */.exec(line)?.[0].length ?? 0) / 4
      const opened = /^ *# Subtest: (.*)$/.exec(line)
      if (opened) {
        suites[level] = opened[1] ?? ''
        parents[level] = false
        if (level > 0) parents[level - 1] = true
        continue
      }
      if (failing && /^\s+code: '?ERR_ASSERTION'?$/.test(line))
        results.set(failing, { status: 'fail', ran: true })
      const found = /^ *(not ok|ok) \d+ - (.*?)( # (SKIP|TODO).*)?$/.exec(line)
      if (!found || parents[level]) {
        if (found) parents[level] = false
        continue
      }
      const id = [file, ...suites.slice(0, level), found[2]].join(' > ')
      failing = found[1] === 'not ok' && !found[3] ? id : undefined
      results.set(id, {
        status: found[3] ? 'skipped' : found[1] === 'ok' ? 'pass' : 'error',
        ran: !found[3],
      })
    }
  }
  return results
}

function vitestConfig(project: Project, wrappedFile: string): string {
  const directory = join(project.root, 'node_modules', '.verifiable')
  mkdirSync(directory, { recursive: true })
  const own = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
  ]
    .map((name) => join(project.root, name))
    .find((path) => existsSync(path))
  const path = join(directory, 'vitest.config.mjs')
  const setup = join(directory, 'setup.mjs')
  writeFileSync(
    setup,
    `import { portsReady } from ${JSON.stringify(join(tools, 'flip.ts'))}\n\nawait portsReady()\n`,
  )
  const wrapping = createHash('sha256')
    .update(readFileSync(wrappedFile))
    .digest('hex')
  writeFileSync(
    path,
    `// wrapped sources ${wrapping}
import { readFileSync } from 'node:fs'
import { defineConfig, mergeConfig } from 'vitest/config'
${own ? `import own from ${JSON.stringify(own)}` : 'const own = {}'}

const wrapped = JSON.parse(readFileSync(process.env.VERIFIABLE_WRAPPED, 'utf8'))
const base = typeof own === 'function' ? await own({ mode: 'test', command: 'serve' }) : own

export default mergeConfig(
  base,
  defineConfig({
    test: { setupFiles: [${JSON.stringify(setup)}] },
    plugins: [
      {
        name: 'verifiable-flip',
        enforce: 'pre',
        load(id) {
          const file = id.split('?')[0]
          return file in wrapped ? wrapped[file] : null
        },
      },
    ],
  }),
)
`,
  )
  return path
}

function vitest(
  project: Project,
  files: readonly string[],
  env: Record<string, string>,
  only?: Only,
): Map<string, Result> {
  const out = join(
    mkdtempSync(join(tmpdir(), 'verifiable-vitest-')),
    'out.json',
  )
  const installed = createRequire(join(project.root, 'package.json')).resolve(
    'vitest/package.json',
  )
  const ran = spawnSync(
    process.execPath,
    [
      join(dirname(installed), 'vitest.mjs'),
      'run',
      `--root=${project.root}`,
      `--config=${vitestConfig(project, env.VERIFIABLE_WRAPPED ?? '')}`,
      '--reporter=json',
      `--outputFile=${out}`,
      ...(only ? ['-t', alone(only)] : []),
      ...(only ? [only.file] : files).map((file) => join(project.root, file)),
    ],
    { cwd: project.root, env: { ...process.env, ...env }, encoding: 'utf8' },
  )
  lastOutput = `${ran.stdout}${ran.stderr}`
  const results = new Map<string, Result>()
  if (!existsSync(out)) return results
  const report: {
    testResults: Array<{
      name: string
      assertionResults: Array<{
        ancestorTitles: string[]
        title: string
        status: string
        failureMessages?: string[]
      }>
    }>
  } = JSON.parse(readFileSync(out, 'utf8'))
  rmSync(dirname(out), { recursive: true, force: true })
  for (const file of report.testResults)
    for (const result of file.assertionResults) {
      const id = [
        project.path(file.name),
        ...result.ancestorTitles.filter(Boolean),
        result.title,
      ].join(' > ')
      const asserted = (result.failureMessages ?? []).some((message) =>
        /^AssertionError\b|__VITEST_(REJECTS|RESOLVES)__/.test(message),
      )
      results.set(id, {
        status:
          result.status === 'passed'
            ? 'pass'
            : result.status === 'failed'
              ? asserted
                ? 'fail'
                : 'error'
              : 'skipped',
        ran: result.status === 'passed' || result.status === 'failed',
      })
    }
  return results
}

export function reconcile(options: {
  project: Project
  tests: readonly string[]
  runner: Runner
  units?: readonly string[]
}) {
  const { project } = options
  const run = (
    env: Record<string, string>,
    only?: Only,
    files: readonly string[] = options.tests,
  ) =>
    (options.runner === 'vitest' ? vitest : nodeTest)(
      project,
      files,
      {
        VERIFIABLE_ROOT: project.root,
        VERIFIABLE_WRAPPED: sources,
        VERIFIABLE_PORTS: portsFile,
        ...env,
      },
      only,
    )
  const all: Obligation[] = JSON.parse(
    readFileSync(project.obligations, 'utf8'),
  ).obligations
  const counted = all.filter(
    (o): o is Counted =>
      o.kind !== 'handler' && o.kind !== 'contract' && o.kind !== 'conversion',
  )
  const found = options.units
    ? { sites: [], unobserved: [], calls: [] }
    : findSites(project, loadContracts(project.root, project.contracts))
  const units: Unit[] = [
    ...counted.map(
      (o): Unit => ({
        name: o.name,
        library: false,
        cells: cellsOf(o, project),
        alternatives: (cell) => alternatives(o, cell),
        alternativeLabel: (cell, outcome, to) =>
          alternativeLabel(o, cell, outcome, to),
        carriesOn: (cell, to) =>
          o.kind === 'adapter' &&
          o.carriesData &&
          !o.bare.includes(alternativeLabel(o, cell, undefined, to)),
      }),
    ),
    ...libraryUnits(found.sites).map(
      (u): Unit => ({
        name: u.name,
        library: true,
        cells: u.cells,
        alternatives: u.alternatives,
        alternativeLabel: (cell, _outcome, to) => u.alternativeLabel(cell, to),
        carriesOn: () => false,
      }),
    ),
  ]
  const selected = (unit: string) =>
    !options.units || options.units.includes(unit)
  const labels = new Map(
    units.map((u) => [u.name, new Map(u.cells.map((c) => [c.cell, c.label]))]),
  )
  const byFile = new Map<string, Set<string>>()
  for (const o of counted)
    byFile.set(o.file, (byFile.get(o.file) ?? new Set()).add(o.name))
  for (const site of found.sites) {
    const file = project.path(site.file)
    if (!byFile.has(file)) byFile.set(file, new Set())
  }
  const scratch = mkdtempSync(join(tmpdir(), 'verifiable-reconcile-'))
  const sources = join(scratch, 'wrapped.json')
  writeFileSync(
    sources,
    JSON.stringify(
      Object.fromEntries(
        [...byFile].map(([file, names]) => {
          const path = join(project.root, file)
          return [
            path,
            wrapped(
              readFileSync(path, 'utf8'),
              path,
              names,
              found.sites.filter((site) => site.file === path),
            ),
          ]
        }),
      ),
    ),
  )
  const portsFile = join(scratch, 'ports.json')
  const table: PortTable = Object.fromEntries(
    found.sites.map((site) => [
      site.id,
      {
        member: site.member,
        contractFile: site.contractFile,
        excluded: site.excluded,
        options: Object.fromEntries(
          site.objects.map((object) => [object.unit, object.leaves]),
        ),
      },
    ]),
  )
  writeFileSync(portsFile, JSON.stringify(table))

  const outcomes = new Map<string, string>()
  const name = (unit: string, cell: string) => {
    const label = labels.get(unit)?.get(cell) ?? cell
    const outcome = outcomes.get(JSON.stringify([unit, cell]))
    return outcome === undefined || outcome === label
      ? `${unit}: ${label}`
      : `${unit}: ${label} gives ${outcome}`
  }
  const unitOf = (entry: string) => {
    const [unit, cell]: [string, string] = JSON.parse(entry)
    return { unit, cell, o: units.find((u) => u.name === unit) }
  }
  const baseline = run({})
  if (baseline.size === 0)
    throw new Error(
      `the runner reported no test for ${options.tests.join(', ')}; its output ended with:\n${lastOutput.slice(-2000)}`,
    )
  const reachedBy = new Map<string, Set<string>>()
  const reachedAnywhere = new Map<string, Set<string>>()
  const shared = new Set<string>()
  const fixed = new Map<string, Set<number>>()
  const noticedAt = new Map<string, number>()
  const reachedFile = join(scratch, 'reached.jsonl')
  const alone = (test: string): Only => {
    const parts = test.split(' > ')
    return { file: parts[0] ?? '', path: parts.slice(1) }
  }
  const recorded = (changes: readonly Change[] = []): Set<string> => {
    const cells = new Set<string>()
    for (const line of readFileSync(reachedFile, 'utf8').split('\n')) {
      if (!line) continue
      const [unit, cell, outcome]: [string, string, string] = JSON.parse(line)
      if (unit === outside) {
        const made = changes.find((c) => c.unit === cell && c.cell === outcome)
        const key = JSON.stringify([cell, outcome])
        if (made) fixed.set(key, (fixed.get(key) ?? new Set()).add(made.to))
        continue
      }
      const entry = JSON.stringify([unit, cell])
      cells.add(entry)
      if (!outcomes.has(entry)) outcomes.set(entry, outcome)
    }
    return cells
  }
  const changed = (
    changes: readonly Change[],
    only?: Only,
    files?: readonly string[],
  ) => {
    writeFileSync(reachedFile, '')
    return run(
      {
        VERIFIABLE_REACHED: reachedFile,
        VERIFIABLE_FLIP: JSON.stringify({ changes }),
      },
      only,
      files,
    )
  }
  const filesReaching = (entry: string) => [
    ...new Set(
      [...reachedBy]
        .filter(([, reaches]) => reaches.has(entry))
        .map(([test]) => test.split(' > ')[0] ?? ''),
    ),
  ]
  for (const [test, result] of baseline) {
    if (result.status !== 'pass') continue
    writeFileSync(reachedFile, '')
    const single = run({ VERIFIABLE_REACHED: reachedFile }, alone(test))
    if ([...single.values()].filter((r) => r.ran).length !== 1) {
      shared.add(test)
      continue
    }
    const everyCell = recorded()
    reachedAnywhere.set(test, everyCell)
    reachedBy.set(
      test,
      new Set([...everyCell].filter((entry) => selected(unitOf(entry).unit))),
    )
  }
  const reachedCells = new Set([...reachedBy.values()].flatMap((s) => [...s]))
  const checkedBy = new Map<string, Set<string>>()
  const brokenBy = new Map<string, Set<string>>()
  const worlds = new Map<string, string>()
  const evidence = new Map<string, LibraryEvidence>()
  for (const entry of reachedCells) {
    const { unit, cell, o } = unitOf(entry)
    if (!o) continue
    if (o.library) {
      for (let to = 0; to < o.alternatives(cell); to++) {
        const flippedRun = changed(
          [{ unit, cell, to }],
          undefined,
          filesReaching(entry),
        )
        recorded([{ unit, cell, to }])
        const label = o.alternativeLabel(cell, undefined, to)
        for (const [test, result] of flippedRun) {
          if (baseline.get(test)?.status !== 'pass') continue
          if (!reachedBy.get(test)?.has(entry)) continue
          const key = `${test}\n${entry}`
          const seen = evidence.get(key) ?? {
            cell: '',
            noticed: [],
            unnoticed: [],
            threw: [],
          }
          evidence.set(key, seen)
          ;(result.status === 'fail'
            ? seen.noticed
            : result.status === 'error'
              ? seen.threw
              : seen.unnoticed
          ).push(label)
        }
      }
      continue
    }
    const flippedRun = changed(
      [{ unit, cell, to: 0 }],
      undefined,
      filesReaching(entry),
    )
    recorded([{ unit, cell, to: 0 }])
    for (const [test, result] of flippedRun) {
      if (baseline.get(test)?.status !== 'pass') continue
      if (result.status === 'fail') noticedAt.set(`${test}\n${entry}`, 0)
      if (result.status === 'fail')
        checkedBy.set(test, (checkedBy.get(test) ?? new Set()).add(entry))
      if (result.status === 'error')
        brokenBy.set(test, (brokenBy.get(test) ?? new Set()).add(entry))
    }
  }
  const describe = (change: Change) => {
    const entry = JSON.stringify([change.unit, change.cell])
    const o = units.find((u) => u.name === change.unit)
    const to = o
      ? o.alternativeLabel(change.cell, outcomes.get(entry), change.to)
      : 'another outcome'
    return `${name(change.unit, change.cell)} becomes ${to}`
  }
  const budget = 24
  for (const [test, reaches] of reachedBy)
    for (const entry of reaches) {
      if (checkedBy.get(test)?.has(entry)) continue
      const { unit, cell, o } = unitOf(entry)
      if (!o || o.library) continue
      const queue: Change[][] = Array.from(
        { length: o.alternatives(cell) },
        (_, to) => [{ unit, cell, to }],
      ).slice(1)
      const first: Change[] = [{ unit, cell, to: 0 }]
      queue.unshift(first)
      let runs = 0
      while (queue.length > 0 && runs < budget) {
        const world = queue.shift() ?? []
        runs++
        const result = changed(world, alone(test)).get(test)
        const now = recorded(world)
        if (result?.status === 'fail') {
          noticedAt.set(`${test}\n${entry}`, world[0]?.to ?? 0)
          checkedBy.set(test, (checkedBy.get(test) ?? new Set()).add(entry))
          if (world.length > 1 || (world[0]?.to ?? 0) > 0)
            worlds.set(`${test}\n${entry}`, world.map(describe).join(', and '))
          brokenBy.get(test)?.delete(entry)
          break
        }
        if (result?.status === 'error') {
          brokenBy.set(test, (brokenBy.get(test) ?? new Set()).add(entry))
          continue
        }
        if (world.length >= 3 || !o.carriesOn(cell, world[0]?.to ?? 0)) continue
        for (const reachedNow of now) {
          if (reachedAnywhere.get(test)?.has(reachedNow)) continue
          const next = unitOf(reachedNow)
          if (
            !next.o ||
            next.o.library ||
            world.some((c) => c.unit === next.unit)
          )
            continue
          for (let to = 0; to < next.o.alternatives(next.cell); to++)
            queue.push([...world, { unit: next.unit, cell: next.cell, to }])
        }
      }
    }
  const everything = run({ VERIFIABLE_FLIP: JSON.stringify({ all: true }) })
  rmSync(scratch, { recursive: true, force: true })
  const generated = join(project.root, 'node_modules', '.verifiable')
  rmSync(generated, { recursive: true, force: true })
  if (
    existsSync(dirname(generated)) &&
    readdirSync(dirname(generated)).length === 0
  )
    rmSync(dirname(generated), { recursive: true })

  const named = (entries: Iterable<string>) =>
    [...entries].map((entry) => {
      const [unit, cell]: [string, string] = JSON.parse(entry)
      return name(unit, cell)
    })
  const drafted = [...baseline].map(([test, { status }]) => {
    const everyReach = [...(reachedBy.get(test) ?? new Set<string>())]
    const reaches = everyReach.filter((entry) => !unitOf(entry).o?.library)
    const checks = checkedBy.get(test) ?? new Set<string>()
    const breaks = brokenBy.get(test) ?? new Set<string>()
    const unchangeable = everyReach.filter((entry) => {
      const outsideAt = fixed.get(entry)
      if (!outsideAt) return false
      const at = noticedAt.get(`${test}\n${entry}`)
      if (at !== undefined) return outsideAt.has(at)
      const { cell, o } = unitOf(entry)
      const count = o ? o.alternatives(cell) : 0
      return (
        count > 0 &&
        Array.from({ length: count }, (_, to) => to).every((to) =>
          outsideAt.has(to),
        )
      )
    })
    const library = everyReach
      .filter((entry) => unitOf(entry).o?.library)
      .map((entry): LibraryEvidence => {
        const seen = evidence.get(`${test}\n${entry}`)
        return {
          cell: named([entry])[0] ?? entry,
          noticed: seen?.noticed ?? [],
          unnoticed: seen?.unnoticed ?? [],
          threw: seen?.threw ?? [],
        }
      })
    const noticedLibrary = library.filter((l) => l.noticed.length > 0).length
    const also =
      noticedLibrary > 0
        ? `; it also notices ${noticedLibrary} of the ${library.length} library cells it reaches`
        : library.length > 0
          ? `; it reaches ${library.length} library cells and notices none`
          : ''
    const noticedWith = [...checks].flatMap((entry) => {
      const world = worlds.get(`${test}\n${entry}`)
      return world ? [world] : []
    })
    const afterAll = everything.get(test)?.status
    const failsWhenEveryOutcomeChanges =
      afterAll === 'fail' || afterAll === 'error'
    const verdict =
      status === 'skipped'
        ? 'skipped: it runs nothing'
        : status !== 'pass'
          ? 'fails already, before any change'
          : shared.has(test)
            ? 'cannot be run alone: a nested test in its file has the same name'
            : reaches.length === 0 && library.length === 0
              ? 'runs none of the counted code, so this tool has no evidence about it'
              : reaches.length === 0
                ? noticedLibrary > 0
                  ? `runs none of the counted code; an assertion notices ${noticedLibrary} of the ${library.length} library cells it reaches`
                  : `runs none of the counted code; it reaches ${library.length} library cells and no assertion notices any`
                : checks.size > 0
                  ? `an assertion notices ${checks.size} of the ${reaches.length} cells it reaches; the computed checks cover each of them${also}`
                  : breaks.size > 0
                    ? `no assertion notices any of the ${reaches.length} cells it reaches; it only stops when a changed outcome makes later code throw${also}`
                    : failsWhenEveryOutcomeChanges
                      ? `fails only when several outcomes change at once; needs a look${also}`
                      : options.units
                        ? `no assertion notices any of the ${reaches.length} cells it reaches in the selected units; this says nothing about the other units`
                        : noticedLibrary > 0
                          ? `no assertion notices any of the ${reaches.length} counted cells it reaches; it notices ${noticedLibrary} of the ${library.length} library cells it reaches`
                          : `cannot fail on the counted code: reaches ${reaches.length} cells and no assertion notices any${also}`
    return {
      test,
      status,
      reaches: named(reaches),
      checks: named(checks),
      breaksOn: named(breaks),
      noticedWith,
      outsideType: named(unchangeable),
      library,
      failsWhenEveryOutcomeChanges,
      verdict,
    }
  })
  const evidenceOf = (row: (typeof drafted)[number]) =>
    JSON.stringify([
      [...row.reaches].sort(),
      [...row.checks].sort(),
      [...row.breaksOn].sort(),
      [...row.noticedWith].sort(),
      row.library.map((seen) => JSON.stringify(seen)).sort(),
    ])
  const rows: Row[] = drafted.map((row) => ({
    ...row,
    sameEvidenceAs:
      row.status === 'pass' && row.reaches.length + row.library.length > 0
        ? drafted
            .filter(
              (other) =>
                other !== row &&
                other.status === 'pass' &&
                evidenceOf(other) === evidenceOf(row),
            )
            .map((other) => other.test)
        : [],
  }))
  const checkedCells = new Set([
    ...[...checkedBy.values()].flatMap((s) => [...s]),
    ...[...evidence]
      .filter(([, seen]) => seen.noticed.length > 0)
      .map(([key]) => key.slice(key.indexOf('\n') + 1)),
  ])
  const summary = units
    .filter((u) => selected(u.name))
    .map((u) => {
      const key = (cell: string) => JSON.stringify([u.name, cell])
      return {
        unit: u.name,
        library: u.library,
        cells: u.cells.length,
        reached: u.cells.filter((c) => reachedCells.has(key(c.cell))).length,
        checked: u.cells.filter((c) => checkedCells.has(key(c.cell))).length,
      }
    })
  const gaps: Gap[] = [...reachedCells]
    .filter((entry) =>
      [unlisted, refuted, scopeRefuted].includes(unitOf(entry).cell),
    )
    .map((entry) => ({
      site: unitOf(entry).unit,
      refutes: unitOf(entry).cell !== unlisted,
      error: outcomes.get(entry) ?? '',
      tests: [...reachedBy]
        .filter(([, reaches]) => reaches.has(entry))
        .map(([test]) => test),
    }))
  return { rows, summary, gaps, unobserved: found.unobserved }
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tests = argument('tests')?.split(',')
  if (!tests) {
    console.log(
      'usage: node reconcile.ts --tests=<file>[,<file>] [--runner=node|vitest] [--root=<project>] [--units=<name>[,<name>]] [--out=<file.jsonl>]',
    )
    process.exit(2)
  }
  const project = loadProject(rootFrom())
  const root = project.root
  const missing = tests.filter((t) => !existsSync(join(root, t)))
  if (missing.length > 0) {
    console.log(`no such test file: ${missing.join(', ')}`)
    process.exit(2)
  }
  const { rows, summary, gaps, unobserved } = reconcile({
    project,
    runner: argument('runner') === 'vitest' ? 'vitest' : 'node',
    tests,
    ...(argument('units')
      ? { units: argument('units')?.split(',') ?? [] }
      : {}),
  })
  for (const row of rows) {
    console.log(`\n${row.test}\n  ${row.verdict}`)
    if (row.checks.length > 0) console.log(`  checks  ${row.checks.join('; ')}`)
    if (row.noticedWith.length > 0)
      console.log(
        `  noticed only under another outcome than the first tried  ${row.noticedWith.join('; ')}`,
      )
    if (row.breaksOn.length > 0)
      console.log(`  throws, unasserted  ${row.breaksOn.join('; ')}`)
    const unchecked = row.reaches.filter(
      (r) => !row.checks.includes(r) && !row.breaksOn.includes(r),
    )
    if (unchecked.length > 0)
      console.log(`  reaches without checking  ${unchecked.join('; ')}`)
    if (row.outsideType.length > 0)
      console.log(
        `  changed to an outcome outside its type, for lack of another, so weak evidence either way  ${row.outsideType.join('; ')}`,
      )
    for (const seen of row.library.filter((l) => l.noticed.length > 0))
      console.log(
        `  library  ${seen.cell} | noticed under: ${seen.noticed.join('; ')}${seen.unnoticed.length > 0 ? ` | not noticed under: ${seen.unnoticed.join('; ')}` : ''}${seen.threw.length > 0 ? ` | throws, unasserted, under: ${seen.threw.join('; ')}` : ''}`,
      )
    const onlyThrows = row.library.filter(
      (l) => l.noticed.length === 0 && l.threw.length > 0,
    )
    if (onlyThrows.length > 0)
      console.log(
        `  library, throws unasserted  ${onlyThrows.map((l) => l.cell).join('; ')}`,
      )
    const quiet = row.library.filter(
      (l) => l.noticed.length === 0 && l.threw.length === 0,
    )
    if (quiet.length > 0)
      console.log(
        `  library, reached without noticing  ${quiet.map((l) => l.cell).join('; ')}`,
      )
    if (row.sameEvidenceAs.length > 0)
      console.log(
        `  same evidence as  ${row.sameEvidenceAs.join('; ')}; nothing here tells them apart`,
      )
  }
  console.log('\nunit                     cells  reached  checked by the suite')
  for (const s of summary.filter((x) => x.reached > 0 && !x.library))
    console.log(
      `${s.unit.padEnd(24)} ${String(s.cells).padStart(5)} ${String(s.reached).padStart(8)} ${String(s.checked).padStart(8)}`,
    )
  const libraryRows = summary.filter((x) => x.library)
  if (libraryRows.length > 0)
    console.log('\nlibrary call or its options, cells, reached, noticed')
  for (const s of libraryRows)
    console.log(`${s.unit}  ${s.cells}  ${s.reached}  ${s.checked}`)
  for (const gap of gaps)
    console.log(
      gap.refutes
        ? `\nCONTRACT REFUTED ${gap.site}: ${gap.error}; seen in ${gap.tests.join(', ')}`
        : `\nCONTRACT GAP ${gap.site} threw ${gap.error}, which its contract does not list; seen in ${gap.tests.join(', ')}`,
    )
  for (const site of unobserved)
    console.log(`NOT OBSERVED ${site.at}: ${site.why}`)
  if (argument('units'))
    console.log(
      '\nNOT OBSERVED with --units: no library call is wrapped, so there are no library lines and no contract is tested against what the suite sees; run without --units for those',
    )
  const out = resolve(root, argument('out') ?? 'reports/reconciliation.jsonl')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)
}
