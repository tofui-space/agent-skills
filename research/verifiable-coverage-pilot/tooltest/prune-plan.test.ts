import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { Row } from '../tools/reconcile.ts'

const copies = [
  ['pilot', new URL('../tools/prune.ts', import.meta.url)],
  ['bundled', new URL('../../../skills/development/verifiable/scripts/prune.ts', import.meta.url)],
] as const

const row = (fields: Partial<Row> & { test: string }): Row => ({
  status: 'pass', reaches: [], checks: [], breaksOn: [], noticedWith: [],
  outsideType: [], library: [], sameEvidenceAs: [], failsWhenEveryOutcomeChanges: false,
  verdict: '', ...fields,
})

const scoped = row({
  test: 'asserts an unmodeled formatter after calling a decision',
  reaches: ['decision: false'],
  verdict: 'cannot fail on the counted code: reaches 1 cells and no assertion notices any',
})

for (const [label, url] of copies) {
  const { plan } = await import(url.href)

  test(`${label}: scoped non-detection never authorizes removal of an active test`, () => {
    const rows = [
      scoped,
      row({ ...scoped, test: 'unnoticed library option', library: [
        { cell: 'format option', noticed: [], unnoticed: ['changed'], threw: [] },
      ] }),
      row({ ...scoped, test: 'observed library guard', library: [
        { cell: 'format option', noticed: ['changed'], unnoticed: [], threw: [] },
      ] }),
      row({ test: 'duplicate', reaches: ['decision: false'], checks: ['decision: false'] }),
      row({ test: 'outside', verdict: 'runs none of the counted code' }),
      row({ ...scoped, test: 'already fails', status: 'fail' }),
      row({ ...scoped, test: 'selected units only', verdict: 'no assertion notices any in the selected units' }),
      row({ test: 'skipped', status: 'skipped' }),
    ]
    const result = plan(rows)
    assert.deepEqual(result.map((p: { action: string }) => p.action),
      ['keep', 'keep', 'keep', 'covered', 'keep', 'keep', 'keep', 'remove'])
    assert.deepEqual(result[0].evidence, scoped.reaches)
    assert.match(result[0].why, /outside those cells is unmeasured/)
  })

  test(`${label}: matching evidence preserves the candidate for human review`, () => {
    const result = plan([row({ ...scoped, sameEvidenceAs: ['another test'] })])[0]
    assert.equal(result.action, 'keep')
    assert.deepEqual(result.sameEvidenceAs, ['another test'])
    assert.match(result.why, /review the remaining purpose/)
  })

  test(`${label}: CLI emits a conservative plan without touching test files`, () => {
    const workspace = join(tmpdir(), 'verifiable-workspace')
    mkdirSync(workspace, { recursive: true })
    const root = mkdtempSync(join(workspace, 'prune-'))
    try {
      const testFile = join(root, 'formatter.test.ts')
      const original = '// A test outside the counted scope remains intact.\n'
      writeFileSync(testFile, original)
      const rowsFile = join(root, 'rows.jsonl')
      writeFileSync(rowsFile, [scoped, row({ test: 'skipped', status: 'skipped' })]
        .map((r) => JSON.stringify(r)).join('\n'))
      const run = spawnSync(process.execPath, [fileURLToPath(url), `--root=${root}`, `--rows=${rowsFile}`],
        { encoding: 'utf8' })
      assert.equal(run.status, 0, run.stdout + run.stderr)
      assert.match(run.stdout, /may be removed: skipped tests only \(1\)/)
      assert.match(run.stdout, /kept \(1\)/)
      const result = JSON.parse(readFileSync(join(root, 'reports/prune-plan.json'), 'utf8'))
      assert.equal(result[0].action, 'keep')
      assert.equal(result[1].action, 'remove')
      assert.equal(readFileSync(testFile, 'utf8'), original)
    } finally {
      // root is created by mkdtempSync under the explicitly named temporary workspace.
      assert.equal(root.startsWith(join(workspace, 'prune-')), true)
      rmSync(root, { recursive: true, force: true })
    }
  })
}
