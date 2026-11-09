import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readShelfList } from '../src/adapters/shelf-list.ts'

test('reports text that is not JSON as malformed', () => {
  assert.deepEqual(readShelfList(JSON, '['), { kind: 'malformed' })
})
