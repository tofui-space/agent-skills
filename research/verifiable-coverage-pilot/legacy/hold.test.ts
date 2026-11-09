import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findHold, NoHold } from '../src/adapters/hold-shelf.ts'

const nobody = {
  holdOn: async () => {
    throw new NoHold('nobody holds this copy')
  },
}

test('a copy nobody holds is free', async () => {
  assert.deepEqual(await findHold(nobody, 3 as never), { kind: 'free' })
})

test('a lookup answers', async () => {
  assert.ok(await findHold(nobody, 3 as never))
})
