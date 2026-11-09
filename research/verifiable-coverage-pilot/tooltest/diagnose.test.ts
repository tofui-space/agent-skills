import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const pilot = join(dirname(fileURLToPath(import.meta.url)), '..')

const board = `export type Timetable = {
  minutesUntilNext(stop: string, line: number): Promise<number>
}

export async function boardText(
  timetable: Timetable,
  stop: string | undefined,
  line: number,
): Promise<string> {
  if (!stop || !/^[A-Z]{2}-\\d{3}$/.test(stop)) return 'unknown stop'
  if (line < 1 || line > 99) return 'unknown line'
  let minutes: number
  try {
    minutes = await timetable.minutesUntilNext(stop, line)
  } catch (error) {
    return 'no service'
  }
  if (minutes <= 0) return 'due'
  return minutes > 60 ? 'more than an hour' : \`\${minutes} min\`
}
`

function diagnosed(...args: string[]): { out: string; status: number } {
  const root = mkdtempSync(join(pilot, 'tooltest', '.scratch-'))
  try {
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src/board.ts'), board)
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { strict: true, module: 'nodenext', noEmit: true },
      }),
    )
    const done = spawnSync(
      process.execPath,
      [join(pilot, 'tools/diagnose.ts'), ...args, `--root=${root}`],
      {
        cwd: tmpdir(),
        encoding: 'utf8',
        env: { ...process.env, NODE_TEST_CONTEXT: undefined },
      },
    )
    return { out: `${done.stdout}${done.stderr}`, status: done.status ?? -1 }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('a branch on a variable that is assigned later is open, and decided branches are listed', () => {
  const { out, status } = diagnosed('src/board.ts')
  assert.equal(status, 0)
  assert.match(
    out,
    /exits 6, reached only through decidable conditions 0; branch points 7, decidable 1;/,
  )
  assert.match(out, /decided line 11 \|\| \(number cell\) line < 1/)
  assert.match(
    out,
    /open {3}line 18 if minutes <= 0\n {9}depends on untraced variable minutes/,
  )
  assert.match(
    out,
    /open {3}line 19 \?: minutes > 60\n {9}depends on untraced variable minutes/,
  )
  assert.match(
    out,
    /dependency: minutes is not a const with one value, so what it holds is not followed and every branch on it stays open/,
  )
})

test('a text built from a value is named as fitting no shape, and a merged condition is not called an adapter', () => {
  const { out } = diagnosed('src/board.ts')
  assert.match(
    out,
    /no shape: line 19 builds the text `\$\{minutes\} min` from a value, and no shape returns such a text; return the value as data beside a literal tag, and build the text in a file declared outside the claim/,
  )
  assert.match(
    out,
    /classifier: line 10 gives 'unknown stop' for several causes; if the requirement tells them apart, give each its own outcome/,
  )
  assert.match(
    out,
    /adapter: line 15 turns every failure into one catch path; give each cause its own variant/,
  )
  assert.doesNotMatch(out, /adapter: line 1[01] /)
})

test('a file is found under the root, a line inside the function selects it, and a miss is said', () => {
  assert.match(
    diagnosed('src/board.ts', '--at=13').out,
    /src\/board\.ts:5 boardText/,
  )
  const outside = diagnosed('src/board.ts', '--at=2')
  assert.match(outside.out, /no function holds line 2 of src\/board\.ts/)
  assert.equal(outside.status, 2)
  const missing = diagnosed('src/nowhere.ts')
  assert.match(missing.out, /no such file: src\/nowhere\.ts/)
  assert.equal(missing.status, 2)
})
