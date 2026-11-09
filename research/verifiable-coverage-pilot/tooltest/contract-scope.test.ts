import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const pilot = join(dirname(fileURLToPath(import.meta.url)), '..')

function inProject<T>(
  files: Record<string, string>,
  use: (
    run: (tool: string, ...args: string[]) => string,
    checks: () => string,
  ) => T,
): T {
  const root = mkdtempSync(join(pilot, 'tooltest', '.scratch-'))
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return use(
      (tool, ...args) => {
        const run = spawnSync(
          process.execPath,
          [join(pilot, 'tools', tool), ...args, `--root=${root}`],
          {
            cwd: root,
            encoding: 'utf8',
            env: { ...process.env, NODE_TEST_CONTEXT: undefined },
          },
        )
        return `${run.stdout}${run.stderr}`
      },
      () => {
        const run = spawnSync(
          process.execPath,
          ['--test', join(pilot, 'test/obligations.test.ts')],
          {
            cwd: root,
            encoding: 'utf8',
            env: {
              ...process.env,
              NODE_TEST_CONTEXT: undefined,
              VERIFIABLE_ROOT: root,
            },
          },
        )
        return `${run.stdout}${run.stderr}`
      },
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const tsconfig = JSON.stringify({
  compilerOptions: {
    strict: true,
    module: 'nodenext',
    target: 'es2022',
    noEmit: true,
    allowImportingTsExtensions: true,
    types: ['node'],
  },
})
const settings = JSON.stringify({ outside: ['src/ports/**'] })
const contract = `import assert from 'node:assert/strict'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

export const contract = {
  package: 'node',
  version: '${process.versions.node.split('.')[0]}',
  members: {
    join: {
      throws: [
        {
          error: TypeError,
          when: 'a segment is not text',
          provoke: () => join('shelf', 5 as never),
          argument: { index: 1, isNot: 'string' },
        },
      ],
      ensures: [
        {
          claim: 'the joined path is text',
          check: () => join('shelf', 'QA'),
          result: { is: 'string' },
        },
      ],
    },
    parseArgs: {
      throws: [],
      ensures: [
        {
          claim: 'the words that are no options come back as a list',
          check: () => parseArgs({ args: [], options: {} }),
          result: { path: 'positionals', is: 'array' },
        },
        {
          claim: 'the values come back as an object',
          check: () => parseArgs({ args: [], options: {} }),
          result: { path: 'values', is: 'object' },
        },
      ],
    },
  },
}
`
const port = (argument: string) => `import { join } from 'node:path'

export const shelves = {
  place: (shelf: string, mark: ${argument}) => join(shelf, mark),
}
`
const adapter = (
  handler: string,
  variant: string,
) => `export type Shelves = { place(shelf: string, mark: string): string }
export type Placed =
  | { readonly kind: 'placed'; readonly path: string }${variant}

export function placeMark(shelves: Shelves, shelf: string, mark: string): Placed {
  try {
    const path = shelves.place(shelf, mark)
    return { kind: 'placed', path }
  } catch (error) {${handler}
    throw error
  }
}
`
const spec = `export const port = { contract: 'node@${process.versions.node.split('.')[0]}', member: 'join' }
`
const checked = `${spec}
export const args = ['shelf', 'QA']
export function fake(failure: () => Error | undefined) {
  const calls: unknown[] = []
  return {
    calls,
    db: {
      place: (shelf: string, mark: string) => {
        calls.push([shelf, mark])
        const error = failure()
        if (error) throw error
        return 'shelf/QA'
      },
    },
  }
}
export const provoke = { placed: () => undefined }
export const expected = { placed: { kind: 'placed', path: 'shelf/QA' } }
export const unnamed = () => new RangeError('other')
`
const project = (argument: string, handler: string, variant: string) => ({
  'tsconfig.json': tsconfig,
  'verifiable.json': settings,
  [`spec/contracts/node@${process.versions.node.split('.')[0]}.ts`]: contract,
  'src/ports/shelves.ts': port(argument),
  'src/adapters/place-mark.ts': adapter(handler, variant),
  'spec/placeMark.spec.ts': checked,
})
const named = [
  "\n    if (error instanceof TypeError) return { kind: 'notText' }",
  "\n  | { readonly kind: 'notText' }",
] as const

test('an adapter need not name an error that every call rules out by its argument types', () => {
  inProject(project('string', '', ''), (run) => {
    const out = run('inventory.ts')
    assert.doesNotMatch(out, /REJECTED/)
    assert.match(out, /adapter +placeMark +2 cases/)
  })
})

test('an adapter may not name an error that every call rules out', () => {
  inProject(project('string', ...named), (run) => {
    assert.match(
      run('inventory.ts'),
      /REJECTED src\/adapters\/place-mark\.ts:\d+ the catch names TypeError, which no call of join in this project can get: the contract node@\d+ says it is thrown only when argument 2 is not a string, and every one of the 1 calls \(src\/ports\/shelves\.ts:4\) passes one; remove the statement and its variant/,
    )
  })
})

test('an error stays required while one call may pass another type', () => {
  inProject(project('never', '', ''), (run) => {
    assert.match(
      run('inventory.ts'),
      /REJECTED src\/adapters\/place-mark\.ts:\d+ the contract node@\d+ says join throws TypeError, and the catch has no statement for it/,
    )
  })
  inProject(project('never', ...named), (run) => {
    const out = run('inventory.ts')
    assert.doesNotMatch(out, /REJECTED/)
    assert.match(out, /adapter +placeMark +3 cases/)
  })
})

test('diagnose drops the exit a call rules out and marks the checks a guarantee decides', () => {
  const files = {
    ...project('string', '', ''),
    'src/ports/words.ts': `import { join } from 'node:path'
import { parseArgs } from 'node:util'

export function words(args: string[], mark: string, loose: unknown): string {
  const parsed = parseArgs({ args, options: { card: { type: 'string' } } })
  if (parsed.values === undefined) return 'none'
  if (!Array.isArray(parsed.positionals)) return 'odd'
  if (typeof parsed.values.card !== 'string') return join('shelf', loose as never)
  const placed = join('shelf', mark)
  return typeof placed === 'string' ? placed : 'unplaced'
}
`,
  }
  inProject(files, (run) => {
    const out = run('diagnose.ts', 'src/ports/words.ts')
    assert.match(
      out,
      /given {2}line 6 parsed\.values === undefined is always false if the contract holds: the values come back as an object \[contract node@\d+\]/,
    )
    assert.match(
      out,
      /given {2}line 7 !Array\.isArray\(parsed\.positionals\) is always false if the contract holds: the words that are no options come back as a list/,
    )
    assert.match(
      out,
      /given {2}line 10 typeof placed === 'string' is always true if the contract holds: the joined path is text/,
    )
    assert.doesNotMatch(out, /given {2}line 8/)
    assert.doesNotMatch(out, /\bdead\b/)
    assert.match(
      out,
      /exit +\d+ line 6 return 'none' \[not taken if the contract holds\]/,
    )
    assert.match(
      out,
      /exit +\d+ line 10 return 'unplaced' \[not taken if the contract holds\]/,
    )
    assert.match(
      out,
      /a given or scoped line rests on what a contract declares and its checks sample; it explains an exit, and is no ground for removing a check; this report reads the contract without running it/,
    )
    assert.match(out, /branch points 4, decidable 0;/)
    assert.match(
      out,
      /scoped line 9 join\(…\) gets no exit for TypeError \(a segment is not text\): its contract says it is thrown only when argument 2 is not a string, and here that is string/,
    )
    assert.match(
      out,
      /exit +\d+ line 8 throw join\(…\) throws TypeError when a segment is not text/,
    )
    assert.doesNotMatch(out, /exit +\d+ line 9 throw/)
    assert.match(out, /not taken if a contract holds 3/)
  })
})

test('a guarantee about the result is checked against what the library returns', () => {
  const major = process.versions.node.split('.')[0]
  const kept = {
    ...project('string', '', ''),
    'spec/placeMark.spec.ts': checked,
  }
  inProject(kept, (run, checks) => {
    assert.doesNotMatch(run('inventory.ts'), /REJECTED/)
    assert.match(checks(), /ℹ fail 0\n/)
  })
  const wrong = contract.replace(
    "result: { is: 'string' }",
    "result: { is: 'number' }",
  )
  assert.notEqual(wrong, contract)
  inProject(
    { ...kept, [`spec/contracts/node@${major}.ts`]: wrong },
    (run, checks) => {
      assert.doesNotMatch(run('inventory.ts'), /REJECTED/)
      assert.match(
        checks(),
        /join: the check for "the joined path is text" must return what join returned, and the result is a number does not hold for what it returned/,
      )
    },
  )
})

test('a result claim that another check of the same member contradicts fails', () => {
  const major = process.versions.node.split('.')[0]
  const files = {
    'tsconfig.json': tsconfig,
    'src/types.ts': "export type Kind = 'a' | 'b'\n",
    [`spec/contracts/node@${major}.ts`]: `export const contract = {
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
        {
          claim: 'the text null comes back as null',
          check: () => JSON.parse('null'),
        },
      ],
    },
  },
}
`,
  }
  inProject(files, (run, checks) => {
    assert.doesNotMatch(run('inventory.ts'), /REJECTED/)
    assert.match(
      checks(),
      /JSON\.parse: the contract contradicts itself: the check for "the text null comes back as null" got a result for which "what comes back is an object" \(the result is an object\) does not hold/,
    )
  })
  inProject(
    {
      ...files,
      [`spec/contracts/node@${major}.ts`]:
        files[`spec/contracts/node@${major}.ts`]?.replace(
          "check: () => JSON.parse('null'),",
          'check: () => undefined,',
        ) ?? '',
    },
    (run, checks) => {
      assert.doesNotMatch(run('inventory.ts'), /REJECTED/)
      assert.match(
        checks(),
        /a result claim speaks about every call, so every check of JSON\.parse must return what JSON\.parse returned/,
      )
    },
  )
})

test('an argument scope may name a property of the argument', () => {
  const major = process.versions.node.split('.')[0]
  const files = {
    'tsconfig.json': tsconfig,
    'verifiable.json': settings,
    [`spec/contracts/node@${major}.ts`]: `import { parseArgs } from 'node:util'

export const contract = {
  package: 'node',
  version: '${major}',
  members: {
    parseArgs: {
      throws: [
        {
          error: TypeError,
          when: 'strict is not true or false',
          provoke: () => parseArgs({ args: [], strict: 'yes' as never }),
          argument: { index: 0, path: 'strict', isNot: 'boolean' },
        },
      ],
      ensures: [],
    },
  },
}
`,
    'src/ports/words.ts': `import { parseArgs } from 'node:util'

export function words(args: string[], loose: { strict: unknown }) {
  const strictly = parseArgs({ args, strict: true })
  const loosely = parseArgs({ args, strict: loose.strict as never })
  return [strictly, loosely]
}
`,
  }
  inProject(files, (run) => {
    const out = run('diagnose.ts', 'src/ports/words.ts')
    assert.match(
      out,
      /scoped line 4 parseArgs\(…\) gets no exit for TypeError \(strict is not true or false\): its contract says it is thrown only when argument 1 at strict is not a boolean, and here that is true/,
    )
    assert.doesNotMatch(out, /scoped line 5/)
    assert.match(out, /exit +\d+ line 5 throw parseArgs\(…\) throws TypeError/)
    assert.doesNotMatch(out, /exit +\d+ line 4 throw/)
  })
})

test('with no direct call, the call an adapter makes through its port decides the scope', () => {
  const without = (handler: string, variant: string) => {
    const all: Record<string, string> = project('string', handler, variant)
    const { 'src/ports/shelves.ts': _port, ...rest } = all
    return rest
  }
  inProject(without('', ''), (run) => {
    const out = run('inventory.ts')
    assert.doesNotMatch(out, /REJECTED/)
    assert.match(out, /adapter +placeMark +2 cases/)
  })
  inProject(without(...named), (run) => {
    assert.match(
      run('inventory.ts'),
      /REJECTED src\/adapters\/place-mark\.ts:\d+ the catch names TypeError, which no call of join in this project can get: the contract node@\d+ says it is thrown only when argument 2 is not a string, and every one of the 1 calls \(src\/adapters\/place-mark\.ts:8, the adapter's own call through the object passed in, the only call of the member in the project\) passes one/,
    )
  })
})
