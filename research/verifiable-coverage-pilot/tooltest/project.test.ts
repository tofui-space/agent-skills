import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadProject } from '../tools/project.ts'
import { reconcile } from '../tools/reconcile.ts'

const pilot = join(dirname(fileURLToPath(import.meta.url)), '..')
const desk = join(pilot, 'tooltest', 'fixtures', 'desk')
const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, args, {
    cwd: desk,
    encoding: 'utf8',
    env: { ...process.env, NODE_TEST_CONTEXT: undefined, ...env },
  })

test('a project names its own folders and file suffixes', () => {
  const project = loadProject(desk)
  assert.equal(
    project.shapeOf(join(desk, 'app/renewal/loan-state.classifier.ts')),
    'classifiers',
  )
  assert.equal(
    project.shapeOf(join(desk, 'app/renewal/renewal.handler.ts')),
    'wiring',
  )
  assert.equal(project.shapeOf(join(desk, 'app/renewal/types.ts')), undefined)
  assert.equal(
    project.shapeOf(join(desk, 'app/renewal/renewal.test.ts')),
    undefined,
  )
  assert.deepEqual(
    project.files().map((file) => project.path(file)),
    [
      'app/desk/words.port.ts',
      'app/renewal/current-day.classifier.ts',
      'app/renewal/library-card.classifier.ts',
      'app/renewal/loan-catalog.adapter.ts',
      'app/renewal/loan-state.classifier.ts',
      'app/renewal/renewal.handler.ts',
      'app/renewal/types.ts',
    ],
  )
  assert.equal(
    project.path(
      project.spec('findLoan', 'app/renewal/loan-catalog.adapter.ts'),
    ),
    'checks/findLoan.spec.ts',
  )
})

test('a setting the tools do not know is an error', () => {
  const root = mkdtempSync(join(tmpdir(), 'verifiable-settings-'))
  writeFileSync(join(root, 'verifiable.json'), '{ "sources": ["lib/**"] }')
  assert.throws(() => loadProject(root), /unknown setting sources/)
})

test('the inventory of the other layout is fresh and admitted', () => {
  const result = run([join(pilot, 'tools/inventory.ts'), '--check'])
  assert.doesNotMatch(result.stdout, /STALE|REJECTED/)
  assert.match(result.stdout, /total +68 cases/)
})

test('the computed checks of the other layout pass under node:test', () => {
  const result = run(['--test', join(pilot, 'test/obligations.test.ts')])
  assert.match(result.stdout, /ℹ pass 9\n/)
  assert.match(result.stdout, /ℹ fail 0\n/)
})

test('the computed checks of the other layout pass under Vitest', () => {
  const vitest = join(
    dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
    'vitest.mjs',
  )
  const result = run([vitest, 'run', 'verifiable.test.mjs'])
  assert.match(result.stdout, /Tests {2}9 passed \(9\)/)
})

test('under Vitest a check that leaves through another guard fails', () => {
  const scratch = mkdtempSync(join(pilot, 'tooltest', '.scratch-'))
  try {
    const copy = join(scratch, 'desk')
    cpSync(desk, copy, { recursive: true })
    const handler = join(copy, 'app/renewal/renewal.handler.ts')
    const card =
      '  if (!isLibraryCard(req.card)) return refusal.unreadableCard\n'
    const day = '  if (!isCurrentDay(req.today)) return refusal.malformedDay\n'
    const text = readFileSync(handler, 'utf8')
    assert.ok(text.includes(card + day))
    writeFileSync(handler, text.replace(card + day, day + card))
    const vitest = join(
      dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
      'vitest.mjs',
    )
    const result = spawnSync(
      process.execPath,
      [vitest, 'run', 'verifiable.test.mjs'],
      {
        cwd: copy,
        encoding: 'utf8',
        env: { ...process.env, NODE_TEST_CONTEXT: undefined },
      },
    )
    assert.match(
      result.stdout + result.stderr,
      /the check for isLibraryCard\(req\.card\) being false left handleRenewal through another exit/,
    )
    assert.match(result.stdout, /1 failed \| 8 passed/)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('the Vitest runner reaches the verdicts of the node runner', () => {
  const verdicts = (rows: Array<{ test: string; verdict: string }>) =>
    rows.map((r) => `${r.test.split(' > ').slice(1).join(' > ')}: ${r.verdict}`)
  const underNode = reconcile({
    project: loadProject(pilot),
    runner: 'node',
    tests: ['legacy/renewal.test.ts'],
  })
  const underVitest = reconcile({
    project: loadProject(desk),
    runner: 'vitest',
    tests: ['app/renewal/renewal.test.ts'],
  })
  assert.equal(underVitest.rows.length, 13)
  assert.deepEqual(verdicts(underVitest.rows), verdicts(underNode.rows))
})

test('under Vitest a library option is linked to the test that guards it', () => {
  const project = loadProject(desk)
  const options = {
    project,
    runner: 'vitest' as const,
    tests: ['app/desk/words.test.ts'],
  }
  const selected = reconcile({ ...options, units: ['handleRenewal'] })
  assert.ok(selected.rows.every((row) => row.library.length === 0))
  const { rows } = reconcile(options)
  const refused = rows.find((row) =>
    row.test.endsWith('refuses an option the desk does not know'),
  )
  assert.deepEqual(
    refused?.library.find((l) => l.cell.endsWith('options: strict gives true')),
    {
      cell: 'parseArgs at app/desk/words.port.ts:7, options: strict gives true',
      noticed: ['changed to false'],
      unnoticed: ['removed, so the default applies'],
      threw: [],
    },
  )
  assert.equal(
    rows.find((row) => row.test.endsWith('after the modules are loaded again'))
      ?.verdict,
    'runs none of the counted code; an assertion notices 1 of the 4 library cells it reaches',
  )
  assert.equal(
    rows.find((row) => row.test.endsWith('answers with an object'))?.verdict,
    'runs none of the counted code; it reaches 4 library cells and no assertion notices any',
  )
})
