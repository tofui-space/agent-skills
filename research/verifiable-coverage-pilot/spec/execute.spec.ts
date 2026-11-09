import type { Plan, ProviderId, TagText, Version } from '../src/types.ts'
import type {
  Outcome,
  ProviderRequest,
} from '../src/wiring/provider-request.ts'
import { recordingDb } from './fakes.ts'

const request: ProviderRequest = {
  membership: 'member',
  reviewerFlag: false,
  operation: 'editOrdinaryTag',
  failedLogins: 0 as ProviderRequest['failedLogins'],
  tenant: 'sameTenant',
  ownership: 'ownsProvider',
  providerId: 'p-1' as ProviderId,
  tag: 'organic' as TagText,
  version: 7 as Version,
}

export const requirement =
  'Each plan performs exactly its own write, and a denial writes nothing.'

export const expected: Record<Plan, unknown> = {
  deny: { outcome: 'denied', calls: [] },
  setApproved: {
    outcome: 'written',
    calls: [['p-1', { field: 'approved', value: true }, 7]],
  },
  clearApproved: {
    outcome: 'written',
    calls: [['p-1', { field: 'approved', value: false }, 7]],
  },
  editTag: {
    outcome: 'written',
    calls: [['p-1', { field: 'tag', value: 'organic' }, 7]],
  },
}

export async function observe(
  run: (
    deps: { db: ReturnType<typeof recordingDb>['db'] },
    req: ProviderRequest,
  ) => Promise<Outcome>,
) {
  const { db, calls } = recordingDb()
  const outcome = await run({ db }, request)
  return { outcome, calls }
}
