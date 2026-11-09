import type { DueDay, LibraryCard } from './types.ts'

export type Loan = { readonly dueOn: DueDay }

export type LoanCatalog = {
  loanFor(card: LibraryCard): Promise<Loan>
}

export class NoOpenLoan extends Error {}

export class CatalogUnavailable extends Error {}

export type LoanLookup =
  | { readonly kind: 'found'; readonly loan: Loan }
  | { readonly kind: 'none' }
  | { readonly kind: 'unavailable' }

export async function findLoan(
  catalog: LoanCatalog,
  card: LibraryCard,
): Promise<LoanLookup> {
  try {
    const loan = await catalog.loanFor(card)
    return { kind: 'found', loan }
  } catch (error) {
    if (error instanceof NoOpenLoan) return { kind: 'none' }
    if (error instanceof CatalogUnavailable) return { kind: 'unavailable' }
    throw error
  }
}
