import type {
  FailedLoginCount,
  ProviderId,
  TagText,
  Version,
} from '../src/types.ts'
import type { ProviderRequest } from '../src/wiring/provider-request.ts'
import { recordingDb } from './fakes.ts'

export const requirement =
  'A request is decided, executed and answered in one pass.'

const request: ProviderRequest = {
  membership: 'member',
  reviewerFlag: true,
  operation: 'revokeApproval',
  failedLogins: 4 as FailedLoginCount,
  tenant: 'sameTenant',
  ownership: 'doesNotOwn',
  providerId: 'p-9' as ProviderId,
  tag: 'unused' as TagText,
  version: 3 as Version,
}

export const expected = {
  status: 200,
  calls: [['p-9', { field: 'approved', value: false }, 3]],
}

export async function observe(
  handle: (
    req: ProviderRequest,
    deps: { db: ReturnType<typeof recordingDb>['db'] },
  ) => Promise<number>,
) {
  const { db, calls } = recordingDb()
  const status = await handle(request, { db })
  return { status, calls }
}
