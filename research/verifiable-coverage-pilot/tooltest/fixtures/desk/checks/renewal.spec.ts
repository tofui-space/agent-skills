import type { LoanState } from '../app/renewal/types.ts'

export const requirement =
  'A loan on time renews with 200 and one due today with 202. A loan in grace needs the fee first, 402. An overdue loan is refused, 403.'

export const expected: Record<LoanState, number> = {
  onTime: 200,
  dueToday: 202,
  inGrace: 402,
  overdue: 403,
}
