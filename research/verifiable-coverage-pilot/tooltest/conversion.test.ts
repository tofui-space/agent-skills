import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const pilot = join(dirname(fileURLToPath(import.meta.url)), '..')

function inProject(
  files: Record<string, string>,
  use: (inventory: () => string, checks: () => string) => void,
): void {
  const root = mkdtempSync(join(pilot, 'tooltest', '.scratch-'))
  const run = (args: string[]) => {
    const done = spawnSync(process.execPath, args, {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_TEST_CONTEXT: undefined,
        VERIFIABLE_ROOT: root,
      },
    })
    return `${done.stdout}${done.stderr}`
  }
  try {
    for (const [path, text] of Object.entries({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          strict: true,
          module: 'nodenext',
          target: 'es2022',
          noEmit: true,
          allowImportingTsExtensions: true,
        },
      }),
      'src/types.ts': `export type Minutes = number & { readonly brand: 'Minutes' }
export type Seconds = number & { readonly brand: 'Seconds' }
`,
      ...files,
    })) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    use(
      () => run([join(pilot, 'tools/inventory.ts')]),
      () => run(['--test', join(pilot, 'test/obligations.test.ts')]),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const header = "import type { Minutes, Seconds } from '../types.ts'\n\n"
const total = (body: string) =>
  `${header}export function totalSeconds(whole: Minutes, rest: Seconds): Seconds {\n${body}\n}\n`
const spec = (body: string) =>
  `export function expected(whole: number, rest: number): number {\n${body}\n}\n`

test('a conversion over two branded numbers is counted and its checks pass', () => {
  inProject(
    {
      'src/conversions/total.ts': total(
        '  return (whole * 60 + rest) as Seconds',
      ),
      'spec/totalSeconds.spec.ts': spec('  return rest + 60 * whole'),
    },
    (inventory, checks) => {
      const out = inventory()
      assert.doesNotMatch(out, /REJECTED|ASSUMES/)
      assert.match(out, /conversion totalSeconds +\d+ cases/)
      assert.match(checks(), /ℹ fail 0\n/)
    },
  )
})

test('a spec that says something else fails a computed check, with the input', () => {
  inProject(
    {
      'src/conversions/total.ts': total(
        '  return (whole * 60 + rest) as Seconds',
      ),
      'spec/totalSeconds.spec.ts': spec('  return rest + 61 * whole'),
    },
    (inventory, checks) => {
      assert.doesNotMatch(inventory(), /REJECTED/)
      assert.match(checks(), /expected -?\d+, got -?\d+/)
    },
  )
})

test('a conversion that may give a fraction is rejected with the input', () => {
  inProject(
    {
      'src/conversions/total.ts': total(
        '  return (whole + rest / 60) as Seconds',
      ),
      'spec/totalSeconds.spec.ts': spec('  return whole + rest / 60'),
    },
    (inventory) => {
      assert.match(
        inventory(),
        /REJECTED src\/conversions\/total\.ts:3 the conversion gives -?[\d.]+ for \(-?\d+, -?\d+\), and the classifiers that read its result count whole numbers only; round the result/,
      )
    },
  )
})

test('a conversion with a branch, a product of inputs, or a second cast is rejected', () => {
  inProject(
    {
      'src/conversions/total.ts': total(
        '  if (whole > 0) return rest\n  return (whole * 60 + rest) as Seconds',
      ),
      'spec/totalSeconds.spec.ts': spec('  return rest + 60 * whole'),
    },
    (inventory) => {
      assert.match(
        inventory(),
        /REJECTED src\/conversions\/total\.ts:3 a conversion is one statement: return <expression>, with no branch/,
      )
    },
  )
  inProject(
    {
      'src/conversions/total.ts': total('  return (whole * rest) as Seconds'),
      'spec/totalSeconds.spec.ts': spec('  return rest + 60 * whole'),
    },
    (inventory) => {
      assert.match(
        inventory(),
        /REJECTED src\/conversions\/total\.ts:4 the product of two inputs is not counted; a conversion is built from/,
      )
    },
  )
  inProject(
    {
      'src/conversions/total.ts': total(
        '  return ((whole as number) * 60 + rest) as Seconds',
      ),
      'spec/totalSeconds.spec.ts': spec('  return rest + 60 * whole'),
    },
    (inventory) => {
      assert.match(
        inventory(),
        /REJECTED src\/conversions\/total\.ts:4 a cast or non-null assertion bypasses the types/,
      )
    },
  )
})

test('two inputs of one type are rejected, and a plain number is listed as an assumption', () => {
  inProject(
    {
      'src/conversions/total.ts': `${header}export function totalSeconds(whole: number, rest: number): Seconds {\n  return (whole * 60 + rest) as Seconds\n}\n`,
      'spec/totalSeconds.spec.ts': spec('  return rest + 60 * whole'),
    },
    (inventory) => {
      const out = inventory()
      assert.match(
        out,
        /REJECTED src\/conversions\/total\.ts:3 two inputs share a type, so swapped arguments would compile/,
      )
      assert.match(
        out,
        /ASSUMES src\/conversions\/total\.ts totalSeconds: whole is a whole number/,
      )
    },
  )
})

test('wiring may call a conversion, and may not cast', () => {
  const wiring = (
    body: string,
  ) => `import { totalSeconds } from '../conversions/total.ts'
import type { Minutes, Seconds } from '../types.ts'

export function lengthOf(whole: Minutes, rest: Seconds): Seconds {
${body}
}
`
  const files = {
    'src/conversions/total.ts': total(
      '  return (whole * 60 + rest) as Seconds',
    ),
    'spec/totalSeconds.spec.ts': spec('  return rest + 60 * whole'),
    'spec/lengthOf.spec.ts':
      'export const observe = (run: (whole: number, rest: number) => number) => run(1, 5)\nexport const expected = 65\n',
  }
  inProject(
    {
      ...files,
      'src/wiring/length.ts': wiring('  return totalSeconds(whole, rest)'),
    },
    (inventory) => {
      const out = inventory()
      assert.doesNotMatch(out, /REJECTED/)
      assert.match(out, /handler +lengthOf +1 cases/)
    },
  )
  inProject(
    { ...files, 'src/wiring/length.ts': wiring('  return whole as Seconds') },
    (inventory) => {
      assert.match(
        inventory(),
        /REJECTED src\/wiring\/length\.ts:5 a cast or non-null assertion/,
      )
    },
  )
})

test('every rounding and the remainder are counted without an unknown answer', () => {
  const body =
    '  return (Math.round(whole / 7) + Math.trunc(whole / -3) - Math.ceil(whole / 2) + (whole % 5)) as Seconds'
  inProject(
    {
      'src/conversions/odd.ts': `${header}export function oddSeconds(whole: Minutes): Seconds {\n${body}\n}\n`,
      'spec/oddSeconds.spec.ts': `export function expected(whole: number): number {\n${body.replace(' as Seconds', '')}\n}\n`,
    },
    (inventory, checks) => {
      const out = inventory()
      assert.doesNotMatch(out, /REJECTED/)
      assert.match(out, /conversion oddSeconds +\d+ cases/)
      assert.match(checks(), /ℹ fail 0\n/)
    },
  )
})

test('a rounding that differs from the spec only below zero fails a check', () => {
  inProject(
    {
      'src/conversions/days.ts': `${header}export function wholeMinutes(rest: Seconds): Minutes {\n  return Math.trunc(rest / 60) as Minutes\n}\n`,
      'spec/wholeMinutes.spec.ts':
        'export function expected(rest: number): number {\n  return Math.floor(rest / 60)\n}\n',
    },
    (inventory, checks) => {
      assert.doesNotMatch(inventory(), /REJECTED/)
      assert.match(checks(), /\[-\d+\]: expected -\d+, got -?\d+/)
    },
  )
})

test('a date conversion returns a plain number, and may not give it a branded type', () => {
  const body = (cast: string) =>
    `${header}export function minutesAt(moment: Date): ${cast ? 'Minutes' : 'number'} {\n  return ${cast ? '(' : ''}Math.floor(moment.getTime() / 60000)${cast}\n}\n`
  const expected =
    'export function expected(moment: Date): number {\n  return Math.floor(moment.getTime() / (60 * 1000))\n}\n'
  inProject(
    {
      'src/conversions/minutes.ts': body(') as Minutes'),
      'spec/minutesAt.spec.ts': expected,
    },
    (inventory) => {
      assert.match(
        inventory(),
        /REJECTED src\/conversions\/minutes\.ts:4 a date may be invalid, and then this conversion gives NaN, which would carry the branded type into a classifier that counts whole numbers only; return a plain number, and let a predicate that tests Number\.isSafeInteger give it its type/,
      )
    },
  )
  inProject(
    {
      'src/conversions/minutes.ts': body(''),
      'spec/minutesAt.spec.ts': expected,
    },
    (inventory, checks) => {
      const out = inventory()
      assert.doesNotMatch(out, /REJECTED|ASSUMES/)
      assert.match(out, /conversion minutesAt +\d+ cases/)
      assert.match(checks(), /ℹ fail 0\n/)
    },
  )
})

test('text is read as a number only when a classifier shows it is 1 to 15 digits', () => {
  const types =
    "export type Minutes = number & { readonly brand: 'Minutes' }\nexport type Seconds = number & { readonly brand: 'Seconds' }\nexport type MinuteText = string & { readonly brand: 'MinuteText' }\n"
  const conversion =
    "import type { MinuteText, Minutes } from '../types.ts'\n\nexport function minutesOf(text: MinuteText): Minutes {\n  return Number(text) as Minutes\n}\n"
  const expected =
    'export function expected(text: string): number {\n  return Number(text)\n}\n'
  const predicate = (pattern: string) =>
    `import type { MinuteText } from '../types.ts'\n\nexport function isMinuteText(text: string | undefined): text is MinuteText {\n  if (text === undefined) return false\n  return ${pattern}.test(text)\n}\n`
  const predicateSpec = (pattern: string) =>
    `export function expected(text: string | undefined): boolean {\n  if (text === undefined) return false\n  return ${pattern}.test(text)\n}\n`
  const files = (pattern: string | undefined) => ({
    'src/types.ts': types,
    'src/conversions/minutes.ts': conversion,
    'spec/minutesOf.spec.ts': expected,
    ...(pattern
      ? {
          'src/classifiers/minute-text.ts': predicate(pattern),
          'spec/isMinuteText.spec.ts': predicateSpec(pattern),
        }
      : {}),
  })
  inProject(files('/^[0-9]{1,4}$/'), (inventory, checks) => {
    const out = inventory()
    assert.doesNotMatch(out, /REJECTED|ASSUMES/)
    assert.match(out, /conversion minutesOf +\d+ cases/)
    assert.match(checks(), /ℹ fail 0\n/)
  })
  inProject(files('/^[0-9a-f]{1,4}$/'), (inventory) => {
    assert.match(
      inventory(),
      /REJECTED src\/conversions\/minutes\.ts:3 the text "[0-9a-f]{1,4}" passes isMinuteText and is not 1 to 15 digits, so Number\(\) of it is not a whole number that JavaScript represents exactly/,
    )
  })
  inProject(files(undefined), (inventory) => {
    assert.match(
      inventory(),
      /REJECTED src\/conversions\/minutes\.ts:3 text is text of the type MinuteText, and no classifier gives that type through a type predicate/,
    )
  })
})
