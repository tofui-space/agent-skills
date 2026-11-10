import type {
  AccountState,
  Operation,
  Ownership,
  Plan,
  Role,
  Tenant,
} from '../types.ts'

export type AuthInput = {
  readonly role: Role
  readonly operation: Operation
  readonly accountState: AccountState
  readonly tenant: Tenant
  readonly ownership: Ownership
}

export function authorize(input: AuthInput): Plan {
  if (input.accountState !== 'active' || input.tenant !== 'sameTenant')
    return 'deny'
  if (input.role === 'reviewer' && input.operation === 'grantApproval')
    return 'setApproved'
  if (input.role === 'reviewer' && input.operation === 'revokeApproval')
    return 'clearApproved'
  if (
    input.role === 'owner' &&
    input.operation === 'editOrdinaryTag' &&
    input.ownership === 'ownsProvider'
  )
    return 'editTag'
  return 'deny'
}
