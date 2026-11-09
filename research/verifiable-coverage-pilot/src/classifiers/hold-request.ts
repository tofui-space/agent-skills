import type { CopyNumber } from '../types.ts'

export type HoldRequest = {
  readonly kind: 'hold'
  readonly book: { readonly copy: CopyNumber }
}

export function isHoldRequest(input: unknown): input is HoldRequest {
  if (typeof input !== 'object' || input === null) return false
  if (!('kind' in input) || input.kind !== 'hold') return false
  if (!('book' in input)) return false
  if (typeof input.book !== 'object' || input.book === null) return false
  return 'copy' in input.book && Number.isSafeInteger(input.book.copy)
}
