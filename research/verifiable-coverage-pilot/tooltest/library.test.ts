import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadProject } from '../tools/project.ts'
import { reconcile } from '../tools/reconcile.ts'

const pilot = join(dirname(fileURLToPath(import.meta.url)), '..')
const major = process.versions.node.split('.')[0]

const files: Record<string, string> = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      strict: true,
      module: 'nodenext',
      target: 'es2022',
      noEmit: true,
      allowImportingTsExtensions: true,
      types: ['node'],
    },
  }),
  'verifiable.json': JSON.stringify({ outside: ['src/ports/**'] }),
  [`spec/contracts/node@${major}.ts`]: `import { join } from 'node:path'

export const contract = {
  package: 'node',
  version: '${major}',
  members: {
    'JSON.parse': {
      throws: [],
      ensures: [
        {
          claim: 'what comes back is an object',
          check: () => JSON.parse('{}'),
          result: { is: 'object' },
        },
      ],
    },
    parseArgs: { throws: [], ensures: [] },
    join: {
      throws: [
        {
          error: TypeError,
          when: 'a segment is not text',
          provoke: () => join('shelf', 5 as never),
          argument: { index: 1, isNot: 'string' },
        },
      ],
      ensures: [],
    },
    'Buffer.from': { throws: [], ensures: [] },
  },
}
`,
  'src/ports/shelf.ts': `import { join } from 'node:path'
import { parseArgs } from 'node:util'

export const place = (mark: string): string => join('shelf', mark)

export const readShelf = (text: string): unknown => JSON.parse(text)

export const fixedCard = (): string | undefined =>
  parseArgs({
    args: ['--card', 'M-1'],
    options: { card: { type: 'string' } },
  }).values.card
`,
  'legacy/shelf.test.ts': `import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fixedCard, place, readShelf } from '../src/ports/shelf.ts'

test('refuses a mark that is no text', () => {
  assert.throws(() => place(5 as never), TypeError)
})

test('reads a count', () => {
  assert.equal(readShelf('7'), 7)
})

test('reads the fixed card', () => {
  assert.equal(fixedCard(), 'M-1')
})

test('reads the fixed card again', () => {
  assert.equal(fixedCard(), 'M-1')
})
`,
}

test('reconcile reports a refuted guarantee, list elements and members that no call uses', () => {
  const root = mkdtempSync(join(pilot, 'tooltest', '.scratch-'))
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    const inventory = spawnSync(
      process.execPath,
      [join(pilot, 'tools/inventory.ts'), `--root=${root}`],
      {
        encoding: 'utf8',
        env: { ...process.env, NODE_TEST_CONTEXT: undefined },
      },
    )
    assert.doesNotMatch(inventory.stdout, /REJECTED/)
    const { rows, gaps, unobserved } = reconcile({
      project: loadProject(root),
      runner: 'node',
      tests: ['legacy/shelf.test.ts'],
    })
    assert.deepEqual(gaps, [
      {
        site: 'join at src/ports/shelf.ts:4',
        refutes: true,
        error:
          'it threw TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received type number (5) (a segment is not text), which the contract rules out for this call by the type of an argument',
        tests: ['legacy/shelf.test.ts > refuses a mark that is no text'],
      },
      {
        site: 'JSON.parse at src/ports/shelf.ts:6',
        refutes: true,
        error:
          'it returned a value for which this guarantee does not hold: what comes back is an object (the result is an object)',
        tests: ['legacy/shelf.test.ts > reads a count'],
      },
    ])
    assert.deepEqual(unobserved, [
      {
        at: `Buffer.from of the contract node@${major}`,
        why: 'no call in the project is written as this member and comes from its package, so nothing about it is observed; a library that is passed in as an object is called through that object, not as the member',
      },
    ])
    const count = rows.find((r) => r.test.endsWith('reads a count'))
    assert.deepEqual(
      count?.library.find((l) => l.cell.endsWith(': returns')),
      {
        cell: 'JSON.parse at src/ports/shelf.ts:6: returns',
        noticed: [],
        unnoticed: [],
        threw: [],
      },
    )
    const card = rows.find((r) => r.test.endsWith('reads the fixed card'))
    assert.deepEqual(
      card?.library.find((l) => l.cell.includes('args.1')),
      {
        cell: "parseArgs at src/ports/shelf.ts:9, options: args.1 gives 'M-1'",
        noticed: ['changed to "M-1 (changed)"'],
        unnoticed: [],
        threw: ['removed from its list'],
      },
    )
    assert.deepEqual(card?.sameEvidenceAs, [
      'legacy/shelf.test.ts > reads the fixed card again',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
