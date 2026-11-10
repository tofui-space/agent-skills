import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRegex, regexSource } from '../tools/regex.ts'

const accepted: Array<[string, string]> = [
  ['^(M-[0-9]{6}|S-[A-Z]{2}[0-9]{4})$', ''],
  ['^Bearer .+$', ''],
  ['^bearer .+$', 'i'],
  ['[a-f0-9]+\\W', 'i'],
  ['^a.b$', 's'],
  ['[^k]\\w', 'i'],
  ['^(?=.*[0-9])(?=.*[a-z])(?!.*\\s).{8,}$', ''],
  ['\\bstaff\\b', 'i'],
  ['\\b\\d{3}\\b', ''],
  ['(?<!\\\\)"', ''],
  ['(?<=^ab|c)d(?=e$|f)', ''],
  ['a\\Bb', ''],
  ['\\Bx', ''],
  ['x\\b', ''],
  ['^(?<year>\\d{4})-(\\d{2})$', ''],
  ['a+?b*?c{2,3}?', ''],
  ['^(\\w+)@(\\w+)$', ''],
  ['\\ba\\bb\\b', ''],
  ['foo(?=bar)\\w+(?<=r)x', ''],
  ['^[A-Z]{3} (.+) [0-9]{4}$', ''],
]
const rejected: Array<[string, string, RegExp]> = [
  ['(a)\\1', '', /backreference/],
  ['(a(?=b))', '', /lookaround inside a group/],
  ['\\b[a-z]*\\b', '', /word boundary after a lookahead/],
  ['x', 'g', /the flag g/],
  ['a^b', '', /\^ somewhere other than the start/],
  ['\\p{L}', '', /Unicode property escape/],
]

const alphabet = [...'ab cdef0S"\\staf_x-:@9zZM\n']
const texts = ['']
let level = ['']
for (let length = 0; length < 3; length++) {
  level = level.flatMap((prefix) => alphabet.map((c) => prefix + c))
  texts.push(...level)
}
for (const word of [
  'staff',
  'Staff x',
  'xstaff',
  'staff_',
  'a 123 b',
  '1234',
  'abcdefg1',
  'ABCDEFG1',
  'abc defg1',
  'cdf',
  'abde',
  'foobarrx',
  'foobarx',
  '2024-11',
  'Bearer x',
  'bearer \n',
  'accc',
  'ABC t 1234',
  'M-000000',
  'S-AB0000',
  'a@b',
])
  for (const before of ['', ' ', 'x', '\n'])
    for (const after of ['', ' ', 'x', '\n']) texts.push(before + word + after)

for (const [pattern, flags] of accepted)
  test(`/${pattern}/${flags} reads like JavaScript on ${texts.length} texts`, () => {
    const parsed = parseRegex(pattern, flags)
    assert.ok(!('error' in parsed), 'error' in parsed ? parsed.error : '')
    const restated = new RegExp(regexSource(parsed))
    const original = new RegExp(pattern, flags)
    assert.deepEqual(
      texts.filter((text) => restated.test(text) !== original.test(text)),
      [],
    )
  })

for (const [pattern, flags, reason] of rejected)
  test(`/${pattern}/${flags} is rejected by name`, () => {
    const parsed = parseRegex(pattern, flags)
    assert.ok('error' in parsed)
    assert.match(parsed.error, reason)
  })

test('a group between fixed-length parts is a slice', () => {
  const at = (pattern: string) => {
    const parsed = parseRegex(pattern, '')
    return 'error' in parsed ? undefined : parsed.captures
  }
  assert.deepEqual(at('^Bearer (.+)$'), [{ offset: 7, tail: 0 }])
  assert.deepEqual(at('^[A-Z]{3} (.+) [0-9]{4}$'), [{ offset: 4, tail: 5 }])
  assert.deepEqual(at('^(\\d{4})-(\\d{2})$'), [
    { offset: 0, tail: 3 },
    { offset: 5, tail: 0 },
  ])
  assert.equal(at('^(\\w+)@(\\w+)$'), undefined)
  assert.equal(at('Bearer (.+)'), undefined)
})
