import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadProject } from '../tools/project.ts'
import { reconcile } from '../tools/reconcile.ts'

test('reconcile sorts the legacy suite by what each test can notice', () => {
  const { rows, summary } = reconcile({
    project: loadProject(),
    runner: 'node',
    tests: [
      'legacy/renewal.test.ts',
      'legacy/hold.test.ts',
      'legacy/shelf-list.test.ts',
    ],
  })
  const card = 'isLibraryCard: "M-000000" gives true'
  const day = 'isCurrentDay: "safe integer" gives true'
  const seen = Object.fromEntries(
    rows.map((r) => [
      r.test.replace(/^legacy\/[a-z-]+\.test\.ts > /, ''),
      {
        reaches: r.reaches.length,
        checks: r.checks.sort(),
        verdict: r.verdict.split(/[:;,]| of /)[0],
      },
    ]),
  )
  assert.deepEqual(seen, {
    'renews a loan that is on time': {
      reaches: 5,
      checks: [
        'classifyLoan: [1,0] gives "onTime"',
        'findLoan: found',
        day,
        card,
        'renewal: onTime gives 200',
      ],
      verdict: 'an assertion notices 5',
    },
    'refuses a malformed day': {
      reaches: 2,
      checks: [
        'isLibraryCard: "M-0" gives false',
        'refusal: unreadableCard gives 401',
      ],
      verdict: 'an assertion notices 2',
    },
    'handles an unreachable catalog': {
      reaches: 4,
      checks: [],
      verdict: 'cannot fail on the counted code',
    },
    'answers a refusal with a client error': {
      reaches: 1,
      checks: [],
      verdict: 'cannot fail on the counted code',
    },
    'classifies an overdue loan': {
      reaches: 1,
      checks: ['classifyLoan: [-8,0] gives "overdue"'],
      verdict: 'an assertion notices 1',
    },
    'refuses an overdue loan': {
      reaches: 5,
      checks: [
        'classifyLoan: [-8,0] gives "overdue"',
        'findLoan: found',
        day,
        card,
        'renewal: overdue gives 403',
      ],
      verdict: 'an assertion notices 5',
    },
    'renews a staff card': { reaches: 0, checks: [], verdict: 'skipped' },
    'adds the grace period': {
      reaches: 0,
      checks: [],
      verdict: 'runs none',
    },
    'the catalog > is asked once': {
      reaches: 5,
      checks: [day, card],
      verdict: 'an assertion notices 2',
    },
    'a lapsed card > is asked once': {
      reaches: 5,
      checks: [],
      verdict: 'cannot fail on the counted code',
    },
    'passes an unexpected catalog error on': {
      reaches: 3,
      checks: [
        'findLoan: an error it does not name gives the error, unchanged',
        day,
        card,
      ],
      verdict: 'an assertion notices 3',
    },
    'refuses a card without a loan': {
      reaches: 4,
      checks: ['findLoan: none'],
      verdict: 'an assertion notices 1',
    },
    'refuses a bad card on a bad day': {
      reaches: 2,
      checks: [],
      verdict: 'cannot fail on the counted code',
    },
    'a copy nobody holds is free': {
      reaches: 1,
      checks: ['findHold: free'],
      verdict: 'an assertion notices 1',
    },
    'a lookup answers': {
      reaches: 1,
      checks: [],
      verdict: 'cannot fail on the counted code',
    },
    'reports text that is not JSON as malformed': {
      reaches: 1,
      checks: ['readShelfList: malformed'],
      verdict: 'an assertion notices 1',
    },
  })
  assert.deepEqual(rows.at(-1)?.outsideType, ['readShelfList: malformed'])
  assert.deepEqual(
    rows.find((r) => r.test.endsWith('refuses a card without a loan'))
      ?.noticedWith,
    [
      'findLoan: none becomes found, and classifyLoan: [-8,0] gives "overdue" becomes "onTime"',
    ],
  )
  assert.deepEqual(
    rows.find((r) => r.test.endsWith('a copy nobody holds is free'))
      ?.outsideType,
    [],
  )
  assert.deepEqual(
    summary.find((s) => s.unit === 'findLoan'),
    { unit: 'findLoan', library: false, cells: 4, reached: 4, checked: 3 },
  )
})

test('reconcile links tests to library options and contract clauses', () => {
  const { rows, summary, gaps, unobserved } = reconcile({
    project: loadProject(),
    runner: 'node',
    tests: ['legacy/desk-command.test.ts'],
  })
  assert.deepEqual(
    unobserved.map((site) => site.at),
    ['JSON.parse of the contract node@24'],
  )
  const site = 'parseArgs at src/ports/desk-words.ts:6'
  const row = (title: string) => {
    const found = rows.find((r) => r.test.endsWith(`> ${title}`))
    assert.ok(found, title)
    return found
  }
  const library = (title: string, cell: string) => {
    const found = row(title).library.find((l) => l.cell === cell)
    assert.ok(found, `${title}: ${cell}`)
    return found
  }
  const undeclared =
    'throws when a word names an option that is not declared, and strict is on'
  const stray = 'throws when a word is no option, and allowPositionals is off'
  const misfit =
    'throws when an option that takes a value has none, or a switch is given one'
  const removed = 'removed, so the default applies'

  const unknown = 'refuses an option the desk does not know'
  assert.deepEqual(row(unknown).reaches, [
    'isUndeclaredOption: {"code":["literal","ERR_PARSE_ARGS_UNKNOWN_OPTION"]} gives true',
    'readDeskCommand: undeclaredOption',
  ])
  assert.deepEqual(library(unknown, `${site}: ${undeclared}`), {
    cell: `${site}: ${undeclared}`,
    noticed: [stray, misfit],
    unnoticed: [],
    threw: [],
  })
  assert.deepEqual(library(unknown, `${site}, options: strict gives true`), {
    cell: `${site}, options: strict gives true`,
    noticed: ['changed to false'],
    unnoticed: [removed],
    threw: [],
  })
  assert.deepEqual(
    library(
      'refuses a stray word',
      `${site}, options: allowPositionals gives false`,
    ).noticed,
    ['changed to true'],
  )
  assert.deepEqual(
    library('reads a renewal command', `${site}: returns`).noticed,
    [undeclared, stray, misfit],
  )
  assert.match(
    row('survives any words').verdict,
    /^cannot fail on the counted code: reaches 1 cells and no assertion notices any; it reaches 6 library cells and notices none$/,
  )
  assert.deepEqual(
    row('refuses a card option without its value').sameEvidenceAs,
    ['legacy/desk-command.test.ts > refuses a value given to the renew switch'],
  )
  assert.deepEqual(row(unknown).sameEvidenceAs, [])
  assert.deepEqual(gaps, [
    {
      site,
      refutes: false,
      error: "TypeError: Cannot read properties of null (reading 'length')",
      tests: [
        'legacy/desk-command.test.ts > passes on a failure the desk does not name',
      ],
    },
  ])
  assert.deepEqual(
    summary.filter((s) => s.library),
    [
      { unit: site, library: true, cells: 4, reached: 4, checked: 4 },
      {
        unit: `${site}, options`,
        library: true,
        cells: 5,
        reached: 5,
        checked: 3,
      },
    ],
  )
})

test('a test file given with the separator of the operating system is reported with forward slashes', () => {
  const { rows } = reconcile({
    project: loadProject(),
    runner: 'node',
    tests: [join('legacy', 'hold.test.ts')],
    units: ['findHold'],
  })
  assert.ok(rows.length > 0)
  assert.deepEqual(
    rows.filter((row) => !row.test.startsWith('legacy/hold.test.ts > ')),
    [],
  )
})
