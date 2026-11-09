import {
  type Change,
  StoreUnavailable,
  VersionConflict,
  type WriteResult,
} from '../src/adapters/provider-store.ts'
import type { ProviderId, Version } from '../src/types.ts'
import { recordingDb } from './fakes.ts'

export const requirement =
  'A write that the database accepts is written. A write rejected for a stale version is a conflict. A write the store cannot reach is unavailable. Any other error propagates unchanged.'

export const args: readonly [ProviderId, Change, Version] = [
  'p-1' as ProviderId,
  { field: 'approved', value: true },
  7 as Version,
]

export const fake = recordingDb

export const provoke: Record<WriteResult, () => Error | undefined> = {
  written: () => undefined,
  conflict: () => new VersionConflict('version 7 is stale'),
  unavailable: () => new StoreUnavailable('connection reset'),
}

export const unnamed = () => new TypeError('db.update is not a function')
