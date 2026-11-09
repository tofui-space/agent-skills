import {
  CatalogUnavailable,
  type LoanLookup,
  NoOpenLoan,
} from '../src/adapters/loan-catalog.ts'
import type { LibraryCard } from '../src/types.ts'
import { openLoan, recordingCatalog } from './fakes.ts'

export const requirement =
  'A card with an open loan gives that loan, unchanged. A card without one gives none. A catalog that cannot be reached gives unavailable. Any other error propagates unchanged.'

export const args: readonly [LibraryCard] = ['M-000001' as LibraryCard]

export const fake = recordingCatalog

export const provoke: Record<LoanLookup['kind'], () => Error | undefined> = {
  found: () => undefined,
  none: () => new NoOpenLoan('no loan on this card'),
  unavailable: () => new CatalogUnavailable('connection reset'),
}

export const expected: Record<LoanLookup['kind'], LoanLookup> = {
  found: { kind: 'found', loan: openLoan },
  none: { kind: 'none' },
  unavailable: { kind: 'unavailable' },
}

export const unnamed = () => new TypeError('catalog.loanFor is not a function')
