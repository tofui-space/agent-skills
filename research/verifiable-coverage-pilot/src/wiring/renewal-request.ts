import {
  findLoan,
  type LoanCatalog,
  type LoanLookup,
} from '../adapters/loan-catalog.ts'
import { isCurrentDay } from '../classifiers/current-day.ts'
import { isLibraryCard } from '../classifiers/library-card.ts'
import { classifyLoan } from '../classifiers/loan-state.ts'
import type { LoanState } from '../types.ts'

export type RenewalRequest = {
  readonly card: string | undefined
  readonly today: unknown
}

export type RenewalDeps = { readonly catalog: LoanCatalog }

export const refusal: Record<'unreadableCard' | 'malformedDay', number> = {
  unreadableCard: 401,
  malformedDay: 400,
}

export const lookupFailure: Record<
  Exclude<LoanLookup['kind'], 'found'>,
  number
> = {
  none: 404,
  unavailable: 503,
}

export const renewal: Record<LoanState, number> = {
  onTime: 200,
  dueToday: 202,
  inGrace: 402,
  overdue: 403,
}

export async function handleRenewal(
  req: RenewalRequest,
  deps: RenewalDeps,
): Promise<number> {
  if (!isLibraryCard(req.card)) return refusal.unreadableCard
  if (!isCurrentDay(req.today)) return refusal.malformedDay
  const lookup = await findLoan(deps.catalog, req.card)
  if (lookup.kind !== 'found') return lookupFailure[lookup.kind]
  return renewal[classifyLoan(lookup.loan.dueOn, req.today)]
}
