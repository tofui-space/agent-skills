import type { Facts, FactsDecision } from '../src/decisions/approval-facts.ts'

export const requirement =
  'Approval occurs exactly for an active reviewer. Owners are denied. Missing facts are not found, and an unavailable source is retried.'

export const rows: ReadonlyArray<{
  readonly input: readonly [Facts]
  readonly outcome: FactsDecision
}> = [
  { input: [{ kind: 'missing' }], outcome: 'notFound' },
  { input: [{ kind: 'unavailable' }], outcome: 'retry' },
  {
    input: [{ kind: 'found', role: 'reviewer', account: 'active' }],
    outcome: 'approve',
  },
  {
    input: [{ kind: 'found', role: 'reviewer', account: 'suspended' }],
    outcome: 'deny',
  },
  {
    input: [{ kind: 'found', role: 'owner', account: 'active' }],
    outcome: 'deny',
  },
  {
    input: [{ kind: 'found', role: 'owner', account: 'suspended' }],
    outcome: 'deny',
  },
]
