import type { HoldState } from '../src/types.ts'

export const requirement =
  'A book without a hold date is not held. A hold lasts through its last day and is released the day after.'

export function expected(
  holdUntil: number | undefined,
  today: number,
): HoldState {
  if (holdUntil !== undefined && holdUntil - today >= 0) return 'held'
  return holdUntil === undefined ? 'noHold' : 'released'
}
