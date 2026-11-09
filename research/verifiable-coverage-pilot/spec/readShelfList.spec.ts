import type { ShelfListRead, TextParser } from '../src/adapters/shelf-list.ts'

export const requirement =
  'A shelf list that is JSON is read, whatever it holds. Text that is not JSON is malformed. Any other error propagates unchanged.'

export const port = { contract: 'node@24', member: 'JSON.parse' }

export const args: readonly [string] = ['["QA 76"]']

const parsed = ['QA 76']

export function fake(failure: () => Error | undefined): {
  readonly db: TextParser
  readonly calls: Array<readonly [string]>
} {
  const calls: Array<readonly [string]> = []
  const db: TextParser = {
    parse: (text) => {
      calls.push([text])
      const error = failure()
      if (error) throw error
      return parsed
    },
  }
  return { db, calls }
}

export const provoke: Record<ShelfListRead['kind'], () => Error | undefined> = {
  read: () => undefined,
  malformed: () => new SyntaxError('Unexpected end of JSON input'),
}

export const expected: Record<ShelfListRead['kind'], ShelfListRead> = {
  read: { kind: 'read', value: parsed },
  malformed: { kind: 'malformed' },
}

export const unnamed = () => new RangeError('Maximum call stack size exceeded')
