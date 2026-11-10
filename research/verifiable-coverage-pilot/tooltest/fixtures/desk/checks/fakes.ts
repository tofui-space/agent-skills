import type { Loan, LoanCatalog } from '../app/renewal/loan-catalog.adapter.ts'
import type { DueDay, LibraryCard } from '../app/renewal/types.ts'

export const openLoan: Loan = { dueOn: 100 as DueDay }

export function recordingCatalog(
  failure: () => Error | undefined = () => undefined,
): { readonly db: LoanCatalog; readonly calls: Array<readonly [LibraryCard]> } {
  const calls: Array<readonly [LibraryCard]> = []
  const db: LoanCatalog = {
    loanFor: async (card) => {
      calls.push([card])
      const error = failure()
      if (error) throw error
      return openLoan
    },
  }
  return { db, calls }
}
