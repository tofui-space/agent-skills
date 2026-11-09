import type { Loan, LoanCatalog } from '../src/adapters/loan-catalog.ts'
import type { Change, ProviderDb } from '../src/adapters/provider-store.ts'
import type { DueDay, LibraryCard, ProviderId, Version } from '../src/types.ts'

export type Recorded = {
  readonly db: ProviderDb
  readonly calls: Array<readonly [ProviderId, Change, Version]>
}

export function recordingDb(
  failure: () => Error | undefined = () => undefined,
): Recorded {
  const calls: Array<readonly [ProviderId, Change, Version]> = []
  const db: ProviderDb = {
    update: async (providerId, change, expectedVersion) => {
      calls.push([providerId, change, expectedVersion])
      const error = failure()
      if (error) throw error
    },
  }
  return { db, calls }
}

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
