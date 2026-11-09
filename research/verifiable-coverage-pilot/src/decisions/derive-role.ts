import type { Membership, Role } from '../types.ts'

export function deriveRole(
  membership: Membership,
  reviewerFlag: boolean,
): Role {
  if (membership === 'admin') return 'reviewer'
  if (membership === 'member' && reviewerFlag) return 'reviewer'
  if (membership === 'member') return 'owner'
  return 'visitor'
}
