import type { CurrentDay, DueDay, LoanState } from '../types.ts'

export function classifyLoan(dueOn: DueDay, today: CurrentDay): LoanState {
  if (today < dueOn) return 'onTime'
  if (today <= dueOn) return 'dueToday'
  if (today <= dueOn + 7) return 'inGrace'
  return 'overdue'
}
