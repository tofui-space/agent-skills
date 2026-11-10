import type { CurrentDay } from '../types.ts'

export type RenewalForm = {
  readonly card: string
  readonly today: CurrentDay
}

export function isRenewalForm(input: unknown): input is RenewalForm {
  if (typeof input !== 'object' || input === null) return false
  if (!('card' in input) || !('today' in input)) return false
  return typeof input.card === 'string' && Number.isSafeInteger(input.today)
}
