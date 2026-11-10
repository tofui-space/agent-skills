import type { AccountState } from '../src/types.ts'

export const requirement =
  'An account with five or more failed logins is suspended. A negative count means corrupt data and is treated as suspended.'

export const intervals: ReadonlyArray<{
  readonly min: number
  readonly max: number
  readonly outcome: AccountState
}> = [
  { min: Number.NEGATIVE_INFINITY, max: -1, outcome: 'suspended' },
  { min: 0, max: 4, outcome: 'active' },
  { min: 5, max: Number.POSITIVE_INFINITY, outcome: 'suspended' },
]
