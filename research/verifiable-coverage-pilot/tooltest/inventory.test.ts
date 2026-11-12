import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const pilot = join(dirname(fileURLToPath(import.meta.url)), '..')

function inventory(files: Record<string, string>, ...args: string[]): string {
  const root = mkdtempSync(join(pilot, 'tooltest', '.scratch-'))
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    const run = spawnSync(
      process.execPath,
      [join(pilot, 'tools/inventory.ts'), `--root=${root}`, ...args],
      {
        encoding: 'utf8',
        env: { ...process.env, NODE_TEST_CONTEXT: undefined },
      },
    )
    return `${run.stdout}${run.stderr}`
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const strict = JSON.stringify({
  compilerOptions: {
    strict: true,
    module: 'nodenext',
    target: 'es2022',
    noEmit: true,
    allowImportingTsExtensions: true,
  },
})

const types = `export type Failure = 'gone' | 'other'
`
const isGone = `export function isGone(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false
  return 'code' in input && input.code === 'GONE'
}
`
const isGoneSpec = `export function expected(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false
  if (!('code' in input)) return false
  return input.code === 'GONE'
}
`
const adapter = (condition: string, importLine: string) => `${importLine}
export type Port = { read(id: string): Promise<string> }
export type Read =
  | { readonly kind: 'read'; readonly text: string }
  | { readonly kind: 'gone' }

export async function readNote(port: Port, id: string): Promise<Read> {
  try {
    const text = await port.read(id)
    return { kind: 'read', text }
  } catch (error) {
    if (${condition}) return { kind: 'gone' }
    throw error
  }
}
`

test('a catch statement may test the error with a counted classifier', () => {
  const out = inventory({
    'tsconfig.json': strict,
    'src/classifiers/gone.ts': isGone,
    'spec/isGone.spec.ts': isGoneSpec,
    'spec/readNote.spec.ts': `export const args = ['n-1']
export const fake = () => ({ db: { read: async () => 'text' }, calls: [] })
export const provoke = { read: () => undefined, gone: () => new Error('gone') }
export const expected = { read: { kind: 'read', text: 'text' }, gone: { kind: 'gone' } }
export const unnamed = () => new RangeError('other')
`,
    'src/adapters/notes.ts': adapter(
      'isGone(error)',
      "import { isGone } from '../classifiers/gone.ts'",
    ),
  })
  assert.doesNotMatch(out, /REJECTED/)
  assert.match(out, /adapter +readNote +3 cases/)
})

test('a catch statement that tests the error any other way is rejected', () => {
  const out = inventory({
    'tsconfig.json': strict,
    'src/adapters/notes.ts': adapter("String(error) === 'gone'", ''),
  })
  assert.match(
    out,
    /REJECTED src\/adapters\/notes\.ts:\d+ each catch statement must be/,
  )
})

test('a spec may import a value through a .js specifier', () => {
  const out = inventory({
    'tsconfig.json': strict,
    'src/classifiers/level.ts': `export type Level = number & { readonly brand: 'Level' }
export function classifyLevel(level: Level): 'low' | 'high' {
  if (level < 10) return 'low'
  return 'high'
}
`,
    'src/limits.ts': 'export type Limit = 10\n',
    'spec/classifyLevel.spec.ts': `import { classifyLevel } from '../src/classifiers/level.js'

export const unit = classifyLevel
export const intervals = [
  { min: Number.NEGATIVE_INFINITY, max: 9, outcome: 'low' },
  { min: 10, max: Number.POSITIVE_INFINITY, outcome: 'high' },
]
`,
  })
  assert.doesNotMatch(out, /ERR_MODULE_NOT_FOUND|REJECTED/)
  assert.match(out, /classifier classifyLevel +2 cases/)
})

test('a project without strictNullChecks is rejected by name', () => {
  const out = inventory({
    'tsconfig.json': JSON.stringify({
      compilerOptions: { strict: false, module: 'nodenext', noEmit: true },
    }),
    'src/types.ts': types,
  })
  assert.match(
    out,
    /REJECTED tsconfig\.json:1 the project compiles without strictNullChecks/,
  )
})

test('files in a folder are named with forward slashes', () => {
  const loose = inventory({
    'verifiable.json': JSON.stringify({ tsconfig: 'config/tsconfig.json' }),
    'config/tsconfig.json': JSON.stringify({
      compilerOptions: { strict: false, module: 'nodenext', noEmit: true },
    }),
    'src/types.ts': types,
  })
  assert.match(loose, /REJECTED config\/tsconfig\.json:1 /)
  const stale = inventory(
    {
      'tsconfig.json': strict,
      'src/types.ts': types,
      'reports/obligations.json': '{}',
    },
    '--out=reports/obligations.json',
    '--check',
  )
  assert.match(stale, /STALE reports\/obligations\.json differs from the code/)
})

test('a missing or faulty spec, and a contract, are named with forward slashes', () => {
  const code = {
    'tsconfig.json': strict,
    'src/types.ts':
      "export type Minutes = number & { readonly brand: 'Minutes' }\n",
    'src/classifiers/gone.ts': isGone,
    'src/conversions/double.ts': `import type { Minutes } from '../types.ts'

export function doubled(whole: Minutes): Minutes {
  return (whole * 2) as Minutes
}
`,
  }
  const missing = inventory(code)
  assert.match(
    missing,
    /REJECTED src\/classifiers\/gone\.ts:1 no spec: write spec\/isGone\.spec\.ts exporting function expected\(input\)/,
  )
  assert.match(
    missing,
    /REJECTED src\/conversions\/double\.ts:3 no spec: write spec\/doubled\.spec\.ts exporting function expected\(whole\)/,
  )
  const faulty = inventory({
    ...code,
    'spec/isGone.spec.ts': `export function expected(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false
  return String(input).length === 4
}
`,
    'spec/doubled.spec.ts': `export function expected(whole: number): number {
  return whole * whole
}
`,
    'spec/contracts/vite@8.ts': `export const contract = {
  package: 'vite',
  version: '8',
  members: { build: { throws: [], ensures: [] } },
}
`,
  })
  assert.match(
    faulty,
    /REJECTED spec\/isGone\.spec\.ts:3 unsupported statement/,
  )
  assert.match(
    faulty,
    /REJECTED spec\/doubled\.spec\.ts:2 the product of two inputs is not counted/,
  )
  assert.match(
    faulty,
    /REJECTED spec\/contracts\/vite@8\.ts:1 vite cannot be found from the project root/,
  )
})

test('files declared outside the claim are listed, not judged', () => {
  const out = inventory({
    'tsconfig.json': strict,
    'verifiable.json': JSON.stringify({ outside: ['src/legacy/**'] }),
    'src/legacy/old.ts': 'export const now = () => Date.now()\n',
    'src/types.ts': types,
  })
  assert.doesNotMatch(out, /REJECTED/)
  assert.match(out, /OUTSIDE src\/legacy\/old\.ts/)
  assert.match(out, /1 files are declared outside the claim/)
})

test('a spec may sit beside its module', () => {
  const out = inventory({
    'tsconfig.json': strict,
    'verifiable.json': JSON.stringify({
      specs: '{dir}/{name}.spec.ts',
      exclude: ['**/*.spec.ts'],
    }),
    'src/classifiers/gone.ts': isGone,
    'src/classifiers/isGone.spec.ts': isGoneSpec,
  })
  assert.doesNotMatch(out, /REJECTED/)
  assert.match(out, /classifier isGone/)
})

test('a handler may return its own tagged result and guard on a call', () => {
  const out = inventory({
    'tsconfig.json': strict,
    'src/classifiers/gone.ts': isGone,
    'spec/isGone.spec.ts': isGoneSpec,
    'src/classifiers/size.ts': `export function classifySize(text: string): 'short' | 'long' {
  return text.length > 3 ? 'long' : 'short'
}
`,
    'spec/classifySize.spec.ts': `export function expected(text: string): 'short' | 'long' {
  if (text.length <= 3) return 'short'
  return 'long'
}
`,
    'spec/showNote.spec.ts': `export const observe = (show: (note: unknown, text: string) => unknown) => show({}, 'abc')
export const expected = { kind: 'shown', text: 'abc' }
export const order = ['isGone(note)', 'classifySize(text)']
export const exits = {}
`,
    'src/wiring/note.ts': `import { isGone } from '../classifiers/gone.ts'
import { classifySize } from '../classifiers/size.ts'

export type Shown =
  | { readonly kind: 'shown'; readonly text: string }
  | { readonly kind: 'hidden' }
  | { readonly kind: 'cut' }

export function showNote(note: unknown, text: string): Shown {
  if (isGone(note)) return { kind: 'hidden' }
  if (classifySize(text) === 'long') return { kind: 'cut' }
  return { kind: 'shown', text }
}
`,
  })
  assert.doesNotMatch(out, /REJECTED/)
  assert.match(out, /handler +showNote +3 cases/)
})

test('a contract may reach a package through the one that depends on it', () => {
  const contract = (via: string) => `export const contract = {
  package: 'vite',
  version: '8',${via}
  members: { build: { throws: [], ensures: [] } },
}
`
  const direct = inventory({
    'tsconfig.json': strict,
    'src/types.ts': types,
    'spec/contracts/vite@8.ts': contract(''),
  })
  assert.match(direct, /vite cannot be found from the project root/)
  const through = inventory({
    'tsconfig.json': strict,
    'src/types.ts': types,
    'spec/contracts/vite@8.ts': contract("\n  via: 'vitest',"),
  })
  assert.doesNotMatch(through, /REJECTED/)
  assert.match(through, /contract +vite@8/)
})

test('a unit whose spec is missing or lacks an export is rejected and gets no count', () => {
  const files = {
    'tsconfig.json': strict,
    'src/classifiers/gone.ts': isGone,
    'spec/isGone.spec.ts': isGoneSpec,
    'src/adapters/notes.ts': adapter(
      'isGone(error)',
      "import { isGone } from '../classifiers/gone.ts'",
    ),
  }
  const missing = inventory(files)
  assert.match(
    missing,
    /REJECTED src\/adapters\/notes\.ts:1 no spec: write spec\/readNote\.spec\.ts exporting args, fake, provoke, unnamed, expected/,
  )
  assert.match(
    missing,
    /adapter +readNote +not counted: its file or its spec has a REJECTED line/,
  )
  assert.match(missing, /total, admitted units only +\d+ cases/)
  const partial = inventory({
    ...files,
    'spec/readNote.spec.ts': "export const args = ['n-1']\n",
  })
  assert.match(
    partial,
    /the spec of readNote \(spec\/readNote\.spec\.ts\) does not export fake, provoke, unnamed, expected/,
  )
})

const noteSpec = `export const args = ['n-1']
export const fake = () => ({ db: { read: async () => 'text' }, calls: [] })
export const provoke = { read: () => undefined, gone: () => new Error('gone') }
export const expected = { read: { kind: 'read', text: 'text' }, gone: { kind: 'gone' } }
export const unnamed = () => new RangeError('other')
`

test('an adapter file holds adapters, their error classes and types, and nothing else', () => {
  const withClass = `export class NoteGone extends Error {}
${adapter('error instanceof NoteGone', '')}`
  const files = {
    'tsconfig.json': strict,
    'spec/readNote.spec.ts': noteSpec,
  }
  const clean = inventory({ ...files, 'src/adapters/notes.ts': withClass })
  assert.doesNotMatch(clean, /REJECTED/)
  const stray = inventory({
    ...files,
    'src/adapters/notes.ts': `${withClass}
const unchecked = Math.random() > 2 ? 'a' : 'b'
function helper(x: number) {
  return x > 3 ? 1 : 2
}
`,
  })
  assert.match(
    stray,
    /REJECTED src\/adapters\/notes\.ts:\d+ an adapter file holds exported adapters, the error classes they name .*; found: const unchecked/,
  )
  assert.match(stray, /; found: function helper/)
})

const sizeClassifier = `export function classifySize(size: number): 'short' | 'long' {
  return size > 3 ? 'long' : 'short'
}
`
const sizeSpec = `export const intervals = [
  { min: Number.NEGATIVE_INFINITY, max: 3, outcome: 'short' },
  { min: 4, max: Number.POSITIVE_INFINITY, outcome: 'long' },
]
`

test('a dispatch map is exported, may be called through a key, and a file of re-exports is admitted', () => {
  const wiring = (
    map: string,
    call: string,
  ) => `import { classifySize } from '../classifiers/size.ts'

${map} label: Record<'short' | 'long', (size: number) => number> = {
  short: (size) => size,
  long: (size) => size,
}

export function sized(size: number): number {
  ${call}
}
`
  const files = {
    'tsconfig.json': strict,
    'src/classifiers/size.ts': sizeClassifier,
    'spec/classifySize.spec.ts': sizeSpec,
    'spec/label.spec.ts': 'export const expected = {}\n',
    'spec/sized.spec.ts':
      'export const observe = (run: (size: number) => number) => run(1)\nexport const expected = 1\n',
    'src/index.ts':
      "export { sized } from './wiring/sized.ts'\nexport type { Sized } from './types.ts'\n",
    'src/types.ts': 'export type Sized = number\n',
  }
  const admitted = inventory({
    ...files,
    'src/wiring/sized.ts': `export { classifySize } from '../classifiers/size.ts'\n${wiring('export const', 'return label.short(size)')}`,
  })
  assert.doesNotMatch(admitted, /REJECTED/)
  assert.match(admitted, /route +label +2 cases/)
  assert.match(
    admitted,
    /ASSUMES src\/classifiers\/size\.ts classifySize: size is a whole number/,
  )
  const hidden = inventory({
    ...files,
    'src/wiring/sized.ts': wiring(
      'const',
      'return label[classifySize(size)](size)',
    ),
  })
  assert.match(
    hidden,
    /REJECTED src\/wiring\/sized\.ts:\d+ a dispatch map is exported, so that its check can read it/,
  )
})

test('a point the requirement leaves open is printed for every spec that names one', () => {
  const out = inventory({
    'tsconfig.json': strict,
    'src/classifiers/size.ts': sizeClassifier,
    'spec/classifySize.spec.ts': `${sizeSpec}export const unsettled = ['whether a size of exactly 3 is short']\n`,
  })
  assert.doesNotMatch(out, /REJECTED/)
  assert.match(
    out,
    /UNSETTLED spec\/classifySize\.spec\.ts classifySize: whether a size of exactly 3 is short/,
  )
  assert.match(out, /1 points of the requirement are unsettled/)
})
