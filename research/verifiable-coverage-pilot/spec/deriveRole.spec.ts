import type { Membership, Role } from '../src/types.ts'

export const requirement =
  'Tenant admins are reviewers. Members flagged as reviewers are reviewers; other members are owners. Non-members are visitors.'

export const rows: ReadonlyArray<{
  readonly input: readonly [Membership, boolean]
  readonly outcome: Role
}> = [
  { input: ['admin', false], outcome: 'reviewer' },
  { input: ['admin', true], outcome: 'reviewer' },
  { input: ['member', false], outcome: 'owner' },
  { input: ['member', true], outcome: 'reviewer' },
  { input: ['none', false], outcome: 'visitor' },
  { input: ['none', true], outcome: 'visitor' },
]
