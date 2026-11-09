import type { Outcome } from '../src/wiring/provider-request.ts'

export const requirement =
  'Denied is 403, written is 200, a version conflict is 409, an unavailable store is 503.'

export const expected: Record<Outcome, number> = {
  denied: 403,
  written: 200,
  conflict: 409,
  unavailable: 503,
}
