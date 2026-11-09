import type { AccountState, FailedLoginCount } from '../types.ts'

export function classifyAccount(failedLogins: FailedLoginCount): AccountState {
  if (failedLogins < 0) return 'suspended'
  if (failedLogins >= 5) return 'suspended'
  return 'active'
}
