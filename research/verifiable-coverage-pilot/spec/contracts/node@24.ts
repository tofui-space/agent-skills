import assert from 'node:assert/strict'
import { parseArgs } from 'node:util'
import {
  isMisfitValue,
  isStrayWord,
  isUndeclaredOption,
} from '../../src/classifiers/parse-failure.ts'
import type { Contract } from '../../tools/contracts.ts'

export const reviewedAgainst = [
  'ECMAScript JSON.parse as shipped by Node.js 24: https://tc39.es/ecma262/#sec-json.parse',
  'util.parseArgs of Node.js 24: https://nodejs.org/docs/latest-v24.x/api/util.html#utilparseargsconfig',
]

export const contract: Contract = {
  package: 'node',
  version: '24',
  members: {
    'JSON.parse': {
      throws: [
        {
          error: SyntaxError,
          when: 'the text is not JSON',
          provoke: () => JSON.parse('[1,'),
        },
      ],
      ensures: [
        {
          claim:
            'an array in the text comes back as an array with the same elements',
          check: () => assert.deepEqual(JSON.parse('["a",2]'), ['a', 2]),
        },
        {
          claim:
            'a number too large for a double comes back as Infinity, not as an error',
          check: () =>
            assert.equal(JSON.parse('1e999'), Number.POSITIVE_INFINITY),
        },
      ],
    },
    parseArgs: {
      throws: [
        {
          error: isUndeclaredOption,
          when: 'a word names an option that is not declared, and strict is on',
          provoke: () => parseArgs({ args: ['--shelf'], options: {} }),
        },
        {
          error: isStrayWord,
          when: 'a word is no option, and allowPositionals is off',
          provoke: () => parseArgs({ args: ['today'], options: {} }),
        },
        {
          error: isMisfitValue,
          when: 'an option that takes a value has none, or a switch is given one',
          provoke: () =>
            parseArgs({
              args: ['--card'],
              options: { card: { type: 'string' } },
            }),
        },
      ],
      ensures: [
        {
          claim: 'an option that is not given is absent from the values',
          check: () => {
            const read = parseArgs({
              args: [],
              options: { card: { type: 'string' } },
            })
            assert.deepEqual({ ...read.values }, {})
            return read
          },
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
