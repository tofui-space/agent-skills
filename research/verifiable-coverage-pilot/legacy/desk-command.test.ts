import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDeskCommand } from '../src/adapters/desk-command.ts'
import { deskWords } from '../src/ports/desk-words.ts'

test('reads a renewal command', () => {
  assert.deepEqual(
    readDeskCommand(deskWords, ['--card', 'M-000001', '--renew']),
    { kind: 'command', words: { card: 'M-000001', renew: true } },
  )
})

test('refuses an option the desk does not know', () => {
  assert.deepEqual(readDeskCommand(deskWords, ['--shelf', 'QA']), {
    kind: 'undeclaredOption',
  })
})

test('refuses a stray word', () => {
  assert.deepEqual(readDeskCommand(deskWords, ['today']), {
    kind: 'strayWord',
  })
})

test('refuses a card option without its value', () => {
  assert.deepEqual(readDeskCommand(deskWords, ['--card']), {
    kind: 'misfitValue',
  })
})

test('refuses a value given to the renew switch', () => {
  assert.deepEqual(readDeskCommand(deskWords, ['--renew=yes']), {
    kind: 'misfitValue',
  })
})

test('survives any words', () => {
  assert.equal(typeof readDeskCommand(deskWords, ['--renew']).kind, 'string')
})

test('passes on a failure the desk does not name', () => {
  assert.throws(() => readDeskCommand(deskWords, [null as never]), TypeError)
})
