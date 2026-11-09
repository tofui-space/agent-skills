import type { CurrentDay } from '../types.ts'

export function isCurrentDay(input: unknown): input is CurrentDay {
  return Number.isSafeInteger(input)
}
