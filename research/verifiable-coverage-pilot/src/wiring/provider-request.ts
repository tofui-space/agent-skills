import {
  type ProviderDb,
  type WriteResult,
  writeProvider,
} from '../adapters/provider-store.ts'
import { classifyAccount } from '../classifiers/account-state.ts'
import { authorize } from '../decisions/authorize.ts'
import { deriveRole } from '../decisions/derive-role.ts'
import type {
  FailedLoginCount,
  Membership,
  Operation,
  Ownership,
  Plan,
  ProviderId,
  TagText,
  Tenant,
  Version,
} from '../types.ts'

export type ProviderRequest = {
  readonly membership: Membership
  readonly reviewerFlag: boolean
  readonly operation: Operation
  readonly failedLogins: FailedLoginCount
  readonly tenant: Tenant
  readonly ownership: Ownership
  readonly providerId: ProviderId
  readonly tag: TagText
  readonly version: Version
}

export type Deps = { readonly db: ProviderDb }

export type Outcome = 'denied' | WriteResult

export const execute: Record<
  Plan,
  (deps: Deps, req: ProviderRequest) => Promise<Outcome>
> = {
  deny: async () => 'denied',
  setApproved: (deps, req) =>
    writeProvider(
      deps.db,
      req.providerId,
      { field: 'approved', value: true },
      req.version,
    ),
  clearApproved: (deps, req) =>
    writeProvider(
      deps.db,
      req.providerId,
      { field: 'approved', value: false },
      req.version,
    ),
  editTag: (deps, req) =>
    writeProvider(
      deps.db,
      req.providerId,
      { field: 'tag', value: req.tag },
      req.version,
    ),
}

export const statusOf: Record<Outcome, number> = {
  denied: 403,
  written: 200,
  conflict: 409,
  unavailable: 503,
}

export async function handleProviderRequest(
  req: ProviderRequest,
  deps: Deps,
): Promise<number> {
  const plan = authorize({
    role: deriveRole(req.membership, req.reviewerFlag),
    operation: req.operation,
    accountState: classifyAccount(req.failedLogins),
    tenant: req.tenant,
    ownership: req.ownership,
  })
  const outcome = await execute[plan](deps, req)
  return statusOf[outcome]
}
