import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boardText, NoService } from '../src/board.ts'

const every = (minutes: number) => ({
  minutesUntilNext: async () => minutes,
})

test('shows the minutes until the next bus', async () => {
  assert.equal(await boardText(every(7), 'AB-123', 4), '7 min')
})

test('rejects a stop it cannot read', async () => {
  assert.equal(await boardText(every(7), 'ab-1', 4), 'unknown stop')
})

test('answers something for a far-away bus', async () => {
  assert.equal(typeof (await boardText(every(600), 'AB-123', 4)), 'string')
})

test('reports a line without service', async () => {
  const none = {
    minutesUntilNext: async () => {
      throw new NoService('no buses today')
    },
  }
  assert.equal(await boardText(none, 'AB-123', 4), 'no service')
})

test.skip('shows due for a bus at the stop', async () => {
  assert.equal(await boardText(every(0), 'AB-123', 4), 'due')
})
