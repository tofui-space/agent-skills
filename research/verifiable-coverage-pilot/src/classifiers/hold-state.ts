import type { CurrentDay, HoldDay, HoldState } from '../types.ts'

export function classifyHold(
  holdUntil: HoldDay | undefined,
  today: CurrentDay,
): HoldState {
  if (holdUntil === undefined) return 'noHold'
  if (today <= holdUntil) return 'held'
  return 'released'
}
