import {
  type HoldLookup,
  type HoldShelf,
  NoHold,
} from '../src/adapters/hold-shelf.ts'
import type { CopyNumber, HoldDay } from '../src/types.ts'

export const requirement =
  'A copy with a hold gives the last day of that hold, unchanged. A copy without one is free. Any other error propagates unchanged.'

export const args: readonly [CopyNumber] = [3 as CopyNumber]

const lastDay = 120 as HoldDay

export function fake(failure: () => Error | undefined): {
  readonly db: HoldShelf
  readonly calls: Array<readonly [CopyNumber]>
} {
  const calls: Array<readonly [CopyNumber]> = []
  const db: HoldShelf = {
    holdOn: async (copy) => {
      calls.push([copy])
      const error = failure()
      if (error) throw error
      return lastDay
    },
  }
  return { db, calls }
}

export const provoke: Record<HoldLookup['kind'], () => Error | undefined> = {
  held: () => undefined,
  free: () => new NoHold('nobody holds this copy'),
}

export const expected: Record<HoldLookup['kind'], HoldLookup> = {
  held: { kind: 'held', until: lastDay },
  free: { kind: 'free' },
}

export const unnamed = () => new TypeError('shelf.holdOn is not a function')
