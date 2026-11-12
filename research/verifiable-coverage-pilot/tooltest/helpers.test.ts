import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { plan } from '../tools/prune.ts'
import type { Row } from '../tools/reconcile.ts'

const pilot = join(dirname(fileURLToPath(import.meta.url)), '..')

function inProject(
  files: Record<string, string>,
  use: (run: (...args: string[]) => { out: string; status: number }) => void,
): void {
  const root = mkdtempSync(join(pilot, 'tooltest', '.scratch-'))
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    use((...args) => {
      const done = spawnSync(
        process.execPath,
        [join(pilot, 'tools/mutation.ts'), ...args, `--root=${root}`],
        {
          encoding: 'utf8',
          env: { ...process.env, NODE_TEST_CONTEXT: undefined },
        },
      )
      return { out: `${done.stdout}${done.stderr}`, status: done.status ?? -1 }
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const size = `export function classifySize(text: string): 'short' | 'long' {
  if (text.length > 3) return 'long'
  return 'short'
}
`
const port = 'export const limit = () => 3\n'
const mutant = (
  status: string,
  mutatorName: string,
  replacement: string,
  line: number,
  from: number,
  to: number,
) => ({
  id: `${line}:${from}`,
  mutatorName,
  replacement,
  status,
  location: { start: { line, column: from }, end: { line, column: to } },
})
const report = JSON.stringify({
  files: {
    'src/classifiers/size.ts': {
      source: size,
      mutants: [
        mutant('Survived', 'EqualityOperator', 'text.length >= 3', 2, 7, 22),
        mutant('Survived', 'StringLiteral', '""', 3, 10, 17),
        mutant('Killed', 'ConditionalExpression', 'false', 2, 7, 22),
      ],
    },
    'src/ports/limit.ts': {
      source: port,
      mutants: [
        mutant('NoCoverage', 'ArrowFunction', '() => undefined', 1, 22, 29),
      ],
    },
  },
})
const explained = [
  {
    file: 'src/classifiers/size.ts',
    mutator: 'StringLiteral',
    original: "'short'",
    replacement: '""',
    reason: 'no caller reads the text of this outcome',
  },
  {
    file: 'src/classifiers/size.ts',
    mutator: 'BooleanLiteral',
    original: 'true',
    replacement: 'false',
    reason: 'an explanation for a mutant that is gone',
  },
]
const base = {
  'verifiable.json': JSON.stringify({ outside: ['src/ports/**'] }),
  'src/classifiers/size.ts': size,
  'src/ports/limit.ts': port,
  'obligations.json': JSON.stringify({
    obligations: [
      {
        kind: 'classifier',
        file: 'src/classifiers/size.ts',
        name: 'classifySize',
        cases: 3,
      },
    ],
  }),
  'reports/mutation.json': report,
}

test('every surviving mutant is open, explained or outside the claim, and a stale explanation is named', () => {
  inProject(
    { ...base, 'spec/equivalent-mutants.json': JSON.stringify(explained) },
    (run) => {
      const { out, status } = run()
      assert.match(
        out,
        /open {6}src\/classifiers\/size\.ts:2 EqualityOperator {2}text\.length > 3 {2}-> {2}text\.length >= 3\n {10}in classifier classifySize, 3 checks/,
      )
      assert.match(
        out,
        /explained src\/classifiers\/size\.ts:3 StringLiteral {2}'short' {2}-> {2}""\n {10}no caller reads the text of this outcome/,
      )
      assert.match(
        out,
        /outside {3}src\/ports\/limit\.ts: 1 surviving mutants in a file that is not under the claim/,
      )
      assert.match(
        out,
        /stale {5}src\/classifiers\/size\.ts BooleanLiteral {2}true {2}-> {2}false\n {10}no surviving mutant matches this explanation any more; remove it from spec\/equivalent-mutants\.json/,
      )
      assert.match(
        out,
        /record in spec\/equivalent-mutants\.json why no input can/,
      )
      assert.match(
        out,
        /4 mutants, 1 killed, 3 survived: 1 explained, 1 open, 1 outside the claim; 1 stale explanations/,
      )
      assert.equal(status, 1)
    },
  )
})

test('with every survivor explained and no stale explanation the helper exits 0', () => {
  const settled = [
    explained[0],
    {
      file: 'src/classifiers/size.ts',
      mutator: 'EqualityOperator',
      original: 'text.length > 3',
      replacement: 'text.length >= 3',
      reason: 'a reason, for the test',
    },
  ]
  inProject(
    { ...base, 'spec/equivalent-mutants.json': JSON.stringify(settled) },
    (run) => {
      const { out, status } = run()
      assert.match(out, /3 survived: 2 explained, 0 open, 1 outside the claim/)
      assert.equal(status, 0)
    },
  )
})

test('the mutate globs leave out excluded files, files outside the claim and specs beside modules', () => {
  inProject(
    {
      'verifiable.json': JSON.stringify({
        include: ['app/**/*.ts'],
        exclude: ['**/*.test.ts'],
        outside: ['app/legacy/**'],
        specs: '{dir}/{name}.spec.ts',
      }),
    },
    (run) => {
      assert.deepEqual(JSON.parse(run('--mutate').out), [
        'app/**/*.ts',
        '!**/*.test.ts',
        '!app/legacy/**',
        '!**/*.spec.ts',
      ])
    },
  )
})

test('a missing report is said, not guessed', () => {
  inProject({ 'verifiable.json': '{}' }, (run) => {
    const { out, status } = run()
    assert.match(out, /no mutation report at reports\/mutation\.json/)
    assert.equal(status, 2)
  })
})

test('a missing reconciliation is said, not guessed', () => {
  const root = mkdtempSync(join(pilot, 'tooltest', '.scratch-'))
  try {
    const done = spawnSync(
      process.execPath,
      [join(pilot, 'tools/prune.ts'), `--root=${root}`],
      { encoding: 'utf8' },
    )
    assert.match(
      done.stdout,
      /no reconciliation at reports\/reconciliation\.jsonl/,
    )
    assert.equal(done.status, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

const row = (fields: Partial<Row> & { test: string }): Row => ({
  status: 'pass',
  reaches: [],
  checks: [],
  breaksOn: [],
  noticedWith: [],
  outsideType: [],
  library: [],
  sameEvidenceAs: [],
  failsWhenEveryOutcomeChanges: false,
  verdict: '',
  ...fields,
})

test('the prune plan removes only skipped tests and keeps scoped non-detection for review', () => {
  const planned = plan([
    row({
      test: 'skipped',
      status: 'skipped',
      verdict: 'skipped: it runs nothing',
    }),
    row({
      test: 'weak',
      reaches: ['findLoan: found'],
      verdict:
        'cannot fail on the counted code: reaches 1 cells and no assertion notices any',
    }),
    row({
      test: 'weak on counted code, guards an option',
      reaches: ['findLoan: found'],
      library: [
        {
          cell: 'strict',
          noticed: ['changed to false'],
          unnoticed: [],
          threw: [],
        },
      ],
      verdict:
        'no assertion notices any of the 1 counted cells it reaches; it notices 1 of the 1 library cells it reaches',
    }),
    row({
      test: 'duplicate',
      reaches: ['findLoan: found'],
      checks: ['findLoan: found'],
      verdict: 'an assertion notices 1 of the 1 cells it reaches',
    }),
    row({
      test: 'elsewhere',
      verdict:
        'runs none of the counted code, so this tool has no evidence about it',
    }),
    row({
      test: 'broken',
      status: 'fail',
      verdict: 'fails already, before any change',
    }),
    row({
      test: 'selected units only',
      reaches: ['findLoan: found'],
      verdict:
        'no assertion notices any of the 1 cells it reaches in the selected units; this says nothing about the other units',
    }),
  ])
  assert.deepEqual(
    planned.map((p) => [p.test, p.action]),
    [
      ['skipped', 'remove'],
      ['weak', 'keep'],
      ['weak on counted code, guards an option', 'keep'],
      ['duplicate', 'covered'],
      ['elsewhere', 'keep'],
      ['broken', 'keep'],
      ['selected units only', 'keep'],
    ],
  )
})
