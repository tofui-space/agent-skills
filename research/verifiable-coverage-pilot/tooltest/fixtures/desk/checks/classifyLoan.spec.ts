import type { LoanState } from '../app/renewal/types.ts'

export const requirement =
  'A loan is on time before its due day and due on that day. For seven days after, it is in grace. From the eighth day it is overdue.'

export function expected(dueOn: number, today: number): LoanState {
  if (today - dueOn > 7) return 'overdue'
  if (today - dueOn > 0) return 'inGrace'
  if (today - dueOn === 0) return 'dueToday'
  return 'onTime'
}
