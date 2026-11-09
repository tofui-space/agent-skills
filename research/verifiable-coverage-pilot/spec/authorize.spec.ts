import type { AuthInput } from '../src/decisions/authorize.ts'
import type { Plan } from '../src/types.ts'

export const requirement =
  'Active reviewers may grant or revoke provider approval within their tenant. Active owners may edit ordinary tags on their own provider within their tenant. Everything else is denied.'

export const otherwise: Plan = 'deny'

export const reviewedDomain = {
  role: ['owner', 'reviewer', 'visitor'],
  operation: ['editOrdinaryTag', 'grantApproval', 'revokeApproval'],
  accountState: ['active', 'suspended'],
  tenant: ['otherTenant', 'sameTenant'],
  ownership: ['doesNotOwn', 'ownsProvider'],
}

export const rows: ReadonlyArray<{
  readonly input: AuthInput
  readonly outcome: Plan
}> = [
  {
    input: {
      role: 'reviewer',
      operation: 'grantApproval',
      accountState: 'active',
      tenant: 'sameTenant',
      ownership: 'ownsProvider',
    },
    outcome: 'setApproved',
  },
  {
    input: {
      role: 'reviewer',
      operation: 'grantApproval',
      accountState: 'active',
      tenant: 'sameTenant',
      ownership: 'doesNotOwn',
    },
    outcome: 'setApproved',
  },
  {
    input: {
      role: 'reviewer',
      operation: 'revokeApproval',
      accountState: 'active',
      tenant: 'sameTenant',
      ownership: 'ownsProvider',
    },
    outcome: 'clearApproved',
  },
  {
    input: {
      role: 'reviewer',
      operation: 'revokeApproval',
      accountState: 'active',
      tenant: 'sameTenant',
      ownership: 'doesNotOwn',
    },
    outcome: 'clearApproved',
  },
  {
    input: {
      role: 'owner',
      operation: 'editOrdinaryTag',
      accountState: 'active',
      tenant: 'sameTenant',
      ownership: 'ownsProvider',
    },
    outcome: 'editTag',
  },
]
